import fs from 'fs';
let lines = fs.readFileSync('server.ts', 'utf8').split('\n');

// Delete lines 136, 137
// Line 136 is index 135
lines.splice(135, 2);

// Since we deleted 2 lines, previous line 144 is now 142
lines[141] = '            });';

// previous line 151 is now 149
lines[148] = '            });';

fs.writeFileSync('server.ts', lines.join('\n'));
