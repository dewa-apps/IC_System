import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf8');

// Replace top imports to include necessary firestore functions
if (!content.includes('import { getFirestore, doc, setDoc, getDoc, serverTimestamp, collection, query, where, limit, getDocs, updateDoc, addDoc, runTransaction } from')) {
    content = content.replace(
        "import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';",
        "import { getFirestore, doc, setDoc, getDoc, serverTimestamp, collection, query, where, limit, getDocs, updateDoc, addDoc, runTransaction } from 'firebase/firestore';"
    );
}

// 1. Replace the entire webhook block
const webhookStart = '  // Webhook endpoint to receive emails from Google Apps Script\n  app.post(["/api/webhooks/email-task", "/IC_System/api/webhooks/email-task"], async (req, res) => {';
const webhookEndStr = '  // GAS proxy endpoint';
const beforeWebhook = content.substring(0, content.indexOf(webhookStart));
const afterWebhook = content.substring(content.indexOf(webhookEndStr));

const newWebhook = `  // Webhook endpoint to receive emails from Google Apps Script
  app.post(["/api/webhooks/email-task", "/IC_System/api/webhooks/email-task"], async (req, res) => {
    try {
      const { secret, taskData } = req.body;
      
      if (secret !== "SIRCLO_INVENTORY_SECRET_TASK") {
        return res.status(403).json({ error: "Unauthorized" });
      }
      if (!taskData) {
        return res.status(400).json({ error: "No taskData provided" });
      }

      let division = "";
      if (taskData.requestor) {
        const pastTasksQuery = query(collection(db, "tasks"), where("requestor", "==", taskData.requestor), where("division", "!=", ""), limit(1));
        const pastTasks = await getDocs(pastTasksQuery);
        if (!pastTasks.empty && pastTasks.docs[0].data().division) {
          division = pastTasks.docs[0].data().division;
        }
      }

      let authorName = taskData.authorName || taskData.authorId || taskData.requestor || "Unknown";
      
      try {
        let searchEmail = taskData.authorId || taskData.authorName || taskData.requestor;
        if (searchEmail && searchEmail.includes('<') && searchEmail.includes('>')) {
           const match = searchEmail.match(/<([^>]+)>/);
           if (match) searchEmail = match[1];
        }
        if (searchEmail) searchEmail = searchEmail.trim();
        
        if (searchEmail) {
          const usersMatchQuery = query(collection(db, "users"), where("email", "==", searchEmail), limit(1));
          const usersMatch = await getDocs(usersMatchQuery);
          if (!usersMatch.empty && usersMatch.docs[0].data().name) {
             authorName = usersMatch.docs[0].data().name;
          } else if ((taskData.authorId || "").includes('<')) {
             const namePart = taskData.authorId.split('<')[0].trim();
             if (namePart) authorName = namePart.replace(/['"]/g, '');
          }
        }
      } catch (e) {
        console.error("Error finding user for authorName", e);
      }

      const debugInfo: any = { 
        received_parent_id: taskData.parent_task_id, 
        parent_id_type: typeof taskData.parent_task_id 
      };

      if (taskData.parent_task_id) {
        const parentId = String(taskData.parent_task_id).trim().toUpperCase();
        debugInfo.parsed_parent_id = parentId;
        
        try {
          const parentTasksQuery = query(collection(db, "tasks"), where("display_id", "==", parentId), limit(1));
          const parentTasks = await getDocs(parentTasksQuery);
          debugInfo.is_parent_empty = parentTasks.empty;
          
          if (!parentTasks.empty) {
            const parentDoc = parentTasks.docs[0];
            const parentData = parentDoc.data();
            const existingSubtasks = parentData.subtasks || [];
            
            const isDuplicate = existingSubtasks.some((st: any) => st.title === taskData.title);
            
            if (!isDuplicate) {
              const newSubtask = {
                id: Math.random().toString(36).substr(2, 9),
                title: taskData.title,
                completed: false,
                due_date: taskData.due_date || ''
              };
              
              await updateDoc(doc(db, "tasks", parentDoc.id), {
                subtasks: [...existingSubtasks, newSubtask],
                updated_at: serverTimestamp()
              });

              try {
                await addDoc(collection(db, "activity_log"), {
                  task_id: parentDoc.id,
                  user: authorName,
                  action: "Added Subtask via Email",
                  details: \`Title: \${newSubtask.title}\`,
                  created_at: serverTimestamp()
                });
              } catch (logError) {
                console.error("Error creating activity log for subtask:", logError);
              }
            }
            return res.status(200).json({ success: true, message: "Added as subtask", id: parentDoc.id, debug: debugInfo });
          } else {
            return res.status(200).json({ 
              success: false, 
              message: \`Gagal: Parent task \${parentId} tidak ditemukan di database. Pastikan ID Task sudah benar.\`,
              debug: debugInfo
            });
          }
        } catch (dbError: any) {
          return res.status(200).json({ 
              success: false, 
              message: \`Error querying database for parent \${parentId}: \${dbError.message}\`,
              debug: debugInfo
            });
        }
      }

      if (taskData.email_thread_id) {
        const existingInfoQuery = query(collection(db, "tasks"), where("email_thread_id", "==", taskData.email_thread_id), limit(1));
        const existingInfo = await getDocs(existingInfoQuery);
        if (!existingInfo.empty) {
          return res.status(200).json({ success: true, message: "Task already created for this email thread.", id: existingInfo.docs[0].id });
        }
      }

      const metadataRef = doc(db, 'metadata', 'taskSequence');
      const newDisplayId = await runTransaction(db, async (transaction) => {
        const metadataDoc = await transaction.get(metadataRef);
        let currentMax = 0;
        if (metadataDoc.exists() && metadataDoc.data()?.lastNumber) {
          currentMax = metadataDoc.data()?.lastNumber;
        }
        const nextNum = currentMax + 1;
        transaction.set(metadataRef, { lastNumber: nextNum }, { merge: true });
        return \`IC-\${String(nextNum).padStart(5, '0')}\`;
      });

      const result = await addDoc(collection(db, "tasks"), {
        ...taskData,
        authorName: authorName,
        division: division,
        display_id: newDisplayId,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });

      try {
        await addDoc(collection(db, "activity_log"), {
          task_id: result.id,
          user: authorName,
          action: "Created task",
          details: \`Title: \${taskData.title}\`,
          created_at: serverTimestamp()
        });
      } catch (logError) {
        console.error("Error creating activity log:", logError);
      }

      return res.status(200).json({ success: true, id: result.id, is_new_task: true, debug: debugInfo });
    } catch (error) {
      console.error("Error creating task from webhook:", error);
      return res.status(500).json({ error: String(error) });
    }
  });

`;

content = beforeWebhook + newWebhook + afterWebhook;

// 2. Fix the `/api/test-db` block or just remove it.
const testDbStart = '  app.get("/api/test-db", async (req, res) => {';
const chatStart = '  app.post(["/api/upload-knowledge", "/IC_System/api/upload-knowledge"], async (req, res) => {';

if (content.includes(testDbStart)) {
  const beforeTest = content.substring(0, content.indexOf(testDbStart));
  const afterTest = content.substring(content.indexOf(chatStart));
  content = beforeTest + afterTest;
}

fs.writeFileSync('server.ts', content);
