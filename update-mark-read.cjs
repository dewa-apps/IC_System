const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  /const markAllNotificationsAsRead = async \(\) => \{\s+try \{\s+const unreadNotifs = notifications\.filter\(n => !n\.read\);\s+for \(const notif of unreadNotifs\) \{\s+await updateDoc\(doc\(db, 'notifications', notif\.id\), \{ read: true \}\);\s+\}\s+\} catch \(e\) \{\s+console\.error\("Failed to mark all notifications as read", e\);\s+\}\s+\};/g,
  `const markAllNotificationsAsRead = async () => {
    try {
      const unreadNotifs = notifications.filter(n => !n.read);
      if (unreadNotifs.length === 0) return;
      
      const batch = writeBatch(db);
      unreadNotifs.forEach(notif => {
        batch.update(doc(db, 'notifications', notif.id), { read: true });
      });
      await batch.commit();
    } catch (e) {
      console.error("Failed to mark all notifications as read", e);
    }
  };`
);

fs.writeFileSync('src/App.tsx', code);
