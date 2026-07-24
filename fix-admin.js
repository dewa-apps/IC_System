import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf8');

// Replace admin usage with client usage in webhooks
content = content.replace(
  'const db = getDb();',
  '// use global db'
);

// We need to rewrite the db.collection usage to client SDK
