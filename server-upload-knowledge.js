import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf8');

const injection = `
  app.post(["/api/upload-knowledge", "/IC_System/api/upload-knowledge"], async (req, res) => {
    try {
      const { fileName, mimeType, base64 } = req.body;
      const gasUrl = "https://script.google.com/macros/s/AKfycbwlC8ARWAHK6CtkdtHeOpqDw6pIjEAV3jxTrtCabiTgX5kDqlcaPOiO9NCWVDQNvqOgsQ/exec";
      
      // Upload to Drive
      const uploadPayload = JSON.stringify({
        action: 'uploadKnowledgeFile',
        fileName,
        mimeType,
        base64
      });
      
      const uploadRes = await fetch(gasUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: uploadPayload
      });
      
      if (!uploadRes.ok) throw new Error("Failed to upload to Drive via GAS");
      const uploadData = await uploadRes.json();
      if (uploadData.status !== 'success') throw new Error(uploadData.message || "Unknown error during upload");

      // Now sync from Drive
      const syncPayload = JSON.stringify({
        action: 'getDriveFolderText',
        folderId: '1fmZcQre4WqR6o-K5mJVwTtTgjiNX8MlM'
      });
      const syncRes = await fetch(gasUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: syncPayload
      });
      if (!syncRes.ok) throw new Error("Failed to sync from Drive via GAS");
      const syncData = await syncRes.json();
      if (syncData.status === 'success') {
         await setDoc(doc(db, "globals", "drive_knowledge_base"), {
             data: syncData.data,
             updatedAt: serverTimestamp()
         }, { merge: true }); // use merge just in case
         res.json({ success: true, message: "File uploaded and synced successfully", count: syncData.data.length });
      } else {
         throw new Error(syncData.message || "Failed to sync");
      }
    } catch (e: any) {
      console.error("Upload Knowledge Error:", e);
      res.status(500).json({ error: e.message });
    }
  });
`;

content = content.replace("app.post([\"/api/sync-drive\", \"/IC_System/api/sync-drive\"], async (req, res) => {", injection + "\n  app.post([\"/api/sync-drive\", \"/IC_System/api/sync-drive\"], async (req, res) => {");

// Also add a way for chat to save manual knowledge to firebase
// We can intercept in the chat handler, OR we can add a new API /api/save-manual-knowledge
const manualKnowledgeInjection = `
  app.post(["/api/save-manual-knowledge", "/IC_System/api/save-manual-knowledge"], async (req, res) => {
    try {
       const { text } = req.body;
       const docRef = doc(db, "globals", "drive_knowledge_base");
       const docSnap = await getDoc(docRef);
       let data = [];
       if (docSnap.exists()) {
          data = docSnap.data()?.data || [];
       }
       data.push({ fileName: "Manual Knowledge " + new Date().toLocaleString(), content: text });
       
       await setDoc(docRef, { data, updatedAt: serverTimestamp() }, { merge: true });
       res.json({ success: true });
    } catch (e: any) {
       res.status(500).json({ error: e.message });
    }
  });
`;
content = content.replace("app.post([\"/api/chat\", \"/IC_System/api/chat\"], async (req, res) => {", manualKnowledgeInjection + "\n  app.post([\"/api/chat\", \"/IC_System/api/chat\"], async (req, res) => {");

fs.writeFileSync('server.ts', content);
