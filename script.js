// script.js — Public dashboard
// Reads subject statuses from Firestore in real-time

import { db } from "./firebase-config.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {

    // ── Search ──────────────────────────────────────────────
    const searchInput  = document.getElementById('searchInput');
    const subjectCards = document.querySelectorAll('.subject-card');

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            subjectCards.forEach(card => {
                const title = card.querySelector('h3').textContent.toLowerCase();
                const desc  = card.querySelector('p').textContent.toLowerCase();
                card.style.display = (title.includes(term) || desc.includes(term)) ? 'flex' : 'none';
            });
        });
    }

    // ── Modal ───────────────────────────────────────────────
    const lockModal    = document.getElementById('lockModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const modalTitle   = document.querySelector('.modal-title');
    const modalMessage = document.querySelector('.modal-message');
    const modalIcon    = document.querySelector('.modal-icon');

    function closeModal() { lockModal.classList.remove('active'); }
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (lockModal) lockModal.addEventListener('click', (e) => { if (e.target === lockModal) closeModal(); });

    function showModal(title, message, icon) {
        modalTitle.textContent   = title;
        modalMessage.textContent = message;
        modalIcon.textContent    = icon;
        lockModal.classList.add('active');
    }

    // ── Apply status to a card ──────────────────────────────
    function applyStatus(card, status) {
        // Clean up previous state
        card.classList.remove('locked', 'unavailable', 'coming-soon');
        const oldBadge = card.querySelector('.coming-soon-badge, .unavailable-badge');
        if (oldBadge) oldBadge.remove();
        // Remove any previously bound click blocker
        card.replaceWith(card.cloneNode(true)); // cleanest way to strip old listeners
    }

    function bindCard(card, status) {
        applyStatus(card, status); // strips old listeners via cloneNode
        // Re-query after clone
        const freshCard = document.querySelector(`[data-subject-id="${card.dataset.subjectId}"]`);

        if (status === 'locked') {
            freshCard.classList.add('locked');
            freshCard.addEventListener('click', (e) => {
                e.preventDefault();
                showModal("Access Denied", "This subject requires completion of prerequisites or admin approval.", "🔒");
            });

        } else if (status === 'unavailable') {
            freshCard.classList.add('unavailable');
            const badge = document.createElement('div');
            badge.className = 'unavailable-badge';
            badge.textContent = 'UNAVAILABLE';
            freshCard.appendChild(badge);
            freshCard.addEventListener('click', (e) => {
                e.preventDefault();
                showModal("Subject Unavailable", "This subject is not being offered at this time.", "🚫");
            });

        } else if (status === 'coming_soon') {
            freshCard.classList.add('coming-soon');
            const badge = document.createElement('div');
            badge.className = 'coming-soon-badge';
            badge.textContent = 'COMING SOON';
            freshCard.appendChild(badge);
            freshCard.addEventListener('click', (e) => {
                e.preventDefault();
                showModal("Not Available Yet", "This subject is scheduled for a future semester.", "⏳");
            });
        }
        // unlocked — do nothing, link works normally
    }

    // ── Firestore real-time listener ────────────────────────
    // All statuses stored in a single document: statuses/subjects
    const statusDoc = doc(db, "statuses", "subjects");

    onSnapshot(statusDoc, (snapshot) => {
        const statuses = snapshot.exists() ? snapshot.data() : {};

        document.querySelectorAll('.subject-card').forEach(card => {
            const id     = card.getAttribute('data-subject-id');
            const status = statuses[id] || 'unlocked';
            bindCard(card, status);
        });
    }, (error) => {
        console.error("Firestore read error:", error);
    });
});