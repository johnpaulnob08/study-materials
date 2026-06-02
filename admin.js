// admin.js — Admin panel
// Firebase Auth gates access; Firestore stores subject statuses

import { db, auth } from "./firebase-config.js";
import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
    doc,
    getDoc,
    setDoc,
    onSnapshot,
    collection,
    query,
    orderBy,
    addDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── DOM refs ────────────────────────────────────────────────
const loginScreen    = document.getElementById('loginScreen');
const adminPanel     = document.getElementById('adminPanel');
const loginForm      = document.getElementById('loginForm');
const loginEmail     = document.getElementById('loginEmail');
const loginPassword  = document.getElementById('loginPassword');
const loginError     = document.getElementById('loginError');
const loginBtn       = document.getElementById('loginBtn');
const logoutBtn      = document.getElementById('logoutBtn');
const userEmailEl    = document.getElementById('userEmail');

const adminCards       = document.querySelectorAll('.admin-card');
const selectAllChk     = document.getElementById('selectAllCheckbox');
const selectedCountEl  = document.getElementById('selectedCountText');
const bulkStatusSelect = document.getElementById('bulkStatusSelect');
const applyBulkBtn     = document.getElementById('applyBulkBtn');
const saveStatus       = document.getElementById('saveStatus');

const statusDoc = doc(db, "statuses", "subjects");

let statuses = {};

// ── Auth gate ───────────────────────────────────────────────
onAuthStateChanged(auth, (user) => {
    if (user) {
        loginScreen.style.display  = 'none';
        adminPanel.style.display   = 'flex';
        if (userEmailEl) userEmailEl.textContent = user.email;
        initAdmin();
        initMessagesPanel();
    } else {
        loginScreen.style.display  = 'flex';
        adminPanel.style.display   = 'none';
    }
});

// ── Login ───────────────────────────────────────────────────
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.textContent = '';
    loginBtn.textContent   = 'Signing in…';
    loginBtn.disabled      = true;

    try {
        await signInWithEmailAndPassword(auth, loginEmail.value.trim(), loginPassword.value);
    } catch (err) {
        loginBtn.textContent = 'Sign In';
        loginBtn.disabled    = false;
        loginError.textContent = friendlyAuthError(err.code);
    }
});

function friendlyAuthError(code) {
    const map = {
        'auth/user-not-found':    'No account found with that email.',
        'auth/wrong-password':    'Incorrect password.',
        'auth/invalid-email':     'Please enter a valid email.',
        'auth/too-many-requests': 'Too many attempts. Try again later.',
        'auth/invalid-credential':'Invalid email or password.',
    };
    return map[code] || 'Sign-in failed. Please try again.';
}

// ── Logout ──────────────────────────────────────────────────
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => signOut(auth));
}

// ── Admin init (runs after login) ───────────────────────────
function initAdmin() {

    // Inject checkmark into each card
    adminCards.forEach(card => {
        if (!card.querySelector('.select-indicator')) {
            const chk = document.createElement('div');
            chk.className   = 'select-indicator';
            chk.textContent = '✓';
            card.appendChild(chk);
        }
        card.addEventListener('click', () => {
            card.classList.toggle('selected');
            updateSelectedCount();
            const allSel = document.querySelectorAll('.admin-card.selected').length === adminCards.length;
            selectAllChk.checked = allSel;
        });
    });

    // Real-time Firestore listener → update card labels
    onSnapshot(statusDoc, (snapshot) => {
        statuses = snapshot.exists() ? snapshot.data() : {};
        adminCards.forEach(card => {
            const id    = card.getAttribute('data-subject-id');
            const state = statuses[id] || 'unlocked';
            updateLabel(card, state);
        });
    });

    // Select All
    selectAllChk.addEventListener('change', (e) => {
        adminCards.forEach(card => card.classList.toggle('selected', e.target.checked));
        updateSelectedCount();
    });

    // Apply bulk
    applyBulkBtn.addEventListener('click', async () => {
        const selected = document.querySelectorAll('.admin-card.selected');
        if (selected.length === 0) {
            showSaveStatus('Select at least one subject first.', 'error');
            return;
        }

        applyBulkBtn.textContent = 'Saving…';
        applyBulkBtn.disabled    = true;

        selected.forEach(card => {
            const id      = card.getAttribute('data-subject-id');
            const newState = bulkStatusSelect.value;
            statuses[id]  = newState;
            updateLabel(card, newState);
            card.classList.remove('selected');
        });

        try {
            await setDoc(statusDoc, statuses);
            showSaveStatus('✓ Saved to Firestore', 'success');
        } catch (err) {
            console.error(err);
            showSaveStatus('Save failed — check console.', 'error');
        }

        selectAllChk.checked      = false;
        updateSelectedCount();
        applyBulkBtn.textContent  = 'Apply Changes';
        applyBulkBtn.disabled     = false;
    });
}

// ── Helpers ─────────────────────────────────────────────────
function updateSelectedCount() {
    const n = document.querySelectorAll('.admin-card.selected').length;
    selectedCountEl.textContent = `${n} selected`;
}

function updateLabel(card, state) {
    const pill = card.querySelector('.admin-status');
    pill.classList.remove('status-unlocked', 'status-coming', 'status-unavailable');
    card.classList.remove('locked', 'coming-soon', 'unavailable');
    const badge = card.querySelector('.coming-soon-badge, .unavailable-badge');
    if (badge) badge.remove();

    const map = {
        unlocked:   ['UNLOCKED',    'status-unlocked', null],
        locked:     ['LOCKED',      null,              'locked'],
        unavailable:['UNAVAILABLE', 'status-unavailable','unavailable'],
        coming_soon:['COMING SOON', 'status-coming',   'coming-soon'],
    };
    const [label, pillClass, cardClass] = map[state] || map.unlocked;
    pill.textContent = label;
    if (pillClass) pill.classList.add(pillClass);
    if (cardClass) card.classList.add(cardClass);
}

function showSaveStatus(msg, type) {
    if (!saveStatus) return;
    saveStatus.textContent  = msg;
    saveStatus.className    = `save-status ${type}`;
    saveStatus.style.opacity = '1';
    setTimeout(() => { saveStatus.style.opacity = '0'; }, 3000);
}

// ── Messages Panel ────────────────────────────────────────────────────────────

function initMessagesPanel() {
  const list  = document.getElementById("messagesList");
  const count = document.getElementById("messagesCount");
  if (!list) return;

  const q = query(collection(db, "messages"), orderBy("sentAt", "desc"));

  onSnapshot(q, (snapshot) => {
    count.textContent = `${snapshot.size} message${snapshot.size !== 1 ? "s" : ""}`;

    if (snapshot.empty) {
      list.innerHTML = `<div class="messages-empty">No messages yet.</div>`;
      return;
    }

    list.innerHTML = "";
    snapshot.forEach((docSnap) => {
      const d   = docSnap.data();
      const ts  = d.sentAt?.toDate();
      const time = ts ? ts.toLocaleString("en-PH", {
        month: "short", day: "numeric",
        hour: "numeric", minute: "2-digit", hour12: true
      }) : "—";

      const item = document.createElement("div");
      item.className = "message-item";
      item.innerHTML = `
        <div class="message-meta">
          <span class="message-sender">${escapeHtml(d.nickname || "Unknown")}</span>
          <span class="message-year">${escapeHtml(d.year || "")}</span>
          <span class="message-email">${escapeHtml(d.email || "")}</span>
          <span class="message-time">${time}</span>
        </div>
        <div class="message-body">${escapeHtml(d.message || "")}</div>
      `;
      list.appendChild(item);
    });
  }, (err) => {
    console.error("Messages read error:", err);
    list.innerHTML = `<div class="messages-empty">Could not load messages.</div>`;
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}