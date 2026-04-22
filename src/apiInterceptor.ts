import { db, auth } from './firebase';
import { 
  collection, getDocs, getDoc, addDoc, updateDoc, deleteDoc, doc, 
  query, where, orderBy, limit, serverTimestamp, setDoc, arrayUnion, runTransaction, increment
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

const storage = getStorage();

const originalFetch = window.fetch;

// Helper to format Firestore document
export const formatDoc = (docSnapshot: any) => {
  const data = docSnapshot.data();
  return {
    id: docSnapshot.id,
    ...data,
    created_at: data.created_at?.toDate ? data.created_at.toDate().toISOString() : data.created_at,
    updated_at: data.updated_at?.toDate ? data.updated_at.toDate().toISOString() : data.updated_at,
  };
};

export const apiFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : (input instanceof Request ? input.url : input.toString());
  
  if (!url.startsWith('/api/')) {
    return originalFetch(input, init);
  }

  const method = init?.method || 'GET';
  const path = url.split('?')[0].replace('/api/', '');
  const segments = path.split('/');
  
  const user = auth.currentUser;
  const userName = user?.displayName || user?.email || 'Unknown User';
  const userId = user?.uid;

  const logActivity = async (taskId: string, action: string, details: string) => {
    if (!userId) return;
    return addDoc(collection(db, 'activity_log'), {
      task_id: taskId,
      user: userName,
      action,
      details,
      created_at: serverTimestamp()
    }).catch(e => console.error("Failed to log activity", e));
  };

  const updateDropdownMetadata = async (body: any) => {
    if (!userId) return;
    const updates: any = {};
    if (body.category) updates.categories = arrayUnion(body.category);
    if (body.brand) updates.brands = arrayUnion(body.brand);
    if (body.requestor) updates.requestors = arrayUnion(body.requestor);
    if (body.division) updates.divisions = arrayUnion(body.division);
    
    if (Object.keys(updates).length > 0) {
      return setDoc(doc(db, 'metadata', 'dropdowns'), updates, { merge: true }).catch(e => console.error("Failed to update dropdown metadata", e));
    }
  };

  const triggerAssignmentNotification = async (assignee: string, taskTitle: string, displayId: string, assignedBy: string) => {
    if (!assignee || assignee === assignedBy) return;
    
    const notificationPayload = {
      type: 'TASK_ASSIGNMENT',
      recipient: assignee,
      title: `New Task Assigned: ${displayId}`,
      message: `${assignedBy} assigned you to the task: "${taskTitle}"`,
      task_display_id: displayId,
      read: false,
      created_at: serverTimestamp()
    };
    
    // Store in Firestore for in-app notifications
    if (localStorage.getItem('notify_in_app') !== 'false') {
      try {
        await addDoc(collection(db, 'notifications'), notificationPayload);
      } catch (e) {
        console.error("Failed to save notification to Firestore", e);
      }
    }

    // Attempt to send email via Google Apps Script
    if (localStorage.getItem('notify_email') !== 'false') {
      try {
        // Find the assignee's email from the users collection
        const usersSnapshot = await getDocs(query(collection(db, 'users'), where('name', '==', assignee)));
        if (!usersSnapshot.empty) {
          const assigneeEmail = usersSnapshot.docs[0].data().email;
          
          // Use the same GAS URL used for attachments, assuming it handles action: 'sendEmail'
          // If the GAS script doesn't handle this yet, the user will need to update their Apps Script.
          const gasUrl = "https://script.google.com/macros/s/AKfycbwlC8ARWAHK6CtkdtHeOpqDw6pIjEAV3jxTrtCabiTgX5kDqlcaPOiO9NCWVDQNvqOgsQ/exec";
          
          const response = await originalFetch(gasUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'text/plain;charset=utf-8',
            },
            body: JSON.stringify({
              action: 'sendEmail',
              to: assigneeEmail,
              subject: `[IC Task Manager] New Task Assigned: ${displayId}`,
              body: `Hello ${assignee},\n\n${assignedBy} has assigned you to a new task.\n\nTask ID: ${displayId}\nTitle: ${taskTitle}\n\nPlease check the IC Task Manager for more details.\n\nBest regards,\nIC System`
            })
          });
          
          const resultText = await response.text();
          console.log(`Email notification sent to ${assigneeEmail}. GAS Response:`, resultText);
        } else {
          console.warn(`Could not find email for assignee: ${assignee}`);
        }
      } catch (e) {
        console.error("Failed to send email notification", e);
      }
    }
  };

  const triggerCommentNotification = async (taskId: string, commentContent: string, commentedBy: string) => {
    try {
      // 1. Get the task details (to know the assignee and displayId)
      const taskDoc = await getDoc(doc(db, 'tasks', taskId));
      if (!taskDoc.exists()) return;
      const taskData = taskDoc.data();
      const assignee = taskData.assignee;
      const displayId = taskData.display_id || taskId;
      const taskTitle = taskData.title;

      // 2. Get all comments for this task to find other commenters
      const commentsSnapshot = await getDocs(query(collection(db, 'comments'), where('task_id', '==', taskId)));
      const commenters = new Set<string>();
      commentsSnapshot.docs.forEach(doc => {
        const author = doc.data().author;
        if (author && author !== commentedBy) {
          commenters.add(author);
        }
      });

      // 3. Determine who needs to be notified
      const usersToNotify = new Set<string>(commenters);
      if (assignee && assignee !== commentedBy) {
        usersToNotify.add(assignee);
      }

      // 4. Send notifications to each user
      for (const user of usersToNotify) {
        const notificationPayload = {
          type: 'NEW_COMMENT',
          recipient: user,
          title: `New Comment on Task: ${displayId}`,
          message: `${commentedBy} commented: "${commentContent.substring(0, 50)}${commentContent.length > 50 ? '...' : ''}"`,
          task_display_id: displayId,
          read: false,
          created_at: serverTimestamp()
        };
        
        // Store in Firestore for in-app notifications
        if (localStorage.getItem('notify_in_app') !== 'false') {
          try {
            await addDoc(collection(db, 'notifications'), notificationPayload);
          } catch (e) {
            console.error("Failed to save notification to Firestore", e);
          }
        }

        // Attempt to send email
        if (localStorage.getItem('notify_email') !== 'false') {
          try {
            const usersSnapshot = await getDocs(query(collection(db, 'users'), where('name', '==', user)));
            if (!usersSnapshot.empty) {
              const userEmail = usersSnapshot.docs[0].data().email;
              const gasUrl = "https://script.google.com/macros/s/AKfycbwlC8ARWAHK6CtkdtHeOpqDw6pIjEAV3jxTrtCabiTgX5kDqlcaPOiO9NCWVDQNvqOgsQ/exec";
              
              const response = await originalFetch(gasUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'text/plain;charset=utf-8',
                },
                body: JSON.stringify({
                  action: 'sendEmail',
                  to: userEmail,
                  subject: `[IC Task Manager] New Comment on Task: ${displayId}`,
                  body: `Hello ${user},\n\n${commentedBy} added a new comment to task "${taskTitle}" (ID: ${displayId}).\n\nComment:\n"${commentContent}"\n\nPlease check the IC Task Manager for more details.\n\nBest regards,\nIC System`
                })
              });
              
              const resultText = await response.text();
              console.log(`Email notification sent to ${userEmail}. GAS Response:`, resultText);
            }
          } catch (e) {
            console.error("Failed to send email notification", e);
          }
        }
      }
    } catch (e) {
      console.error("Failed to process comment notifications", e);
    }
  };

  const triggerTaskModificationNotification = async (
    authorName: string, 
    taskTitle: string, 
    displayId: string, 
    actionTaken: 'edited' | 'deleted', 
    actionBy: string
  ) => {
    if (!authorName || authorName === actionBy) return;
    
    const actionText = actionTaken === 'deleted' ? 'deleted' : 'updated';
    
    const notificationPayload = {
      type: 'TASK_MODIFICATION',
      recipient: authorName,
      title: `Task ${displayId} was ${actionText}`,
      message: `${actionBy} has ${actionText} your task: "${taskTitle}"`,
      task_display_id: displayId,
      read: false,
      created_at: serverTimestamp()
    };
    
    if (localStorage.getItem('notify_in_app') !== 'false') {
      try {
        await addDoc(collection(db, 'notifications'), notificationPayload);
      } catch (e) {
        console.error("Failed to save notification to Firestore", e);
      }
    }

    if (localStorage.getItem('notify_email') !== 'false') {
      try {
        const usersSnapshot = await getDocs(query(collection(db, 'users'), where('name', '==', authorName)));
        if (!usersSnapshot.empty) {
          const authorEmail = usersSnapshot.docs[0].data().email;
          const gasUrl = "https://script.google.com/macros/s/AKfycbwlC8ARWAHK6CtkdtHeOpqDw6pIjEAV3jxTrtCabiTgX5kDqlcaPOiO9NCWVDQNvqOgsQ/exec";
          
          const response = await originalFetch(gasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              action: 'sendEmail',
              to: authorEmail,
              subject: `[IC Task Manager] Task ${displayId} ${actionText}`,
              body: `Hello ${authorName},\n\n${actionBy} has ${actionText} the task you created.\n\nTask ID: ${displayId}\nTitle: ${taskTitle}\n\nPlease check the IC Task Manager for more details (if applicable).\n\nBest regards,\nIC System`
            })
          });
          
          const resultText = await response.text();
          console.log(`Email notification sent to ${authorEmail}. GAS Response:`, resultText);
        }
      } catch (e) {
        console.error("Failed to send email notification", e);
      }
    }
  };

  const triggerMentionNotification = async (
    text: string,
    actionBy: string,
    taskTitle: string,
    displayId: string,
    sourceType: 'task' | 'comment'
  ) => {
    if (!text) return;
    
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      if (usersSnapshot.empty) return;
      
      const allUsers = usersSnapshot.docs.map(doc => doc.data());
      
      const mentionedUsers = allUsers.filter(u => u.name && text.includes(`@${u.name}`) && u.name !== actionBy);
      
      for (const user of mentionedUsers) {
        const notificationPayload = {
          type: 'MENTION',
          recipient: user.name,
          title: `You were mentioned in a ${sourceType === 'task' ? 'task' : 'comment'}`,
          message: `${actionBy} mentioned you in ${displayId} ("${taskTitle}")`,
          task_display_id: displayId,
          read: false,
          created_at: serverTimestamp()
        };
        
        if (localStorage.getItem('notify_in_app') !== 'false') {
          try {
            await addDoc(collection(db, 'notifications'), notificationPayload);
          } catch (e) {
            console.error("Failed to save mention notification to Firestore", e);
          }
        }

        if (localStorage.getItem('notify_email') !== 'false') {
          try {
            const gasUrl = "https://script.google.com/macros/s/AKfycbwlC8ARWAHK6CtkdtHeOpqDw6pIjEAV3jxTrtCabiTgX5kDqlcaPOiO9NCWVDQNvqOgsQ/exec";
            
            const response = await originalFetch(gasUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain;charset=utf-8' },
              body: JSON.stringify({
                action: 'sendEmail',
                to: user.email,
                subject: `[IC Task Manager] You were mentioned in Task ${displayId}`,
                body: `Hello ${user.name},\n\n${actionBy} mentioned you in a ${sourceType === 'task' ? 'task description' : 'comment'} for Task ${displayId} ("${taskTitle}").\n\nPlease check the IC Task Manager for more details.\n\nBest regards,\nIC System`
              })
            });
            
            const resultText = await response.text();
            console.log(`Mention email notification sent to ${user.email}. GAS Response:`, resultText);
          } catch (e) {
            console.error("Failed to send mention email notification", e);
          }
        }
      }
    } catch (e) {
      console.error("Failed to process mention notifications", e);
    }
  };

  try {
    // --- METADATA ---
    if (path === 'metadata/dropdowns' && method === 'GET') {
      const docRef = doc(db, 'metadata', 'dropdowns');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return new Response(JSON.stringify(docSnap.data()), { status: 200 });
      } else {
        // Auto-migrate from existing tasks if metadata doesn't exist
        const q = query(collection(db, 'tasks'));
        const snapshot = await getDocs(q);
        const categories = new Set<string>();
        const brands = new Set<string>();
        const requestors = new Set<string>();
        const divisions = new Set<string>();
        
        snapshot.docs.forEach(taskDoc => {
          const data = taskDoc.data();
          if (data.category) categories.add(data.category);
          if (data.brand) brands.add(data.brand);
          if (data.requestor) requestors.add(data.requestor);
          if (data.division) divisions.add(data.division);
        });
        
        const initialData = {
          categories: Array.from(categories),
          brands: Array.from(brands),
          requestors: Array.from(requestors),
          divisions: Array.from(divisions)
        };
        
        if (initialData.categories.length > 0 || initialData.brands.length > 0 || initialData.requestors.length > 0 || initialData.divisions.length > 0) {
          try {
            await setDoc(docRef, initialData);
          } catch (e) {
            console.error("Failed to save initial metadata", e);
          }
        }
        
        return new Response(JSON.stringify(initialData), { status: 200 });
      }
    }

    // --- USERS ---
    if (path === 'users' && method === 'GET') {
      const q = query(collection(db, 'users'), orderBy('name', 'asc'));
      const snapshot = await getDocs(q);
      const users = snapshot.docs.map(formatDoc);
      return new Response(JSON.stringify(users), { status: 200 });
    }

    if (path === 'users' && method === 'POST') {
      if (!userId) throw new Error("Unauthorized");
      const body = JSON.parse(init?.body as string);
      
      // Check if current user is admin
      const currentUserDoc = await getDoc(doc(db, 'users', auth.currentUser?.email || ''));
      const isAdmin = currentUserDoc.exists() && currentUserDoc.data().role === 'admin';
      
      if (!isAdmin) {
        // Allow first user to be admin if no users exist
        const usersSnapshot = await getDocs(collection(db, 'users'));
        if (usersSnapshot.empty) {
          // First user, allow them to be admin
        } else if (body.email === auth.currentUser?.email && body.role === 'user') {
          // Allow users to sync themselves as regular users
        } else {
          return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
        }
      }

      const docRef = doc(db, 'users', body.email);
      await setDoc(docRef, {
        name: body.name,
        email: body.email,
        role: body.role || 'user',
        created_at: serverTimestamp()
      });
      const newDoc = await getDoc(docRef);
      return new Response(JSON.stringify(formatDoc(newDoc)), { status: 201 });
    }

    if (segments[0] === 'users' && segments.length === 2 && method === 'PUT') {
      if (!userId) throw new Error("Unauthorized");
      const targetUserId = segments[1];
      const body = JSON.parse(init?.body as string);
      
      const currentUserDoc = await getDoc(doc(db, 'users', auth.currentUser?.email || ''));
      if (!currentUserDoc.exists() || currentUserDoc.data().role !== 'admin') {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
      }

      if (body.email !== targetUserId) {
        const oldDoc = await getDoc(doc(db, 'users', targetUserId));
        const newDocRef = doc(db, 'users', body.email);
        await setDoc(newDocRef, {
          name: body.name,
          email: body.email,
          role: body.role,
          created_at: oldDoc.exists() ? oldDoc.data().created_at : serverTimestamp()
        });
        await deleteDoc(doc(db, 'users', targetUserId));
        const updatedDoc = await getDoc(newDocRef);
        return new Response(JSON.stringify(formatDoc(updatedDoc)), { status: 200 });
      } else {
        const docRef = doc(db, 'users', targetUserId);
        await updateDoc(docRef, {
          name: body.name,
          email: body.email,
          role: body.role
        });
        const updatedDoc = await getDoc(docRef);
        return new Response(JSON.stringify(formatDoc(updatedDoc)), { status: 200 });
      }
    }

    if (segments[0] === 'users' && segments.length === 2 && method === 'DELETE') {
      if (!userId) throw new Error("Unauthorized");
      const targetUserId = segments[1];
      
      const currentUserDoc = await getDoc(doc(db, 'users', auth.currentUser?.email || ''));
      if (!currentUserDoc.exists() || currentUserDoc.data().role !== 'admin') {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
      }

      await deleteDoc(doc(db, 'users', targetUserId));
      return new Response(null, { status: 204 });
    }

    // --- TASKS ---
    if (path.startsWith('tasks') && method === 'GET' && segments[0] === 'tasks' && segments.length === 1) {
      if (!userId) return new Response('[]', { status: 200 });
      
      const urlObj = new URL(url, window.location.origin);
      const limitParam = urlObj.searchParams.get('limit');
      const limitVal = limitParam ? parseInt(limitParam, 10) : 5000;

      const q = query(collection(db, 'tasks'), orderBy('created_at', 'desc'), limit(limitVal));
      const snapshot = await getDocs(q);
      const tasks = snapshot.docs.map(formatDoc);
      
      // Background migration for old tasks missing counts + immediately return counts
      const tasksWithCounts = await Promise.all(tasks.map(async (t) => {
        if (t.comment_count === undefined || t.attachment_count === undefined) {
           const commentSnap = await getDocs(query(collection(db, 'comments'), where('task_id', '==', t.id)));
           const attachmentSnap = await getDocs(query(collection(db, 'attachments'), where('task_id', '==', t.id)));
           
           const newCounts = {
             comment_count: commentSnap.size,
             attachment_count: attachmentSnap.size
           };

           // Fire and forget update
           updateDoc(doc(db, 'tasks', t.id), newCounts).catch(e => console.error(e));
           
           return { ...t, ...newCounts };
        }
        return t;
      }));

      return new Response(JSON.stringify(tasksWithCounts), { status: 200 });
    }
    
    if (path === 'tasks' && method === 'POST') {
      if (!userId) throw new Error("Unauthorized");
      const body = JSON.parse(init?.body as string);
      
      // Use Firestore transaction for safe sequential ID generation
      const dbInstance = db;
      
      const newDocId = doc(collection(dbInstance, 'tasks')).id;
      const taskRef = doc(dbInstance, 'tasks', newDocId);
      const metadataRef = doc(dbInstance, 'metadata', 'taskSequence');

      let nextNum = 1;
      let generatedDisplayId = '';

      await runTransaction(dbInstance, async (transaction) => {
        const metadataDoc = await transaction.get(metadataRef);
        
        let currentMax = metadataDoc.exists() ? metadataDoc.data().lastNumber : 0;
        
        // If task_number is provided in the import payload, we use it.
        let parsedTaskNumber = body.task_number ? parseInt(body.task_number, 10) : null;
        
        if (!parsedTaskNumber && body.display_id) {
           const match = body.display_id.match(/IC-(\d+)/);
           if (match && match[1]) {
             parsedTaskNumber = parseInt(match[1], 10);
           }
        }
        
        if (parsedTaskNumber && !isNaN(parsedTaskNumber)) {
          nextNum = parsedTaskNumber;
          // Update the sequence only if the imported number is higher
          if (nextNum > currentMax) {
            transaction.set(metadataRef, { lastNumber: nextNum }, { merge: true });
          }
        } else {
          nextNum = currentMax + 1;
          transaction.set(metadataRef, { lastNumber: nextNum }, { merge: true });
        }
        
        generatedDisplayId = `IC-${String(nextNum).padStart(5, '0')}`;
        
        const finalDisplayId = body.display_id || generatedDisplayId;
        const finalAuthorId = body.authorId || userId;
        const finalAuthorName = body.authorName || userName;
        
        let finalCreatedAt: any = serverTimestamp();
        if (body.created_at) {
          const dt = new Date(body.created_at);
          if (!isNaN(dt.getTime())) {
            finalCreatedAt = dt;
          }
        }

        transaction.set(taskRef, {
          ...body,
          authorId: finalAuthorId,
          authorName: finalAuthorName,
          task_number: nextNum,
          display_id: finalDisplayId,
          created_at: finalCreatedAt,
          updated_at: serverTimestamp()
        });
      });
      
      // Run side-effects in background without awaiting them to speed up response
      Promise.all([
        logActivity(newDocId, "Created task", `Title: ${body.title}`),
        updateDropdownMetadata(body),
        body.assignee ? triggerAssignmentNotification(body.assignee, body.title, body.display_id || generatedDisplayId, userName) : Promise.resolve(),
        body.description ? triggerMentionNotification(body.description, userName, body.title, body.display_id || generatedDisplayId, 'task') : Promise.resolve()
      ]).catch(err => console.error("Error in task creation side-effects:", err));
      
      const newDoc = await getDoc(taskRef);
      return new Response(JSON.stringify(formatDoc(newDoc)), { status: 201 });
    }

    if (segments[0] === 'tasks' && segments.length === 2) {
      const taskId = segments[1];
      const taskRef = doc(db, 'tasks', taskId);
      
      if (method === 'PATCH') {
        const body = JSON.parse(init?.body as string);
        
        const oldDoc = await getDoc(taskRef);
        const oldData = oldDoc.exists() ? oldDoc.data() : null;
        
        const updatePayload: any = {
          ...body,
          updated_at: serverTimestamp()
        };

        // Don't overwrite immutable fields during PATCH unless explicitly necessary
        if ('created_at' in updatePayload) {
          delete updatePayload.created_at; 
        }
        if ('authorId' in updatePayload) {
          delete updatePayload.authorId;
        }

        await updateDoc(taskRef, updatePayload);
        
        // Background tasks
        const bgTasks: Promise<any>[] = [
          logActivity(taskId, "Updated task", "Task details updated"),
          updateDropdownMetadata(body)
        ];
        
        if (oldData) {
          const displayId = oldData.display_id || `IC-${taskId}`;
          const taskTitle = body.title || oldData.title;

          if (body.assignee && oldData.assignee !== body.assignee) {
            bgTasks.push(triggerAssignmentNotification(body.assignee, taskTitle, displayId, userName));
          }

          // Trigger modification notification to the author
          if (oldData.authorName && oldData.authorName !== userName) {
            bgTasks.push(triggerTaskModificationNotification(oldData.authorName, taskTitle, displayId, 'edited', userName));
          }

          // Trigger mention notification if description was changed
          if (body.description && body.description !== oldData.description) {
            bgTasks.push(triggerMentionNotification(body.description, userName, taskTitle, displayId, 'task'));
          }
          
          // RECURRING TASKS LOGIC
          if (body.status && ['DONE', 'CLOSED'].includes(body.status) && oldData.status !== body.status) {
            const recurringPattern = body.recurring_pattern || oldData.recurring_pattern;
            if (recurringPattern && recurringPattern !== 'none' && !oldData.recurring_spawned) {
              const spawnRecurringTask = async () => {
                const nextDate = new Date(body.due_date || oldData.due_date || new Date());
                if (recurringPattern === 'daily') nextDate.setDate(nextDate.getDate() + 1);
                else if (recurringPattern === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
                else if (recurringPattern === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
                
                const nextDateStr = nextDate.toISOString().split('T')[0];

                const dbInstance = db;
                const newDocId = doc(collection(dbInstance, 'tasks')).id;
                const newTaskRef = doc(dbInstance, 'tasks', newDocId);
                const metadataRef = doc(dbInstance, 'metadata', 'taskSequence');

                await runTransaction(dbInstance, async (transaction) => {
                  const metadataDoc = await transaction.get(metadataRef);
                  let nextNum = 1;
                  if (!metadataDoc.exists()) {
                    transaction.set(metadataRef, { lastNumber: 1 });
                  } else {
                    nextNum = metadataDoc.data().lastNumber + 1;
                    transaction.update(metadataRef, { lastNumber: nextNum });
                  }
                  
                  const newDisplayId = `IC-${String(nextNum).padStart(5, '0')}`;
                  
                  // Make sure we carry over fields safely
                  const mergedData = { ...oldData, ...body };
                  // We do NOT copy subtasks fully completed. Or maybe we shouldn't copy subtasks here out of simplicity.
                  // Just copy core info.
                  transaction.set(newTaskRef, {
                    title: mergedData.title,
                    description: mergedData.description || '',
                    status: 'TODO',
                    priority: mergedData.priority,
                    assignee: mergedData.assignee || '',
                    request_date: new Date().toISOString().split('T')[0],
                    due_date: nextDateStr,
                    category: mergedData.category || '',
                    brand: mergedData.brand || '',
                    requestor: mergedData.requestor || '',
                    division: mergedData.division || '',
                    recurring_pattern: recurringPattern,
                    
                    authorId: mergedData.authorId || userId,
                    authorName: mergedData.authorName || userName,
                    task_number: nextNum,
                    display_id: newDisplayId,
                    created_at: serverTimestamp(),
                    updated_at: serverTimestamp()
                  });
                  // Mark the old one as spawned
                  transaction.update(taskRef, { recurring_spawned: true });
                });
                console.log("Spawned recurring task");
              };
              bgTasks.push(spawnRecurringTask());
            }
          }
        }
        
        Promise.all(bgTasks).catch(err => console.error("Error in task update side effects", err));
        
        const updatedDoc = await getDoc(taskRef);
        return new Response(JSON.stringify(formatDoc(updatedDoc)), { status: 200 });
      }
      
      if (method === 'DELETE') {
        const taskDoc = await getDoc(taskRef);
        if (taskDoc.exists()) {
          const taskData = taskDoc.data();
          const displayId = taskData.display_id || `IC-${taskId}`;
          if (taskData.authorName && taskData.authorName !== userName) {
            triggerTaskModificationNotification(taskData.authorName, taskData.title, displayId, 'deleted', userName).catch(err => console.error(err));
          }
        }
        await deleteDoc(taskRef);
        return new Response(null, { status: 204 });
      }
    }

    // --- COMMENTS ---
    if (segments[0] === 'tasks' && segments[2] === 'comments' && method === 'GET') {
      const taskId = segments[1];
      const q = query(collection(db, 'comments'), where('task_id', '==', taskId), orderBy('created_at', 'asc'));
      const snapshot = await getDocs(q);
      return new Response(JSON.stringify(snapshot.docs.map(formatDoc)), { status: 200 });
    }

    if (segments[0] === 'tasks' && segments[2] === 'comments' && method === 'POST') {
      const taskId = segments[1];
      const body = JSON.parse(init?.body as string);
      const docRef = await addDoc(collection(db, 'comments'), {
        task_id: taskId,
        author: userName,
        content: body.content,
        created_at: serverTimestamp()
      });
      
      // Fetch task directly since we need title and ID for mention notification
      getDoc(doc(db, 'tasks', taskId)).then((taskDoc) => {
        const taskData = taskDoc.exists() ? taskDoc.data() : null;
        const taskTitle = taskData?.title || 'Unknown Task';
        const displayId = taskData?.display_id || `IC-${taskId}`;
        
        // Run side-effects
        Promise.all([
          logActivity(taskId, "Added comment", body.content.substring(0, 50)),
          triggerCommentNotification(taskId, body.content, userName),
          triggerMentionNotification(body.content, userName, taskTitle, displayId, 'comment'),
          updateDoc(doc(db, 'tasks', taskId), { comment_count: increment(1) })
        ]).catch(err => console.error("Error in comment side effects", err));
      });
      
      const newDoc = await getDoc(docRef);
      return new Response(JSON.stringify(formatDoc(newDoc)), { status: 201 });
    }

    if (segments[0] === 'comments' && segments.length === 2) {
      const commentId = segments[1];
      const commentRef = doc(db, 'comments', commentId);
      
      const commentDoc = await getDoc(commentRef);
      if (!commentDoc.exists()) {
        return new Response("Comment not found", { status: 404 });
      }

      // Check permissions
      // We assume userName is available from the scope outside
      const isAuthor = commentDoc.data().author === userName;
      
      let isAdmin = false;
      if (userId) {
        // Try to get user role
        // Since email is not explicitly available as a clean variable here without fetching, 
        // we'll fetch based on uid/email or just do a generic check if they are author. 
        // We will fetch the user doc to get the role if possible.
        // Actually userName could be mapped back, but email is safer. 
        try {
           const currentUserDoc = await getDoc(doc(db, 'users', auth.currentUser?.email || ''));
           if (currentUserDoc.exists() && currentUserDoc.data().role === 'admin') {
             isAdmin = true;
           }
        } catch (e) {
           console.error("Error checking user role", e);
        }
      }

      if (!isAuthor) {
        return new Response("Forbidden: You can only modify your own comments", { status: 403 });
      }
      
      if (method === 'DELETE') {
        const taskId = commentDoc.data().task_id;
        // Run log in background
        Promise.all([
          logActivity(taskId, "Deleted comment", "Comment deleted"),
          updateDoc(doc(db, 'tasks', taskId), { comment_count: increment(-1) })
        ]).catch(e => console.error(e));
        await deleteDoc(commentRef);
        return new Response(null, { status: 204 });
      }
      
      if (method === 'PUT') {
        const body = JSON.parse(init?.body as string);
        await updateDoc(commentRef, {
          content: body.content,
          updated_at: serverTimestamp()
        });
        
        const updatedDoc = await getDoc(commentRef);
        // Run log in background
        logActivity(updatedDoc.data()?.task_id, "Edited comment", "Comment edited").catch(e => console.error(e));
        
        return new Response(JSON.stringify(formatDoc(updatedDoc)), { status: 200 });
      }
    }

    // --- ACTIVITIES ---
    if (segments[0] === 'tasks' && segments[2] === 'activities' && method === 'GET') {
      const taskId = segments[1];
      const q = query(collection(db, 'activity_log'), where('task_id', '==', taskId), orderBy('created_at', 'desc'));
      const snapshot = await getDocs(q);
      return new Response(JSON.stringify(snapshot.docs.map(formatDoc)), { status: 200 });
    }

    // --- TASK LINKS ---
    if (segments[0] === 'tasks' && segments[2] === 'links' && method === 'GET') {
      const taskId = segments[1];
      
      // Fetch where current task is source
      const qSource = query(collection(db, 'task_links'), where('source_task_id', '==', taskId));
      const sourceSnapshot = await getDocs(qSource);
      
      // Fetch where current task is target
      const qTarget = query(collection(db, 'task_links'), where('target_task_id', '==', taskId));
      const targetSnapshot = await getDocs(qTarget);
      
      // Merge results, avoiding duplicates (though there shouldn't be any)
      const allDocs = [...sourceSnapshot.docs, ...targetSnapshot.docs];
      const uniqueDocs = Array.from(new Map(allDocs.map(doc => [doc.id, doc])).values());
      
      // Fetch target task details
      const links = await Promise.all(uniqueDocs.map(async (linkDoc) => {
        const linkData = formatDoc(linkDoc);
        
        const isCurrentTaskTarget = linkData.target_task_id === taskId;
        const otherTaskId = isCurrentTaskTarget ? linkData.source_task_id : linkData.target_task_id;
        
        const targetDoc = await getDoc(doc(db, 'tasks', otherTaskId));
        if (targetDoc.exists()) {
          linkData.target_task_title = targetDoc.data().title;
          linkData.target_task_status = targetDoc.data().status;
          linkData.target_task_display_id = targetDoc.data().display_id;
          
          if (isCurrentTaskTarget) {
            linkData.target_task_id = linkData.source_task_id;
            if (linkData.link_type === 'blocks') linkData.link_type = 'is_blocked_by';
            else if (linkData.link_type === 'is_blocked_by') linkData.link_type = 'blocks';
            else if (linkData.link_type === 'duplicates') linkData.link_type = 'is_duplicated_by';
            else if (linkData.link_type === 'is_duplicated_by') linkData.link_type = 'duplicates';
          }
        }
        return linkData;
      }));
      
      return new Response(JSON.stringify(links), { status: 200 });
    }

    if (path === 'task-links' && method === 'POST') {
      const body = JSON.parse(init?.body as string);
      const docRef = await addDoc(collection(db, 'task_links'), {
        ...body,
        created_at: serverTimestamp()
      });
      
      let targetDisplayId = body.target_task_id;
      
      // Let's background the fetch and log
      getDoc(doc(db, 'tasks', body.target_task_id)).then(targetDoc => {
        if (targetDoc.exists()) {
           const targetData = targetDoc.data();
           const displayId = targetData.display_id || `IC-${targetDoc.id}`;
           logActivity(body.source_task_id, "Linked task", `Linked to Task #${displayId}`);
        } else {
           logActivity(body.source_task_id, "Linked task", `Linked to Task #${body.target_task_id}`);
        }
      }).catch(e => console.error("Failed to fetch target task for activity log", e));

      const newDoc = await getDoc(docRef);
      return new Response(JSON.stringify(formatDoc(newDoc)), { status: 201 });
    }

    if (segments[0] === 'task-links' && segments.length === 2 && method === 'DELETE') {
      const linkId = segments[1];
      try {
        const linkDoc = await getDoc(doc(db, 'task_links', linkId));
        if (linkDoc.exists()) {
          const linkData = linkDoc.data();
          
          // Background the log fetch
          getDoc(doc(db, 'tasks', linkData.target_task_id)).then(targetDoc => {
             const displayId = targetDoc.exists() ? (targetDoc.data().display_id || `IC-${targetDoc.id}`) : linkData.target_task_id;
             logActivity(linkData.source_task_id, "Removed link", `Removed link to Task #${displayId}`);
          }).catch(e => console.error(e));
        }
      } catch (e) {
        console.error("Failed to log link removal", e);
      }
      await deleteDoc(doc(db, 'task_links', linkId));
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    // --- TEMPLATES ---
    if (path === 'templates' && method === 'GET') {
      if (!userId) return new Response('[]', { status: 200 });
      const q = query(collection(db, 'templates'), where('authorId', '==', userId));
      const snapshot = await getDocs(q);
      return new Response(JSON.stringify(snapshot.docs.map(formatDoc)), { status: 200 });
    }

    if (path === 'templates' && method === 'POST') {
      if (!userId) throw new Error("Unauthorized");
      const body = JSON.parse(init?.body as string);
      const docRef = await addDoc(collection(db, 'templates'), {
        ...body,
        authorId: userId,
        created_at: serverTimestamp()
      });
      const newDoc = await getDoc(docRef);
      return new Response(JSON.stringify(formatDoc(newDoc)), { status: 201 });
    }

    if (segments[0] === 'templates' && segments.length === 2 && method === 'DELETE') {
      await deleteDoc(doc(db, 'templates', segments[1]));
      return new Response(null, { status: 204 });
    }

    // --- ATTACHMENTS ---
    if (segments[0] === 'tasks' && segments[2] === 'attachments' && method === 'GET') {
      const taskId = segments[1];
      const q = query(collection(db, 'attachments'), where('task_id', '==', taskId), orderBy('created_at', 'desc'));
      const snapshot = await getDocs(q);
      return new Response(JSON.stringify(snapshot.docs.map(formatDoc)), { status: 200 });
    }

    if (segments[0] === 'tasks' && segments[2] === 'attachments' && method === 'POST') {
      const taskId = segments[1];
      const formData = init?.body as FormData;
      const file = formData.get('file') as File;
      
      if (!file) return new Response(JSON.stringify({ error: "No file" }), { status: 400 });

      // Convert file to base64
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = error => reject(error);
      });

      // Send to Google Apps Script
      const gasUrl = "https://script.google.com/macros/s/AKfycbwlC8ARWAHK6CtkdtHeOpqDw6pIjEAV3jxTrtCabiTgX5kDqlcaPOiO9NCWVDQNvqOgsQ/exec";
      const gasResponse = await originalFetch(gasUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({
          base64: base64Data,
          fileName: file.name,
          mimeType: file.type
        })
      });

      const gasResult = await gasResponse.json();

      if (gasResult.status !== 'success') {
        throw new Error(gasResult.message || "Failed to upload to Google Drive");
      }

      const downloadURL = gasResult.fileUrl;
      const fileId = gasResult.fileId;

      const docRef = await addDoc(collection(db, 'attachments'), {
        task_id: taskId,
        filename: fileId, // Store fileId instead of storage path
        original_name: file.name,
        mime_type: file.type,
        size: file.size,
        url: downloadURL,
        created_at: serverTimestamp()
      });

      Promise.all([
        logActivity(taskId, "Uploaded attachment", file.name),
        updateDoc(doc(db, 'tasks', taskId), { attachment_count: increment(1) })
      ]).catch(e => console.error(e));
      
      const newDoc = await getDoc(docRef);
      return new Response(JSON.stringify(formatDoc(newDoc)), { status: 201 });
    }

    if (segments[0] === 'attachments' && segments[2] === 'download' && method === 'GET') {
      const attachmentId = segments[1];
      const attachmentDoc = await getDoc(doc(db, 'attachments', attachmentId));
      if (attachmentDoc.exists()) {
        // Handled by frontend window.open(attachment.url)
      }
    }

    if (segments[0] === 'attachments' && segments.length === 2 && method === 'DELETE') {
      const attachmentId = segments[1];
      const attachmentDoc = await getDoc(doc(db, 'attachments', attachmentId));
      if (attachmentDoc.exists()) {
        const data = attachmentDoc.data();
        await deleteDoc(doc(db, 'attachments', attachmentId));
        Promise.all([
          logActivity(data.task_id, "Deleted attachment", data.original_name),
          updateDoc(doc(db, 'tasks', data.task_id), { attachment_count: increment(-1) })
        ]).catch(e => console.error(e));
      }
      return new Response(null, { status: 204 });
    }

    console.warn(`Unhandled API request: ${method} ${url}`);
    return new Response(JSON.stringify({ error: "Not implemented in Firebase interceptor" }), { status: 404 });
    
  } catch (error: any) {
    console.error(`Firebase Interceptor Error (${method} ${url}):`, error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};
