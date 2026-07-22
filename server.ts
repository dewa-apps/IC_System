import express from "express";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configStr = fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf-8');
const config = JSON.parse(configStr);
const firebaseApp = initializeApp(config);
const db = getFirestore(firebaseApp, config.firestoreDatabaseId);

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  app.use(cors({ origin: true }));
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Webhook endpoint to receive emails from Google Apps Script
  app.post(["/api/webhooks/email-task", "/IC_System/api/webhooks/email-task"], async (req, res) => {
    try {
      const { secret, taskData } = req.body;
      
      // Simple secret check (in a real app, use environment variables)
      if (secret !== "SIRCLO_INVENTORY_SECRET_TASK") {
        return res.status(403).json({ error: "Unauthorized" });
      }

      if (!taskData) {
        return res.status(400).json({ error: "No taskData provided" });
      }

      const db = getDb();

      // Find division based on requestor
      let division = "";
      if (taskData.requestor) {
        const pastTasks = await db.collection("tasks")
          .where("requestor", "==", taskData.requestor)
          .where("division", "!=", "")
          .limit(1)
          .get();
        if (!pastTasks.empty && pastTasks.docs[0].data().division) {
          division = pastTasks.docs[0].data().division;
        }
      }

      let authorName = taskData.authorName || taskData.authorId || taskData.requestor || "Unknown";
      
      try {
        let searchEmail = taskData.authorId || taskData.authorName || taskData.requestor;
        if (searchEmail && searchEmail.includes('<') && searchEmail.includes('>')) {
           const match = searchEmail.match(/<([^>]+)>/);
           if (match) searchEmail = match[1];
        }
        if (searchEmail) searchEmail = searchEmail.trim();
        
        if (searchEmail) {
          const usersMatch = await db.collection("users")
            .where("email", "==", searchEmail)
            .limit(1)
            .get();
            
          if (!usersMatch.empty && usersMatch.docs[0].data().name) {
             authorName = usersMatch.docs[0].data().name;
          } else if ((taskData.authorId || "").includes('<')) {
             const namePart = taskData.authorId.split('<')[0].trim();
             if (namePart) authorName = namePart.replace(/['"]/g, '');
          }
        }
      } catch (e) {
        console.error("Error finding user for authorName", e);
      }

      const debugInfo: any = { 
        received_parent_id: taskData.parent_task_id, 
        parent_id_type: typeof taskData.parent_task_id 
      };

      // Check if this task should be appended as a subtask to an existing task
      if (taskData.parent_task_id) {
        const parentId = String(taskData.parent_task_id).trim().toUpperCase();
        debugInfo.parsed_parent_id = parentId;
        
        try {
          const parentTasks = await db.collection("tasks")
            .where("display_id", "==", parentId)
            .limit(1)
            .get();
            
          debugInfo.is_parent_empty = parentTasks.empty;
            
          if (!parentTasks.empty) {
            const parentDoc = parentTasks.docs[0];
            const parentData = parentDoc.data();
            const existingSubtasks = parentData.subtasks || [];
            
            // Prevent duplicates by checking if subtask with same title exists
            const isDuplicate = existingSubtasks.some((st: any) => st.title === taskData.title);
            
            if (!isDuplicate) {
              const newSubtask = {
                id: Math.random().toString(36).substr(2, 9),
                title: taskData.title,
                completed: false,
                due_date: taskData.due_date || ''
              };
              
              await parentDoc.ref.update({
                subtasks: [...existingSubtasks, newSubtask],
                updated_at: serverTimestamp()
              });
              
              // Log activity for adding subtask
              try {
                await db.collection("activity_log").add({
                  task_id: parentDoc.id,
                  user: authorName,
                  action: "Added Subtask via Email",
                  details: `Title: ${newSubtask.title}`,
                  created_at: serverTimestamp()
                });
              } catch (logError) {
                console.error("Error creating activity log for subtask:", logError);
              }
            }
            
            return res.status(200).json({ success: true, message: "Added as subtask", id: parentDoc.id, debug: debugInfo });
          } else {
            // Jika tidak ditemukan, gagalkan secara tegas agar pengguna tahu!
            return res.status(200).json({ 
              success: false, 
              message: `Gagal: Parent task ${parentId} tidak ditemukan di database. Pastikan ID Task sudah benar.`,
              debug: debugInfo
            });
          }
        } catch (dbError: any) {
          return res.status(200).json({ 
              success: false, 
              message: `Error querying database for parent ${parentId}: ${dbError.message}`,
              debug: debugInfo
            });
        }
      }

      // Duplicate check based on email thread id or message id for main tasks
      if (taskData.email_thread_id) {
        const existingInfo = await db.collection("tasks")
          .where("email_thread_id", "==", taskData.email_thread_id)
          .limit(1)
          .get();
        if (!existingInfo.empty) {
          return res.status(200).json({ success: true, message: "Task already created for this email thread.", id: existingInfo.docs[0].id });
        }
      }

      // Generate sequence display_id
      const metadataRef = db.collection('metadata').doc('taskSequence');
      const newDisplayId = await db.runTransaction(async (transaction) => {
        const metadataDoc = await transaction.get(metadataRef);
        let currentMax = 0;
        if (metadataDoc.exists && metadataDoc.data()?.lastNumber) {
          currentMax = metadataDoc.data()?.lastNumber;
        }
        const nextNum = currentMax + 1;
        transaction.set(metadataRef, { lastNumber: nextNum }, { merge: true });
        return `IC-${String(nextNum).padStart(5, '0')}`;
      });

      // Create a task
      const result = await db.collection("tasks").add({
        ...taskData,
        authorName: authorName,
        division: division,
        display_id: newDisplayId,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });

      // Log activity
      try {
        await db.collection("activity_log").add({
          task_id: result.id,
          user: authorName,
          action: "Created task",
          details: `Title: ${taskData.title}`,
          created_at: serverTimestamp()
        });
      } catch (logError) {
        console.error("Error creating activity log:", logError);
      }

      return res.status(200).json({ success: true, id: result.id, is_new_task: true, debug: debugInfo });
    } catch (error) {
      console.error("Error creating task from webhook:", error);
      return res.status(500).json({ error: String(error) });
    }
  });

  // GAS proxy endpoint
  app.post(["/api/gas-proxy", "/IC_System/api/gas-proxy"], async (req, res) => {
    try {
      const gasUrl = "https://script.google.com/macros/s/AKfycbwlC8ARWAHK6CtkdtHeOpqDw6pIjEAV3jxTrtCabiTgX5kDqlcaPOiO9NCWVDQNvqOgsQ/exec";
      
      const payload = JSON.stringify(req.body);
      const response = await fetch(gasUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: payload,
        redirect: "follow"
      });

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
         const json = await response.json();
         return res.status(response.status).json(json);
      } else {
         const text = await response.text();
         console.error("GAS proxy returned non-JSON:", text.substring(0, 200)); // Log first 200 chars of HTML
         return res.status(500).json({ error: "Received non-JSON response from Google Apps Script", details: text.substring(0, 100) });
      }
    } catch (error: any) {
      console.error("GAS proxy failed", error);
      return res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/test-db", async (req, res) => {
    try {
      const configStr = fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf-8');
      const config = JSON.parse(configStr);
      
      let defaultWorks = false;
      let namedWorks = false;
      let defaultError = "";
      let namedError = "";

      try {
        const dbDefault = getFirestore(admin.app());
        await dbDefault.collection("globals").doc("test").set({a:1});
        defaultWorks = true;
      } catch (e: any) {
        defaultError = e.message;
      }

      try {
        const dbNamed = getFirestore(admin.app(), config.firestoreDatabaseId);
        await dbNamed.collection("globals").doc("test").set({a:1});
        namedWorks = true;
      } catch (e: any) {
        namedError = e.message;
      }
      
      res.json({ defaultWorks, defaultError, namedWorks, namedError, envDbId: process.env.FIREBASE_DATABASE_ID });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Sync Drive endpoint
  app.post(["/api/sync-drive", "/IC_System/api/sync-drive"], async (req, res) => {
    try {
      const gasUrl = "https://script.google.com/macros/s/AKfycbwlC8ARWAHK6CtkdtHeOpqDw6pIjEAV3jxTrtCabiTgX5kDqlcaPOiO9NCWVDQNvqOgsQ/exec";
      const payload = JSON.stringify({
        action: 'getDriveFolderText',
        folderId: '1fmZcQre4WqR6o-K5mJVwTtTgjiNX8MlM'
      });
      
      const response = await fetch(gasUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      });
      
      if (!response.ok) {
        throw new Error(`GAS returned ${response.status}`);
      }
      
      const resData = await response.json();
      if (resData.status === 'success') {
         await setDoc(doc(db, "globals", "drive_knowledge_base"), {
             data: resData.data,
             updatedAt: serverTimestamp()
         });
         res.json({ success: true, count: resData.data.length });
      } else {
         res.status(500).json({ error: resData.message || 'Unknown GAS error' });
      }
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // Chat endpoint
  app.post(["/api/chat", "/IC_System/api/chat"], async (req, res) => {
    try {
      const { message, history, contextData, currentUser } = req.body;
      const kiloApiKey = process.env.KILO_API_KEY;

      let cTasks = contextData.tasks || [];
      let cJadwal = contextData.jadwal || [];
      let cKlaim = contextData.klaim || [];
      let cLinks = contextData.links || [];
      let cWarehouse = contextData.warehouse || [];
      let cDrive = contextData.driveData || [];

      // Fetch Drive Knowledge Base from Firestore
      try {
        const driveDoc = await getDoc(doc(db, "globals", "drive_knowledge_base"));
        if (driveDoc.exists()) {
           cDrive = driveDoc.data()?.data || [];
        }
      } catch (err) {
        console.error("Failed to fetch drive data from firestore", err);
      }

      if (kiloApiKey) {
         cTasks = cTasks.slice(-30);
         cJadwal = cJadwal.slice(-30);
         cKlaim = cKlaim.slice(-30);
         cLinks = cLinks.slice(-30);
         cWarehouse = cWarehouse.slice(-30);
         cDrive = cDrive.slice(-5);
      }

      const systemPrompt = `You are an AI Assistant for the IC System application.
The user's email is: ${currentUser}. You can address them by their first name if appropriate.
You have access to the following application data. Please use this data to answer user questions factually.

Here is the data, represented as JSON arrays:
- Tasks: ${JSON.stringify(cTasks)}
- Jadwal: ${JSON.stringify(cJadwal)}
- Klaim: ${JSON.stringify(cKlaim)}
- Links: ${JSON.stringify(cLinks)}
- Warehouse: ${JSON.stringify(cWarehouse)}
- Drive Documents: ${JSON.stringify(cDrive)}

If the user asks a question about schedules (jadwal) this month, look at the Jadwal data.
If asked about tasks, look at the Tasks data.
If the user asks about knowledge base or manual docs, check the Drive Documents.
Be concise and helpful. Format your response in Markdown.`;

      if (kiloApiKey) {
        const { default: OpenAI } = await import("openai");
        const openai = new OpenAI({
          apiKey: kiloApiKey,
          baseURL: "https://api.kilo.ai/api/gateway"
        });

        const messages: any[] = [
          { role: 'system', content: systemPrompt }
        ];

        if (history && history.length > 0) {
          history.forEach((m: any) => {
            messages.push({
              role: m.role === 'model' ? 'assistant' : 'user',
              content: m.text
            });
          });
        }
        
        messages.push({
          role: 'user',
          content: message
        });

        const stream = await openai.chat.completions.create({
          model: "openrouter/free", // Kilo API model: kilo-auto/free
          messages: messages,
          temperature: 0.2,
          stream: true,
        });

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
             res.write(content);
          }
        }
        res.end();
        return;
      }
      
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      const chatOptions: any = {
        model: "gemini-2.5-flash",
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.2
        }
      };

      if (history && history.length > 0) {
        chatOptions.history = history.map((m: any) => ({
          role: m.role === 'model' ? 'model' : 'user',
          parts: [{ text: m.text }]
        }));
      }

      const chat = ai.chats.create(chatOptions);

      const response = await chat.sendMessageStream({ message });
      
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Transfer-Encoding', 'chunked');

      for await (const chunk of response) {
        if (chunk.text) {
          res.write(chunk.text);
        }
      }
      res.end();
    } catch (error: any) {
      console.error("Chat proxy failed", error);
      if (error.message?.includes('API_KEY_INVALID') || error.message?.includes('API key not valid')) {
         res.status(400).json({ error: "The GEMINI_API_KEY is invalid. Please get a valid API key from https://aistudio.google.com/." });
      } else if (error.message?.includes('429') || error.message?.includes('exceeded your current quota') || error.status === 429) {
         res.status(429).json({ error: "You have exceeded your Gemini API quota. Please check your plan (https://ai.google.dev/gemini-api/docs/rate-limits) or try again later." });
      } else {
         res.status(500).json({ error: error.message || 'Internal server error' });
      }
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
