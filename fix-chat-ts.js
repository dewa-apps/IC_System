import fs from 'fs';
let content = fs.readFileSync('api/chat.ts', 'utf8');
content = content.replace(
  'messages: messages,',
  'messages: messages as any,'
);
fs.writeFileSync('api/chat.ts', content);
