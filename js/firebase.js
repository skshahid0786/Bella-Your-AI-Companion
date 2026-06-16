// ============================================================
//  firebase.js  — Firebase init + auth state
//  Loaded as <script type="module"> in index.html
// ============================================================

import { initializeApp }    from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

// ── Firebase config ──────────────────────────────────────────
// SECURITY NOTE: Firebase API keys for web apps are public by design.
// Actual security is enforced server-side via:
//   1. Firestore Security Rules  (only authenticated users read/write their own doc)
//   2. Firebase Auth domain whitelisting (limit to your Hosting domain in Firebase Console > Auth > Settings > Authorised domains)
//   3. App Check (optional but recommended — blocks non-app requests)
// ─────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyBZwypq0KTahld4vOZRaDXv2tGdKT6iFOE",
  authDomain:        "bella-b1362.firebaseapp.com",
  databaseURL:       "https://bella-b1362-default-rtdb.firebaseio.com",
  projectId:         "bella-b1362",
  storageBucket:     "bella-b1362.firebasestorage.app",
  messagingSenderId: "122567484038",
  appId:             "1:122567484038:web:151cab01150d1d82882707"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// Expose to non-module scripts
window._fb = {
  auth, db,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut, onAuthStateChanged,
  doc, getDoc, setDoc, updateDoc, serverTimestamp
};

// ── Auth state listener ───────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const userRef = doc(db, "users", user.uid);
    let snap = await getDoc(userRef);

    const today    = new Date().toDateString();
    const todayFmt = _formatDateKey(new Date());

    if (!snap.exists()) {
      // Brand-new user
      await setDoc(userRef, {
        name:       window._pendingName || "Friend",
        email:      user.email,
        birthdate:  window._pendingBirthdate || "",
        isPremium:  false,
        hearts: {
          balance:      10,
          lastReset:    today,
          totalEarned:  10
        },
        streak: {
          count:        1,
          lastLoginDay: todayFmt
        },
        msgCount:         0,
        surpriseShownAt:  "",
        birthdayShownYear: 0,
        createdAt:        serverTimestamp()
      });
      snap = await getDoc(userRef);
    }

    let data = snap.data();

    // ── Daily heart reset ──
    if (data.hearts.lastReset !== today) {
      const dailyGrant = data.isPremium ? 30 : 10;
      await updateDoc(userRef, {
        "hearts.balance":     dailyGrant,
        "hearts.lastReset":   today,
        "hearts.totalEarned": (data.hearts.totalEarned || 0) + dailyGrant,
        msgCount: 0
      });
    }

    // ── Login streak ──
    const yesterday = _formatDateKey(_daysAgo(1));
    const streakData = data.streak || { count: 0, lastLoginDay: "" };
    let newStreak = streakData.count || 0;

    if (streakData.lastLoginDay === todayFmt) {
      // Already logged in today — keep streak
    } else if (streakData.lastLoginDay === yesterday) {
      // Consecutive day — increment
      newStreak += 1;
      await updateDoc(userRef, {
        "streak.count":        newStreak,
        "streak.lastLoginDay": todayFmt
      });
    } else {
      // Streak broken
      newStreak = 1;
      await updateDoc(userRef, {
        "streak.count":        1,
        "streak.lastLoginDay": todayFmt
      });
    }

    // ── Streak bonus hearts ──
    const bonusMilestones = [3, 7, 14, 30];
    if (streakData.lastLoginDay !== todayFmt && bonusMilestones.includes(newStreak)) {
      const bonus = newStreak >= 30 ? 10 : newStreak >= 14 ? 6 : newStreak >= 7 ? 4 : 2;
      await updateDoc(userRef, { "hearts.balance": (data.hearts?.balance ?? 10) + bonus });
      window._streakBonus = { days: newStreak, hearts: bonus };
    }

    // Re-fetch fresh data
    snap = await getDoc(userRef);
    data = snap.data();

    window.onUserReady({ ...data, streak: { ...data.streak, count: newStreak } }, user.uid);

  } else {
    // Not signed in — show auth
    _hideSplash();
    document.getElementById("authOverlay").classList.remove("hidden");
  }
});

// ── Helpers ──────────────────────────────────────────────────
function _hideSplash() {
  const splash = document.getElementById("splashScreen");
  splash.classList.add("fade-out");
  setTimeout(() => splash.classList.add("gone"), 500);
}

function _formatDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function _daysAgo(n) {
  const d = new Date(); d.setDate(d.getDate() - n); return d;
}
