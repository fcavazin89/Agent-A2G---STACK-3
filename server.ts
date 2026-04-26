import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Database from "better-sqlite3";
import fs from "fs";
import bcrypt from "bcrypt";
import crypto from "crypto";

// Initialize SQL database
const db = new Database("stack3.db");

// Simple schema setup
db.exec(`
  CREATE TABLE IF NOT EXISTS professionals (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL,
    company TEXT,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS audits (
    id TEXT PRIMARY KEY,
    professional_id TEXT,
    mission_idea TEXT,
    audit_hash TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(professional_id) REFERENCES professionals(id)
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    professional_id TEXT,
    name TEXT NOT NULL,
    state TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(professional_id) REFERENCES professionals(id)
  );
`);

const SALT_ROUNDS = 10;

async function seedDatabase() {
  const users = [
    {
      name: "Tiago Cavazin",
      password: "123",
      role: "Lead Architect",
      company: "STACK3 TEST"
    },
    {
      name: "TIAGOFCAVAZIN",
      password: "123",
      role: "Auditor",
      company: "STACK3"
    }
  ];

  for (const user of users) {
    const existing = db.prepare("SELECT id FROM professionals WHERE name = ?").get(user.name);
    if (!existing) {
      const id = crypto.randomUUID();
      const hashedPassword = await bcrypt.hash(user.password, SALT_ROUNDS);
      db.prepare("INSERT INTO professionals (id, name, role, company, password) VALUES (?, ?, ?, ?, ?)").run(
        id, user.name, user.role, user.company, hashedPassword
      );
      console.log(`[SEED] User created: ${user.name}`);
    }
  }
}

async function startServer() {
  await seedDatabase();
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.get("/api/projects", (req, res) => {
    const { professional_id } = req.query;
    if (!professional_id) return res.status(400).json({ success: false, error: "Professional ID required" });
    
    try {
      const projects = db.prepare("SELECT id, name, timestamp FROM projects WHERE professional_id = ? ORDER BY timestamp DESC").all(professional_id);
      res.json({ success: true, projects });
    } catch (err) {
      console.error("[PROJECTS FETCH ERROR]", err);
      res.status(500).json({ success: false, error: "Database error fetching projects" });
    }
  });

  app.get("/api/projects/:id", (req, res) => {
    try {
      const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id) as any;
      if (!project) return res.status(404).json({ success: false, error: "Project not found" });
      
      res.json({ success: true, project: { ...project, state: JSON.parse(project.state) } });
    } catch (err) {
      res.status(500).json({ success: false, error: "Database error" });
    }
  });

  app.post("/api/projects", (req, res) => {
    const { professional_id, name, state } = req.body;
    if (!professional_id || !name || !state) return res.status(400).json({ success: false, error: "Missing data" });
    
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    
    try {
      db.prepare("INSERT INTO projects (id, professional_id, name, state, timestamp) VALUES (?, ?, ?, ?, ?)")
        .run(id, professional_id, name, JSON.stringify(state), timestamp);
      res.json({ success: true, project_id: id });
    } catch (err) {
      console.error("[PROJECT SAVE ERROR]", err);
      res.status(500).json({ success: false, error: "Database error" });
    }
  });

  app.delete("/api/projects/:id", (req, res) => {
    try {
      db.prepare("DELETE FROM projects WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, error: "Database error" });
    }
  });

  app.post("/api/register", async (req, res) => {
    const { name, role, company, password } = req.body;
    
    // Basic validation
    if (!name || name.length < 3) return res.status(400).json({ success: false, error: "Name must be at least 3 characters" });
    if (!password || password.length < 3) return res.status(400).json({ success: false, error: "Password must be at least 3 characters" });
    if (!role) return res.status(400).json({ success: false, error: "Role is required" });

    const id = crypto.randomUUID();
    
    try {
      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
      const stmt = db.prepare("INSERT INTO professionals (id, name, role, company, password) VALUES (?, ?, ?, ?, ?)");
      stmt.run(id, name, role, company, hashedPassword);
      
      console.log(`[AUTH] New professional registered: ${name} (${id})`);
      res.json({ success: true, user: { id, name, role, company } });
    } catch (err: any) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(400).json({ success: false, error: "Username already exists" });
      }
      console.error("[AUTH ERROR] Registration failed:", err);
      res.status(500).json({ success: false, error: "Internal server error during registration" });
    }
  });

  app.post("/api/login", async (req, res) => {
    const { name, password } = req.body;
    
    if (!name || !password) return res.status(400).json({ success: false, error: "Credentials required" });

    try {
      const stmt = db.prepare("SELECT * FROM professionals WHERE name = ?");
      const user = stmt.get(name) as any;
      
      if (!user) {
        return res.status(401).json({ success: false, error: "Invalid username or password" });
      }

      const match = await bcrypt.compare(password, user.password);
      if (match) {
        const { password: _, ...userWithoutPassword } = user;
        console.log(`[AUTH] Professional login: ${name}`);
        res.json({ success: true, user: userWithoutPassword });
      } else {
        res.status(401).json({ success: false, error: "Invalid username or password" });
      }
    } catch (err) {
      console.error("[AUTH ERROR] Login failed:", err);
      res.status(500).json({ success: false, error: "Internal server error during login" });
    }
  });

  app.post("/api/audit", (req, res) => {
    const { professional_id, mission_idea, audit_hash } = req.body;
    
    if (!audit_hash) return res.status(400).json({ success: false, error: "Audit hash is required" });
    
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    
    try {
      // Validate professional exists if ID provided
      if (professional_id) {
        const user = db.prepare("SELECT id FROM professionals WHERE id = ?").get(professional_id);
        if (!user) return res.status(400).json({ success: false, error: "Referenced professional does not exist" });
      }

      const stmt = db.prepare("INSERT INTO audits (id, professional_id, mission_idea, audit_hash, timestamp) VALUES (?, ?, ?, ?, ?)");
      stmt.run(id, professional_id, mission_idea, audit_hash, timestamp);
      
      console.log(`[AUDIT] Cryptographic mission record saved.
        ID: ${id}
        Professional: ${professional_id || "ANONYMOUS"}
        Mission: ${mission_idea ? mission_idea.substring(0, 50) + "..." : "N/A"}
        Hash: ${audit_hash}
        Time: ${timestamp}`);

      res.json({ success: true, audit_id: id });
    } catch (err) {
      console.error("[AUDIT ERROR] Recording failed:", err);
      res.status(500).json({ success: false, error: "Database error while recording audit" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
