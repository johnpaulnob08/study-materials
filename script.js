// script.js — Public dashboard
// Handles Firestore real-time status updates, search, modal, and user widget

// ── Imports ─────────────────────────────────────────────────────────────────
import { initializeApp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, onSnapshot, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Firebase Init ────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyDwvhiPoRJGzlZf5anKM1Kt48qjpT3Jo5E",
  authDomain:        "study-materials-2026.firebaseapp.com",
  projectId:         "study-materials-2026",
  storageBucket:     "study-materials-2026.firebasestorage.app",
  messagingSenderId: "613790178346",
  appId:             "1:613790178346:web:6151c6bada7b389ffbf753"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ── State ────────────────────────────────────────────────────────────────────
let currentUser = null;

// ── DOM Ready ────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {

  // ── Modal ──────────────────────────────────────────────────────────────────
  const lockModal     = document.getElementById("lockModal");
  const closeModalBtn = document.getElementById("closeModalBtn");
  const modalTitle    = document.querySelector(".modal-title");
  const modalMessage  = document.querySelector(".modal-message");
  const modalIcon     = document.querySelector(".modal-icon");

  function closeModal() {
    lockModal.classList.remove("active");
  }

  function showModal(title, message, icon) {
    modalTitle.textContent   = title;
    modalMessage.textContent = message;
    modalIcon.textContent    = icon;
    lockModal.classList.add("active");
  }

  if (closeModalBtn) closeModalBtn.addEventListener("click", closeModal);
  if (lockModal) lockModal.addEventListener("click", (e) => {
    if (e.target === lockModal) closeModal();
  });

  // ── Search ─────────────────────────────────────────────────────────────────
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const term = e.target.value.toLowerCase();
      document.querySelectorAll(".subject-card").forEach((card) => {
        const title   = card.querySelector("h3")?.textContent.toLowerCase() || "";
        const desc    = card.querySelector("p")?.textContent.toLowerCase()  || "";
        const sem     = card.closest(".semester");
        const visible = title.includes(term) || desc.includes(term);
        card.style.display = visible ? "" : "none";
        if (sem) {
          const anyVisible = [...sem.querySelectorAll(".subject-card")]
            .some((c) => c.style.display !== "none");
          sem.style.display = anyVisible ? "" : "none";
        }
      });
    });
  }

  // ── Card Click Handlers ────────────────────────────────────────────────────
  // Keyed by subjectId so we can cleanly swap handlers on status changes
  const handlers = {};

  function setCardClickHandler(card, handler) {
    const id = card.getAttribute("data-subject-id");
    if (handlers[id]) card.removeEventListener("click", handlers[id]);
    handlers[id] = handler;
    if (handler) card.addEventListener("click", handler);
  }

  // ── Apply Status to Card ───────────────────────────────────────────────────
  function applyStatus(card, status) {
    card.classList.remove("locked", "unavailable", "coming-soon");
    card.querySelectorAll(".coming-soon-badge, .unavailable-badge").forEach((b) => b.remove());
    setCardClickHandler(card, null);

    if (status === "locked") {
      card.classList.add("locked");
      setCardClickHandler(card, (e) => {
        e.preventDefault();
        showModal("Access Denied", "This subject requires completion of prerequisites or admin approval.", "🔒");
      });

    } else if (status === "unavailable") {
      card.classList.add("unavailable");
      const badge = document.createElement("div");
      badge.className   = "unavailable-badge";
      badge.textContent = "UNAVAILABLE";
      card.appendChild(badge);
      setCardClickHandler(card, (e) => {
        e.preventDefault();
        showModal("Subject Unavailable", "This subject is not being offered at this time.", "🚫");
      });

    } else if (status === "coming_soon") {
      card.classList.add("coming-soon");
      const badge = document.createElement("div");
      badge.className   = "coming-soon-badge";
      badge.textContent = "COMING SOON";
      card.appendChild(badge);
      setCardClickHandler(card, (e) => {
        e.preventDefault();
        showModal("Not Available Yet", "This subject is scheduled for a future semester.", "⏳");
      });
    }
    // "unlocked" — link works normally, no handler needed
  }

  // ── Firestore: Real-time Subject Statuses ──────────────────────────────────
  const statusDoc = doc(db, "statuses", "subjects");

  onSnapshot(statusDoc, (snapshot) => {
    const statuses = snapshot.exists() ? snapshot.data() : {};
    document.querySelectorAll(".subject-card").forEach((card) => {
      const id     = card.getAttribute("data-subject-id");
      const status = statuses[id] || "unlocked";
      applyStatus(card, status);
    });
  }, (error) => {
    console.error("Firestore read error:", error);
  });

}); // end DOMContentLoaded

// ── Auth: Populate User Widget ───────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  currentUser = user;

  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) return;

  const p        = snap.data();
  const nickname = p.nickname || p.firstName || user.displayName?.split(" ")[0] || "Scholar";
  const year     = p.year || "";

  document.getElementById("userNickname").textContent = nickname;
  document.getElementById("userYear").textContent     = year;
  document.getElementById("menuFullName").textContent =
    `${p.firstName || ""} ${p.lastName || ""}`.trim() || user.displayName || "";
  document.getElementById("menuEmail").textContent    = user.email;

  const avatarEl = document.getElementById("userAvatar");
  if (user.photoURL) {
    avatarEl.innerHTML = `<img src="${user.photoURL}" alt="${nickname}">`;
  } else {
    avatarEl.textContent = nickname.charAt(0).toUpperCase();
  }
});

// ── User Menu ────────────────────────────────────────────────────────────────
window.toggleUserMenu = function () {
  document.getElementById("userWidget").classList.toggle("open");
};

document.addEventListener("click", (e) => {
  const widget = document.getElementById("userWidget");
  if (widget && !widget.contains(e.target)) widget.classList.remove("open");
});

// ── Logout ───────────────────────────────────────────────────────────────────
window.handleLogout = async function () {
  await signOut(auth);
  window.location.href = "login.html";
};

// ── Edit Profile: Open ───────────────────────────────────────────────────────
window.openEditProfile = async function () {
  document.getElementById("userWidget").classList.remove("open");
  if (!currentUser) return;

  const snap = await getDoc(doc(db, "users", currentUser.uid));
  if (!snap.exists()) return;

  const p = snap.data();
  document.getElementById("ep-firstname").value = p.firstName || "";
  document.getElementById("ep-lastname").value  = p.lastName  || "";
  document.getElementById("ep-nickname").value  = p.nickname  || "";
  document.getElementById("ep-year").value      = p.year      || "Freshman";

  document.getElementById("epOverlay").classList.add("open");
};

// ── Edit Profile: Close ──────────────────────────────────────────────────────
window.closeEditProfile = function () {
  document.getElementById("epOverlay").classList.remove("open");
  document.getElementById("ep-alert").classList.remove("show");
};

window.closeEditOnBackdrop = function (e) {
  if (e.target === document.getElementById("epOverlay")) window.closeEditProfile();
};

// ── Edit Profile: Save ───────────────────────────────────────────────────────
window.saveEditProfile = async function () {
  const firstName = document.getElementById("ep-firstname").value.trim();
  const lastName  = document.getElementById("ep-lastname").value.trim();
  const nickname  = document.getElementById("ep-nickname").value.trim();
  const year      = document.getElementById("ep-year").value;
  const alertEl   = document.getElementById("ep-alert");

  if (!firstName || !lastName || !nickname || !year) {
    alertEl.textContent = "Please fill in all fields.";
    alertEl.classList.add("show");
    return;
  }

  const btn     = document.getElementById("ep-save-btn");
  btn.disabled  = true;
  btn.innerHTML = `<span class="spin-sm"></span> Saving...`;

  try {
    await setDoc(
      doc(db, "users", currentUser.uid),
      { firstName, lastName, nickname, year, updatedAt: serverTimestamp() },
      { merge: true }
    );

    document.getElementById("userNickname").textContent = nickname;
    document.getElementById("userYear").textContent     = year;
    document.getElementById("menuFullName").textContent = `${firstName} ${lastName}`;

    window.closeEditProfile();
  } catch (err) {
    console.error(err);
    alertEl.textContent = "Could not save. Please try again.";
    alertEl.classList.add("show");
  } finally {
    btn.disabled  = false;
    btn.innerHTML = "Save Changes";
  }
};
