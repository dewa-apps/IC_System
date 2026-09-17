const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const original = `            jadwal_id: j.id,
            created_at: new Date().toISOString(),
            read: false`;

const replacement = `            jadwal_id: j.id,
            created_at: new Date(),
            read: false`;

code = code.replace(original, replacement);
fs.writeFileSync('src/App.tsx', code);
