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
const maintDoc  = doc(db, "settings", "maintenance");

let statuses = {};

// ── Auth gate ───────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Role check — only admin role gets in
        try {
            const userSnap = await getDoc(doc(db, 'users', user.uid));
            const profile  = userSnap.exists() ? userSnap.data() : {};
            if (profile.role !== 'admin') {
                loginError.textContent = 'Access denied. Admin accounts only.';
                await signOut(auth);
                loginScreen.style.display = 'flex';
                adminPanel.style.display  = 'none';
                return;
            }
        } catch(err) {
            console.error('Role check failed:', err);
        }

        loginScreen.style.display  = 'none';
        adminPanel.style.display   = 'flex';
        if (userEmailEl) userEmailEl.textContent = user.email;
        initAdmin();
        initMessagesPanel();
        initSettingsPanel();
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
            const id       = card.getAttribute('data-subject-id');
            const newState = bulkStatusSelect.value;
            statuses[id]   = newState;
            updateLabel(card, newState);
            card.classList.remove('selected');
        });

        try {
            await setDoc(statusDoc, statuses, { merge: true });
            showSaveStatus('✓ Saved to Firestore', 'success');
        } catch (err) {
            console.error(err);
            const msg = err.code === 'permission-denied'
                ? 'Permission denied — check Firestore rules.'
                : `Save failed: ${err.message}`;
            showSaveStatus(msg, 'error');
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
    saveStatus.textContent   = msg;
    saveStatus.className     = `save-status ${type}`;
    saveStatus.style.opacity = '1';
    setTimeout(() => { saveStatus.style.opacity = '0'; }, 3000);
}

// ── Messages Panel (notification icon + modal) ───────────────────────────────
function initMessagesPanel() {
    const bellBtn   = document.getElementById('msgBellBtn');
    const badge     = document.getElementById('msgBadge');
    const modal     = document.getElementById('msgModal');
    const closeBtn  = document.getElementById('msgModalClose');
    const body      = document.getElementById('msgModalBody');
    if (!bellBtn || !modal) return;

    let allMessages  = [];
    let unreadCount  = 0;

    // Read unread count from localStorage
    const getLastRead = () => parseInt(localStorage.getItem('admin_msg_last_read') || '0');
    const setLastRead = (ts) => localStorage.setItem('admin_msg_last_read', String(ts));

    const q = query(collection(db, "messages"), orderBy("sentAt", "asc"));

    onSnapshot(q, (snapshot) => {
        allMessages = [];
        snapshot.forEach(d => {
            const data = d.data();
            allMessages.push({ id: d.id, ...data });
        });

        // Count messages newer than last read timestamp
        const lastRead = getLastRead();
        unreadCount = allMessages.filter(m => {
            const ts = m.sentAt?.toMillis ? m.sentAt.toMillis() : 0;
            return ts > lastRead;
        }).length;

        // Update badge
        if (unreadCount > 0) {
            badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }, (err) => {
        console.error("Messages read error:", err);
    });

    // Open modal
    bellBtn.addEventListener('click', () => {
        renderMsgModal(allMessages, body);
        modal.classList.add('open');

        // Mark all as read
        if (allMessages.length > 0) {
            const latest = Math.max(...allMessages.map(m => m.sentAt?.toMillis ? m.sentAt.toMillis() : 0));
            setLastRead(latest);
            unreadCount = 0;
            badge.style.display = 'none';
        }
    });

    // Close modal
    closeBtn.addEventListener('click', () => modal.classList.remove('open'));
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('open'); });
}

function renderMsgModal(messages, body) {
    if (messages.length === 0) {
        body.innerHTML = '<div class="msg-modal-empty">No messages yet.</div>';
        return;
    }

    // Group by year → month
    const grouped = {}; // { 2025: { 5: [...], 6: [...] }, 2026: { ... } }
    messages.forEach(m => {
        const ts = m.sentAt?.toDate ? m.sentAt.toDate() : new Date(m.sentAt?.seconds * 1000 || Date.now());
        const yr = ts.getFullYear();
        const mo = ts.getMonth(); // 0-indexed
        if (!grouped[yr]) grouped[yr] = {};
        if (!grouped[yr][mo]) grouped[yr][mo] = [];
        grouped[yr][mo].push({ ...m, _date: ts });
    });

    const MONTHS = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];

    let html = '';
    // Sort years ascending
    Object.keys(grouped).sort((a,b) => a-b).forEach(yr => {
        html += `<div class="msg-year-group"><div class="msg-year-label">${yr}</div>`;
        // Sort months ascending
        Object.keys(grouped[yr]).sort((a,b) => a-b).forEach(mo => {
            const msgs = grouped[yr][mo];
            html += `<div class="msg-month-card">
                <div class="msg-month-header">
                    <span class="msg-month-name">${MONTHS[mo]}</span>
                    <span class="msg-month-count">${msgs.length} message${msgs.length !== 1 ? 's' : ''}</span>
                </div>
                <div class="msg-month-list">`;
            msgs.forEach(m => {
                const time = m._date.toLocaleString('en-PH', {
                    day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
                });
                html += `<div class="msg-item">
                    <div class="msg-item-meta">
                        <span class="msg-item-sender">${escapeHtml(m.nickname || 'Unknown')}</span>
                        <span class="msg-item-year-badge">${escapeHtml(m.year || '')}</span>
                        <span class="msg-item-email">${escapeHtml(m.email || '')}</span>
                        <span class="msg-item-time">${time}</span>
                    </div>
                    <div class="msg-item-body">${escapeHtml(m.message || '')}</div>
                </div>`;
            });
            html += `</div></div>`;
        });
        html += '</div>';
    });

    body.innerHTML = html;
}

// ── Settings Panel (maintenance mode toggle) ──────────────────────────────────
function initSettingsPanel() {
    const settingsBtn   = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const settingsClose = document.getElementById('settingsModalClose');
    const maintToggle   = document.getElementById('maintToggle');
    const maintMsg      = document.getElementById('maintMessage');
    const saveMaintBtn  = document.getElementById('saveMaintBtn');
    const maintStatus   = document.getElementById('maintStatus');
    if (!settingsBtn || !settingsModal) return;

    // Load current maintenance state from Firestore
    onSnapshot(maintDoc, (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        maintToggle.checked = data.enabled === true;
        maintMsg.value      = data.message || '';
        updateMaintLabel(data.enabled === true);
    });

    function updateMaintLabel(enabled) {
        const label = document.getElementById('maintToggleLabel');
        if (label) label.textContent = enabled ? 'Maintenance Mode is ON' : 'Maintenance Mode is OFF';
        if (maintToggle) maintToggle.checked = enabled;
    }

    // Open/close
    settingsBtn.addEventListener('click', () => settingsModal.classList.add('open'));
    settingsClose.addEventListener('click', () => settingsModal.classList.remove('open'));
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) settingsModal.classList.remove('open');
    });

    maintToggle.addEventListener('change', () => {
        updateMaintLabel(maintToggle.checked);
    });

    // Save maintenance settings
    saveMaintBtn.addEventListener('click', async () => {
        saveMaintBtn.textContent = 'Saving…';
        saveMaintBtn.disabled    = true;
        try {
            await setDoc(maintDoc, {
                enabled: maintToggle.checked,
                message: maintMsg.value.trim() || 'The system is currently under maintenance. Please check back later.'
            });
            maintStatus.textContent  = '✓ Settings saved';
            maintStatus.className    = 'maint-status success';
            maintStatus.style.opacity = '1';
            setTimeout(() => { maintStatus.style.opacity = '0'; }, 3000);
        } catch(err) {
            console.error(err);
            maintStatus.textContent  = err.code === 'permission-denied' ? 'Permission denied.' : `Error: ${err.message}`;
            maintStatus.className    = 'maint-status error';
            maintStatus.style.opacity = '1';
            setTimeout(() => { maintStatus.style.opacity = '0'; }, 4000);
        } finally {
            saveMaintBtn.textContent = 'Save Settings';
            saveMaintBtn.disabled    = false;
        }
    });
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}