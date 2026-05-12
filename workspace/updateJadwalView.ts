import fs from 'fs';

const FILE_PATH = './src/components/DataListJadwalView.tsx';
let data = fs.readFileSync(FILE_PATH, 'utf8');

const logActivityStr = `
  const logActivity = async (jadwalId: string, action: string, details: string) => {
    const user = auth.currentUser;
    const userName = user?.displayName || user?.email || 'Unknown User';
    try {
      await addDoc(collection(db, 'activity_log'), {
        task_id: jadwalId,
        user: userName,
        action,
        details,
        created_at: serverTimestamp()
      });
    } catch (e) {
      console.error("Failed to log activity", e);
    }
  };
`;

if (!data.includes('logActivity')) {
  data = data.replace('const handleSave = async () => {', logActivityStr + '\n  const handleSave = async () => {');
  
  data = data.replace(
    'await updateDoc(doc(db, \'data_list_jadwal\', currentEditingJadwal.id), saveData);',
    'await updateDoc(doc(db, \'data_list_jadwal\', currentEditingJadwal.id), saveData);\n        await logActivity(currentEditingJadwal.id, "Updated Jadwal", `Updated Jadwal ${currentEditingJadwal.display_id || formData.wh_name}`);'
  );
  
  data = data.replace(
    `await addDoc(dbRef, {
          ...saveData,
          display_id: newDisplayId,
          created_at: serverTimestamp()
        });`,
    `const newDocRef = await addDoc(dbRef, {
          ...saveData,
          display_id: newDisplayId,
          created_at: serverTimestamp()
        });
        await logActivity(newDocRef.id, "Created Jadwal", \`Created Jadwal \${newDisplayId}\`);`
  );

  data = data.replace(
    'await deleteDoc(doc(db, \'data_list_jadwal\', currentId));',
    'await deleteDoc(doc(db, \'data_list_jadwal\', currentId));\n      await logActivity(currentId, "Deleted Jadwal", `Deleted Jadwal ${displayId}`);'
  );
  
  fs.writeFileSync(FILE_PATH, data);
  console.log('JadwalView updated');
} else {
  console.log('JadwalView already updated');
}
