import express from "express";
import { initDB } from "../db.js";
import { queryGemini } from "../services/gemini.js";

const router = express.Router();

let db;
initDB().then((database) => {
  db = database;
  console.log("✅ Database connected to chat routes");
}).catch((error) => {
  console.error("❌ Database connection failed:", error);
});

// Get all chats with message counts
router.get("/chats", async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: "Database not initialized" });
    }
    
    const chats = await db.all(`
      SELECT c.*, COUNT(m.id) as messageCount 
      FROM chats c 
      LEFT JOIN messages m ON c.id = m.chat_id 
      GROUP BY c.id 
      ORDER BY c.created_at DESC
    `);
    
    res.json(chats || []);
  } catch (error) {
    console.error("Failed to fetch chats:", error);
    res.status(500).json({ error: "Failed to fetch chats" });
  }
});

// Create a new chat
router.post("/create", async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: "Database not initialized" });
    }
    
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Chat name is required" });
    }

    
    const result = await db.run("INSERT INTO chats (name) VALUES (?)", [name]);
    res.json({ chatId: result.lastID });
  } catch (error) {
    console.error("Failed to create chat:", error);
    res.status(500).json({ error: "Failed to create chat" });
  }
});

// Delete a specific chat and all its messages
router.delete("/:chatId", async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: "Database not initialized" });
    }
    
    const { chatId } = req.params;
    
    // Delete messages first (due to foreign key constraint)
    await db.run("DELETE FROM messages WHERE chat_id = ?", [chatId]);
    
    // Delete the chat
    const result = await db.run("DELETE FROM chats WHERE id = ?", [chatId]);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: "Chat not found" });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to delete chat:", error);
    res.status(500).json({ error: "Failed to delete chat" });
  }
});

// Delete all chats and messages
router.delete("/", async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: "Database not initialized" });
    }
    
    await db.run("DELETE FROM messages");
    await db.run("DELETE FROM chats");
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to delete all chats:", error);
    res.status(500).json({ error: "Failed to delete all chats" });
  }
});

// Add a message to a chat
router.post("/:chatId/message", async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: "Database not initialized" });
    }
    
    const { chatId } = req.params;
    const { sender, message } = req.body;
    
    if (!sender || !message) {
      return res.status(400).json({ error: "Sender and message are required" });
    }
    
    // Check if chat exists
    const chat = await db.get("SELECT id FROM chats WHERE id = ?", [chatId]);
    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }
    
    const result = await db.run(
      "INSERT INTO messages (chat_id, sender, message) VALUES (?, ?, ?)",
      [chatId, sender, message],
    );
    
    res.json({ messageId: result.lastID });
  } catch (error) {
    console.error("Failed to add message:", error);
    res.status(500).json({ error: "Failed to add message" });
  }
});

// Get messages for a chat
router.get("/:chatId/messages", async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: "Database not initialized" });
    }
    
    const { chatId } = req.params;
    const messages = await db.all(
      "SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC",
      [chatId],
    );
    
    res.json(messages || []);
  } catch (error) {
    console.error("Failed to get messages:", error);
    res.status(500).json({ error: "Failed to get messages" });
  }
});

// Update chat name
router.put("/:chatId", async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: "Database not initialized" });
    }
    
    const { chatId } = req.params;
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: "Chat name is required" });
    }
    
    const result = await db.run("UPDATE chats SET name = ? WHERE id = ?", [name, chatId]);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: "Chat not found" });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to update chat:", error);
    res.status(500).json({ error: "Failed to update chat" });
  }
});

// Main chat endpoint for AI responses
router.post("/", async (req, res) => {
  try {
    const { prompt, chatId } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    // Get AI response
    const reply = await queryGemini(prompt, process.env.GEMINI_API_KEY);
    
    // If chatId is provided and database is available, save both messages
    if (chatId && db) {
      try {
        // Check if chat exists
        const chat = await db.get("SELECT id FROM chats WHERE id = ?", [chatId]);
        if (chat) {
          await db.run(
            "INSERT INTO messages (chat_id, sender, message) VALUES (?, ?, ?)",
            [chatId, "user", prompt]
          );
          await db.run(
            "INSERT INTO messages (chat_id, sender, message) VALUES (?, ?, ?)",
            [chatId, "bot", reply]
          );
        }
      } catch (dbError) {
        console.error("Failed to save messages to database:", dbError);
        // Still return the reply even if saving failed
      }
    }
    
    res.json({ reply });
  } catch (err) {
    console.error("Chat endpoint error:", err);
    res.status(500).json({ error: "Something went wrong with the AI response" });
  }
});

// Health check endpoint
router.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    database: db ? "connected" : "not connected",
    timestamp: new Date().toISOString()
  });
});

export default router;