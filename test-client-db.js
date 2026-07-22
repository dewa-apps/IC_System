import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf-8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  try {
    await setDoc(doc(db, "globals", "test-client"), {a: 1});
    console.log("Success with client SDK!");
  } catch (e) {
    console.error("Error with client SDK:", e.message);
  }
}
run();
