const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  /const performBackupToSheets = async \(\) => {/g,
  `const performBackupToSheets = async (target: 'all' | 'tasks' | 'links' | 'jadwal' | 'klaim' = 'all') => {`
);

fs.writeFileSync('src/App.tsx', code);
console.log('done2');
