(function () {
  const LOCK_ID = "lock";
  const APP_ID = "app";
  const FORM_ID = "lock-form";
  const UNLOCK_KEY = "scrm-unlocked";
  const TRANSITION_DELAY = 320;

  function elements() {
    return {
      lock: document.getElementById(LOCK_ID),
      app: document.getElementById(APP_ID),
      form: document.getElementById(FORM_ID)
    };
  }

  function toggleAppVisibility(lock, app, unlocked) {
    if (!lock || !app) return;

    if (unlocked) {
      lock.classList.add("is-hidden");
      app.classList.add("is-active");
      app.setAttribute("aria-hidden", "false");
    } else {
      lock.classList.remove("is-hidden");
      app.classList.remove("is-active");
      app.setAttribute("aria-hidden", "true");
    }
  }

  function launchConfetti() {
    const lock = document.getElementById(LOCK_ID);
    if (!lock) return;

    const colors = ["#ffd6e7", "#f9e79f", "#c7f9cc", "#cfe8ff", "#e9d5ff"];
    const count = 90;

    for (let i = 0; i < count; i += 1) {
      const piece = document.createElement("span");
      piece.className = "confetti-piece";
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDelay = `${Math.random() * 0.2}s`;
      piece.style.animationDuration = `${1.8 + Math.random() * 1.4}s`;
      piece.style.setProperty("--drift", String(Math.random()));
      lock.appendChild(piece);

      window.setTimeout(() => {
        piece.remove();
      }, 3400);
    }
  }

  function handleUnlock(elementsMap) {
    const { lock, app } = elementsMap;
    launchConfetti();
    window.setTimeout(() => {
      toggleAppVisibility(lock, app, true);
      document.dispatchEvent(new CustomEvent("auth:granted"));
    }, TRANSITION_DELAY);
  }

  document.addEventListener("DOMContentLoaded", () => {
    const els = elements();
    const { form, lock, app } = els;

    if (!form || !lock || !app) {
      console.warn("Lock screen elements missing. Initialization skipped.");
      return;
    }

    const previouslyUnlocked = sessionStorage.getItem(UNLOCK_KEY) === "1";

    if (previouslyUnlocked) {
      toggleAppVisibility(lock, app, true);
      document.dispatchEvent(new CustomEvent("auth:granted", { detail: { restored: true } }));
    } else {
      toggleAppVisibility(lock, app, false);
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      sessionStorage.setItem(UNLOCK_KEY, "1");
      handleUnlock(els);
    });
  });
})();
