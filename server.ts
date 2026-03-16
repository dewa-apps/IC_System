import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOADS_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ storage });

const db = new Database("tasks.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'TODO',
    priority TEXT DEFAULT 'MEDIUM',
    assignee TEXT,
    request_date DATE,
    due_date DATE,
    category TEXT,
    brand TEXT,
    requestor TEXT,
    division TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Migration: Add columns if they don't exist (for existing databases)
const tableInfo = db.prepare("PRAGMA table_info(tasks)").all() as any[];
const columns = tableInfo.map(c => c.name);

const newColumns = [
  { name: 'request_date', type: 'DATE' },
  { name: 'due_date', type: 'DATE' },
  { name: 'category', type: 'TEXT' },
  { name: 'brand', type: 'TEXT' },
  { name: 'requestor', type: 'TEXT' },
  { name: 'division', type: 'TEXT' }
];

for (const col of newColumns) {
  if (!columns.includes(col.name)) {
    try {
      db.exec(`ALTER TABLE tasks ADD COLUMN ${col.name} ${col.type}`);
      console.log(`Added column ${col.name} to tasks table`);
    } catch (err) {
      console.error(`Failed to add column ${col.name}:`, err);
    }
  }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    author TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT,
    size INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE
  )
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/tasks", (req, res) => {
    const tasks = db.prepare("SELECT * FROM tasks ORDER BY created_at DESC").all();
    res.json(tasks);
  });

  app.post("/api/tasks", (req, res) => {
    const { title, description, status, priority, assignee, request_date, due_date, category, brand, requestor, division } = req.body;
    const info = db.prepare(
      "INSERT INTO tasks (title, description, status, priority, assignee, request_date, due_date, category, brand, requestor, division) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(title, description, status || 'TODO', priority || 'MEDIUM', assignee, request_date, due_date, category, brand, requestor, division);
    
    const newTask = db.prepare("SELECT * FROM tasks WHERE id = ?").get(info.lastInsertRowid);
    res.status(201).json(newTask);
  });

  app.patch("/api/tasks/:id", (req, res) => {
    const { id } = req.params;
    console.log(`Updating task ${id}:`, req.body);
    const { title, description, status, priority, assignee, request_date, due_date, category, brand, requestor, division } = req.body;
    
    const updates = [];
    const params = [];
    
    if (title !== undefined) { updates.push("title = ?"); params.push(title); }
    if (description !== undefined) { updates.push("description = ?"); params.push(description); }
    if (status !== undefined) { updates.push("status = ?"); params.push(status); }
    if (priority !== undefined) { updates.push("priority = ?"); params.push(priority); }
    if (assignee !== undefined) { updates.push("assignee = ?"); params.push(assignee); }
    if (request_date !== undefined) { updates.push("request_date = ?"); params.push(request_date); }
    if (due_date !== undefined) { updates.push("due_date = ?"); params.push(due_date); }
    if (category !== undefined) { updates.push("category = ?"); params.push(category); }
    if (brand !== undefined) { updates.push("brand = ?"); params.push(brand); }
    if (requestor !== undefined) { updates.push("requestor = ?"); params.push(requestor); }
    if (division !== undefined) { updates.push("division = ?"); params.push(division); }
    
    if (updates.length === 0) {
      console.log("No fields to update");
      return res.status(400).json({ error: "No fields to update" });
    }
    
    params.push(id);
    try {
      const result = db.prepare(`UPDATE tasks SET ${updates.join(", ")} WHERE id = ?`).run(...params);
      console.log(`Update result for ${id}:`, result);
      
      const updatedTask = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
      res.json(updatedTask);
    } catch (err) {
      console.error(`Error updating task ${id}:`, err);
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  app.delete("/api/tasks/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
    res.status(204).send();
  });

  // Comment Routes
  app.get("/api/tasks/:taskId/comments", (req, res) => {
    const { taskId } = req.params;
    const comments = db.prepare("SELECT * FROM comments WHERE task_id = ? ORDER BY created_at ASC").all(taskId);
    res.json(comments);
  });

  app.post("/api/tasks/:taskId/comments", (req, res) => {
    const { taskId } = req.params;
    const { author, content } = req.body;
    const info = db.prepare(
      "INSERT INTO comments (task_id, author, content) VALUES (?, ?, ?)"
    ).run(taskId, author, content);
    
    const newComment = db.prepare("SELECT * FROM comments WHERE id = ?").get(info.lastInsertRowid);
    res.status(201).json(newComment);
  });

  app.delete("/api/comments/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM comments WHERE id = ?").run(id);
    res.status(204).send();
  });

  // Attachment Routes
  app.get("/api/tasks/:taskId/attachments", (req, res) => {
    const { taskId } = req.params;
    const attachments = db.prepare("SELECT * FROM attachments WHERE task_id = ? ORDER BY created_at DESC").all(taskId);
    res.json(attachments);
  });

  app.post("/api/tasks/:taskId/attachments", upload.single("file"), (req, res) => {
    const { taskId } = req.params;
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const info = db.prepare(
      "INSERT INTO attachments (task_id, filename, original_name, mime_type, size) VALUES (?, ?, ?, ?, ?)"
    ).run(taskId, req.file.filename, req.file.originalname, req.file.mimetype, req.file.size);

    const newAttachment = db.prepare("SELECT * FROM attachments WHERE id = ?").get(info.lastInsertRowid);
    res.status(201).json(newAttachment);
  });

  app.get("/api/attachments/:id/download", (req, res) => {
    const { id } = req.params;
    const attachment = db.prepare("SELECT * FROM attachments WHERE id = ?").get(id) as any;
    if (!attachment) {
      return res.status(404).json({ error: "Attachment not found" });
    }

    const filePath = path.join(UPLOADS_DIR, attachment.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found on disk" });
    }

    res.download(filePath, attachment.original_name);
  });

  app.delete("/api/attachments/:id", (req, res) => {
    const { id } = req.params;
    const attachment = db.prepare("SELECT * FROM attachments WHERE id = ?").get(id) as any;
    if (attachment) {
      const filePath = path.join(UPLOADS_DIR, attachment.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      db.prepare("DELETE FROM attachments WHERE id = ?").run(id);
    }
    res.status(204).send();
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
