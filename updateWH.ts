import fs from 'fs';

const FILE_PATH = './src/components/DataListWarehouseView.tsx';
let data = fs.readFileSync(FILE_PATH, 'utf8');

const logActivityStr = `
  const logActivity = async (whId: string, action: string, details: string) => {
    const user = auth.currentUser;
    const userName = user?.displayName || user?.email || 'Unknown User';
    try {
      await addDoc(collection(db, 'activity_log'), {
        task_id: whId,
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
  data = data.replace('const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {', logActivityStr + '\n  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {');
  
  data = data.replace(
    `if (newFolderUrl) {
           fetchItemFiles(newFolderUrl);`,
    `if (newFolderUrl) {
           fetchItemFiles(newFolderUrl);
           await logActivity(activeItem.id, "Uploaded Warehouse File", \`Uploaded \${uploadedCount} file(s) to \${activeItem.name}\`);`
  );
  
  data = data.replace(
    `const handleDeleteFile = async (fileId: string) => {`,
    `const handleDeleteFile = async (fileId: string, fileName?: string) => {`
  );
  
  data = data.replace(
    `onClick={(e) => {
                                   e.preventDefault();
                                   e.stopPropagation();
                                   handleDeleteFile(file.id);
                                 }}`,
    `onClick={(e) => {
                                   e.preventDefault();
                                   e.stopPropagation();
                                   handleDeleteFile(file.id, file.name);
                                 }}`
  );
  
  data = data.replace(
    `if (res.ok) {
        toast.success('File deleted');`,
    `if (res.ok) {
        toast.success('File deleted');
        if (activeItem) await logActivity(activeItem.id, "Deleted Warehouse File", \`Deleted file \${fileName || fileId} from \${activeItem.name}\`);`
  );
  
  fs.writeFileSync(FILE_PATH, data);
  console.log('WarehouseView updated');
} else {
  console.log('WarehouseView already updated');
}
