import { getAuthInstance, getDbInstance, firebaseConfig } from './firebase.js';
import { GoogleAuthProvider, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { ref, get } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';


import { loadProducts, refreshProducts } from './products.js';
import { setupSalePanel } from './sales.js';
import { renderDashboard } from './dashboard.js';
import { loadPendingSales, attachApprovalEvents, refreshPendingSales } from './approvals.js';
import { logAudit } from './audit.js';

const loginForm = document.getElementById('loginForm');
const googleBtn = document.getElementById('googleBtn');
const authError = document.getElementById('authError');
const authScreen = document.getElementById('auth-screen');
const appScreen = document.getElementById('app-screen');
const signOutBtn = document.getElementById('signOutBtn');
const welcomeTitle = document.getElementById('welcomeTitle');
const roleBadge = document.getElementById('roleBadge');
const managerPanels = document.getElementById('managerPanels');
const saleSection = document.getElementById('saleSection');
const commissionSection = document.getElementById('commissionSection');
const salesListSection = document.getElementById('salesListSection');
const collapsibleSection = document.getElementById('collapsibleSection');
const registerRepForm = document.getElementById('registerRepForm');
const repNameInput = document.getElementById('repNameInput');
const repEmailInput = document.getElementById('repEmailInput');
const repPasswordInput = document.getElementById('repPasswordInput');
const registerRepMessage = document.getElementById('registerRepMessage');
const themeToggle = document.getElementById('themeToggle');
const notificationTimeouts = new Map();

function showTimedNotification(element, message, duration = 5000) {
  if (!element) return;
  element.textContent = message;
  element.classList.remove('hidden');
  if (notificationTimeouts.has(element)) {
    clearTimeout(notificationTimeouts.get(element));
  }
  const timeoutId = setTimeout(() => {
    element.classList.add('hidden');
    notificationTimeouts.delete(element);
  }, duration);
  notificationTimeouts.set(element, timeoutId);
}

function hideNotification(element) {
  if (!element) return;
  element.classList.add('hidden');
  if (notificationTimeouts.has(element)) {
    clearTimeout(notificationTimeouts.get(element));
    notificationTimeouts.delete(element);
  }
}

function applyTheme(theme) {
  document.body.classList.toggle('light-theme', theme === 'light');
  if (themeToggle) {
    themeToggle.textContent = theme === 'light' ? 'Dark mode' : 'Light mode';
  }
  localStorage.setItem('theme', theme);
}

const savedTheme = localStorage.getItem('theme') || 'dark';
applyTheme(savedTheme);

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    applyTheme(document.body.classList.contains('light-theme') ? 'dark' : 'light');
  });
}

// Collapsible section functionality
const collapsibleHeaders = document.querySelectorAll('.collapsible-header');
collapsibleHeaders.forEach((header) => {
  header.addEventListener('click', () => {
    const targetId = header.dataset.target;
    const content = document.getElementById(targetId);
    if (content) {
      content.classList.toggle('hidden');
      header.classList.toggle('active');
    }
  });
});

// Hamburger menu functionality
const refreshBtn = document.getElementById('refreshBtn');
const hamburgerMenu = document.getElementById('hamburgerMenu');
const hamburgerDropdown = document.getElementById('hamburgerDropdown');

const pullToRefreshIndicator = document.createElement('div');
pullToRefreshIndicator.id = 'pullToRefresh';
pullToRefreshIndicator.className = 'pull-to-refresh hidden';
pullToRefreshIndicator.textContent = 'Pull down to refresh';
document.body.appendChild(pullToRefreshIndicator);

let pullToRefreshStartY = null;
let pullToRefreshDistance = 0;

function getAuthErrorMessage(error) {
  const code = error?.code || '';
  const message = error?.message || 'Login failed. Check credentials or try again.';
  return {
    'auth/invalid-email': 'The email address is invalid. Please enter a correct email.',
    'auth/user-disabled': 'This account has been disabled. Contact the administrator.',
    'auth/user-not-found': 'No account found for that email address.',
    'auth/wrong-password': 'Incorrect password. Please check your password and try again.',
    'auth/too-many-requests': 'Too many failed login attempts. Try again later.',
    'auth/popup-closed-by-user': 'Google sign-in was canceled. Please try again.',
    'auth/cancelled-popup-request': 'Google sign-in was canceled. Please try again.',
    'auth/account-exists-with-different-credential': 'An account exists with a different sign-in method.',
    'auth/credential-already-in-use': 'This credential is already used by another account.',
    'auth/network-request-failed': 'Network error. Please check your connection and try again.',
  }[code] || message;
}

let refreshTimer = null;
let initialProductsEvent = true;
let initialSalesEvent = true;
let initialAuditEvent = true;
const firebaseListeners = {
  products: null,
  sales: null,
  auditLogs: null
};

function scheduleAppRefresh(reason) {
  if (!window.currentUser) return;
  if (refreshTimer) {
    clearTimeout(refreshTimer);
  }
  refreshTimer = setTimeout(async () => {
    refreshTimer = null;
    console.log('Refreshing app from Firebase change:', reason);
    if (window.refreshApp) {
      await window.refreshApp();
    }
  }, 600);
}

function detachRealtimeListeners() {
  if (firebaseListeners.products) {
    firebaseListeners.products.off();
    firebaseListeners.products = null;
  }
  if (firebaseListeners.sales) {
    firebaseListeners.sales.off();
    firebaseListeners.sales = null;
  }
  if (firebaseListeners.auditLogs) {
    firebaseListeners.auditLogs.off();
    firebaseListeners.auditLogs = null;
  }
  initialProductsEvent = initialSalesEvent = initialAuditEvent = true;
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

function attachRealtimeListeners() {
  // Intentionally no realtime listeners.
  detachRealtimeListeners();
}

function resetPullToRefresh() {
  pullToRefreshIndicator.classList.add('hidden');
  pullToRefreshIndicator.classList.remove('visible', 'refreshing');
  pullToRefreshIndicator.style.transform = '';
  pullToRefreshStartY = null;
  pullToRefreshDistance = 0;
}

function updatePullToRefresh(distance) {
  const clampedDistance = Math.min(distance, 120);
  pullToRefreshIndicator.classList.remove('hidden');
  pullToRefreshIndicator.classList.add('visible');
  pullToRefreshIndicator.textContent = clampedDistance >= 70 ? 'Release to refresh' : 'Pull down to refresh';
  pullToRefreshIndicator.style.transform = `translateX(-50%) translateY(${clampedDistance - 120}px)`;
}

function triggerPullToRefresh() {
  pullToRefreshIndicator.textContent = 'Refreshing…';
  pullToRefreshIndicator.classList.add('refreshing');
  if (window.refreshApp) {
    window.refreshApp().finally(() => {
      setTimeout(resetPullToRefresh, 500);
    });
  } else {
    resetPullToRefresh();
  }
}

window.addEventListener('touchstart', (event) => {
  if (!window.currentUser || window.scrollY !== 0) return;
  const touch = event.touches?.[0];
  if (!touch) return;
  pullToRefreshStartY = touch.clientY;
  pullToRefreshDistance = 0;
});

window.addEventListener('touchmove', (event) => {
  if (pullToRefreshStartY === null) return;
  const touch = event.touches?.[0];
  if (!touch) return;
  pullToRefreshDistance = touch.clientY - pullToRefreshStartY;
  if (pullToRefreshDistance > 0) {
    event.preventDefault();
    updatePullToRefresh(pullToRefreshDistance);
  } else {
    resetPullToRefresh();
  }
}, { passive: false });

window.addEventListener('touchend', () => {
  if (pullToRefreshStartY === null) return;
  if (pullToRefreshDistance >= 70) {
    triggerPullToRefresh();
  } else {
    resetPullToRefresh();
  }
});

window.addEventListener('touchcancel', resetPullToRefresh);

if (hamburgerMenu && hamburgerDropdown) {
  hamburgerMenu.addEventListener('click', () => {
    hamburgerDropdown.classList.toggle('hidden');
  });

  document.addEventListener('click', (event) => {
    if (!hamburgerMenu.contains(event.target) && !hamburgerDropdown.contains(event.target)) {
      hamburgerDropdown.classList.add('hidden');
    }
  });

  hamburgerDropdown.addEventListener('click', (event) => {
    if (event.target.classList.contains('dropdown-item')) {
      event.preventDefault();
      const targetId = event.target.getAttribute('href').substring(1);
      const targetElement = document.getElementById(targetId);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth' });
        hamburgerDropdown.classList.add('hidden');
      }
    }
  });
}

window.currentUser = null;
window.selectedProduct = null;

async function findUserRecord(firebaseUser, db) {
  const idTokenResult = await firebaseUser.getIdTokenResult();
  const customClaims = idTokenResult.claims;
  const roleFromClaims = customClaims?.role;

  const byUidSnap = await get(ref(db, `users/${firebaseUser.uid}`));
  if (byUidSnap.exists()) {
    const userData = byUidSnap.val();
    return {
      id: firebaseUser.uid,
      uid: firebaseUser.uid,
      email: firebaseUser.email || userData.email,
      name: userData.name || 'User',
      role: roleFromClaims || userData.role || 'rep'
    };
  }

  if (roleFromClaims) {
    return {
      id: firebaseUser.uid,
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      name: 'User',
      role: roleFromClaims
    };
  }

  return null;
}

function showAuthError(message) {
  showTimedNotification(authError, message, 6000);
}

function hideAuthError() {
  hideNotification(authError);
}

function resetAppUI() {
  window.currentUser = null;
  window.selectedProduct = null;
  authScreen.classList.remove('hidden');
  appScreen.classList.add('hidden');
  signOutBtn.classList.add('hidden');
  managerPanels.classList.add('hidden');
  saleSection.classList.add('hidden');
  commissionSection.classList.add('hidden');
  salesListSection.classList.add('hidden');
}

function configureAppForRole(userRecord) {
  welcomeTitle.textContent = `Welcome, ${userRecord.name}`;
  roleBadge.textContent = userRecord.role === 'manager' ? 'Manager' : 'Rep';
  managerPanels.classList.toggle('hidden', userRecord.role !== 'manager');
  saleSection.classList.toggle('hidden', userRecord.role !== 'rep' && userRecord.role !== 'manager');
  commissionSection.classList.toggle('hidden', false);
  salesListSection.classList.toggle('hidden', userRecord.role !== 'manager');
  collapsibleSection.classList.toggle('hidden', userRecord.role !== 'manager');
  if (hamburgerMenu) {
    hamburgerMenu.classList.toggle('hidden', userRecord.role !== 'manager');
  }
  if (hamburgerDropdown && userRecord.role !== 'manager') {
    hamburgerDropdown.classList.add('hidden');
  }
}

async function showApp(userRecord, firebaseUser, db) {
  window.currentUser = { ...userRecord, uid: firebaseUser.uid };
  authScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');
  signOutBtn.classList.remove('hidden');
  hideAuthError();
  configureAppForRole(userRecord);
  await loadProducts(userRecord.role);
  setupSalePanel(window.currentUser);
  await renderDashboard(window.currentUser);

  if (window.currentUser.role === 'manager') {
    await loadPendingSales(window.currentUser);
    attachApprovalEvents(window.currentUser);
  }

  await logAudit('LOGIN_DETECTED', window.currentUser.email, {
    provider: firebaseUser.providerData?.[0]?.providerId || 'password'
  });
}

(async () => {
  const auth = await getAuthInstance();
  const db = await getDbInstance();

  onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      console.log('Firebase auth state changed:', firebaseUser.email);

      try {
        showTimedNotification(authError, 'Connecting to server…', 3000);
        const userRecord = await findUserRecord(firebaseUser, db);

        if (!userRecord) {
          await signOut(auth);
          showAuthError('Your account is not configured in the sales system. Contact the manager.');
          return;
        }

        // store Firebase ID token for backend REST API calls (MongoDB)
        try {
          const token = await firebaseUser.getIdToken();
          window.firebaseIdToken = token;
        } catch (e) {
          console.warn('Unable to get Firebase ID token for API calls', e);
          window.firebaseIdToken = null;
        }

        await showApp(userRecord, firebaseUser, db);
        attachRealtimeListeners();

      } catch (error) {
        console.error('Login profile fetch failed (transient/network).', error);
        showAuthError('Network is unstable. Please try again.');
      }
    } else {
      console.log('No user logged in. Showing sign-in form.');
      detachRealtimeListeners();
      resetAppUI();
    }
  });
})();

let lastManualRefreshTs = 0;
const REFRESH_COOLDOWN_MS = 60_000;

function setRefreshingUI(isRefreshing) {
  if (!refreshBtn) return;
  refreshBtn.disabled = isRefreshing;
  if (isRefreshing) {
    refreshBtn.dataset.prevText = refreshBtn.textContent;
    refreshBtn.textContent = 'Refreshing…';
  } else {
    const prev = refreshBtn.dataset.prevText;
    refreshBtn.textContent = prev || 'Refresh';
    delete refreshBtn.dataset.prevText;
  }
}

async function refreshWithCooldown() {
  const now = Date.now();
  if (now - lastManualRefreshTs < REFRESH_COOLDOWN_MS) {
    const waitSec = Math.ceil((REFRESH_COOLDOWN_MS - (now - lastManualRefreshTs)) / 1000);
    showTimedNotification(authError, `Please wait ${waitSec}s before refreshing again.`, 4000);
    return;
  }

  lastManualRefreshTs = now;
  setRefreshingUI(true);
  try {
    if (window.refreshApp) {
      await window.refreshApp();
    }
  } finally {
    setRefreshingUI(false);
  }
}

if (refreshBtn) {
  refreshBtn.addEventListener('click', async () => {
    await refreshWithCooldown('manual');
  });
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  hideAuthError();
  const email = document.getElementById('emailInput').value.trim();
  const password = document.getElementById('passwordInput').value.trim();

  if (!email || !password) {
    showAuthError('Please enter both email and password.');
    return;
  }

  try {
    const auth = await getAuthInstance();
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    console.error('Email sign-in failed', error.code, error.message, error);
    showAuthError(getAuthErrorMessage(error));
  }
});

let googleSignInInFlight = false;

googleBtn.addEventListener('click', async () => {
  if (googleSignInInFlight) return;
  googleSignInInFlight = true;

  hideAuthError();
  const provider = new GoogleAuthProvider();

  try {
    const auth = await getAuthInstance();
    await signInWithPopup(auth, provider);
  } catch (error) {
    // If the popup was blocked/cancelled, Firebase may reject before auth state settles.
    console.error('Google sign-in failed', error?.code, error?.message, error);
    showAuthError(getAuthErrorMessage(error));

    // Ensure we don’t continue with a half-authenticated session.
    try {
      const auth = await getAuthInstance();
      await signOut(auth);
    } catch (_) {
      // ignore
    }
  } finally {
    googleSignInInFlight = false;
  }
});


signOutBtn.addEventListener('click', async () => {
  try {
    const auth = await getAuthInstance();
    await signOut(auth);
    detachRealtimeListeners();
    resetAppUI();
  } catch (error) {
    console.error('Sign out error', error);
    showAuthError('Unable to sign out right now.');
  }
});

async function createRepAuthAccount(email, password) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`;
  const payload = {
    email,
    password,
    returnSecureToken: false
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok) {
    const message = data.error?.message || 'Unable to create rep account.';
    throw new Error(message.replace(/_/g, ' '));
  }

  return data.localId;
}

async function addRepRecord(uid, name, email, db) {
  // Keep original business logic. Write via modular database.
  const { set } = await import('firebase/database');
  const record = {
    name,
    email,
    role: 'rep',
    uid,
    createdAt: Date.now()
  };
  await set(ref(db, `users/${uid}`), record);
}

if (registerRepForm) {
  registerRepForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideNotification(registerRepMessage);

    const name = repNameInput.value.trim();
    const email = repEmailInput.value.trim();
    const password = repPasswordInput.value.trim();

    if (!name || !email || !password || password.length < 6) {
      showTimedNotification(registerRepMessage, 'Please enter a name, valid email, and a password with at least 6 characters.', 6000);
      return;
    }

    try {
      const newUserId = await createRepAuthAccount(email, password);
      const db = await getDbInstance();
      await addRepRecord(newUserId, name, email, db);
      showTimedNotification(
        registerRepMessage,
        `Rep account created successfully for ${name} (${email}). Please sign back in with your manager credentials.`,
        8000
      );
      registerRepForm.reset();
      window.refreshApp();
    } catch (error) {
      console.error('Rep registration failed', error);
      showTimedNotification(registerRepMessage, error.message || 'Unable to create rep account.', 6000);
    }
  });
}

window.refreshApp = async function () {
  if (window.currentUser) {
    const db = await getDbInstance();
    console.log('Refreshing app for', window.currentUser.email, window.currentUser.role);
    await refreshProducts(window.currentUser.role);
    await renderDashboard(window.currentUser);

    if (window.currentUser.role === 'manager') {
      await refreshPendingSales(window.currentUser);
    }
  }
};

