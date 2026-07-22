import admin from 'firebase-admin';
import fs from 'fs';
import { getFirestore } from 'firebase-admin/firestore';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf-8'));
admin.initializeApp({
  projectId: config.projectId
});

async function run() {
  try {
    const db = getFirestore(admin.app(), config.firestoreDatabaseId);
    await db.collection("globals").doc("drive_knowledge_base").set({
      data: ["test"],
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log("Success");
  } catch (e) {
    console.error(e);
  }
}
run();
