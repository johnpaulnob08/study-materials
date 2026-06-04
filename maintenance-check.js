// maintenance-check.js
// Blocks index.html and login.html during maintenance mode.
// Reads directly from Firestore — no auth wait needed.

import { db, auth } from "./firebase-config.js";
import { doc, getDoc }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// Show blocking overlay immediately — before anything else renders
function showMaintenance(message) {
    const esc = (s) => String(s).replace(/</g,"&lt;").replace(/>/g,"&gt;");
    const s = document.createElement("style");
    s.textContent = `
        #__maint{position:fixed;inset:0;z-index:999999;background:#0d0f14;
            display:flex;align-items:center;justify-content:center;
            font-family:'DM Sans',system-ui,sans-serif;}
        #__maint_box{background:#13161d;border:1px solid rgba(232,184,75,0.25);
            border-radius:20px;padding:3rem 2.5rem;text-align:center;
            max-width:420px;width:90%;
            box-shadow:0 32px 64px rgba(0,0,0,.8);
            animation:__mp .4s cubic-bezier(0.34,1.56,0.64,1) forwards;}
        @keyframes __mp{from{transform:scale(.88) translateY(20px);opacity:0}
                        to{transform:scale(1) translateY(0);opacity:1}}
        #__maint_icon{font-size:3.2rem;display:block;margin-bottom:1.2rem;
            animation:__mfl 3s ease-in-out infinite;}
        @keyframes __mfl{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        #__maint_ttl{font-size:1.5rem;font-weight:700;color:#e8eaf0;
            margin-bottom:.6rem;letter-spacing:-.02em;
            font-family:'DM Serif Display',Georgia,serif;}
        #__maint_sub{font-size:.875rem;color:#9ba3b8;line-height:1.7;margin-bottom:1.6rem;}
        #__maint_badge{display:inline-flex;align-items:center;gap:.4rem;
            background:rgba(232,184,75,0.1);border:1px solid rgba(232,184,75,0.25);
            border-radius:20px;padding:.3rem .9rem;font-size:.72rem;font-weight:600;
            letter-spacing:.06em;color:#e8b84b;text-transform:uppercase;}
    `;
    document.head.appendChild(s);
    document.body.style.overflow = "hidden";
    const el = document.createElement("div");
    el.id = "__maint";
    el.innerHTML = `<div id="__maint_box">
        <span id="__maint_icon">🔧</span>
        <div id="__maint_ttl">Under Maintenance</div>
        <p id="__maint_sub">${esc(message)}</p>
        <div id="__maint_badge">⏱ We'll be back soon</div>
    </div>`;
    document.body.appendChild(el);
}

// Main — runs immediately on page load
(async () => {
    try {
        // 1. Fetch maintenance state directly — no auth dependency
        const maintSnap = await getDoc(doc(db, "settings", "maintenance"));

        // Not in maintenance — do nothing, page loads normally
        if (!maintSnap.exists() || maintSnap.data().enabled !== true) return;

        const message = maintSnap.data().message
            || "The system is currently under maintenance. Please check back later.";

        // 2. Check if a logged-in admin is viewing — if so, skip the block
        //    Use a short-circuit: wait max 3s for auth, then block anyway
        await new Promise((resolve) => {
            const timeout = setTimeout(() => resolve(false), 3000);
            onAuthStateChanged(auth, async (user) => {
                clearTimeout(timeout);
                if (!user) return resolve(false);
                try {
                    const ADMIN_EMAIL = "studyhub.nob-admin@gmail.com";
                    if (user.email === ADMIN_EMAIL) return resolve(true); // admin — don't block
                    const userSnap = await getDoc(doc(db, "users", user.uid));
                    if (userSnap.exists() && userSnap.data().role === "admin") return resolve(true);
                } catch(_) {}
                resolve(false);
            });
        }).then((isAdmin) => {
            if (!isAdmin) showMaintenance(message);
        });

    } catch(err) {
        console.warn("[maintenance-check]", err);
    }
})();