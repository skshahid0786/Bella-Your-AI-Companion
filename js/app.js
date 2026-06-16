// ============================================================
//  app.js  — Bella main application logic
// ============================================================

// ── Config ───────────────────────────────────────────────────
const CHAT_API_URL     = "https://shahid202-image30.hf.space/chat";
const TTS_GENERATE_URL = "https://shahid202-kokoro-api.hf.space/tts";
const TTS_OUTPUT_URL   = "https://shahid202-kokoro-api.hf.space/static/output.wav";
const STORAGE_KEY      = "bella_chat_v2";
const GALLERY_KEY      = "bella_gallery";
const SETTINGS_KEY     = "bella_settings";
const IMAGE_EVERY_N    = 5;
const MSGS_PER_HEART   = 20;

const BASE_CHARACTER_PROMPTS = [
  "anime style","digital art","young woman","fair complexion",
  "long dark hair cascading down her shoulders",
  "light-colored bikini with halter neck and front tie detail, high-cut bottoms",
  "confident pose, posing directly for the camera"
];
const POSE_PROMPTS = [
  "kneeling on the sandy beach, hands resting on her hips, coastal backdrop, sunny day",
  "standing at the shoreline, waves gently washing over her feet, golden hour lighting",
  "sitting on a beach towel, leaning back on her hands, ocean view behind her",
  "walking along the beach, looking back over her shoulder, sand and sea in the background",
  "lying on a beach lounger under an umbrella, relaxed pose, tropical resort setting",
  "standing near palm trees, one hand brushing her hair back, blue sky and ocean behind",
  "sitting on a wooden pier over the water, legs dangling, sunset colors in the sky"
];
const PIC_REQUEST_KEYWORDS = [
  "send pic","send a pic","send photo","your pic","ur pic","send selfie",
  "selfie","show me","pic please","picture of you","photo of you",
  "what do you look like","show your face","send picture","send image"
];
const ACTIVITY_KEYWORDS = [
  "what are you doing","what r u doing","wyd","what are u doing","what're you up to","what you up to"
];
const SURPRISE_MESSAGES = [
  "Hey {name}! I was thinking about you 💜 How's your day going?",
  "{name}! Bella misses you~ Send me a message! 🌸",
  "Random thought: you're pretty amazing, {name} ✨",
  "Hey {name} 💜 Did you know smiling boosts your mood instantly? Try it!",
  "{name}! I just imagined us watching stars together 🌠 So peaceful~",
  "Bella is bored without you, {name}! Come chat 💜",
  "Missing you, {name}! 🌸 Tell me something that made you smile today.",
];
const THEMES = [
  { id: "rose",   label: "Rose",   from: "#f472b6", to: "#c084fc" },
  { id: "night",  label: "Night",  from: "#7c3aed", to: "#4f46e5" },
  { id: "sakura", label: "Sakura", from: "#fb7185", to: "#f43f5e" },
  { id: "ocean",  label: "Ocean",  from: "#0ea5e9", to: "#6366f1" },
  { id: "forest", label: "Forest", from: "#059669", to: "#0d9488" },
];

// ── State ─────────────────────────────────────────────────────
let chatHistory      = [];
let galleryImages    = [];
let userMessageCount = 0;
let _uid             = null;
let _isPremium       = false;
let _hearts          = 0;
let _msgCountToday   = 0;
let _userName        = "";
let _streak          = 0;
let _settings        = {
  theme:       "rose",
  typingSound: true,
  vibration:   true,
  bgMusic:     true,
};
window._pendingName      = "";
window._pendingBirthdate = "";

// ── DOM refs ─────────────────────────────────────────────────
const messagesEl    = document.getElementById("messages");
const inputEl       = document.getElementById("userInput");
const sendBtn       = document.getElementById("sendBtn");
const lightbox      = document.getElementById("lightbox");
const lightboxImg   = document.getElementById("lightboxImg");
const authOverlay   = document.getElementById("authOverlay");
const galleryPanel  = document.getElementById("galleryPanel");
const galleryGrid   = document.getElementById("galleryGrid");
const heartsPanel   = document.getElementById("heartsPanel");
const settingsPanel = document.getElementById("settingsPanel");
const confirmDlg    = document.getElementById("confirmDialog");
const premiumBadge  = document.getElementById("premiumBadge");
const userBar       = document.getElementById("userBar");
const userBarName   = document.getElementById("userBarName");
const heartDisplay  = document.getElementById("heartCountDisplay");
const hpBalanceNum  = document.getElementById("hpBalanceNum");
const streakPill    = document.getElementById("streakPill");
const toast         = document.getElementById("toast");
const birthdayModal = document.getElementById("birthdayModal");

// ── Audio ─────────────────────────────────────────────────────
const bgAudio = new Audio("https://cdn.pixabay.com/download/audio/2022/03/10/audio_5e5fc4ca17.mp3?filename=lofi-study-112191.mp3");
bgAudio.loop   = true;
bgAudio.volume = 0.2;

// Typing sound (short soft click)
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let _audioCtx;
function _getAudioCtx() {
  if (!_audioCtx) _audioCtx = new AudioCtx();
  return _audioCtx;
}
function playTypingSound() {
  if (!_settings.typingSound) return;
  try {
    const ctx = _getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 800 + Math.random() * 200;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.05);
  } catch(e) {}
}

function vibrate(pattern) {
  if (!_settings.vibration) return;
  if (navigator.vibrate) navigator.vibrate(pattern);
}

function startBgMusic() {
  if (!_settings.bgMusic) return;
  bgAudio.play().catch(() => {}); // may need user gesture
}
function stopBgMusic() { bgAudio.pause(); }

// ── Settings persistence ──────────────────────────────────────
function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    if (s) _settings = { ..._settings, ...s };
  } catch(e) {}
}
function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(_settings));
}

// ── Theme ─────────────────────────────────────────────────────
function applyTheme(id) {
  _settings.theme = id;
  document.body.setAttribute("data-theme", id);
  saveSettings();
  // Refresh active chip
  document.querySelectorAll(".theme-chip").forEach(c => {
    c.classList.toggle("active", c.dataset.theme === id);
  });
}

function buildThemePicker() {
  const grid = document.getElementById("themeGrid");
  THEMES.forEach(t => {
    const chip = document.createElement("div");
    chip.className = "theme-chip" + (t.id === _settings.theme ? " active" : "");
    chip.dataset.theme = t.id;
    chip.innerHTML = `
      <div class="theme-swatch" style="background:linear-gradient(135deg,${t.from},${t.to})"></div>
      <span class="theme-chip-label">${t.label}</span>
    `;
    chip.onclick = () => applyTheme(t.id);
    grid.appendChild(chip);
  });
}

// ── onUserReady ───────────────────────────────────────────────
window.onUserReady = function(data, uid) {
  _uid           = uid;
  _isPremium     = data.isPremium === true;
  _hearts        = data.hearts?.balance ?? 10;
  _msgCountToday = data.msgCount || 0;
  _userName      = data.name || "Friend";
  _streak        = data.streak?.count || 1;

  userBarName.textContent = _userName;
  userBar.classList.add("visible");
  premiumBadge.classList.add("clickable");
  premiumBadge.classList.toggle("visible", _isPremium);
  streakPill.textContent = `🔥 ${_streak}d`;
  streakPill.classList.remove("hidden");

  updateHeartDisplay();

  // Dismiss splash
  const splash = document.getElementById("splashScreen");
  splash.classList.add("fade-out");
  setTimeout(() => {
    splash.classList.add("gone");
    authOverlay.classList.add("hidden");
  }, 600);

  loadSettings();
  applyTheme(_settings.theme);
  buildThemePicker();
  syncSettingsUI();
  loadHistory();
  loadGallery();
  if (galleryImages.length > 0) setWallpaper(galleryImages[0]);

  // Apply saved avatar
  const savedAvatar = _settings.avatar || "👩‍💼";
  const headerAvEl = document.getElementById("headerAvatar");
  if (headerAvEl) headerAvEl.textContent = savedAvatar;

  // Premium badge opens upgrade panel if not premium, or shows status if premium
  premiumBadge.onclick = () => _isPremium ? showToast("🌟 You're already Premium!") : openPremium();

  // Start bg music (after user interaction via sign-in)
  if (_settings.bgMusic) startBgMusic();

  // Streak bonus notification
  if (window._streakBonus) {
    const { days, hearts } = window._streakBonus;
    setTimeout(() => showToast(`🔥 ${days}-day streak! +${hearts} bonus hearts! 💜`), 1200);
    window._streakBonus = null;
  }

  // Birthday check
  checkBirthday(data);

  // Surprise message (once per day, random timing)
  scheduleSupriseMessage();

  // Header greeting with name
  document.getElementById("headerName").textContent = `Bella ✿`;
  document.getElementById("headerStatus").textContent = `Online for you, ${_userName} 💜`;
};

// ── Birthday check ────────────────────────────────────────────
function checkBirthday(data) {
  if (!data.birthdate) return;
  const now = new Date();
  const bd  = new Date(data.birthdate + "T00:00");
  if (bd.getMonth() === now.getMonth() && bd.getDate() === now.getDate()) {
    const lastShown = data.birthdayShownYear || 0;
    if (lastShown !== now.getFullYear()) {
      setTimeout(() => {
        document.getElementById("birthdayName").textContent = _userName;
        birthdayModal.classList.add("open");
        vibrate([100, 50, 100, 50, 200]);
        // Update so we don't show again this year
        try {
          const { db, doc, updateDoc } = window._fb;
          updateDoc(doc(db, "users", _uid), { birthdayShownYear: now.getFullYear() });
        } catch(e) {}
      }, 2500);
    }
  }
}

// ── Surprise messages ─────────────────────────────────────────
function scheduleSupriseMessage() {
  // Show one random surprise message once per day, after 60-90s idle
  const lastShown = localStorage.getItem("bella_surprise_shown");
  const today     = new Date().toDateString();
  if (lastShown === today) return;

  const delay = 60000 + Math.random() * 30000;
  setTimeout(() => {
    if (document.hidden) return; // only if tab is active
    const template = SURPRISE_MESSAGES[Math.floor(Math.random() * SURPRISE_MESSAGES.length)];
    const msg      = template.replace(/\{name\}/g, _userName);
    renderTextMessage(msg, "bot", formatTime(new Date()), true);
    vibrate([80, 40, 80]);
    localStorage.setItem("bella_surprise_shown", today);
  }, delay);
}

// ── Heart display ─────────────────────────────────────────────
function updateHeartDisplay() {
  heartDisplay.textContent = _hearts;
  hpBalanceNum.textContent = _hearts;
  const pill = document.getElementById("heartPill");
  pill.classList.remove("heart-pop");
  void pill.offsetWidth;
  pill.classList.add("heart-pop");
  document.getElementById("yourPlanVal").textContent =
    _isPremium ? "★ Premium — 30 💜/day" : "Normal — 10 💜/day";
}

async function spendHeart() {
  if (_hearts <= 0) { showNoHeartsToast(); return false; }
  _hearts--;
  updateHeartDisplay();
  try {
    const { db, doc, updateDoc } = window._fb;
    await updateDoc(doc(db, "users", _uid), { "hearts.balance": _hearts });
  } catch(e) {}
  return true;
}

async function addHearts(amount) {
  _hearts += amount;
  updateHeartDisplay();
  try {
    const { db, doc, updateDoc } = window._fb;
    await updateDoc(doc(db, "users", _uid), { "hearts.balance": _hearts });
  } catch(e) {}
}

function showNoHeartsToast() { showToast("💜 Not enough hearts — watch an ad to earn more!"); }

// ── Generic toast ─────────────────────────────────────────────
let _toastTimer;
function showToast(msg, duration = 3500) {
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => toast.classList.remove("show"), duration);
}

// ── Auth ──────────────────────────────────────────────────────
let _authMode = "login";

function switchAuthTab(mode) {
  _authMode = mode;
  document.getElementById("forgotLink").style.display = mode === "login" ? "block" : "none";
  document.getElementById("tabLogin").classList.toggle("active",  mode === "login");
  document.getElementById("tabSignup").classList.toggle("active", mode === "signup");
  document.getElementById("authName").style.display      = mode === "signup" ? "block" : "none";
  document.getElementById("birthdateLabel").style.display = mode === "signup" ? "block" : "none";
  document.querySelector(".btn-label").textContent =
    mode === "login" ? "Sign In" : "Create Account";
  document.getElementById("authError").textContent = "";
}


async function handleForgotPassword() {
  const email = document.getElementById("authEmail").value.trim();
  const errEl = document.getElementById("authError");
  if (!email) { errEl.textContent = "Enter your email above first."; return; }
  try {
    const { auth } = window._fb;
    const { sendPasswordResetEmail } = await import("https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js");
    await sendPasswordResetEmail(auth, email);
    errEl.style.color = "var(--success)";
    errEl.textContent = "✅ Reset email sent! Check your inbox.";
    setTimeout(() => { errEl.style.color = ""; errEl.textContent = ""; }, 5000);
  } catch(err) {
    errEl.textContent = _authError(err.code);
  }
}
window.handleForgotPassword = handleForgotPassword;




async function handleAuth() {
  const name      = document.getElementById("authName").value.trim();
  const birthdate = document.getElementById("authBirthdate").value;
  const email     = document.getElementById("authEmail").value.trim();
  const password  = document.getElementById("authPassword").value;
  const errEl     = document.getElementById("authError");
  const btn       = document.getElementById("authSubmit");
  errEl.textContent = "";

  if (!email || !password) { errEl.textContent = "Please enter email and password."; return; }
  if (_authMode === "signup" && !name) { errEl.textContent = "Please enter your name."; return; }

  btn.classList.add("loading"); btn.disabled = true;
  window._pendingName      = name;
  window._pendingBirthdate = birthdate;

  try {
    const { auth, createUserWithEmailAndPassword, signInWithEmailAndPassword } = window._fb;
    if (_authMode === "signup") {
      await createUserWithEmailAndPassword(auth, email, password);
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
  } catch(err) {
    errEl.textContent = _authError(err.code);
    btn.classList.remove("loading"); btn.disabled = false;
  }
}

function _authError(code) {
  const m = {
    "auth/invalid-email":        "Invalid email address.",
    "auth/user-not-found":       "No account found with that email.",
    "auth/wrong-password":       "Incorrect password.",
    "auth/email-already-in-use": "Email already registered — try signing in.",
    "auth/weak-password":        "Password needs at least 6 characters.",
    "auth/too-many-requests":    "Too many attempts. Please try again later.",
    "auth/invalid-credential":   "Invalid email or password.",
  };
  return m[code] || "Something went wrong. Please try again.";
}

function handleLogout() {
  const { auth, signOut } = window._fb;
  signOut(auth).then(() => {
    _uid = null; _isPremium = false; _hearts = 0;
    chatHistory = []; userMessageCount = 0;
    messagesEl.innerHTML = "";
    userBar.classList.remove("visible");
    premiumBadge.classList.remove("visible");
    streakPill.classList.add("hidden");
    heartDisplay.textContent = "—";
    stopBgMusic();
    authOverlay.classList.remove("hidden");
    document.getElementById("splashScreen").classList.remove("fade-out", "gone");
  });
}

// ── Settings panel ────────────────────────────────────────────
function openSettings()  { settingsPanel.classList.add("open"); updatePushUI(); }
function closeSettings() { settingsPanel.classList.remove("open"); }

// ── Profile panel ─────────────────────────────────────────────
function openProfile() {
  document.getElementById("profileNameInput").value     = _userName;
  document.getElementById("profileBirthdateInput").value = "";
  // Pick currently-active avatar
  document.querySelectorAll(".avatar-chip").forEach(c => {
    c.classList.toggle("active", c.dataset.avatar === (_settings.avatar || "👩‍💼"));
  });
  document.getElementById("profilePanel").classList.add("open");
}
function closeProfile() { document.getElementById("profilePanel").classList.remove("open"); }
window.openProfile  = openProfile;
window.closeProfile = closeProfile;

function selectAvatar(chip) {
  document.querySelectorAll(".avatar-chip").forEach(c => c.classList.remove("active"));
  chip.classList.add("active");
}
window.selectAvatar = selectAvatar;

async function saveProfile() {
  const newName = document.getElementById("profileNameInput").value.trim();
  const newBd   = document.getElementById("profileBirthdateInput").value;
  const activeAvatar = document.querySelector(".avatar-chip.active");
  const newAvatar = activeAvatar ? activeAvatar.dataset.avatar : (_settings.avatar || "👩‍💼");

  if (!newName) { showToast("Name can't be empty!"); return; }

  const updates = { name: newName };
  if (newBd) updates.birthdate = newBd;

  try {
    const { db, doc, updateDoc } = window._fb;
    await updateDoc(doc(db, "users", _uid), updates);
  } catch(e) {}

  _userName = newName;
  _settings.avatar = newAvatar;
  saveSettings();

  userBarName.textContent = _userName;
  document.getElementById("headerStatus").textContent = `Online for you, ${_userName} 💜`;
  document.getElementById("headerAvatar").textContent = newAvatar;
  closeProfile();
  showToast("✅ Profile updated!");
}
window.saveProfile = saveProfile;

// ── Premium upgrade ───────────────────────────────────────────
function openPremium() { document.getElementById("premiumPanel").classList.add("open"); }
function closePremium() { document.getElementById("premiumPanel").classList.remove("open"); }
window.openPremium  = openPremium;
window.closePremium = closePremium;

async function activatePremium(plan) {
  // In a real app, this is where you'd call your payment backend.
  // For now, simulate a successful upgrade with a confirmation UX.
  const btn = document.querySelector(`.premium-plan-btn[data-plan="${plan}"]`);
  if (btn) { btn.textContent = "⏳ Processing…"; btn.disabled = true; }

  await new Promise(r => setTimeout(r, 1500)); // Simulate network

  try {
    const { db, doc, updateDoc } = window._fb;
    await updateDoc(doc(db, "users", _uid), {
      isPremium: true,
      "hearts.balance": 30,
      premiumSince: new Date().toISOString(),
      premiumPlan: plan
    });
  } catch(e) {}

  _isPremium = true;
  _hearts    = 30;
  updateHeartDisplay();
  premiumBadge.classList.add("visible");
  closePremium();
  showToast("🌟 Welcome to Premium! You now have 30 💜/day!");
}
window.activatePremium = activatePremium;

function syncSettingsUI() {
  document.getElementById("toggleTypingSound").checked = _settings.typingSound;
  document.getElementById("toggleVibration").checked   = _settings.vibration;
  document.getElementById("toggleBgMusic").checked     = _settings.bgMusic;
}

function onToggleTypingSound(el) { _settings.typingSound = el.checked; saveSettings(); }
function onToggleVibration(el)   { _settings.vibration   = el.checked; saveSettings(); }
function onToggleBgMusic(el) {
  _settings.bgMusic = el.checked;
  saveSettings();
  el.checked ? startBgMusic() : stopBgMusic();
}

// ── Ad / Hearts ───────────────────────────────────────────────
function watchAd() {
  const btn  = document.getElementById("watchAdBtn");
  const note = document.getElementById("adNote");
  btn.disabled = true;
  note.textContent = "⏳ Loading ad...";
  try { (adsbygoogle = window.adsbygoogle || []).push({}); } catch(e) {}
  setTimeout(() => {
    addHearts(3);
    note.textContent = "✅ +3 💜 added! Thanks for supporting Bella!";
    btn.disabled = false;
    setTimeout(() => { note.textContent = ""; }, 4000);
  }, 3000);
}

function openHeartsPanel()  { heartsPanel.classList.add("open"); }
function closeHeartsPanel() { heartsPanel.classList.remove("open"); }

// ── Gallery ───────────────────────────────────────────────────
function openGallery()  { galleryPanel.classList.add("open"); }
function closeGallery() { galleryPanel.classList.remove("open"); }

function loadGallery() {
  try { galleryImages = JSON.parse(localStorage.getItem(GALLERY_KEY)) || []; } catch(e) { galleryImages = []; }
  renderGallery();
}
function saveGallery()    { localStorage.setItem(GALLERY_KEY, JSON.stringify(galleryImages)); }
function addToGallery(u)  { galleryImages.unshift(u); if (galleryImages.length > 50) galleryImages.pop(); saveGallery(); renderGallery(); }
function renderGallery() {
  if (!galleryImages.length) {
    galleryGrid.innerHTML = '<div class="gallery-empty">No photos yet — chat with Bella! 💜</div>';
    return;
  }
  galleryGrid.innerHTML = "";
  galleryImages.forEach(url => {
    const img = document.createElement("img");
    img.src = url; img.loading = "lazy";
    img.onclick = () => openLightbox(url);
    galleryGrid.appendChild(img);
  });
}

// ── Wallpaper ─────────────────────────────────────────────────
function setWallpaper(url) {
  document.body.style.backgroundImage = `url(${url})`;
  document.body.classList.add("wallpaper-active");
  document.getElementById("chatContainer").style.backdropFilter = "blur(2px)";
}

// ── Lightbox ──────────────────────────────────────────────────
function openLightbox(url) { lightboxImg.src = url; lightbox.classList.add("active"); }
function closeLightbox()   { lightbox.classList.remove("active"); lightboxImg.src = ""; }

// ── Confirm clear ─────────────────────────────────────────────
function confirmClear() { confirmDlg.classList.add("open"); }
function closeConfirm() { confirmDlg.classList.remove("open"); }
function executeClear() {
  chatHistory = []; userMessageCount = 0;
  messagesEl.innerHTML = "";
  galleryImages = []; saveGallery(); renderGallery();
  localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(GALLERY_KEY);
  document.body.style.backgroundImage = "";
  document.body.classList.remove("wallpaper-active");
  document.getElementById("chatContainer").style.backdropFilter = "";
  closeConfirm();
}

// ── History ───────────────────────────────────────────────────
function saveHistory() { localStorage.setItem(STORAGE_KEY, JSON.stringify(chatHistory)); }
function loadHistory() {
  try {
    chatHistory = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    let lastDate = null;
    chatHistory.forEach(e => {
      const msgDate = e.date || null;
      if (msgDate && msgDate !== lastDate) {
        _appendDateDivider(msgDate);
        lastDate = msgDate;
      }
      if (e.type === "image") renderImageMessage(e.url, e.time, false);
      else renderTextMessage(e.content, e.role === "user" ? "user" : "bot", e.time);
    });
  } catch(e) { chatHistory = []; }
}

function _appendDateDivider(dateStr) {
  const div = document.createElement("div");
  div.className = "date-divider";
  div.textContent = dateStr;
  messagesEl.appendChild(div);
}

// ── Rendering ─────────────────────────────────────────────────
function formatTime(d) { return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
function formatDate(d) { return d.toLocaleDateString([], { month: "short", day: "numeric" }); }

function renderTextMessage(text, sender, timeStr, isSurprise = false) {
  const row    = document.createElement("div");
  row.className = `message-row ${sender === "user" ? "user-row" : "bot-row"}`;
  const bubble = document.createElement("div");
  bubble.className = `message ${sender}`;
  bubble.textContent = text;
  row.appendChild(bubble);
  if (sender === "bot") {
    const ab = document.createElement("button");
    ab.className = "audio-btn";
    ab.textContent = "🔊 Play";
    ab.onclick = () => playTTS(text, ab);
    row.appendChild(ab);
  }
  const ts = document.createElement("div");
  ts.className = "timestamp";
  ts.textContent = isSurprise ? `💜 Surprise message · ${timeStr}` : timeStr;
  row.appendChild(ts);
  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return row;
}

function renderImageMessage(imgUrl, timeStr) {
  const row     = document.createElement("div");
  row.className = "message-row bot-row";
  const wrapper = document.createElement("div");
  wrapper.className = "image-bubble";
  const img = document.createElement("img");
  img.src = imgUrl; img.loading = "lazy";
  img.onclick = () => openLightbox(imgUrl);
  wrapper.appendChild(img);
  const actions = document.createElement("div");
  actions.className = "image-actions";
  const dlBtn = document.createElement("button");
  dlBtn.textContent = "⬇ Save";
  dlBtn.onclick = (e) => {
    e.stopPropagation();
    const a = document.createElement("a");
    a.href = imgUrl; a.download = "bella.png";
    document.body.appendChild(a); a.click(); a.remove();
  };
  actions.appendChild(dlBtn); wrapper.appendChild(actions);
  row.appendChild(wrapper);
  const ts = document.createElement("div");
  ts.className = "timestamp"; ts.textContent = timeStr;
  row.appendChild(ts);
  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function renderImageSkeleton() {
  const row = document.createElement("div");
  row.className = "message-row bot-row";
  const skeleton = document.createElement("div");
  skeleton.className = "image-skeleton";
  skeleton.innerHTML = `<div class="skeleton-shimmer"></div><div class="skeleton-label">✨ Bella is sending a photo…</div>`;
  row.appendChild(skeleton);
  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return row; // caller removes this when image loads
}

// ── Image generation ──────────────────────────────────────────
function buildImagePrompt() {
  return BASE_CHARACTER_PROMPTS.join(", ") + ", " +
         POSE_PROMPTS[Math.floor(Math.random() * POSE_PROMPTS.length)];
}
function detectImageIntent(text) {
  const l = text.toLowerCase();
  return PIC_REQUEST_KEYWORDS.some(k => l.includes(k)) || ACTIVITY_KEYWORDS.some(k => l.includes(k));
}
async function autoSendImage() {
  const ok = await spendHeart();
  if (!ok) return;
  const prompt    = buildImagePrompt();
  const encoded   = encodeURIComponent(prompt);
  const seed      = Math.floor(Math.random() * 999999);
  // Pollinations.ai — publicly acknowledged open image API
  const imgUrl    = `https://image.pollinations.ai/prompt/${encoded}?width=512&height=512&seed=${seed}&model=flux&nologo=true`;
  const skeletonRow = renderImageSkeleton();
  try {
    await new Promise((res, rej) => {
      const t = new Image(); t.onload = res; t.onerror = rej; t.src = imgUrl;
    });
    skeletonRow.remove();
    const t = formatTime(new Date());
    const d = formatDate(new Date());
    renderImageMessage(imgUrl, t);
    chatHistory.push({ type: "image", url: imgUrl, time: t, date: d });
    saveHistory();
    addToGallery(imgUrl);
    setWallpaper(imgUrl);
    vibrate([60, 30, 60]);
  } catch(e) {
    skeletonRow.remove();
    showToast("⚠️ Couldn't load image right now. Try again!");
  }
}

// ── TTS ───────────────────────────────────────────────────────
async function playTTS(text, btn) {
  const orig = btn.textContent;
  btn.textContent = "⏳ Loading..."; btn.disabled = true;
  try {
    const r = await fetch(`${TTS_GENERATE_URL}?text=${encodeURIComponent(text)}&voice=af_heart`);
    if (!r.ok) throw new Error();
    const audio = new Audio(TTS_OUTPUT_URL + "?t=" + Date.now());
    audio.onplay  = () => { btn.textContent = "🔊 Playing..."; };
    audio.onended = () => { btn.textContent = orig; btn.disabled = false; };
    audio.onerror = () => { btn.textContent = "⚠️ Error"; setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 2000); };
    await audio.play();
  } catch(e) {
    btn.textContent = "⚠️ Failed";
    setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 2000);
  }
}

// ── Typing indicator ──────────────────────────────────────────
let _typingRow = null;
let _typingSoundInterval = null;
function showTypingIndicator() {
  _typingRow = document.createElement("div");
  _typingRow.className = "message-row bot-row";
  const b = document.createElement("div");
  b.className = "message bot typing";
  b.textContent = "Bella is typing...";
  _typingRow.appendChild(b);
  messagesEl.appendChild(_typingRow);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  // Play typing sounds while indicator is visible
  if (_settings.typingSound) {
    _typingSoundInterval = setInterval(playTypingSound, 120);
  }
}
function hideTypingIndicator() {
  if (_typingRow) { _typingRow.remove(); _typingRow = null; }
  if (_typingSoundInterval) { clearInterval(_typingSoundInterval); _typingSoundInterval = null; }
}

// ── Send message ──────────────────────────────────────────────
async function sendMessage() {
  const text = inputEl.value.trim();
  if (!text || !_uid) return;

  // Heart cost every N messages
  const nextCount = _msgCountToday + 1;
  if (nextCount % MSGS_PER_HEART === 0) {
    const ok = await spendHeart();
    if (!ok) return;
  }

  _msgCountToday = nextCount;
  try {
    const { db, doc, updateDoc } = window._fb;
    await updateDoc(doc(db, "users", _uid), { msgCount: _msgCountToday });
  } catch(e) {}

  const now = new Date();
  const t   = formatTime(now);
  const d   = formatDate(now);

  // Date divider on first message of a new day
  const lastEntry = chatHistory[chatHistory.length - 1];
  if (!lastEntry || lastEntry.date !== d) _appendDateDivider(d);

  renderTextMessage(text, "user", t);
  chatHistory.push({ role: "user", content: text, time: t, date: d });
  saveHistory();
  inputEl.value = "";
  sendBtn.disabled = true;
  vibrate([20]);

  showTypingIndicator();

  try {
    const res = await fetch(CHAT_API_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        message: text,
        history: chatHistory.filter(h => h.role),
        user_name: _userName
      })
    });
    if (!res.ok) throw new Error("Server error " + res.status);
    const data = await res.json();
    hideTypingIndicator();

    const botTime = formatTime(new Date());
    const reply   = data.response || "(no response)";
    renderTextMessage(reply, "bot", botTime);
    chatHistory.push({ role: "assistant", content: reply, time: botTime, date: d });
    saveHistory();
    vibrate([40, 20, 40]);

    userMessageCount++;
    if (detectImageIntent(text)) {
      setTimeout(autoSendImage, 500);
    } else if (userMessageCount % IMAGE_EVERY_N === 0) {
      setTimeout(autoSendImage, 500);
    }
  } catch(err) {
    hideTypingIndicator();
    renderTextMessage("⚠️ " + err.message, "bot", formatTime(new Date()));
  } finally {
    sendBtn.disabled = false;
    inputEl.focus();
  }
}

// ── Input keyboard ────────────────────────────────────────────
inputEl.addEventListener("keydown", e => {
  if (e.key === "Enter") sendMessage();
  else playTypingSound(); // play sound on each keystroke too
});

// Start bg music on first user interaction
document.addEventListener("click", () => {
  if (_settings.bgMusic) startBgMusic();
}, { once: true });

// Expose functions that HTML calls inline
window.sendMessage     = sendMessage;
window.switchAuthTab   = switchAuthTab;
window.handleAuth      = handleAuth;
window.handleLogout    = handleLogout;
window.openGallery     = openGallery;
window.closeGallery    = closeGallery;
window.openHeartsPanel  = openHeartsPanel;
window.closeHeartsPanel = closeHeartsPanel;
window.openSettings    = openSettings;
window.closeSettings   = closeSettings;
window.watchAd         = watchAd;
window.confirmClear    = confirmClear;
window.closeConfirm    = closeConfirm;
window.executeClear    = executeClear;
window.openLightbox    = openLightbox;
window.closeLightbox   = closeLightbox;
window.onToggleTypingSound = onToggleTypingSound;
window.onToggleVibration   = onToggleVibration;
window.onToggleBgMusic     = onToggleBgMusic;
window.closeBirthdayModal  = () => birthdayModal.classList.remove("open");
// Push notifications
window.requestPushPermission = requestPushPermission;

// ── Push Notifications (FCM) ──────────────────────────────────
async function requestPushPermission() {
  const btn  = document.getElementById("pushEnableBtn");
  const note = document.getElementById("pushNote");
  if (!("Notification" in window)) {
    note.textContent = "⚠️ Your browser doesn't support notifications.";
    return;
  }
  if (Notification.permission === "granted") {
    note.textContent = "✅ Notifications are already enabled!";
    return;
  }
  btn.disabled = true;
  btn.textContent = "⏳ Requesting…";
  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      // In production: call getToken(messaging, { vapidKey }) and save to Firestore
      // For now, show success and store preference
      _settings.pushEnabled = true;
      saveSettings();
      updatePushUI();
      note.textContent = "✅ Notifications enabled! Bella will message you even when you're away 💜";
      // Demo: schedule a test notification
      setTimeout(() => {
        new Notification("Bella 💜", {
          body: `Hey ${_userName}! Notifications are working perfectly~`,
          icon: "https://em-content.zobj.net/source/noto-emoji-animation/344/purple-heart_1f49c.gif"
        });
      }, 2000);
      try {
        const { db, doc, updateDoc } = window._fb;
        await updateDoc(doc(db, "users", _uid), { pushEnabled: true });
      } catch(e) {}
    } else {
      note.textContent = "❌ Permission denied. You can enable it in your browser settings.";
      btn.disabled = false;
      btn.textContent = "🔔 Enable Notifications";
    }
  } catch(e) {
    note.textContent = "⚠️ Something went wrong. Try again.";
    btn.disabled = false;
    btn.textContent = "🔔 Enable Notifications";
  }
}

function updatePushUI() {
  const btn  = document.getElementById("pushEnableBtn");
  const note = document.getElementById("pushNote");
  if (!btn) return;
  const granted = Notification.permission === "granted" && _settings.pushEnabled;
  btn.textContent = granted ? "✅ Notifications On" : "🔔 Enable Notifications";
  btn.disabled    = granted;
  if (granted) note.textContent = "Bella will send you surprise messages even when you're away 💜";
}
