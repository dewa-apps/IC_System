
import { GoogleGenAI } from '@google/genai';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { message, history, contextData, currentUser } = req.body;
    const kiloApiKey = process.env.KILO_API_KEY;

    let cTasks = contextData.tasks || [];
    let cJadwal = contextData.jadwal || [];
    let cKlaim = contextData.klaim || [];
    let cLinks = contextData.links || [];
    let cWarehouse = contextData.warehouse || [];
    let cDrive = contextData.driveData || [];

    // Try to fetch Drive Knowledge Base from Firestore using environment variables
    try {
      const firebaseConfig = {
        apiKey: process.env.VITE_FIREBASE_API_KEY,
        authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.VITE_FIREBASE_APP_ID,
      };
      
      if (firebaseConfig.apiKey) {
        const firebaseApp = initializeApp(firebaseConfig);
        const db = getFirestore(firebaseApp, process.env.VITE_FIREBASE_DATABASE_ID || '(default)');
        
        const driveDoc = await getDoc(doc(db, "globals", "drive_knowledge_base"));
        if (driveDoc.exists()) {
           const driveData = driveDoc.data()?.data || [];
           const manualData = driveDoc.data()?.manualData || [];
           cDrive = [...driveData, ...manualData];
        }
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

Be concise and helpful. Format your response in Markdown.

IMPORTANT: If the user asks you to save something as knowledge (e.g., "jadikan ini knowledge", "simpan ini sebagai referensi"), you MUST extract the knowledge they want to save and output this exact tag anywhere in your response:
[SAVE_KNOWLEDGE]
the knowledge text to save
[/SAVE_KNOWLEDGE]
The system will detect this tag and save it to the knowledge base automatically.`;

    if (kiloApiKey) {
      const { default: OpenAI } = await import("openai");
      const openai = new OpenAI({
        apiKey: kiloApiKey,
        baseURL: "https://api.kilo.ai/api/gateway"
      });

      const messages = [
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
        model: "openrouter/free", // Kilo API model
        messages: messages as any,
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

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Server misconfiguration: GEMINI_API_KEY is not set in Vercel environment variables.' });
    }

    const ai = new GoogleGenAI({ apiKey });
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
       res.status(400).json({ error: "The GEMINI_API_KEY configured in Vercel is invalid." });
    } else if (error.message?.includes('429') || error.message?.includes('exceeded your current quota') || error.status === 429) {
       res.status(429).json({ error: "You have exceeded your Gemini API quota." });
    } else {
       res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }
}
