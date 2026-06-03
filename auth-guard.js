// auth-guard.js — Authentication + access guard for all protected pages
// ─────────────────────────────────────────────────────────────────────
// Add ONE line inside <head> of every protected page:
//   <script type="module" src="auth-guard.js"></script>
//
// What it does (in order):
//   1. Shows a "Verifying access…" overlay immediately (no flash of content)
//   2. Checks maintenance mode — blocks non-admins with a modal if active
//   3. Waits for Firebase Auth — if not logged in → redirects to login.html
//   4. Rejects non @my.xu.edu.ph emails → signs out + redirects
//   5. Checks Firestore profile — must exist AND have year set
//   6. Checks subject lock status from Firestore (locked / unavailable / coming_soon)
//   7. Injects the user's nickname into any [id="user-nickname"] or .user-nickname element
//
// Do NOT add this to: login.html, profile.html  (they handle auth themselves)

import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ─── Checking overlay ────────────────────────────────────────────────────────
function injectCheckingOverlay() {
    const style = document.createElement('style');
    style.textContent = `
        #__ag {
            position:fixed;inset:0;z-index:999999;
            background:#0d0f14;
            display:flex;flex-direction:column;align-items:center;justify-content:center;
            gap:.9rem;font-family:'DM Sans',system-ui,sans-serif;
            transition:opacity .3s ease;
        }
        #__ag_spin {
            width:34px;height:34px;
            border:2px solid rgba(255,255,255,0.07);
            border-top-color:#e8b84b;border-radius:50%;
            animation:__ag_r .75s linear infinite;
        }
        @keyframes __ag_r{to{transform:rotate(360deg);}}
        #__ag_lbl{font-size:.75rem;color:#3d4a60;letter-spacing:.05em;}
    `;
    document.head.appendChild(style);
    const el = document.createElement('div');
    el.id = '__ag';
    el.innerHTML = '<div id="__ag_spin"></div><div id="__ag_lbl">Verifying access…</div>';
    document.body.appendChild(el);
    return el;
}

function removeOverlay(el) {
    el.style.opacity = '0';
    setTimeout(() => { try { el.remove(); } catch(_){} }, 320);
}

// ─── Maintenance Mode overlay ─────────────────────────────────────────────────
function showMaintenanceOverlay(message) {
    const s = document.createElement('style');
    s.textContent = `
        #__ag_maint{position:fixed;inset:0;z-index:999998;background:#0d0f14;
            display:flex;align-items:center;justify-content:center;
            font-family:'DM Sans',system-ui,sans-serif;}
        #__ag_maint_box{background:#13161d;border:1px solid rgba(232,184,75,0.2);border-radius:20px;
            padding:3rem 2.5rem;text-align:center;max-width:420px;width:90%;
            box-shadow:0 32px 64px rgba(0,0,0,.7);
            animation:__ag_pop .4s cubic-bezier(0.34,1.56,0.64,1) forwards;}
        @keyframes __ag_pop{from{transform:scale(.88) translateY(20px);opacity:0}to{transform:scale(1) translateY(0);opacity:1}}
        #__ag_maint_icon{font-size:3.2rem;display:block;margin-bottom:1.2rem;animation:__ag_fl 3s ease-in-out infinite;}
        @keyframes __ag_fl{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        #__ag_maint_ttl{font-size:1.5rem;font-weight:700;color:#e8eaf0;margin-bottom:.6rem;letter-spacing:-.02em;}
        #__ag_maint_sub{font-size:.85rem;color:#9ba3b8;line-height:1.7;margin-bottom:1.6rem;}
        #__ag_maint_badge{display:inline-flex;align-items:center;gap:.4rem;
            background:rgba(232,184,75,0.1);border:1px solid rgba(232,184,75,0.25);
            border-radius:20px;padding:.3rem .9rem;font-size:.72rem;
            font-weight:600;letter-spacing:.06em;color:#e8b84b;text-transform:uppercase;}
    `;
    document.head.appendChild(s);
    document.body.style.overflow = 'hidden';
    const el = document.createElement('div');
    el.id = '__ag_maint';
    el.innerHTML = `<div id="__ag_maint_box">
        <span id="__ag_maint_icon">🔧</span>
        <div id="__ag_maint_ttl">Under Maintenance</div>
        <p id="__ag_maint_sub">${escapeHtml(message)}</p>
        <div id="__ag_maint_badge">⏱ We'll be back soon</div>
    </div>`;
    document.body.appendChild(el);
}

// ─── Blocked overlay (subject locked/unavailable/coming_soon) ────────────────
function showBlockedOverlay(status) {
    const cfg = {
        locked:      { icon:'🔒', title:'Access Denied',       msg:'This subject is currently locked. Please check back later or contact your instructor.' },
        unavailable: { icon:'🚫', title:'Subject Unavailable', msg:'This subject is not currently available.' },
        coming_soon: { icon:'⏳', title:'Coming Soon',          msg:'This subject is not yet available. Stay tuned!' },
    };
    const { icon, title, msg } = cfg[status] || cfg.locked;

    const s = document.createElement('style');
    s.textContent = `
        #__ag_block{position:fixed;inset:0;z-index:999998;background:rgba(0,0,0,0.94);
            backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;
            font-family:'DM Sans',system-ui,sans-serif;}
        #__ag_box{background:#13161d;border:1px solid rgba(255,255,255,0.1);border-radius:20px;
            padding:2.5rem;text-align:center;max-width:360px;width:90%;
            box-shadow:0 32px 64px rgba(0,0,0,.7);
            animation:__ag_pop .35s cubic-bezier(0.34,1.56,0.64,1) forwards;}
        @keyframes __ag_pop{from{transform:scale(.85) translateY(16px);opacity:0}to{transform:scale(1) translateY(0);opacity:1}}
        #__ag_icon{font-size:3rem;display:block;margin-bottom:1rem;animation:__ag_fl 3s ease-in-out infinite;}
        @keyframes __ag_fl{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        #__ag_ttl{font-size:1.35rem;font-weight:700;color:#e8eaf0;margin-bottom:.5rem;letter-spacing:-.01em;}
        #__ag_msg{font-size:.875rem;color:#9ba3b8;line-height:1.6;margin-bottom:1.8rem;}
        #__ag_btn{display:block;background:#e8b84b;color:#0d0f14;padding:.7rem 2rem;
            border-radius:8px;font-size:.875rem;font-weight:600;border:none;width:100%;
            cursor:pointer;transition:background .2s,transform .2s;font-family:inherit;}
        #__ag_btn:hover{background:#f5d080;transform:translateY(-1px);}
    `;
    document.head.appendChild(s);
    document.body.style.overflow = 'hidden';
    const el = document.createElement('div');
    el.id = '__ag_block';
    el.innerHTML = `<div id="__ag_box">
        <span id="__ag_icon">${icon}</span>
        <div id="__ag_ttl">${title}</div>
        <p id="__ag_msg">${msg}</p>
        <button id="__ag_btn" onclick="history.length>1?history.back():location.href='dashboard.html'">← Go Back</button>
    </div>`;
    document.body.appendChild(el);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function goLogin() { window.location.replace('login.html'); }

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function resolveSubjectId() {
    const tag = document.querySelector('script[src*="auth-guard.js"]');
    if (tag?.dataset?.subjectId) return tag.dataset.subjectId;
    const meta = document.querySelector('meta[name="subject-id"]');
    if (meta) return meta.getAttribute('content');
    return location.pathname.split('/').pop().replace('.html','').toLowerCase();
}

function injectNickname(name) {
    const byId = document.getElementById('user-nickname');
    if (byId) byId.textContent = name;
    document.querySelectorAll('.user-nickname').forEach(el => el.textContent = name);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const overlay = injectCheckingOverlay();

onAuthStateChanged(auth, async (user) => {

    // 1. Not signed in — check maintenance first (even for guests)
    if (!user) {
        try {
            const maintSnap = await getDoc(doc(db, 'settings', 'maintenance'));
            if (maintSnap.exists() && maintSnap.data().enabled === true) {
                removeOverlay(overlay);
                showMaintenanceOverlay(maintSnap.data().message || 'The system is currently under maintenance.');
                return;
            }
        } catch(_) {}
        goLogin();
        return;
    }

    try {
        // 2. Check if admin — admins bypass all restrictions
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        const profile  = userSnap.exists() ? userSnap.data() : {};
        const isAdmin  = profile.role === 'admin';

        if (isAdmin) {
            // Admin: just inject nickname and show the page — no restrictions
            const nickname = profile.nickname || profile.firstName || user.displayName?.split(' ')[0] || 'Admin';
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => injectNickname(nickname));
            } else {
                injectNickname(nickname);
            }
            removeOverlay(overlay);
            return;
        }

        // 3. Non-admin: check domain
        if (!user.email.endsWith('@my.xu.edu.ph')) {
            await signOut(auth);
            goLogin();
            return;
        }

        // 4. Firestore profile must exist + have year set
        if (!userSnap.exists() || !profile.year) {
            goLogin(); return;
        }

        // 5. Check maintenance mode — block non-admins
        const maintSnap = await getDoc(doc(db, 'settings', 'maintenance'));
        if (maintSnap.exists() && maintSnap.data().enabled === true) {
            removeOverlay(overlay);
            showMaintenanceOverlay(maintSnap.data().message || 'The system is currently under maintenance.');
            return;
        }

        const nickname = profile.nickname || profile.firstName || user.displayName?.split(' ')[0] || 'Scholar';

        // 6. Inject nickname
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => injectNickname(nickname));
        } else {
            injectNickname(nickname);
        }

        // 7. Subject status check
        const subjectId  = resolveSubjectId();
        const statusSnap = await getDoc(doc(db, 'statuses', 'subjects'));
        const statuses   = statusSnap.exists() ? statusSnap.data() : {};
        const status     = statuses[subjectId] || 'unlocked';

        removeOverlay(overlay);

        if (status !== 'unlocked') showBlockedOverlay(status);

    } catch (err) {
        console.warn('[auth-guard.js]', err);
        removeOverlay(overlay);
    }
});
