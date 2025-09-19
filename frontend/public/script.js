// Use relative URL since frontend is served from the same server
const BACKEND_URL = "http://54.145.42.47:3222/api/chat";

// เลือก element
const convListEl = document.getElementById("conversations");
const newChatBtn = document.getElementById("new-chat-btn");
const clearAllBtn = document.getElementById("clear-all");
const chatBox = document.getElementById("chat-box");
const chatTitle = document.getElementById("chat-title");
const composer = document.getElementById("composer");
const promptInput = document.getElementById("prompt");
const toggleSidebarBtn = document.getElementById("toggle-sidebar");
const sidebar = document.querySelector(".sidebar");
const chatArea = document.getElementById("chat-area");

// overlay สำหรับมือถือ
let overlay = document.createElement("div");
overlay.className = "overlay";
document.body.appendChild(overlay);

// In-memory storage (instead of localStorage for backend integration)
let conversations = [];
let activeId = null;

// API Functions
async function fetchChats() {
  try {
    const res = await fetch(`${BACKEND_URL}/chats`);
    if (res.ok) {
      return await res.json();
    }
    return [];
  } catch (error) {
    console.error('Failed to fetch chats:', error);
    return [];
  }
}

async function createChatOnServer(name) {
  try {
    const res = await fetch(`${BACKEND_URL}/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    return data.chatId;
  } catch (error) {
    console.error('Failed to create chat:', error);
    return null;
  }
}

async function addMessageToServer(chatId, sender, message) {
  try {
    const res = await fetch(`${BACKEND_URL}/${chatId}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender, message }),
    });
    return res.ok;
  } catch (error) {
    console.error('Failed to add message:', error);
    return false;
  }
}

async function fetchMessages(chatId) {
  try {
    const res = await fetch(`${BACKEND_URL}/${chatId}/messages`);
    if (res.ok) {
      return await res.json();
    }
    return [];
  } catch (error) {
    console.error('Failed to fetch messages:', error);
    return [];
  }
}

async function sendChatMessage(prompt) {
  try {
    const res = await fetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json();
    return data.reply || data.error;
  } catch (error) {
    console.error('Failed to send message:', error);
    return "Error: " + error.message;
  }
}

// Utils
function makeId() {
  return "c_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
}

function findConv(id) {
  return conversations.find((c) => c.id === id);
}

function renderConversations() {
  convListEl.innerHTML = "";

  conversations.forEach((conv) => {
    const el = document.createElement("div");
    el.className = "conv-item" + (conv.id === activeId ? " active" : "");
    el.dataset.id = conv.id;

    el.innerHTML = `
      <div class="conv-header">
        <span class="conv-title">${escapeHtml(conv.title)}</span>
        <div class="conv-actions">
          <button class="rename-btn" title="Rename">✏️</button>
          <button class="delete-btn" title="Delete">🗑️</button>
        </div>
      </div>
      <div class="conv-sub">${conv.messageCount || 0} messages</div>
    `;

    // Click to open conversation (but not on buttons)
    el.addEventListener("click", (e) => {
      if (e.target.closest(".rename-btn") || e.target.closest(".delete-btn")) return;
      openConversation(conv.id);
    });

    // Rename button
    el.querySelector(".rename-btn").addEventListener("click", async (e) => {
      e.stopPropagation(); // prevent parent click
      const newTitle = prompt("Rename chat:", conv.title);
      if (newTitle && newTitle.trim()) {
        try {
          // Send rename request to backend
          const res = await fetch(`${BACKEND_URL}/${conv.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: newTitle.trim() }),
          });
          if (res.ok) {
            conv.title = newTitle.trim(); // update locally
            renderConversations();
          } else {
            alert("Failed to rename chat");
          }
        } catch (err) {
          console.error("Rename failed:", err);
          alert("Error renaming chat");
        }
      }
    });

    // Delete button
    el.querySelector(".delete-btn").addEventListener("click", async (e) => {
      e.stopPropagation(); // prevent parent click
      if (!confirm("Delete this conversation?")) return;
      try {
        const res = await fetch(`${BACKEND_URL}/${conv.id}`, { method: "DELETE" });
        if (res.ok) {
          conversations = conversations.filter((c) => c.id !== conv.id);
          if (activeId === conv.id) activeId = conversations.length ? conversations[0].id : null;
          renderConversations();
          await renderChat();
        } else {
          alert("Failed to delete chat");
        }
      } catch (err) {
        console.error("Delete failed:", err);
        alert("Error deleting chat");
      }
    });

    convListEl.appendChild(el);
  });
}


// Render chat area
async function renderChat() {
  chatBox.innerHTML = "";
  const conv = findConv(activeId);
  chatTitle.textContent = conv ? conv.title : "No chat selected";
  
  if (!conv) return;
  
  // Show loading indicator
  const loadingEl = document.createElement("div");
  loadingEl.className = "loading";
  loadingEl.textContent = "Loading messages...";
  chatBox.appendChild(loadingEl);
  
  // Fetch messages from server
  const messages = await fetchMessages(conv.id);
  chatBox.innerHTML = "";
  
  messages.forEach((m) => {
    const d = document.createElement("div");
    d.className = "chat-message " + (m.sender === "user" ? "user" : "bot");
    d.textContent = m.message;
    chatBox.appendChild(d);
  });
  
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Open conversation
async function openConversation(id) {
  activeId = id;
  renderConversations();
  await renderChat();
}

// New conversation
async function createConversation(title = "New chat") {
  const chatId = await createChatOnServer(title);
  
  if (chatId) {
    const conv = { 
      id: chatId, 
      title, 
      messageCount: 0 
    };
    conversations.unshift(conv);
    activeId = chatId;
    renderConversations();
    await renderChat();
    promptInput.focus();
  } else {
    alert("Failed to create new chat");
  }
}

// Add message to active conversation
async function addMessageToActive(sender, text) {
  if (!activeId) {
    await createConversation();
  }
  
  if (activeId) {
    // Add message to server
    const success = await addMessageToServer(activeId, sender, text);
    
    if (success) {
      // Update local conversation count
      const conv = findConv(activeId);
      if (conv) {
        conv.messageCount = (conv.messageCount || 0) + 1;
      }
      
      // Re-render to show new message
      renderConversations();
      await renderChat();
    } else {
      alert("Failed to send message");
    }
  }
}

// Escape HTML
function escapeHtml(s) {
  return (s + "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}

// Initialize app - FIXED VERSION
async function initApp() {
  try {
    console.log('🚀 Initializing app...');
    
    // Show loading state
    chatTitle.textContent = "Loading...";
    
    // Try to fetch existing chats from server
    const existingChats = await fetchChats();
    console.log('📥 Fetched chats:', existingChats);
    
    if (existingChats && existingChats.length > 0) {
      // Load existing chats
      conversations = existingChats.map(chat => ({
        id: chat.id,
        title: chat.name, // Backend uses 'name', frontend uses 'title'
        messageCount: chat.messageCount || 0
      }));
      activeId = conversations[0].id;
      console.log('✅ Loaded existing conversations');
    } else {
      // Create a demo conversation if none exist
      console.log('📝 Creating demo conversation...');
      await createConversation("SPA LLM Chat Demo");
      
      // Add demo messages
      if (activeId) {
        await addMessageToServer(activeId, "bot", "สวัสดีครับ! นี่คือตัวอย่าง Workout Chatbot.");
        await addMessageToServer(activeId, "user", "แนะนำโปรแกรมออกกำลังกาย 4 สัปดาห์ให้หน่อย");
        await addMessageToServer(activeId, "bot", "ได้เลย — ลองเริ่มที่ 3 วัน/สัปดาห์ แบบ full-body...");
        
        // Update message count
        const conv = findConv(activeId);
        if (conv) conv.messageCount = 3;
        console.log('✅ Added demo messages');
      }
    }
    
    renderConversations();
    await renderChat();
    console.log('✅ App initialized successfully');
    
  } catch (error) {
    console.error('❌ Failed to initialize app:', error);
    
    // Fallback: show error message
    chatTitle.textContent = "Connection Error";
    chatBox.innerHTML = `
      <div class="chat-message bot">
        <p>⚠️ Unable to connect to server.</p>
        <p>Please check if the backend is running on port 3222.</p>
        <button onclick="location.reload()" style="margin-top: 10px; padding: 5px 10px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
          Retry
        </button>
      </div>
    `;
  }
}

// Event bindings
newChatBtn.addEventListener("click", () => createConversation("New chat"));

clearAllBtn.addEventListener("click", async () => {
  if (!confirm("ล้างการสนทนาทั้งหมด?")) return;
  
  try {
    // Delete all chats from server
    const res = await fetch(BACKEND_URL, { 
      method: "DELETE",
      headers: { "Content-Type": "application/json" }
    });
    
    if (res.ok) {
      // Clear local state
      conversations = [];
      activeId = null;
      renderConversations();
      await renderChat();
      console.log('✅ Cleared all conversations');
    } else {
      alert("Failed to clear all conversations");
    }
  } catch (error) {
    console.error('Failed to clear conversations:', error);
    alert("Error clearing conversations");
  }
});

composer.addEventListener("submit", async (e) => {
  e.preventDefault();
  const txt = promptInput.value.trim();
  if (!txt) return;

  // Disable input while processing
  promptInput.disabled = true;
  promptInput.value = "";

  try {
    // Show user message immediately
    await addMessageToActive("user", txt);

    // Get AI response
    const reply = await sendChatMessage(txt);
    
    // Show bot response
    await addMessageToActive("bot", reply);
  } catch (error) {
    console.error('Error in chat submission:', error);
    await addMessageToActive("bot", "Sorry, something went wrong. Please try again.");
  } finally {
    // Re-enable input
    promptInput.disabled = false;
    promptInput.focus();
  }
});

// Sidebar toggle
toggleSidebarBtn.addEventListener("click", () => {
  sidebar.classList.toggle("hidden");
//   overlay.classList.toggle("active", !sidebar.classList.contains("hidden"));

  // เพิ่ม/ลบ class expanded ให้ main และ chat-area
  if (sidebar.classList.contains("hidden")) {
    document.querySelector(".main").classList.add("expanded");
    chatArea.classList.add("expanded");
  } else {
    document.querySelector(".main").classList.remove("expanded");
    chatArea.classList.remove("expanded");
  }
});

// overlay click ปิด sidebar บนมือถือ
overlay.addEventListener("click", () => {
  sidebar.classList.add("hidden");
  overlay.classList.remove("active");

  document.querySelector(".main").classList.add("expanded");
  chatArea.classList.add("expanded");
});

// Initialize the app when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}