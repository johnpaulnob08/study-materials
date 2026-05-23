// guard.js — Drop this into every subject page
// Usage: <script type="module" src="../guard.js" data-subject-id="philo25"></script>
// Or:    <script type="module"> import './guard.js'; </script>
// The subject ID is read from the script tag's data-subject-id attribute,
// falling back to a <meta name="subject-id"> tag, then the filename.

import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Resolve subject ID ───────────────────────────────────────
function resolveSubjectId() {
    // 1. data-subject-id on <script src="guard.js">
    const scriptTag = document.querySelector('script[src*="guard.js"]');
    if (scriptTag && scriptTag.dataset.subjectId) return scriptTag.dataset.subjectId;

    // 2. <meta name="subject-id" content="...">
    const meta = document.querySelector('meta[name="subject-id"]');
    if (meta) return meta.getAttribute('content');

    // 3. Filename without extension (e.g. PHILO25.html → philo25)
    const filename = location.pathname.split('/').pop().replace('.html', '').toLowerCase();
    return filename;
}

// ── Inject modal HTML ────────────────────────────────────────
function injectModal(status) {
    const configs = {
        locked:      { icon: '🔒', title: 'Access Denied',       msg: 'This subject is currently locked. Please check back later.' },
        unavailable: { icon: '🚫', title: 'Subject Unavailable', msg: 'This subject is not available at this time.' },
        coming_soon: { icon: '⏳', title: 'Coming Soon',          msg: 'This subject is not yet available. Stay tuned!' },
    };
    const { icon, title, msg } = configs[status];

    // Inject styles
    const style = document.createElement('style');
    style.textContent = `
        #guardOverlay {
            position: fixed; inset: 0; z-index: 99999;
            background: rgba(0,0,0,0.92);
            display: flex; align-items: center; justify-content: center;
            font-family: 'DM Sans', system-ui, sans-serif;
            backdrop-filter: blur(6px);
        }
        #guardBox {
            background: #13161d;
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 20px;
            padding: 2.5rem;
            text-align: center;
            max-width: 360px;
            width: 90%;
            box-shadow: 0 32px 64px rgba(0,0,0,0.7);
            animation: guardPop 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards;
        }
        @keyframes guardPop {
            from { transform: scale(0.85) translateY(16px); opacity: 0; }
            to   { transform: scale(1)    translateY(0);    opacity: 1; }
        }
        #guardIcon { font-size: 3rem; display: block; margin-bottom: 1rem; animation: float 3s ease-in-out infinite; }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        #guardTitle { font-size: 1.4rem; font-weight: 700; color: #e8eaf0; margin-bottom: 0.5rem; letter-spacing: -0.01em; }
        #guardMsg { font-size: 0.875rem; color: #9ba3b8; line-height: 1.6; margin-bottom: 2rem; }
        #guardBtn {
            display: inline-block;
            background: #e8b84b; color: #0d0f14;
            padding: 0.7rem 2rem; border-radius: 8px;
            font-size: 0.875rem; font-weight: 600;
            text-decoration: none; cursor: pointer;
            border: none; width: 100%;
            transition: background 0.2s, transform 0.2s;
            font-family: inherit;
        }
        #guardBtn:hover { background: #f5d080; transform: translateY(-1px); }
    `;
    document.head.appendChild(style);

    // Block page scroll
    document.body.style.overflow = 'hidden';

    // Build overlay
    const overlay = document.createElement('div');
    overlay.id = 'guardOverlay';
    overlay.innerHTML = `
        <div id="guardBox">
            <span id="guardIcon">${icon}</span>
            <div id="guardTitle">${title}</div>
            <p id="guardMsg">${msg}</p>
            <button id="guardBtn" onclick="history.length>1 ? history.back() : location.href='index.html'">
                ← Go Back
            </button>
        </div>
    `;
    document.body.appendChild(overlay);
}

// ── Main check ───────────────────────────────────────────────
async function checkAccess() {
    try {
        const subjectId = resolveSubjectId();
        const statusDoc = doc(db, "statuses", "subjects");
        const snapshot  = await getDoc(statusDoc);

        if (!snapshot.exists()) return; // no doc yet → all unlocked

        const statuses = snapshot.data();
        const status   = statuses[subjectId] || 'unlocked';

        if (status !== 'unlocked') {
            injectModal(status);
        }
    } catch (err) {
        console.warn('[guard.js] Could not check access:', err);
        // Fail open — don't block the page if Firestore is unreachable
    }
}

checkAccess();