import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf-8');
const startIdx = code.indexOf('import express');
const endIdx = code.indexOf('const app = express();');
if (startIdx >= 0 && endIdx >= 0) {
  const newCode = `import express from "express";
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

`;
  code = code.substring(0, startIdx) + newCode + code.substring(endIdx);
  
  // also replace getDb().collection("globals").doc("drive_knowledge_base").set(...)
  // with setDoc(doc(db, "globals", "drive_knowledge_base"), ...)
  code = code.replace(/const db = getDb\(\);\s*await db\.collection\("globals"\)\.doc\("drive_knowledge_base"\)\.set\(\{([\s\S]*?)\}\);/g, `await setDoc(doc(db, "globals", "drive_knowledge_base"), {$1});`);
  
  // also replace driveDoc fetch logic
  code = code.replace(/const db = getDb\(\);\s*const driveDoc = await db\.collection\("globals"\)\.doc\("drive_knowledge_base"\)\.get\(\);/g, `const driveDoc = await getDoc(doc(db, "globals", "drive_knowledge_base"));`);
  
  // also replace admin.firestore.FieldValue.serverTimestamp() with serverTimestamp()
  code = code.replace(/admin\.firestore\.FieldValue\.serverTimestamp\(\)/g, `serverTimestamp()`);
  
  fs.writeFileSync('server.ts', code);
  console.log('Replaced correctly!');
} else {
  console.log('Failed to find indices', startIdx, endIdx);
}
