// maintenance-check.js
// Lightweight maintenance check for pages that don't need full auth-guard
// (index/landing and login pages)

import { db } from "./firebase-config.js";
import { doc, getDoc }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { auth }
    from "./firebase-config.js";
import { onAuthStateChanged }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

(async () => {
    try {
        const maintSnap = await getDoc(doc(db, "settings", "maintenance"));
        if (!maintSnap.exists() || maintSnap.data().enabled !== true) return;

        const message = maintSnap.data().message || "The system is currently under maintenance. Please check back later.";

        // Check if current user is admin — if so, don't block
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    const userSnap = await getDoc(doc(db, "users", user.uid));
                    if (userSnap.exists() && userSnap.data().role === "admin") return;
                    if (user.email === "studyhub.nob-admin@gmail.com") return;
                } catch(_) {}
            }
            showMaintenance(message);
        });

    } catch(err) {
        console.warn("[maintenance-check]", err);
    }
})();

function showMaintenance(message) {
    const s = document.createElement("style");
    s.textContent = `
        #__maint{position:fixed;inset:0;z-index:999999;background:#0d0f14;
            display:flex;align-items:center;justify-content:center;
            font-family:'DM Sans',system-ui,sans-serif;}
        #__maint_box{background:#13161d;border:1px solid rgba(232,184,75,0.2);
            border-radius:20px;padding:3rem 2.5rem;text-align:center;
            max-width:420px;width:90%;
            box-shadow:0 32px 64px rgba(0,0,0,.7);
            animation:__mp .4s cubic-bezier(0.34,1.56,0.64,1) forwards;}
        @keyframes __mp{from{transform:scale(.88) translateY(20px);opacity:0}to{transform:scale(1) translateY(0);opacity:1}}
        #__maint_icon{font-size:3.2rem;display:block;margin-bottom:1.2rem;
            animation:__mfl 3s ease-in-out infinite;}
        @keyframes __mfl{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        #__maint_ttl{font-size:1.5rem;font-weight:700;color:#e8eaf0;
            margin-bottom:.6rem;letter-spacing:-.02em;}
        #__maint_sub{font-size:.85rem;color:#9ba3b8;line-height:1.7;margin-bottom:1.6rem;}
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
        <p id="__maint_sub">${message.replace(/</g,"&lt;").replace(/>/g,"&gt;")}</p>
        <div id="__maint_badge">⏱ We'll be back soon</div>
    </div>`;
    document.body.appendChild(el);
}