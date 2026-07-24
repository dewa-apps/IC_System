import fs from 'fs';
let content = fs.readFileSync('src/components/ChatWidget.tsx', 'utf8');

const fileInputHTML = `
                <label className="p-1.5 text-[var(--text-muted)] cursor-pointer hover:text-[var(--text-primary)] transition-colors">
                  <Paperclip className="w-4 h-4" />
                  <input type="file" className="hidden" onChange={handleFileUpload} accept=".txt,.csv,.json,.pdf,.doc,.docx" />
                </label>
                <input
                  type="text"
`;
content = content.replace('<input\n                  type="text"', fileInputHTML);

const uploadHandler = `
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Convert to base64
    const reader = new FileReader();
    reader.onload = async () => {
       const base64 = reader.result as string;
       const fileName = file.name;
       const mimeType = file.type || "text/plain";
       
       setMessages(prev => [...prev, { role: 'user', text: \`Mengunggah file \${fileName} untuk knowledge base...\` }]);
       setIsTyping(true);
       
       try {
          const res = await apiFetch("/api/upload-knowledge", {
             method: "POST",
             body: JSON.stringify({ fileName, mimeType, base64 })
          });
          const data = await res.json();
          if (data.success) {
             setMessages(prev => [...prev, { role: 'model', text: \`✅ Berhasil mengunggah file **\${fileName}** ke GDrive dan sinkronisasi ke Firebase knowledge base. Sekarang saya bisa membaca isinya!\` }]);
          } else {
             throw new Error(data.error || "Unknown error");
          }
       } catch (err: any) {
          setMessages(prev => [...prev, { role: 'model', text: \`❌ Gagal mengunggah file: \${err.message}\` }]);
       } finally {
          setIsTyping(false);
          if (e.target) e.target.value = ''; // reset
       }
    };
    reader.readAsDataURL(file);
  };

  const handleSend = async () => {
`;
content = content.replace("const handleSend = async () => {", uploadHandler);

fs.writeFileSync('src/components/ChatWidget.tsx', content);
