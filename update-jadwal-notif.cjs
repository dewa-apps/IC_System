const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const insertionPoint = `  const markNotificationAsRead = async (id: string) => {`;

const newCode = `
  // Check for upcoming jadwal (H-1) and notify all users
  useEffect(() => {
    if (currentUserRole !== 'admin' || dataJadwal.length === 0 || users.length === 0) return;
    
    const checkUpcomingJadwal = async () => {
      const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
      const tomorrowStr = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000).toISOString().split('T')[0];
      
      const toNotify = dataJadwal.filter(j => j.date === tomorrowStr && !j.notified_h1);
      if (toNotify.length === 0) return;

      for (const j of toNotify) {
        const batch = writeBatch(db);
        
        users.forEach(user => {
          const notifRef = doc(collection(db, 'notifications'));
          batch.set(notifRef, {
            recipient: user.name,
            title: 'Jadwal H-1 Reminder',
            message: \`Jadwal \${j.display_id || ''} (\${j.type} - \${j.wh_name}) is scheduled for tomorrow (\${tomorrowStr}).\`,
            type: 'system',
            link: '',
            created_at: new Date().toISOString(),
            read: false
          });
        });
        
        batch.update(doc(db, 'data_list_jadwal', j.id), { notified_h1: true });
        
        try {
          await batch.commit();
        } catch (e) {
          console.error("Failed to send upcoming jadwal notifications", e);
        }
      }
    };
    
    checkUpcomingJadwal();
  }, [dataJadwal, currentUserRole, users]);

` + insertionPoint;

code = code.replace(insertionPoint, newCode);
fs.writeFileSync('src/App.tsx', code);
