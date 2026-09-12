// ══════════════════════════════════════════════════════════════════
// admin-login.js — AKANS Admin Panel
// Sirf admin-login.html ke liye
// admin-all.js ke BAAD load karo
// ══════════════════════════════════════════════════════════════════

const ADMIN_EMAIL     = 'akans47g@gmail.com';
const MAX_ATTEMPTS    = 5;
const LOCKOUT_MINUTES = 30;

// ── TOGGLE PASSWORD ────────────────────────────────────────────────
function toggleAdminPass() {
  const inp = document.getElementById('adminPass');
  const btn = document.getElementById('togglePassBtn');
  if (!inp) return;
  if (inp.type === 'password') {
    inp.type = 'text';
    if (btn) btn.textContent = '🙈';
  } else {
    inp.type = 'password';
    if (btn) btn.textContent = '👁️';
  }
}

// ── SET LOADING ────────────────────────────────────────────────────
function setLoginLoading(loading) {
  const btn = document.getElementById('loginBtn');
  if (!btn) return;
  btn.disabled    = loading;
  btn.innerHTML   = loading
    ? '<span style="display:inline-block;animation:spinAnim 1s linear infinite">⟳</span> Verifying...'
    : '🔐 Admin Login';
}

// ── HIGHLIGHT FIELD ────────────────────────────────────────────────
function highlightField(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  const wrap = document.getElementById('wrap-' + id.replace('admin','').toLowerCase());
  if (wrap) wrap.classList.add('field-error-wrap');
  el.focus();
  showAdminToast(msg, 'warning');
  el.addEventListener('input', () => {
    if (wrap) wrap.classList.remove('field-error-wrap');
  }, { once: true });
}

// ── ADMIN LOGIN (Email + Password) ────────────────────────────────
async function adminLogin() {
  // Check lockout
  const lockoutEnd = parseInt(localStorage.getItem('adminLockoutEnd') || '0');
  if (Date.now() < lockoutEnd) {
    const remaining = Math.ceil((lockoutEnd - Date.now()) / 60000);
    showAdminToast(`🔒 ${remaining} minute baad try karein`, 'error');
    return;
  }

  const email = document.getElementById('adminEmail')?.value.trim();
  const pass  = document.getElementById('adminPass')?.value;

  if (!email) { highlightField('adminEmail', '⚠️ Email daalo'); return; }
  if (!pass)  { highlightField('adminPass',  '⚠️ Password daalo'); return; }

  if (email !== ADMIN_EMAIL) {
    recordFailedAttempt();
    showAdminToast('❌ Ye email admin nahi hai', 'error');
    return;
  }

  setLoginLoading(true);

  try {
    const cred = await auth.signInWithEmailAndPassword(email, pass);
    const user = cred.user;

    // Check admin role in Firestore
    const userDoc = await db.collection('users').doc(user.uid).get();
    const isAdmin = userDoc.exists && userDoc.data().role === 'admin';

    if (!isAdmin) {
      await auth.signOut();
      recordFailedAttempt();
      showAdminToast('❌ Access denied — role:admin set karo', 'error');
      setLoginLoading(false);
      return;
    }

    // Save session
    localStorage.setItem('adminSession', JSON.stringify({
      uid:         user.uid,
      email:       user.email,
      displayName: user.displayName || 'Admin',
      isAdmin:     true,
      timestamp:   Date.now()
    }));

    localStorage.removeItem('adminLoginAttempts');
    localStorage.removeItem('adminLockoutEnd');

    // Log
    db.collection('adminLogs').add({
      action: 'login', adminEmail: user.email,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(() => {});

    showAdminToast('✅ Welcome Admin!', 'success');
    setTimeout(() => window.location.replace('admin-dashboard.html'), 800);

  } catch(e) {
    let msg = '❌ Login failed';
    if (e.code === 'auth/wrong-password')         msg = '❌ Galat password';
    if (e.code === 'auth/user-not-found')          msg = '❌ Email registered nahi';
    if (e.code === 'auth/too-many-requests')       msg = '❌ Bahut zyada attempts';
    if (e.code === 'auth/network-request-failed')  msg = '❌ Internet check karo';
    recordFailedAttempt();
    showAdminToast(msg, 'error');
    setLoginLoading(false);
  }
}

// ── GOOGLE ADMIN LOGIN ────────────────────────────────────────────
async function adminGoogleLogin() {
  const btn = document.getElementById('googleAdminBtn');
  if (btn) {
    btn.disabled  = true;
    btn.innerHTML = '<span style="display:inline-block;animation:spinAnim 1s linear infinite">⟳</span> Redirecting...';
  }
  try {
    const googleProvider = new firebase.auth.GoogleAuthProvider();
    googleProvider.setCustomParameters({ login_hint: ADMIN_EMAIL });
    await auth.signInWithRedirect(googleProvider);
  } catch(e) {
    showAdminToast('❌ ' + e.message, 'error');
    if (btn) {
      btn.disabled  = false;
      btn.innerHTML = '<div class="google-logo"></div> Continue with Google';
    }
  }
}

// ── HANDLE GOOGLE REDIRECT RESULT ─────────────────────────────────
(async () => {
  try {
    const result = await auth.getRedirectResult();
    if (!result || !result.user) return;

    const user = result.user;

    // Check admin email
    if (user.email !== ADMIN_EMAIL) {
      await auth.signOut();
      showAdminToast('❌ Ye Gmail admin nahi hai!', 'error');
      return;
    }

    // Check Firestore role
    const userDoc = await db.collection('users').doc(user.uid).get();
    const isAdmin = userDoc.exists && userDoc.data().role === 'admin';

    if (!isAdmin) {
      await auth.signOut();
      showAdminToast('❌ role:admin Firestore mein set karo', 'error');
      return;
    }

    // Save session
    localStorage.setItem('adminSession', JSON.stringify({
      uid:         user.uid,
      email:       user.email,
      displayName: user.displayName || 'Admin',
      photoURL:    user.photoURL || '',
      isAdmin:     true,
      timestamp:   Date.now()
    }));

    db.collection('adminLogs').add({
      action: 'google_login', adminEmail: user.email,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(() => {});

    showAdminToast('✅ Google login successful!', 'success');
    setTimeout(() => window.location.replace('admin-dashboard.html'), 800);

  } catch(e) {
    if (e.code === 'auth/no-current-user') return;
    if (e.code === 'auth/null-user') return;
    console.error('[Google Redirect]', e.message);
  }
})();

// ── FAILED ATTEMPT TRACKER ────────────────────────────────────────
function recordFailedAttempt() {
  const attempts = parseInt(localStorage.getItem('adminLoginAttempts') || '0') + 1;
  localStorage.setItem('adminLoginAttempts', attempts);
  const remaining = MAX_ATTEMPTS - attempts;
  if (attempts >= MAX_ATTEMPTS) {
    const lockEnd = Date.now() + (LOCKOUT_MINUTES * 60 * 1000);
    localStorage.setItem('adminLockoutEnd', lockEnd);
    localStorage.removeItem('adminLoginAttempts');
    showLockOverlay(LOCKOUT_MINUTES * 60);
  } else if (remaining <= 2) {
    showAdminToast(`⚠️ Sirf ${remaining} moka baki!`, 'warning');
  }
}

// ── LOCK OVERLAY ──────────────────────────────────────────────────
function showLockOverlay(totalSeconds) {
  const overlay = document.getElementById('lockOverlay');
  const timerEl = document.getElementById('lockTimerDisplay');
  if (!overlay) return;
  overlay.classList.add('show');
  let secs = totalSeconds;
  timerEl.textContent = formatCountdown(secs);
  const interval = setInterval(() => {
    secs--;
    timerEl.textContent = formatCountdown(secs);
    if (secs <= 0) {
      clearInterval(interval);
      overlay.classList.remove('show');
      localStorage.removeItem('adminLockoutEnd');
      localStorage.removeItem('adminLoginAttempts');
    }
  }, 1000);
}

function formatCountdown(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
}

// ── ENTER KEY ──────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Enter') adminLogin();
});

// ── INIT ON PAGE LOAD ─────────────────────────────────────────────
(function initLoginPage() {
  // Already logged in? Go to dashboard
  if (checkAdminSession()) return;

  // Currently locked?
  const lockoutEnd = parseInt(localStorage.getItem('adminLockoutEnd') || '0');
  if (Date.now() < lockoutEnd) {
    const remaining = Math.ceil((lockoutEnd - Date.now()) / 1000);
    showLockOverlay(remaining);
  }
})();
