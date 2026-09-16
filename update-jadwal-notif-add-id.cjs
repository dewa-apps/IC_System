const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  /type: 'system',\n\s+link: '',\n\s+created_at: new Date\(\)\.toISOString\(\),\n\s+read: false/,
  "type: 'system',\n            link: '',\n            jadwal_id: j.id,\n            created_at: new Date().toISOString(),\n            read: false"
);

fs.writeFileSync('src/App.tsx', code);
