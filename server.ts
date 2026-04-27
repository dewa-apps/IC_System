import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import * as admin from 'firebase-admin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } else {
    admin.initializeApp();
  }
  console.log("Firebase Admin Initialized successfully.");
} catch (e) {
  console.log("Failed to initialize Firebase Admin:", e);
}

import fs from 'fs';

// Helper to get db instance with correct ID
let dbInstance: admin.firestore.Firestore | null = null;
function getDb() {
  if (!dbInstance) {
    try {
      const configStr = fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf-8');
      const config = JSON.parse(configStr);
      dbInstance = admin.firestore();
      
      const dbId = process.env.FIREBASE_DATABASE_ID || config.firestoreDatabaseId;
      if (dbId && dbId !== '(default)') {
        const { getFirestore } = require('firebase-admin/firestore');
        dbInstance = getFirestore(undefined, dbId);
      }
    } catch (e) {
      console.warn("Failed to load custom database ID from config, falling back to default.", e);
      const dbId = process.env.FIREBASE_DATABASE_ID;
      if (dbId && dbId !== '(default)') {
        const { getFirestore } = require('firebase-admin/firestore');
        dbInstance = getFirestore(undefined, dbId);
      } else {
        dbInstance = admin.firestore();
      }
    }
  }
  return dbInstance;
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Webhook endpoint to receive emails from Google Apps Script
  app.post("/api/webhooks/email-task", async (req, res) => {
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
      
      // Duplicate check based on email thread id or message id
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

      // Create a task
      const result = await db.collection("tasks").add({
        ...taskData,
        authorName: authorName,
        division: division,
        display_id: newDisplayId,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      return res.status(200).json({ success: true, id: result.id });
    } catch (error) {
      console.error("Error creating task from webhook:", error);
      return res.status(500).json({ error: String(error) });
    }
  });

  // GAS proxy endpoint
  app.post("/api/gas-proxy", async (req, res) => {
    try {
      const gasUrl = "https://script.google.com/macros/s/AKfycbwlC8ARWAHK6CtkdtHeOpqDw6pIjEAV3jxTrtCabiTgX5kDqlcaPOiO9NCWVDQNvqOgsQ/exec";
      
      const payload = JSON.stringify(req.body);
      const response = await fetch(gasUrl, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: payload
      });

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
         const json = await response.json();
         return res.status(response.status).json(json);
      } else {
         const text = await response.text();
         return res.status(response.status).send(text);
      }
    } catch (error: any) {
      console.error("GAS proxy failed", error);
      return res.status(500).json({ error: error.message });
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
