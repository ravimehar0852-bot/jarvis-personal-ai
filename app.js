import {
  initializeApp,
  getApps
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

import { firebaseConfig, CONFIGURED } from "./firebase-config.js";

const $ = (s) => document.querySelector(s);

const data = {
  conversations: [],
  memories: [],
  notes: [],
  reminders: []
};

let auth = null;
let db = null;
let user = null;
let convId = null;
let messages = [];
let busy = false;
let ctrl = null;

const notified = new Set();
const say = (t) => {
  $("#msg").textContent = t || "";
};

// Theme
document.documentElement.dataset.theme =
  localStorage.getItem("theme") || "dark";

$("#theme").onclick = () => {
  const theme =
    document.documentElement.dataset.theme === "dark"
      ? "light"
      : "dark";

  document.documentElement.dataset.theme = theme;

  try {
    localStorage.setItem("theme", theme);
  } catch {}
};

// Network status
function setStatus() {
  const status = $("#status");
  status.textContent = navigator.onLine ? "online" : "offline";
  status.classList.toggle("off", !navigator.onLine);
}

addEventListener("online", setStatus);
addEventListener("offline", setStatus);
setStatus();

// Drawer
function drawer(open) {
  $("#drawer").classList.toggle("closed", !open);
  $("#scrim").hidden = !open;
}

$("#menu").onclick = () => drawer(true);
$("#scrim").onclick = () => drawer(false);

document.querySelectorAll("#tabs button").forEach((button) => {
  button.onclick = () => {
    document.querySelectorAll("#tabs button").forEach((item) => {
      item.classList.toggle("on", item === button);
    });

    document.querySelectorAll("#drawer section").forEach((section) => {
      section.hidden = section.id !== "p-" + button.dataset.t;
    });
  };
});

// Authentication screen
function showAuth(message = "") {
  $("#auth").hidden = false;
  $("#authMsg").textContent = message;
  $("#authMsg").style.color = "";
}

function hideAuth() {
  $("#auth").hidden = true;
  $("#authMsg").textContent = "";
}

function showDashboard() {
  hideAuth();
  $("#who").textContent = "Signed in as " + (user?.email || "");
  $("#banner").hidden = true;
}

function authError(error) {
  const errors = {
    "auth/invalid-credential": "Email ya password galat hai.",
    "auth/email-already-in-use": "Ye email pehle se registered hai.",
    "auth/weak-password": "Password kam se kam 6 characters ka hona chahiye.",
    "auth/invalid-email": "Email address sahi nahi hai.",
    "auth/too-many-requests": "Bahut attempts ho gaye. Thodi der baad try karo.",
    "auth/network-request-failed": "Internet connection check karo.",
    "auth/operation-not-allowed": "Firebase mein Email/Password sign-in enable karo."
  };

  $("#authMsg").textContent =
    errors[error.code] || "Firebase error: " + (error.code || error.message);
}

function credentials() {
  return [
    $("#em").value.trim(),
    $("#pw").value
  ];
}

// Initialize Firebase
if (!CONFIGURED) {
  $("#banner").hidden = false;
  $("#banner").textContent =
    "Firebase configuration missing. firebase-config.js check karo.";

  showAuth("Firebase configure nahi hai.");
} else {
  try {
    const app = getApps().length
      ? getApps()[0]
      : initializeApp(firebaseConfig);

    auth = getAuth(app);
    db = getFirestore(app);

    // Login
    $("#login").onclick = async () => {
      const [email, password] = credentials();

      if (!email || !password) {
        return showAuth("Email aur password dono bharo.");
      }

      $("#login").disabled = true;

      try {
        await signInWithEmailAndPassword(auth, email, password);
        $("#authMsg").textContent = "Login successful!";
      } catch (error) {
        authError(error);
      } finally {
        $("#login").disabled = false;
      }
    };

    // Register
    $("#reg").onclick = async () => {
      const [email, password] = credentials();

      if (!email || !password) {
        return showAuth("Email aur password dono bharo.");
      }

      if (password.length < 6) {
        return showAuth("Password kam se kam 6 characters ka rakho.");
      }

      $("#reg").disabled = true;

      try {
        await createUserWithEmailAndPassword(auth, email, password);
        $("#authMsg").textContent = "Account created successfully!";
      } catch (error) {
        authError(error);
      } finally {
        $("#reg").disabled = false;
      }
    };

    // Password reset
    $("#reset").onclick = async () => {
      const email = $("#em").value.trim();

      if (!email) {
        return showAuth("Pehle apna email bharo.");
      }

      try {
        await sendPasswordResetEmail(auth, email);
        showAuth("Password reset email bhej diya. Inbox/spam check karo.");
      } catch (error) {
        authError(error);
      }
    };

    // Auth state and dashboard
    onAuthStateChanged(auth, async (currentUser) => {
      user = currentUser;

      if (!user) {
        data.conversations = [];
        data.memories = [];
        data.notes = [];
        data.reminders = [];
        messages = [];
        convId = null;

        $("#log").replaceChildren();
        render();

        showAuth();
        return;
      }

      showDashboard();
      say("JARVIS load ho raha hai...");

      try {
        for (const name of Object.keys(data)) {
          await load(name);
        }

        render();
        newChat();
        say("");
      } catch (error) {
        say(
          "Data load nahi hua: " +
          (error.code || error.message) +
          ". Firestore Rules check karo."
        );
      }
    });

    $("#logout").onclick = async () => {
      try {
        drawer(false);
        await signOut(auth);
      } catch (error) {
        say("Logout error: " + error.message);
      }
    };
  } catch (error) {
    showAuth("Firebase setup error: " + error.message);
  }
}

// Firestore
function col(name) {
  if (!user || !db) throw new Error("Please log in first.");
  return collection(db, "users", user.uid, name);
}

async function load(name) {
  const snapshot = await getDocs(
    query(col(name), orderBy("updatedAt", "desc"), limit(200))
  );

  data[name] = snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data()
  }));
}

async function save(name, value, id) {
  if (!user) throw new Error("Please log in first.");

  const body = {
    ...value,
    updatedAt: serverTimestamp()
  };

  if (id) {
    await setDoc(doc(col(name), id), body, { merge: true });
  } else {
    id = (await addDoc(col(name), body)).id;
  }

  await load(name);
  render();

  return id;
}

async function del(name, id) {
  await deleteDoc(doc(col(name), id));
  await load(name);
  render();
}

// Chat rendering
function bubble(message) {
  const element = document.createElement("div");
  element.className = "b " + message.role;

  const text = document.createElement("div");
  text.textContent = message.text || "";
  element.append(text);

  const sources = (message.sources || []).filter(
    (source) => /^https?:\/\//.test(source.url || "")
  );

  if (sources.length) {
    const sourceBox = document.createElement("div");
    sourceBox.className = "src";
    sourceBox.append(document.createTextNode("Web sources: "));

    sources.forEach((source) => {
      const link = document.createElement("a");
      link.href = source.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = source.title || source.url;
      sourceBox.append(link);
    });

    element.append(sourceBox);
  }

  return element;
}

function renderChat() {
  $("#log").replaceChildren(...messages.map(bubble));
  $("main").scrollTop = $("main").scrollHeight;
}

function item(text, cls, ...buttons) {
  const element = document.createElement("div");
  element.className = "item " + cls;

  const label = document.createElement("span");
  label.textContent = text || "";
  element.append(label, ...buttons);

  return element;
}

function btn(label, action, cls = "") {
  const button = document.createElement("button");
  button.textContent = label;
  button.className = cls;
  button.onclick = action;
  return button;
}

function render() {
  $("#l-conversations").replaceChildren(
    ...data.conversations.map((conversation) =>
      item(
        conversation.title || "Chat",
        "",
        btn("Open", () => {
          convId = conversation.id;
          messages = conversation.messages || [];
          renderChat();
          drawer(false);
        }),
        btn("✕", async () => {
          if (conversation.id === convId) newChat();
          try {
            await del("conversations", conversation.id);
          } catch (error) {
            say(error.message);
          }
        }, "danger")
      )
    )
  );

  $("#l-memories").replaceChildren(
    ...data.memories.map((memory) =>
      item(
        memory.text,
        "",
        btn("Edit", async () => {
          const value = prompt("Edit memory", memory.text);
          if (!value?.trim()) return;

          try {
            await save("memories", {
              text: value.trim().slice(0, 500)
            }, memory.id);
          } catch (error) {
            say(error.message);
          }
        }),
        btn("✕", () => del("memories", memory.id).catch((e) => say(e.message)), "danger")
      )
    )
  );

  const search = ($("#noteSearch").value || "").toLowerCase();

  $("#l-notes").replaceChildren(
    ...data.notes
      .filter((note) => (note.text || "").toLowerCase().includes(search))
      .map((note) =>
        item(
          note.text,
          "",
          btn("✕", () => del("notes", note.id).catch((e) => say(e.message)), "danger")
        )
      )
  );

  $("#l-reminders").replaceChildren(
    ...[...data.reminders]
      .sort((a, b) => (a.at || "").localeCompare(b.at || ""))
      .map((reminder) =>
        item(
          `${reminder.text} — ${reminder.at ? new Date(reminder.at).toLocaleString() : ""}`,
          reminder.done ? "done" : "",
          btn(reminder.done ? "Undo" : "Done", () =>
            save("reminders", { done: !reminder.done }, reminder.id)
              .catch((e) => say(e.message))
          ),
          btn("✕", () => del("reminders", reminder.id).catch((e) => say(e.message)), "danger")
        )
      )
  );
}

function newChat() {
  convId = null;
  messages = [{
    role: "model",
    text: "JARVIS online. How can I help? (English / हिन्दी / Hinglish)",
    sources: []
  }];

  renderChat();
  drawer(false);
}

$("#newchat").onclick = () => {
  if (user) newChat();
  else showAuth("Pehle login karo.");
};

// Shared action guard
function needLogin() {
  if (user) return false;
  showAuth("Pehle login karo.");
  return true;
}

// Memories
$("#memAdd").onclick = async () => {
  const text = $("#memIn").value.trim();
  if (!text || needLogin()) return;

  try {
    await save("memories", { text: text.slice(0, 500) });
    $("#memIn").value = "";
  } catch (error) {
    say("Memory save error: " + error.message);
  }
};

$("#memClear").onclick = async () => {
  if (needLogin() || !confirm("Delete ALL memories?")) return;

  try {
    for (const memory of data.memories) {
      await deleteDoc(doc(col("memories"), memory.id));
    }

    await load("memories");
    render();
  } catch (error) {
    say(error.message);
  }
};

// Notes
$("#noteAdd").onclick = async () => {
  const text = $("#noteIn").value.trim();
  if (!text || needLogin()) return;

  try {
    await save("notes", { text: text.slice(0, 2000) });
    $("#noteIn").value = "";
  } catch (error) {
    say("Note save error: " + error.message);
  }
};

$("#noteSearch").oninput = render;

// Reminders
$("#remAdd").onclick = async () => {
  const text = $("#remIn").value.trim();
  const time = $("#remAt").value;

  if (needLogin()) return;

  if (!text || !time) {
    say("Reminder aur time dono bharo.");
    return;
  }

  try {
    await save("reminders", {
      text: text.slice(0, 300),
      at: new Date(time).toISOString(),
      done: false
    });

    $("#remIn").value = "";
    say("Reminder saved.");
  } catch (error) {
    say("Reminder save error: " + error.message);
  }
};

$("#remPerm").onclick = async () => {
  if (!("Notification" in window)) {
    return say("Is browser mein notifications supported nahi hain.");
  }

  say("Notifications: " + await Notification.requestPermission());
};

setInterval(() => {
  const now = Date.now();

  data.reminders
    .filter((reminder) =>
      !reminder.done &&
      reminder.at &&
      new Date(reminder.at).getTime() <= now &&
      !notified.has(reminder.id)
    )
    .forEach((reminder) => {
      notified.add(reminder.id);
      say("⏰ Reminder: " + reminder.text);

      try {
        if (Notification.permission === "granted") {
          new Notification("JARVIS reminder", {
            body: reminder.text
          });
        }
      } catch {}
    });
}, 20000);

// Memory context
function relevantMemories(text) {
  const words = new Set(text.toLowerCase().match(/\p{L}{3,}/gu) || []);

  return data.memories
    .map((memory) => ({
      text: memory.text,
      score: (memory.text.toLowerCase().match(/\p{L}{3,}/gu) || [])
        .filter((word) => words.has(word)).length
    }))
    .filter((memory) => memory.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((memory) => memory.text);
}

// Chat / AI
function setBusy(value) {
  busy = value;
  $("#send").textContent = value ? "Stop" : "Send";
  $("#orb").classList.toggle("think", value);
}

async function send() {
  if (busy) {
    ctrl?.abort();
    return;
  }

  if (needLogin()) return;

  const text = $("#input").value.trim();
  if (!text) return;

  say("");

  if (text.startsWith("/remember ")) {
    try {
      await save("memories", {
        text: text.slice(10).trim().slice(0, 500)
      });

      $("#input").value = "";
      say("Saved to memory.");
    } catch (error) {
      say("Memory save error: " + error.message);
    }

    return;
  }

  if (!navigator.onLine) return say("You are offline.");

  $("#input").value = "";
  messages.push({ role: "user", text, sources: [] });
  renderChat();

  ctrl = new AbortController();
  setBusy(true);

  try {
    const headers = {
      "Content-Type": "application/json",
      Authorization: "Bearer " + await user.getIdToken()
    };

    let sources = [];

    if ($("#web").checked) {
      const response = await fetch("/api/search", {
        method: "POST",
        headers,
        body: JSON.stringify({ q: text }),
        signal: ctrl.signal
      });

      const result = await response.json().catch(() => ({}));

      if (response.ok) {
        sources = result.results || [];
      } else {
        say("Web search unavailable: " + (result.error || response.status));
      }
    }

    const history = messages
      .filter((message) => message.text)
      .slice(-20)
      .map(({ role, text }) => ({ role, text }));

    while (history.length && history[0].role !== "user") {
      history.shift();
    }

    const response = await fetch("/api/chat", {
      method: "POST",
      headers,
      body: JSON.stringify({
        history,
        memories: relevantMemories(text),
        sources
      }),
      signal: ctrl.signal
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.error || "AI server error " + response.status);
    }

    if (!result.reply) {
      throw new Error("AI server se reply nahi aaya. /api/chat check karo.");
    }

    messages.push({
      role: "model",
      text: result.reply,
      sources: sources.map(({ title, url }) => ({ title, url }))
    });

    renderChat();

    if ($("#speak").checked && "speechSynthesis" in window) {
      const speech = new SpeechSynthesisUtterance(result.reply);
      speech.lang = $("#lang").value;
      speechSynthesis.cancel();
      speechSynthesis.speak(speech);
    }

    const title = (
      messages.find((message) => message.role === "user")?.text || "Chat"
    ).slice(0, 40);

    convId = await save(
      "conversations",
      { title, messages: messages.slice(-60) },
      convId
    );
  } catch (error) {
    if (messages[messages.length - 1]?.role === "user") {
      messages.pop();
    }

    renderChat();
    $("#input").value = text;

    say(
      error.name === "AbortError"
        ? "Stopped."
        : error instanceof TypeError
          ? "Network error. Vercel backend files aur connection check karo."
          : error.message
    );
  } finally {
    setBusy(false);
    ctrl = null;
  }
}

$("#send").onclick = send;

$("#input").addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    send();
  }
});

$("#input").addEventListener("input", (event) => {
  event.target.style.height = "auto";
  event.target.style.height =
    Math.min(event.target.scrollHeight, 120) + "px";
});

// Voice input
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

let recognition = null;

$("#mic").onclick = () => {
  if (needLogin()) return;

  if (!SpeechRecognition) {
    return say("Voice input ke liye Android Chrome try karo.");
  }

  if (recognition) {
    recognition.stop();
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = $("#lang").value;
  recognition.interimResults = false;

  recognition.onstart = () => {
    say("🎙 Listening… mic ko stop karne ke liye dobara tap karo.");
    $("#mic").textContent = "⏹";
  };

  recognition.onresult = (event) => {
    $("#input").value = event.results[0][0].transcript;
    send();
  };

  recognition.onerror = (event) => {
    say("Voice error: " + event.error);
  };

  recognition.onend = () => {
    recognition = null;
    $("#mic").textContent = "🎤";

    if ($("#msg").textContent.startsWith("🎙")) {
      say("");
    }
  };

  recognition.start();
};
