import admin from 'firebase-admin';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf-8'));
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: config.projectId
});

async function run() {
  try {
    const { getFirestore } = require('firebase-admin/firestore');
    // Try to write to (default)
    const dbDefault = getFirestore(admin.app());
    await dbDefault.collection("globals").doc("test").set({a:1});
    console.log("Default DB exists and works.");
  } catch (e) {
    console.error("Default DB Error:", e.message);
  }

  try {
    const { getFirestore } = require('firebase-admin/firestore');
    const dbNamed = getFirestore(admin.app(), config.firestoreDatabaseId);
    await dbNamed.collection("globals").doc("test").set({a:1});
    console.log("Named DB exists and works.");
  } catch (e) {
    console.error("Named DB Error:", e.message);
  }
}
run();
