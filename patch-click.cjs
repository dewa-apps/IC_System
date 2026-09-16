const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const original = `                                if (notif.task_display_id) {
                                  const targetTask = tasks.find(t => t.display_id === notif.task_display_id || \`IC-\${t.id}\` === notif.task_display_id);
                                  if (targetTask) {
                                    setCurrentView('tasks');
                                    openModal(targetTask);
                                  }
                                }`;

const replacement = `                                if (notif.task_display_id) {
                                  const targetTask = tasks.find(t => t.display_id === notif.task_display_id || \`IC-\${t.id}\` === notif.task_display_id);
                                  if (targetTask) {
                                    setCurrentView('tasks');
                                    openModal(targetTask);
                                  }
                                } else if (notif.jadwal_id) {
                                  const targetJadwal = dataJadwal.find(j => j.id === notif.jadwal_id);
                                  if (targetJadwal) {
                                    setCurrentView('jadwal');
                                    setTimeout(() => {
                                      dataListJadwalRef.current?.openEditModal(targetJadwal);
                                    }, 100);
                                  }
                                }`;

code = code.replace(original, replacement);
fs.writeFileSync('src/App.tsx', code);
