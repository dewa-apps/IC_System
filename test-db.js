import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    initializeApp({
      credential: cert(serviceAccount)
    });
  } else {
    initializeApp();
  }
} catch (e) {
  console.log(e);
}
const db = getFirestore();

async function run() {
  const tasks = await db.collection('tasks').where('display_id', '==', 'IC-00452').get();
  console.log("Empty:", tasks.empty);
  if (!tasks.empty) {
     console.log(tasks.docs[0].data());
  }
}
run();
