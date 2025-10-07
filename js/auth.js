(function () {
  const LOCK_ID = "lock";
  const APP_ID = "app";
  const FORM_ID = "lock-form";
  const PASSWORD_ID = "lock-password";
  const ERROR_ID = "lock-error";
  const UNLOCK_KEY = "scrm-unlocked";
  const TRANSITION_DELAY = 320;

  function elements() {
    return {
      lock: document.getElementById(LOCK_ID),
      app: document.getElementById(APP_ID),
      form: document.getElementById(FORM_ID),
      password: document.getElementById(PASSWORD_ID),
      error: document.getElementById(ERROR_ID)
    };
  }

  function showError(el, message) {
    if (!el) return;
    el.textContent = message;
  }

  function clearError(el) {
    if (!el) return;
    el.textContent = "";
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

  function handleUnlock(elementsMap) {
    const { lock, app } = elementsMap;
    toggleAppVisibility(lock, app, true);
    window.setTimeout(() => {
      document.dispatchEvent(new CustomEvent("auth:granted"));
    }, TRANSITION_DELAY);
  }

  document.addEventListener("DOMContentLoaded", () => {
    const els = elements();
    const { form, password, error, lock, app } = els;

    if (!form || !password || !lock || !app) {
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
      if (!password.value.trim()) {
        showError(error, "Enter the access code.");
        password.focus();
        return;
      }

      if (typeof PUBLIC_PASSWORD !== "string" || !PUBLIC_PASSWORD) {
        showError(error, "Access code is not configured.");
        return;
      }

      if (password.value.trim() !== PUBLIC_PASSWORD) {
        showError(error, "Incorrect code. Try again.");
        password.select();
        return;
      }

      clearError(error);
      sessionStorage.setItem(UNLOCK_KEY, "1");
      handleUnlock(els);
    });

    password.addEventListener("input", () => clearError(error));
  });
})();
