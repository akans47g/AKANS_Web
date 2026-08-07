// ══════════════════════════════════════════════════════════
// firebase-config.js — AKANS Web Development Services
// Shared Firebase configuration for all pages
// ══════════════════════════════════════════════════════════

const firebaseConfig = {
  apiKey: "AIzaSyBqfFVCakhPXoS5EOD_x_xseYArTsiLI2A",
  authDomain: "akans-website.firebaseapp.com",
  projectId: "akans-website",
  storageBucket: "akans-website.firebasestorage.app",
  messagingSenderId: "319077212996",
  appId: "1:319077212996:web:bf6c437bf17e047f65ad11"
};

// Initialize only once (guard against duplicate init)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db   = firebase.firestore();

// ── SITE BASE URL ──────────────────────────────────────────
const SITE_URL = 'https://akans47g.github.io/AKANS_Web/';

// ── HELPER: Get current user (returns null if not logged in) ─
function getCurrentUser() {
  return new Promise(resolve => {
    const unsub = auth.onAuthStateChanged(user => {
      unsub();
      resolve(user);
    });
  });
}

// ── HELPER: Redirect to login if not authenticated ──────────
function requireLogin(redirectBack = true) {
  return new Promise(resolve => {
    auth.onAuthStateChanged(user => {
      if (!user) {
        const back = redirectBack ? '?from=' + encodeURIComponent(window.location.pathname) : '';
        window.location.href = 'login.html' + back;
      } else {
        resolve(user);
      }
    });
  });
}

// ── HELPER: Show toast message ───────────────────────────────
function showToastGlobal(msg, duration = 2500) {
  let t = document.getElementById('toast') || document.getElementById('copyToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.style.cssText = `
      position:fixed; bottom:100px; left:50%; transform:translateX(-50%) translateY(20px);
      background:#1a1f3c; color:#fff; font-size:0.82rem; font-weight:600;
      padding:0.65rem 1.4rem; border-radius:30px; opacity:0;
      transition:opacity 0.25s, transform 0.25s; z-index:9999;
      pointer-events:none; white-space:nowrap; font-family:'DM Sans',sans-serif;
    `;
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  t.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateX(-50%) translateY(20px)';
  }, duration);
}
