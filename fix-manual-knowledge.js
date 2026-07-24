import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(
  /let data = \[\];[\s\S]*?await setDoc\(docRef, \{ data, updatedAt: serverTimestamp\(\) \}, \{ merge: true \}\);/,
  `let manualData = [];
       if (docSnap.exists()) {
          manualData = docSnap.data()?.manualData || [];
       }
       manualData.push({ fileName: "Manual Knowledge " + new Date().toLocaleString(), content: text });
       
       await setDoc(docRef, { manualData, updatedAt: serverTimestamp() }, { merge: true });`
);

content = content.replace(
  /cDrive = driveDoc\.data\(\)\?\.data \|\| \[\];/,
  `const driveData = driveDoc.data()?.data || [];
           const manualData = driveDoc.data()?.manualData || [];
           cDrive = [...driveData, ...manualData];`
);

fs.writeFileSync('server.ts', content);
