(function () {
  const LOCK_ID = "lock";
  const APP_ID = "app";

  function getElements() {
    return {
      lock: document.getElementById(LOCK_ID),
      app: document.getElementById(APP_ID),
      form: document.getElementById("lock-form"),
      passwordInput: document.getElementById("lock-password"),
      error: document.getElementById("lock-error"),
    };
  }

  function revealApp(elements, shouldDispatch = true) {
    const { lock, app } = elements;
    if (!lock || !app) return;

    lock.classList.add("is-hidden");
    app.classList.add("is-active");
    app.setAttribute("aria-hidden", "false");

    if (shouldDispatch) {
      document.dispatchEvent(new CustomEvent("app:unlock"));
    }
  }

  function handleSubmit(event, elements) {
    event.preventDefault();
    const { passwordInput, error } = elements;
    if (!passwordInput) return;

    const value = passwordInput.value.trim();
    if (!value) {
      if (error) error.textContent = "Password is required.";
      passwordInput.focus();
      return;
    }

    if (typeof PUBLIC_PASSWORD !== "string") {
      if (error) error.textContent = "Password is not configured.";
      return;
    }

    if (value !== PUBLIC_PASSWORD) {
      if (error) error.textContent = "Incorrect password. Try again.";
      passwordInput.select();
      return;
    }

    sessionStorage.setItem("unlocked", "1");
    if (error) error.textContent = "";
    revealApp(elements);
  }

  document.addEventListener("DOMContentLoaded", () => {
    const elements = getElements();
    const { lock, app, form, passwordInput, error } = elements;

    if (!lock || !app || !form || !passwordInput) {
      console.warn("Lock screen elements are missing.");
      return;
    }

    const alreadyUnlocked = sessionStorage.getItem("unlocked") === "1";

    if (alreadyUnlocked) {
      revealApp(elements);
      return;
    }

    app.classList.remove("is-active");
    app.setAttribute("aria-hidden", "true");
    lock.classList.remove("is-hidden");

    form.addEventListener("submit", (event) => handleSubmit(event, elements));

    passwordInput.addEventListener("input", () => {
      if (error) error.textContent = "";
    });

    setTimeout(() => {
      passwordInput.focus();
    }, 200);
  });
})();
