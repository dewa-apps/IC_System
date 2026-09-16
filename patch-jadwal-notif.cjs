const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// fix setCurrentView('jadwal') -> setCurrentView('data-list-jadwal')
code = code.replace(/setCurrentView\('jadwal'\);/g, "setCurrentView('data-list-jadwal');");

// add processedJadwalRef
const refInsertion = `  const dataListKlaimRef = React.useRef<DataListKlaimViewRef>(null);
  const processedJadwalRef = React.useRef<Set<string>>(new Set());`;
code = code.replace(/  const dataListKlaimRef = React\.useRef<DataListKlaimViewRef>\(null\);/, refInsertion);

// fix duplicate issue by checking and updating processedJadwalRef
const originalCheck = `      const toNotify = dataJadwal.filter(j => j.date === tomorrowStr && !j.notified_h1);
      if (toNotify.length === 0) return;

      for (const j of toNotify) {
        const batch = writeBatch(db);`;

const newCheck = `      const toNotify = dataJadwal.filter(j => j.date === tomorrowStr && !j.notified_h1 && !processedJadwalRef.current.has(j.id));
      if (toNotify.length === 0) return;

      for (const j of toNotify) {
        processedJadwalRef.current.add(j.id);
        const batch = writeBatch(db);`;

code = code.replace(originalCheck, newCheck);
fs.writeFileSync('src/App.tsx', code);
