import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import nodemailer from "nodemailer";
import * as ics from "ics";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("hiring.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS candidates (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT,
    phone TEXT,
    resumeText TEXT,
    jd TEXT,
    status TEXT DEFAULT 'SCREENED',
    scheduledTime TEXT,
    report TEXT,
    skills TEXT,
    matchedSkills TEXT,
    missingSkills TEXT,
    skillMatchScore REAL,
    semanticScore REAL,
    finalScore REAL,
    summary TEXT
  )
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API: Save/Update Candidate from screening
  app.post("/api/candidates", (req, res) => {
    const { 
      id, name, email, phone, resumeText, jd, status, 
      skills, matchedSkills, missingSkills, 
      skillMatchScore, semanticScore, finalScore, summary 
    } = req.body;
    
    try {
      const stmt = db.prepare(`
        INSERT INTO candidates (
          id, name, email, phone, resumeText, jd, status,
          skills, matchedSkills, missingSkills,
          skillMatchScore, semanticScore, finalScore, summary
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name=excluded.name,
          email=excluded.email,
          phone=excluded.phone,
          resumeText=excluded.resumeText,
          jd=excluded.jd,
          status=COALESCE(excluded.status, candidates.status),
          skills=excluded.skills,
          matchedSkills=excluded.matchedSkills,
          missingSkills=excluded.missingSkills,
          skillMatchScore=excluded.skillMatchScore,
          semanticScore=excluded.semanticScore,
          finalScore=excluded.finalScore,
          summary=excluded.summary
      `);
      
      stmt.run(
        id, name, email, phone, resumeText, jd, status || 'SCREENED',
        JSON.stringify(skills || []),
        JSON.stringify(matchedSkills || []),
        JSON.stringify(missingSkills || []),
        skillMatchScore || 0,
        semanticScore || 0,
        finalScore || 0,
        summary || ''
      );
      console.log(`Candidate ${name} (${id}) saved/updated successfully.`);
      res.json({ success: true });
    } catch (err) {
      console.error("Failed to save candidate:", err);
      res.status(500).json({ error: "Failed to save candidate to database" });
    }
  });

  // API: Get all candidates (for HR)
  app.get("/api/candidates", (req, res) => {
    const candidates = db.prepare("SELECT * FROM candidates").all();
    res.json(candidates.map((c: any) => ({
      ...c,
      report: c.report ? JSON.parse(c.report as string) : null,
      skills: c.skills ? JSON.parse(c.skills as string) : [],
      matchedSkills: c.matchedSkills ? JSON.parse(c.matchedSkills as string) : [],
      missingSkills: c.missingSkills ? JSON.parse(c.missingSkills as string) : []
    })));
  });

  // API: Get single candidate (for portal)
  app.get("/api/candidates/:id", (req, res) => {
    const candidate = db.prepare("SELECT * FROM candidates WHERE id = ?").get(req.params.id) as any;
    if (!candidate) return res.status(404).json({ error: "Not found" });
    res.json({
      ...candidate,
      report: candidate.report ? JSON.parse(candidate.report as string) : null,
      skills: candidate.skills ? JSON.parse(candidate.skills as string) : [],
      matchedSkills: candidate.matchedSkills ? JSON.parse(candidate.matchedSkills as string) : [],
      missingSkills: candidate.missingSkills ? JSON.parse(candidate.missingSkills as string) : []
    });
  });

  // API: Send Scheduling Link
  app.post("/api/candidates/:id/send-scheduling-link", async (req, res) => {
    const candidate = db.prepare("SELECT * FROM candidates WHERE id = ?").get(req.params.id) as any;
    if (!candidate) return res.status(404).json({ error: "Not found" });

    const baseUrl = process.env.APP_URL || req.headers.origin;
    const portalUrl = `${baseUrl}/portal/${candidate.id}`;

    const port = parseInt(process.env.SMTP_PORT || "587");
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    try {
      await transporter.sendMail({
        from: process.env.FROM_EMAIL || process.env.SMTP_USER,
        to: candidate.email,
        subject: `Schedule your AI Interview: ${candidate.name}`,
        text: `Hi ${candidate.name},\n\nPlease use the link below to schedule your screening call:\n\n${portalUrl}\n\nBest regards,\nAI Hiring Team`,
      });
      console.log(`Scheduling link sent to ${candidate.email}`);
      db.prepare("UPDATE candidates SET status = 'SCHEDULING_SENT' WHERE id = ?").run(candidate.id);
      res.json({ success: true });
    } catch (err) {
      console.error("Email sending failed:", err);
      res.status(500).json({ error: "Failed to send email. Check SMTP configuration." });
    }
  });

  // API: Confirm Time & Send Interview Link
  app.post("/api/candidates/:id/confirm-time", async (req, res) => {
    const { startTime } = req.body;
    const candidate = db.prepare("SELECT * FROM candidates WHERE id = ?").get(req.params.id) as any;
    if (!candidate) return res.status(404).json({ error: "Not found" });

    const start = new Date(startTime);
    const baseUrl = process.env.APP_URL || req.headers.origin;
    const meetingLink = `${baseUrl}/portal/${candidate.id}?mode=interview`;

    const event: ics.EventAttributes = {
      start: [start.getFullYear(), start.getMonth() + 1, start.getDate(), start.getHours(), start.getMinutes()],
      duration: { minutes: 15 },
      title: `AI Screening: ${candidate.name}`,
      description: `Join your AI interview here: ${meetingLink}`,
      url: meetingLink,
      attendees: [{ name: candidate.name, email: candidate.email, rsvp: true }],
    };

    const { value } = ics.createEvent(event);
    const port = parseInt(process.env.SMTP_PORT || "587");
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    try {
      await transporter.sendMail({
        from: process.env.FROM_EMAIL || process.env.SMTP_USER,
        to: candidate.email,
        subject: `Interview Confirmed: ${start.toLocaleString()}`,
        text: `Hi ${candidate.name},\n\nYour interview is confirmed for ${start.toLocaleString()}.\n\nJoin link: ${meetingLink}`,
        attachments: [{ filename: "invite.ics", content: value || "", contentType: "text/calendar" }],
      });
      console.log(`Confirmation email sent to ${candidate.email}`);
      db.prepare("UPDATE candidates SET status = 'CONFIRMED', scheduledTime = ? WHERE id = ?").run(startTime, candidate.id);
      res.json({ success: true });
    } catch (err) {
      console.error("Confirmation email failed:", err);
      res.status(500).json({ error: "Failed to send email. Check SMTP configuration." });
    }
  });

  // API: Save Interview Report
  app.post("/api/candidates/:id/report", (req, res) => {
    const { report } = req.body;
    db.prepare("UPDATE candidates SET report = ?, status = 'COMPLETED' WHERE id = ?").run(JSON.stringify(report), req.params.id);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        allowedHosts: true,
      },
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
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    console.log(`APP_URL is set to: ${process.env.APP_URL || 'Not set (using request origin)'}`);
  });
}

startServer();
