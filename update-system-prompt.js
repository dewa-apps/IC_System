import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf8');

const oldPrompt = 'Be concise and helpful. Format your response in Markdown.`;';
const newPrompt = `Be concise and helpful. Format your response in Markdown.
IMPORTANT: If the user asks you to save something as knowledge (e.g., "jadikan ini knowledge", "simpan ini sebagai referensi"), you MUST extract the knowledge they want to save and output this exact tag anywhere in your response:
[SAVE_KNOWLEDGE]the knowledge text to save[/SAVE_KNOWLEDGE]
The system will detect this tag and save it to the knowledge base automatically.\`;`;

content = content.replace(oldPrompt, newPrompt);
fs.writeFileSync('server.ts', content);
