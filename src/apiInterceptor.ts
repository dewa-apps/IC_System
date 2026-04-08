import { db, auth } from './firebase';
import { 
  collection, getDocs, getDoc, addDoc, updateDoc, deleteDoc, doc, 
  query, where, orderBy, limit, serverTimestamp, setDoc, arrayUnion
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

const storage = getStorage();

const originalFetch = window.fetch;

// Helper to format Firestore document
const formatDoc = (docSnapshot: any) => {
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
    await addDoc(collection(db, 'activity_log'), {
      task_id: taskId,
      user: userName,
      action,
      details,
      created_at: serverTimestamp()
    });
  };

  const updateDropdownMetadata = async (body: any) => {
    if (!userId) return;
    const updates: any = {};
    if (body.category) updates.categories = arrayUnion(body.category);
    if (body.brand) updates.brands = arrayUnion(body.brand);
    if (body.requestor) updates.requestors = arrayUnion(body.requestor);
    if (body.division) updates.divisions = arrayUnion(body.division);
    
    if (Object.keys(updates).length > 0) {
      try {
        await setDoc(doc(db, 'metadata', 'dropdowns'), updates, { merge: true });
      } catch (e) {
        console.error("Failed to update dropdown metadata", e);
      }
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
    if (path === 'tasks' && method === 'GET') {
      if (!userId) return new Response('[]', { status: 200 });
      const q = query(collection(db, 'tasks'), orderBy('created_at', 'desc'));
      const snapshot = await getDocs(q);
      const tasks = snapshot.docs.map(formatDoc);
      return new Response(JSON.stringify(tasks), { status: 200 });
    }
    
    if (path === 'tasks' && method === 'POST') {
      if (!userId) throw new Error("Unauthorized");
      const body = JSON.parse(init?.body as string);
      
      // Generate sequential ID
      const qLatest = query(collection(db, 'tasks'), orderBy('task_number', 'desc'), limit(1));
      const latestSnapshot = await getDocs(qLatest);
      let nextNum = 1;
      if (!latestSnapshot.empty) {
        const latestTask = latestSnapshot.docs[0].data();
        if (typeof latestTask.task_number === 'number') {
          nextNum = latestTask.task_number + 1;
        }
      }
      const displayId = `IC-${String(nextNum).padStart(5, '0')}`;

      const docRef = await addDoc(collection(db, 'tasks'), {
        ...body,
        authorId: userId,
        authorName: userName,
        task_number: nextNum,
        display_id: displayId,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });
      await logActivity(docRef.id, "Created task", `Title: ${body.title}`);
      await updateDropdownMetadata(body);
      const newDoc = await getDoc(docRef);
      return new Response(JSON.stringify(formatDoc(newDoc)), { status: 201 });
    }

    if (segments[0] === 'tasks' && segments.length === 2) {
      const taskId = segments[1];
      const taskRef = doc(db, 'tasks', taskId);
      
      if (method === 'PATCH') {
        const body = JSON.parse(init?.body as string);
        await updateDoc(taskRef, {
          ...body,
          updated_at: serverTimestamp()
        });
        await logActivity(taskId, "Updated task", "Task details updated");
        await updateDropdownMetadata(body);
        const updatedDoc = await getDoc(taskRef);
        return new Response(JSON.stringify(formatDoc(updatedDoc)), { status: 200 });
      }
      
      if (method === 'DELETE') {
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
      await logActivity(taskId, "Added comment", body.content.substring(0, 50));
      const newDoc = await getDoc(docRef);
      return new Response(JSON.stringify(formatDoc(newDoc)), { status: 201 });
    }

    if (segments[0] === 'comments' && segments.length === 2) {
      const commentId = segments[1];
      const commentRef = doc(db, 'comments', commentId);
      
      if (method === 'DELETE') {
        const commentDoc = await getDoc(commentRef);
        if (commentDoc.exists()) {
          await logActivity(commentDoc.data().task_id, "Deleted comment", "Comment deleted");
          await deleteDoc(commentRef);
        }
        return new Response(null, { status: 204 });
      }
      
      if (method === 'PUT') {
        const body = JSON.parse(init?.body as string);
        await updateDoc(commentRef, {
          content: body.content,
          updated_at: serverTimestamp()
        });
        const updatedDoc = await getDoc(commentRef);
        await logActivity(updatedDoc.data()?.task_id, "Edited comment", "Comment edited");
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
      try {
        const targetDoc = await getDoc(doc(db, 'tasks', body.target_task_id));
        if (targetDoc.exists()) {
          targetDisplayId = targetDoc.data().display_id || `IC-${targetDoc.id}`;
        }
      } catch (e) {
        console.error("Failed to fetch target task for activity log", e);
      }

      await logActivity(body.source_task_id, "Linked task", `Linked to Task #${targetDisplayId}`);
      const newDoc = await getDoc(docRef);
      return new Response(JSON.stringify(formatDoc(newDoc)), { status: 201 });
    }

    if (segments[0] === 'task-links' && segments.length === 2 && method === 'DELETE') {
      const linkId = segments[1];
      try {
        const linkDoc = await getDoc(doc(db, 'task_links', linkId));
        if (linkDoc.exists()) {
          const linkData = linkDoc.data();
          let targetDisplayId = linkData.target_task_id;
          const targetDoc = await getDoc(doc(db, 'tasks', linkData.target_task_id));
          if (targetDoc.exists()) {
            targetDisplayId = targetDoc.data().display_id || `IC-${targetDoc.id}`;
          }
          await logActivity(linkData.source_task_id, "Removed link", `Removed link to Task #${targetDisplayId}`);
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

      await logActivity(taskId, "Uploaded attachment", file.name);
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
        // We only delete the database record, not the file in Google Drive
        // to preserve the file in the shared drive for backup purposes.
        await deleteDoc(doc(db, 'attachments', attachmentId));
        await logActivity(data.task_id, "Deleted attachment", data.original_name);
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
