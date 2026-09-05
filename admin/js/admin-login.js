// ══════════════════════════════════════════════════════════════════
// admin-login.js — AKANS Admin Panel
// Login page ka JS — admin-all.js ke baad load karo
// ══════════════════════════════════════════════════════════════════

// ╔══════════════════════════════════════════════════════════════╗
// ║         SECTION 1 — admin-login.html                        ║
// ╚══════════════════════════════════════════════════════════════╝

// ── CONSTANTS ─────────────────────────────────────────────────────
const ADMIN_EMAIL      = 'akans47g@gmail.com';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 ghante milliseconds mein
const MAX_ATTEMPTS     = 5;                    // 5 galat try ke baad lock
const LOCKOUT_MINUTES  = 30;                   // 30 minute lock


// ── GOOGLE PROVIDER ───────────────────────────────────────────────
const googleProvider = new firebase.auth.GoogleAuthProvider();

// ── ADMIN GOOGLE LOGIN (Redirect — mobile compatible) ─────────────
async function adminGoogleLogin() {
  const btn = document.getElementById('googleAdminBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span style="animation:spinAnim 1s linear infinite;display:inline-block">⟳</span> Redirecting...'; }
  try {
    await auth.signInWithRedirect(googleProvider);
  } catch(e) {
    showAdminToast('❌ Google login failed: ' + e.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Continue with Google'; }
  }
}

// ── HANDLE GOOGLE REDIRECT RESULT (page load pe) ──────────────────
auth.getRedirectResult().then(async result => {
  if (!result || !result.user) return;
  const user = result.user;

  // Admin role check karo
  try {
    const userDoc = await db.collection('users').doc(user.uid).get();
    const isAdmin = userDoc.exists && userDoc.data().role === 'admin';

    if (!isAdmin) {
      await auth.signOut();
      showAdminToast('❌ Access denied — Admin permission nahi hai', 'error');
      return;
    }

    // ✅ Admin confirmed
    localStorage.setItem('adminSession', JSON.stringify({
      uid:         user.uid,
      email:       user.email,
      displayName: user.displayName || user.email.split('@')[0],
      photoURL:    user.photoURL || '',
      isAdmin:     true,
      timestamp:   Date.now()
    }));

    // Log
    db.collection('adminLogs').add({
      action:     'google_login',
      adminEmail:  user.email,
      timestamp:   firebase.firestore.FieldValue.serverTimestamp()
    }).catch(() => {});

    showAdminToast('✅ Google login successful!', 'success');
    setTimeout(() => window.location.replace('admin-dashboard.html'), 800);

  } catch(e) {
    await auth.signOut();
    showAdminToast('❌ Error: ' + e.message, 'error');
  }
}).catch(e => {
  if (e.code && e.code !== 'auth/no-current-user') {
    console.error('[Admin Google]', e.code, e.message);
  }
});

// ── SESSION CHECK (page load pe) ──────────────────────────────────
function checkAdminSession() {
  try {
    const session = JSON.parse(localStorage.getItem('adminSession') || 'null');
    if (session) {
      const elapsed = Date.now() - session.timestamp;
      if (elapsed < SESSION_DURATION && session.isAdmin) {
        // Session valid hai → dashboard pe bhejo
        if (!window.location.href.includes('admin-dashboard')) {
          window.location.replace('admin-dashboard.html');
        }
        return true;
      } else {
        // Session expire → saaf karo
        localStorage.removeItem('adminSession');
        auth.signOut().catch(() => {});
      }
    }
  } catch (e) {
    localStorage.removeItem('adminSession');
  }
  return false;
}

// ── ADMIN LOGIN ────────────────────────────────────────────────────
async function adminLogin() {
  // Pehle lockout check
  const lockoutEnd = parseInt(localStorage.getItem('adminLockoutEnd') || '0');
  if (Date.now() < lockoutEnd) {
    const remaining = Math.ceil((lockoutEnd - Date.now()) / 60000);
    showAdminToast(`🔒 ${remaining} minute baad try karein`, 'error');
    return;
  }

  const email = document.getElementById('adminEmail').value.trim();
  const pass  = document.getElementById('adminPass').value;

  // Basic validation
  if (!email) { highlightField('adminEmail', '⚠️ Email daalo'); return; }
  if (!pass)  { highlightField('adminPass', '⚠️ Password daalo'); return; }

  // Only admin email allowed
  if (email !== ADMIN_EMAIL) {
    recordFailedAttempt();
    showAdminToast('❌ Yeh email admin nahi hai', 'error');
    return;
  }

  const btn = document.getElementById('loginBtn');
  setLoginLoading(true);

  try {
    // Firebase sign in
    const cred = await auth.signInWithEmailAndPassword(email, pass);
    const user  = cred.user;

    // Firestore mein admin role verify karo
    const userDoc = await db.collection('users').doc(user.uid).get();
    const isAdmin = userDoc.exists && userDoc.data().role === 'admin';

    if (!isAdmin) {
      // Role admin nahi → logout karo, block karo
      await auth.signOut();
      recordFailedAttempt();
      showAdminToast('❌ Access denied — Admin permission nahi hai', 'error');
      setLoginLoading(false);
      return;
    }

    // ✅ Admin confirmed — session save karo
    localStorage.setItem('adminSession', JSON.stringify({
      uid:       user.uid,
      email:     user.email,
      displayName: user.displayName || 'Admin',
      isAdmin:   true,
      timestamp: Date.now()
    }));

    // Failed attempts clear karo
    localStorage.removeItem('adminLoginAttempts');
    localStorage.removeItem('adminLockoutEnd');

    // Log login activity
    db.collection('adminLogs').add({
      action:    'login',
      adminEmail: user.email,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      userAgent: navigator.userAgent
    }).catch(() => {});

    showAdminToast('✅ Welcome Admin! Redirecting...', 'success');
    setTimeout(() => window.location.replace('admin-dashboard.html'), 900);

  } catch (e) {
    let msg = '❌ Login failed';
    if (e.code === 'auth/wrong-password')    msg = '❌ Galat password';
    if (e.code === 'auth/user-not-found')    msg = '❌ Email registered nahi hai';
    if (e.code === 'auth/too-many-requests') msg = '❌ Bahut zyada attempts — thodi der baad try karein';
    if (e.code === 'auth/network-request-failed') msg = '❌ Internet connection check karein';

    recordFailedAttempt();
    showAdminToast(msg, 'error');
    setLoginLoading(false);
  }
}


// ── GOOGLE ADMIN LOGIN (Redirect — mobile compatible) ─────────────
async function adminGoogleLogin() {
  const btn = document.getElementById('googleAdminBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span style="animation:spinAnim 1s linear infinite;display:inline-block">⟳</span> Redirecting...'; }
  try {
    const googleProvider = new firebase.auth.GoogleAuthProvider();
    googleProvider.setCustomParameters({ login_hint: ADMIN_EMAIL });
    await auth.signInWithRedirect(googleProvider);
  } catch(e) {
    showAdminToast('❌ Google login failed: ' + e.message, 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = '<div class="google-logo"></div> Continue with Google'; }
  }
}

// ── HANDLE GOOGLE REDIRECT RESULT ─────────────────────────────────
auth.getRedirectResult().then(async result => {
  if (!result || !result.user) return;
  const user = result.user;

  // Check admin email
  if (user.email !== ADMIN_EMAIL) {
    await auth.signOut();
    showAdminToast('❌ Ye Gmail admin nahi hai!', 'error');
    return;
  }

  // Check Firestore role
  try {
    const userDoc = await db.collection('users').doc(user.uid).get();
    const isAdmin = userDoc.exists && userDoc.data().role === 'admin';

    if (!isAdmin) {
      await auth.signOut();
      showAdminToast('❌ Access denied — role:admin set nahi hai', 'error');
      return;
    }

    // ✅ Google Admin Login successful
    localStorage.setItem('adminSession', JSON.stringify({
      uid:         user.uid,
      email:       user.email,
      displayName: user.displayName || 'Admin',
      photoURL:    user.photoURL || '',
      isAdmin:     true,
      timestamp:   Date.now()
    }));

    // Log
    db.collection('adminLogs').add({
      action:     'google_login',
      adminEmail: user.email,
      timestamp:  firebase.firestore.FieldValue.serverTimestamp()
    }).catch(() => {});

    showAdminToast('✅ Google login successful!', 'success');
    setTimeout(() => window.location.replace('admin-dashboard.html'), 800);

  } catch(e) {
    await auth.signOut();
    showAdminToast('❌ Firestore error: ' + e.message, 'error');
  }
}).catch(e => {
  if (e.code && e.code !== 'auth/no-current-user') {
    console.error('[Google Admin Redirect]', e.message);
    showAdminToast('❌ ' + e.message, 'error');
  }
});

// ── FAILED ATTEMPT TRACKER ─────────────────────────────────────────
function recordFailedAttempt() {
  const attempts = parseInt(localStorage.getItem('adminLoginAttempts') || '0') + 1;
  localStorage.setItem('adminLoginAttempts', attempts);

  const remaining = MAX_ATTEMPTS - attempts;

  if (attempts >= MAX_ATTEMPTS) {
    // Lock karo
    const lockEnd = Date.now() + (LOCKOUT_MINUTES * 60 * 1000);
    localStorage.setItem('adminLockoutEnd', lockEnd);
    localStorage.removeItem('adminLoginAttempts');
    showLockOverlay(LOCKOUT_MINUTES * 60);
    showAdminToast(`🔒 ${MAX_ATTEMPTS} galat tries — ${LOCKOUT_MINUTES} min ke liye lock`, 'error');
  } else if (remaining <= 2) {
    showAdminToast(`⚠️ Sirf ${remaining} aur moka bache hain!`, 'warning');
  }
}

// ── LOCK OVERLAY ───────────────────────────────────────────────────
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

// ── UI HELPERS ─────────────────────────────────────────────────────
function setLoginLoading(loading) {
  const btn = document.getElementById('loginBtn');
  if (!btn) return;
  btn.disabled = loading;
  btn.innerHTML = loading
    ? '<span class="spin">⟳</span> Verifying...'
    : '🔐 Admin Login';
}

function highlightField(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('field-error');
  el.focus();
  showAdminToast(msg, 'warning');
  el.addEventListener('input', () => el.classList.remove('field-error'), { once: true });
}

function toggleAdminPass() {
  const inp = document.getElementById('adminPass');
  const btn = document.getElementById('togglePassBtn');
  if (!inp) return;
  if (inp.type === 'password') { inp.type = 'text';     btn.textContent = '🙈'; }
  else                         { inp.type = 'password'; btn.textContent = '👁️'; }
}

// ── SHARED TOAST (sab admin pages pe kaam karega) ──────────────────
function showAdminToast(msg, type = 'info') {
  let t = document.getElementById('adminToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'adminToast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className   = `admin-toast ${type} show`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3200);
}

// ── SESSION LOGOUT (sab admin pages pe use hoga) ───────────────────
async function adminLogout() {
  if (!confirm('Logout karna chahte hain?')) return;
  localStorage.removeItem('adminSession');
  await auth.signOut().catch(() => {});
  window.location.replace('admin-login.html');
}

// ── SESSION GUARD (dashboard + baaki pages pe use hoga) ────────────
function requireAdminSession() {
  const session = JSON.parse(localStorage.getItem('adminSession') || 'null');
  if (!session || !session.isAdmin) {
    window.location.replace('admin-login.html');
    return null;
  }
  const elapsed = Date.now() - session.timestamp;
  if (elapsed >= SESSION_DURATION) {
    localStorage.removeItem('adminSession');
    auth.signOut().catch(() => {});
    window.location.replace('admin-login.html');
    return null;
  }
  return session;
}

// ── ENTER KEY SUPPORT ──────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    if (document.getElementById('adminEmail') && typeof adminLogin === 'function') {
      adminLogin();
    }
  }
});

// ── AUTO INIT on admin-login page ─────────────────────────────────
(function initLoginPage() {
  // Check if already logged in
  if (checkAdminSession()) return;

  // Check if currently locked
  const lockoutEnd = parseInt(localStorage.getItem('adminLockoutEnd') || '0');
  if (Date.now() < lockoutEnd) {
    const remaining = Math.ceil((lockoutEnd - Date.now()) / 1000);
    showLockOverlay(remaining);
  }
})();

// ╔══════════════════════════════════════════════════════════════╗
// ║   SECTION 2, 3, 4... aage ke pages ka JS yahan add hoga    ║
// ║   admin-dashboard.html, admin-bookings.html, etc.           ║
// ╚══════════════════════════════════════════════════════════════╝