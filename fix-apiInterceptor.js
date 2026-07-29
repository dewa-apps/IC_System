import fs from 'fs';
let content = fs.readFileSync('src/apiInterceptor.ts', 'utf8');

const regex = /if \(url\.startsWith\('\/api\/gas-proxy'\) \|\| url\.startsWith\('\/api\/chat'\) \|\| url\.startsWith\('\/api\/webhooks'\)\) \{/;
const replacement = "  if (url.startsWith('/api/gas-proxy') || url.startsWith('/api/chat') || url.startsWith('/api/webhooks') || url.startsWith('/api/sync-drive') || url.startsWith('/api/upload-knowledge') || url.startsWith('/api/save-manual-knowledge')) {";

content = content.replace(regex, replacement);
fs.writeFileSync('src/apiInterceptor.ts', content);
