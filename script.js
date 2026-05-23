// script.js — Public dashboard
// Reads subject statuses from Firestore in real-time

import { db } from "./firebase-config.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {

    // ── Modal ───────────────────────────────────────────────
    const lockModal     = document.getElementById('lockModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const modalTitle    = document.querySelector('.modal-title');
    const modalMessage  = document.querySelector('.modal-message');
    const modalIcon     = document.querySelector('.modal-icon');

    function closeModal() { lockModal.classList.remove('active'); }
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (lockModal) lockModal.addEventListener('click', (e) => { if (e.target === lockModal) closeModal(); });

    function showModal(title, message, icon) {
        modalTitle.textContent   = title;
        modalMessage.textContent = message;
        modalIcon.textContent    = icon;
        lockModal.classList.add('active');
    }

    // ── Search ──────────────────────────────────────────────
    // Use event delegation on the grid container so it always
    // works even after cards are re-rendered by Firestore updates
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            // Always query fresh — cards are never replaced in the DOM
            document.querySelectorAll('.subject-card').forEach(card => {
                const title = card.querySelector('h3')?.textContent.toLowerCase() || '';
                const desc  = card.querySelector('p')?.textContent.toLowerCase() || '';
                const sem   = card.closest('.semester');
                card.style.display = (title.includes(term) || desc.includes(term)) ? '' : 'none';
                // Hide empty semesters too
                if (sem) {
                    const visible = [...sem.querySelectorAll('.subject-card')].some(c => c.style.display !== 'none');
                    sem.style.display = visible ? '' : 'none';
                }
            });
        });
    }

    // ── Click handler map (keyed by subjectId) ──────────────
    // We store one click handler per card and replace it when status changes
    const handlers = {};

    function setCardClickHandler(card, handler) {
        const id = card.getAttribute('data-subject-id');
        if (handlers[id]) card.removeEventListener('click', handlers[id]);
        handlers[id] = handler;
        if (handler) card.addEventListener('click', handler);
    }

    // ── Apply status to a card ──────────────────────────────
    function applyStatus(card, status) {
        // Clean visual state
        card.classList.remove('locked', 'unavailable', 'coming-soon');
        card.querySelectorAll('.coming-soon-badge, .unavailable-badge').forEach(b => b.remove());

        // Remove old click handler
        setCardClickHandler(card, null);

        if (status === 'locked') {
            card.classList.add('locked');
            setCardClickHandler(card, (e) => {
                e.preventDefault();
                showModal("Access Denied", "This subject requires completion of prerequisites or admin approval.", "🔒");
            });

        } else if (status === 'unavailable') {
            card.classList.add('unavailable');
            const badge = document.createElement('div');
            badge.className = 'unavailable-badge';
            badge.textContent = 'UNAVAILABLE';
            card.appendChild(badge);
            setCardClickHandler(card, (e) => {
                e.preventDefault();
                showModal("Subject Unavailable", "This subject is not being offered at this time.", "🚫");
            });

        } else if (status === 'coming_soon') {
            card.classList.add('coming-soon');
            const badge = document.createElement('div');
            badge.className = 'coming-soon-badge';
            badge.textContent = 'COMING SOON';
            card.appendChild(badge);
            setCardClickHandler(card, (e) => {
                e.preventDefault();
                showModal("Not Available Yet", "This subject is scheduled for a future semester.", "⏳");
            });
        }
        // unlocked — link works normally, no handler needed
    }

    // ── Firestore real-time listener ────────────────────────
    const statusDoc = doc(db, "statuses", "subjects");

    onSnapshot(statusDoc, (snapshot) => {
        const statuses = snapshot.exists() ? snapshot.data() : {};
        document.querySelectorAll('.subject-card').forEach(card => {
            const id     = card.getAttribute('data-subject-id');
            const status = statuses[id] || 'unlocked';
            applyStatus(card, status);
        });
    }, (error) => {
        console.error("Firestore read error:", error);
    });

});