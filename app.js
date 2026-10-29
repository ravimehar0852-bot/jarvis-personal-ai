import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, setDoc, deleteDoc, getDocs, query, orderBy, limit, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig, CONFIGURED } from "./firebase-config.js";

const $ = (s) => document.querySelector(s);
const h = (t, p = {}, ...c) => { const e = document.createElement(t); Object.assign(e, p); c.flat().forEach((x) => x && e.append(x)); return e; };
const data = { conversations: [], memories: [], notes: [], reminders: [] };
let auth, db, user, convId = null, messages = [], busy = false, ctrl = null;
const notified = new Set();

const say = (t) => ($("#msg").textContent = t || "");

// ---------- theme / status ----------
document.documentElement.dataset.theme = localStorage.getItem("theme") || "dark";
$("#theme").onclick = () => {
  const t = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem("theme", t); } catch {}
};
const setStatus = () => { const s = $("#status"); s.textContent = navigator.onLine ? "online" : "offline"; s.classList.toggle("off", !navigator.onLine); };
addEventListener("online", setStatus); addEventListener("offline", setStatus); setStatus();

// ---------- drawer ----------
const drawer = (open) => { $("#drawer").classList.toggle("closed", !open); $("#scrim").hidden = !open; };
$("#menu").onclick = () => drawer(true);
$("#scrim").onclick = () => drawer(false);
document.querySelectorAll("#tabs button").forEach((b) => (b.onclick = () => {
  document.querySelectorAll("#tabs button").forEach((x) => x.classList.toggle("on", x === b));
  document.querySelectorAll("#drawer section").forEach((s) => (s.hidden = s.id !== "p-" + b.dataset.t));
}));

// ---------- firebase ----------
if (!CONFIGURED) {
  $("#banner").hidden = false;
  $("#banner").textContent = "Firebase is not configured yet. Edit firebase-config.js (see README). Login and saving are disabled until then.";
  $("#auth").hidden = false;
} else {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app); db = getFirestore(app);
  onAuthStateChanged(auth, async (u) => {
    user = u; $("#auth").hidden = !!u;
    if (u) {
      $("#who").textContent = "Signed in as " + u.email;
      try { for (const n of Object.keys(data)) await load(n); } catch (e) { say("Could not load data: " + e.code); }
      render(); newChat();
    }
  });
}
const col = (n) => collection(db, "users", user.uid, n);
async function load(n) {
  const s = await getDocs(query(col(n), orderBy("updatedAt", "desc"), limit(200)));
  data[n] = s.docs.map((d) => ({ id: d.id, ...d.data() }));
}
async function save(n, d, id) {
  const body = { ...d, updatedAt: serverTimestamp() };
  if (id) await setDoc(doc(col(n), id), body, { merge: true }); else id = (await addDoc(col(n), body)).id;
  await load(n); render(); return id;
}
async function del(n, id) { await deleteDoc(doc(col(n), id)); await load(n); render(); }

// ---------- auth UI ----------
const creds = () => [$("#em").value.trim(), $("#pw").value];
const authErr = (e) => ($("#authMsg").textContent = ({ "auth/invalid-credential": "Wrong email or password.", "auth/email-already-in-use": "Email already registered.", "auth/weak-password": "Password too short (min 6).", "auth/invalid-email": "Invalid email." })[e.code] || "Error: " + e.code);
const needCfg = () => !CONFIGURED && (($("#authMsg").textContent = "Configure Firebase first."), true);
$("#login").onclick = () => { if (!needCfg()) signInWithEmailAndPassword(auth, ...creds()).catch(authErr); };
$("#reg").onclick = () => { if (!needCfg()) createUserWithEmailAndPassword(auth, ...creds()).catch(authErr); };
$("#reset").onclick = () => { if (needCfg()) return; sendPasswordResetEmail(auth, $("#em").value.trim()).then(() => ($("#authMsg").textContent = "Reset email sent (check spam)."), authErr); };
$("#logout").onclick = () => { drawer(false); signOut(auth); };

// ---------- rendering ----------
function bubble(m) {
  const safe = (m.sources || []).filter((s) => /^https?:\/\//.test(s.url));
  return h("div", { className: "b " + m.role }, h("div", { textContent: m.text }),
    safe.length ? h("div", { className: "src" }, "Web sources:", safe.map((s) => h("a", { href: s.url, target: "_blank", rel: "noopener noreferrer", textContent: s.title }))) : null);
}
function renderChat() {
  const log = $("#log"); log.replaceChildren(...messages.map(bubble));
  $("main").scrollTop = $("main").scrollHeight;
}
const item = (text, cls, ...btns) => h("div", { className: "item " + cls }, h("span", { textContent: text }), ...btns);
const btn = (label, fn, cls = "") => h("button", { textContent: label, className: cls, onclick: fn });
function render() {
  $("#l-conversations").replaceChildren(...data.conversations.map((c) => item(c.title || "Chat", "",
    btn("Open", () => { convId = c.id; messages = c.messages || []; renderChat(); drawer(false); }), btn("✕", () => { if (c.id === convId) newChat(); del("conversations", c.id); }, "danger"))));
  $("#l-memories").replaceChildren(...data.memories.map((m) => item(m.text, "",
    btn("Edit", () => { const t = prompt("Edit memory", m.text); if (t && t.trim()) save("memories", { text: t.trim().slice(0, 500) }, m.id); }),
    btn("✕", () => del("memories", m.id), "danger"))));
  const q = $("#noteSearch").value.toLowerCase();
  $("#l-notes").replaceChildren(...data.notes.filter((n) => n.text.toLowerCase().includes(q)).map((n) => item(n.text, "", btn("✕", () => del("notes", n.id), "danger"))));
  const rs = [...data.reminders].sort((a, b) => (a.at || "").localeCompare(b.at || ""));
  $("#l-reminders").replaceChildren(...rs.map((r) => item(`${r.text} — ${r.at ? new Date(r.at).toLocaleString() : ""}`, r.done ? "done" : "",
    btn(r.done ? "Undo" : "Done", () => save("reminders", { done: !r.done }, r.id)), btn("✕", () => del("reminders", r.id), "danger"))));
}
function newChat() { convId = null; messages = [{ role: "model", text: "JARVIS online. How can I help? (English / हिन्दी / Hinglish)" }]; messages[0].sources = []; renderChat(); drawer(false); }
$("#newchat").onclick = () => user && newChat();

// ---------- memory / notes / reminders ----------
const need = () => !user && (say("Log in first."), true);
$("#memAdd").onclick = async () => { const t = $("#memIn").value.trim(); if (!t || need()) return; $("#memIn").value = ""; await save("memories", { text: t.slice(0, 500) }); };
$("#memClear").onclick = async () => { if (need() || !confirm("Delete ALL memories?")) return; for (const m of data.memories) await deleteDoc(doc(col("memories"), m.id)); await load("memories"); render(); };
$("#noteAdd").onclick = async () => { const t = $("#noteIn").value.trim(); if (!t || need()) return; $("#noteIn").value = ""; await save("notes", { text: t.slice(0, 2000) }); };
$("#noteSearch").oninput = render;
$("#remAdd").onclick = async () => { const t = $("#remIn").value.trim(), at = $("#remAt").value; if (!t || !at || need()) return say("Enter text and a time."); $("#remIn").value = ""; await save("reminders", { text: t.slice(0, 300), at: new Date(at).toISOString(), done: false }); };
$("#remPerm").onclick = async () => { if (!("Notification" in window)) return say("Notifications not supported here."); say("Notifications: " + (await Notification.requestPermission())); };
setInterval(() => {
  const now = Date.now();
  data.reminders.filter((r) => !r.done && r.at && new Date(r.at) <= now && !notified.has(r.id)).forEach((r) => {
    notified.add(r.id); say("⏰ Reminder: " + r.text);
    try { if (Notification.permission === "granted") new Notification("JARVIS reminder", { body: r.text }); } catch {}
  });
}, 20000);

function relevantMemories(text) {
  const w = new Set(text.toLowerCase().match(/\p{L}{3,}/gu) || []);
  return data.memories.map((m) => ({ t: m.text, s: (m.text.toLowerCase().match(/\p{L}{3,}/gu) || []).filter((x) => w.has(x)).length }))
    .filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 8).map((x) => x.t);
}

// ---------- chat ----------
function setBusy(b) { busy = b; $("#send").textContent = b ? "Stop" : "Send"; $("#orb").classList.toggle("think", b); }
async function send() {
  if (busy) return ctrl && ctrl.abort();
  if (need()) return;
  const text = $("#input").value.trim(); if (!text) return;
  say("");
  if (text.startsWith("/remember ")) { $("#input").value = ""; await save("memories", { text: text.slice(10).trim().slice(0, 500) }); return say("Saved to memory."); }
  if (!navigator.onLine) return say("You are offline.");
  $("#input").value = ""; messages.push({ role: "user", text, sources: [] }); renderChat();
  ctrl = new AbortController(); setBusy(true);
  try {
    const H = { "Content-Type": "application/json", Authorization: "Bearer " + (await user.getIdToken()) };
    let sources = [];
    if ($("#web").checked) {
      const r = await fetch("/api/search", { method: "POST", headers: H, body: JSON.stringify({ q: text }), signal: ctrl.signal });
      const j = await r.json().catch(() => ({}));
      if (r.ok) sources = j.results || []; else say("Web search unavailable: " + (j.error || r.status) + " (answering without it)");
    }
    const history = messages.filter((m) => m.text).slice(-20).map(({ role, text }) => ({ role, text }));
    while (history.length && history[0].role !== "user") history.shift();
    const r = await fetch("/api/chat", { method: "POST", headers: H, body: JSON.stringify({ history, memories: relevantMemories(text), sources }), signal: ctrl.signal });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Server error " + r.status);
    messages.push({ role: "model", text: j.reply, sources: sources.map(({ title, url }) => ({ title, url })) }); renderChat();
    if ($("#speak").checked && "speechSynthesis" in window) { const u = new SpeechSynthesisUtterance(j.reply); u.lang = $("#lang").value; speechSynthesis.cancel(); speechSynthesis.speak(u); }
    const title = (messages.find((m) => m.role === "user")?.text || "Chat").slice(0, 40);
    convId = await save("conversations", { title, messages: messages.slice(-60) }, convId);
  } catch (e) {
    messages.pop(); renderChat(); $("#input").value = text;
    say(e.name === "AbortError" ? "Stopped." : e instanceof TypeError ? "Network error. Check your connection." : e.message);
  } finally { setBusy(false); }
}
$("#send").onclick = send;
$("#input").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } });
$("#input").addEventListener("input", (e) => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; });

// ---------- voice ----------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null;
$("#mic").onclick = () => {
  if (!SR) return say("Voice input is not supported in this browser. Try Chrome on Android.");
  if (rec) return rec.stop();
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  rec = new SR(); rec.lang = $("#lang").value; rec.interimResults = false;
  rec.onstart = () => { say("🎙 Listening… tap the mic to stop."); $("#mic").textContent = "⏹"; };
  rec.onresult = (e) => { $("#input").value = e.results[0][0].transcript; send(); };
  rec.onerror = (e) => { if (e.error === "aborted") return; say(e.error === "not-allowed" ? "Microphone permission denied. Allow it in Chrome site settings." : e.error === "no-speech" ? "Didn't hear anything. Tap the mic and try again." : "Voice error: " + e.error); };
  rec.onend = () => { rec = null; $("#mic").textContent = "🎤"; if ($("#msg").textContent.startsWith("🎙")) say(""); };
  rec.start();
};
