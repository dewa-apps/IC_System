import { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

// Attempt to load the built-in config if available
let appletConfig: any = {};
try {
  appletConfig = JSON.parse(readFileSync(join(process.cwd(), 'firebase-applet-config.json'), 'utf-8'));
} catch (e) {
  // Ignore
}

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id || appletConfig.projectId
      });
    } else {
       // Fallback for Vercel/Glitch if no env variable is set (might fail locally)
       admin.initializeApp();
    }
  } catch (e) {
    console.error("Firebase Admin initialization error", e);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS (Allow any origin for the webhook if needed)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { secret, taskData } = req.body;
    
    // Simple secret check
    if (secret !== "SIRCLO_INVENTORY_SECRET_TASK") {
      return res.status(403).json({ error: "Unauthorized" });
    }

    if (!taskData) {
      return res.status(400).json({ error: "No taskData provided" });
    }

    let db: admin.firestore.Firestore;
    const dbId = process.env.FIREBASE_DATABASE_ID || process.env.VITE_FIREBASE_DATABASE_ID || appletConfig.firestoreDatabaseId;
    if (dbId && dbId !== '(default)') {
      db = getFirestore(undefined, dbId);
    } else {
      db = admin.firestore();
    }
    
    // Duplicate check based on email thread id
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
    
    // Also try to find the user in the database to map their name
    // authorId might be an email like "Name <email@domain.com>" or just "email@domain.com"
    try {
      let searchEmail = taskData.authorId || taskData.authorName || taskData.requestor;
      if (searchEmail.includes('<') && searchEmail.includes('>')) {
         const match = searchEmail.match(/<([^>]+)>/);
         if (match) searchEmail = match[1];
      }
      searchEmail = searchEmail.trim();
      
      const usersMatch = await db.collection("users")
        .where("email", "==", searchEmail)
        .limit(1)
        .get();
        
      if (!usersMatch.empty && usersMatch.docs[0].data().name) {
         authorName = usersMatch.docs[0].data().name;
      } else if ((taskData.authorId || "").includes('<')) {
         // Fallback to the name part of "Name <email>"
         const namePart = taskData.authorId.split('<')[0].trim();
         if (namePart) authorName = namePart.replace(/['"]/g, '');
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

    // Log activity
    try {
      await db.collection("activity_log").add({
        task_id: result.id,
        user: authorName,
        action: "Created task",
        details: `Title: ${taskData.title}`,
        created_at: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (logError) {
      console.error("Error creating activity log:", logError);
    }

    return res.status(200).json({ success: true, id: result.id });
  } catch (error) {
    console.error("Error creating task from webhook:", error);
    return res.status(500).json({ error: String(error) });
  }
}
