import fs from 'fs';
let content = fs.readFileSync('src/components/ChatWidget.tsx', 'utf8');

const importRegex = /import { (.*?) } from 'lucide-react';/;
content = content.replace(importRegex, "import { $1, Paperclip } from 'lucide-react';");

const oldWhileLoop = `      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const textChunk = decoder.decode(value, { stream: true });
        if (textChunk) {
          fullResponse += textChunk;
          setMessages(prev => {
            const newMsgs = [...prev];
            newMsgs[newMsgs.length - 1].text = fullResponse;
            return newMsgs;
          });
        }
      }`;

const newWhileLoop = `      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const textChunk = decoder.decode(value, { stream: true });
        if (textChunk) {
          fullResponse += textChunk;
          
          let displayResponse = fullResponse;
          // Hide the tag from UI while streaming
          displayResponse = displayResponse.replace(/\\[SAVE_KNOWLEDGE\\].*?(\\[\\/SAVE_KNOWLEDGE\\]|$)/gs, '*Menyimpan knowledge...*');
          
          setMessages(prev => {
            const newMsgs = [...prev];
            newMsgs[newMsgs.length - 1].text = displayResponse;
            return newMsgs;
          });
        }
      }
      
      // Process tag after stream finishes
      const tagMatch = fullResponse.match(/\\[SAVE_KNOWLEDGE\\](.*?)\\[\\/SAVE_KNOWLEDGE\\]/s);
      if (tagMatch && tagMatch[1]) {
         const knowledgeText = tagMatch[1].trim();
         try {
            const saveRes = await apiFetch("/api/save-manual-knowledge", {
               method: "POST",
               body: JSON.stringify({ text: knowledgeText })
            });
            const saveResData = await saveRes.json();
            if (saveResData.success) {
               let finalMsg = fullResponse.replace(/\\[SAVE_KNOWLEDGE\\].*?\\[\\/SAVE_KNOWLEDGE\\]/gs, '');
               finalMsg += "\\n\\n✅ *Knowledge berhasil disimpan ke sistem!*";
               setMessages(prev => {
                 const newMsgs = [...prev];
                 newMsgs[newMsgs.length - 1].text = finalMsg.trim();
                 return newMsgs;
               });
            }
         } catch (e) {
            console.error("Failed to save knowledge", e);
         }
      }`;

content = content.replace(oldWhileLoop, newWhileLoop);
fs.writeFileSync('src/components/ChatWidget.tsx', content);
