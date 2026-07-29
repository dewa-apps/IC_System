
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

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
     const { text } = req.body;
     
     const firebaseConfig = {
        apiKey: process.env.VITE_FIREBASE_API_KEY,
        authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.VITE_FIREBASE_APP_ID,
     };
     if (!firebaseConfig.apiKey) {
        throw new Error("Missing Firebase config in environment");
     }
     
     const firebaseApp = initializeApp(firebaseConfig);
     const db = getFirestore(firebaseApp, process.env.VITE_FIREBASE_DATABASE_ID || '(default)');

     const docRef = doc(db, "globals", "drive_knowledge_base");
     const docSnap = await getDoc(docRef);
     
     let manualData: any[] = [];
     if (docSnap.exists()) {
        manualData = docSnap.data()?.manualData || [];
     }
     
     manualData.push({ fileName: "Manual Knowledge " + new Date().toLocaleString(), content: text });
     
     await setDoc(docRef, { manualData, updatedAt: serverTimestamp() }, { merge: true });
     res.status(200).json({ success: true });
  } catch (e: any) {
     res.status(500).json({ error: e.message });
  }
}
