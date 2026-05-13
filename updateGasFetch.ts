import fs from 'fs';
const FILE_PATH = './src/apiInterceptor.ts';
let data = fs.readFileSync(FILE_PATH, 'utf8');
data = data.replace(/originalFetch\(gasUrl/g, 'apiFetch(gasUrl');
fs.writeFileSync(FILE_PATH, data);
console.log('Done');
