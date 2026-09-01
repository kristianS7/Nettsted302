(function () {
  "use strict";

  const STUDENTS = ["Kristian", "Hans Kristian", "Kasper", "Mats"];
  const form = document.getElementById("diary-form");
  const dialog = document.getElementById("entry-dialog");
  const loginDialog = document.getElementById("login-dialog");
  const loginForm = document.getElementById("login-form");
  const openButton = document.getElementById("open-entry");
  const logoutButton = document.getElementById("logout-button");
  const closeButton = document.getElementById("close-entry");
  const closeLoginButton = document.getElementById("close-login");
  const cancelButton = document.getElementById("cancel-entry");
  const cancelLoginButton = document.getElementById("cancel-login");
  const entryDateInput = document.getElementById("entry-date");
  const submitButton = document.getElementById("submit-button");
  const formMessage = document.getElementById("form-message");
  const loginSubmitButton = document.getElementById("login-submit");
  const loginMessage = document.getElementById("login-message");
  const pageMessage = document.getElementById("page-message");
  const feedStatus = document.getElementById("feed-status");
  const entriesList = document.getElementById("entries-list");
  const filterButtons = document.querySelectorAll("[data-student]");
  let entries = [];
  let selectedStudent = "all";
  let client = null;
  let session = null;
  let authReady = false;

  function setFormMessage(message) {
    formMessage.textContent = message;
  }

  function setLoginMessage(message) {
    loginMessage.textContent = message;
  }

  function setPageMessage(message, type) {
    pageMessage.textContent = message;
    pageMessage.className = "page-message" + (type ? ` ${type}` : "");
  }

  function setFeedStatus(message, type) {
    feedStatus.textContent = "";
    feedStatus.className = `feed-status ${type || ""}`.trim();
    if (type === "loading") {
      const loader = document.createElement("span");
      loader.className = "loader";
      loader.setAttribute("aria-hidden", "true");
      feedStatus.append(loader);
    }
    const text = document.createElement("span");
    text.textContent = message;
    feedStatus.append(text);
  }

  function getErrorMessage(error, action) {
    if (error && error.code === "PGRST205") {
      return "The Supabase table is not set up yet. Run supabase-setup.sql in the SQL Editor.";
    }
    return `${action} ${error && error.message ? error.message : "Please try again."}`;
  }

  function getLocalDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function isValidEntryDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(`${value}T00:00:00`);
    return !Number.isNaN(date.getTime())
      && date.getFullYear() === year
      && date.getMonth() === month - 1
      && date.getDate() === day;
  }

  function validateEntry(entry) {
    if (!STUDENTS.includes(entry.student)) return "Select a student.";
    if (!isValidEntryDate(entry.entry_date)) return "Select a valid date.";
    if (entry.entry_date > getLocalDateString(new Date())) return "The entry date cannot be in the future.";
    if (!entry.content) return "Write something in the entry first.";
    if (entry.content.length > 10000) return "Keep the entry under 10,000 characters.";
    return "";
  }

  function getEntryFromForm() {
    const formData = new FormData(form);
    return {
      student: String(formData.get("student") || "").trim(),
      content: String(formData.get("content") || "").trim(),
      entry_date: String(formData.get("entry_date") || "").trim()
    };
  }

  function getLoginFromForm() {
    const formData = new FormData(loginForm);
    return {
      email: String(formData.get("email") || "").trim(),
      password: String(formData.get("password") || "")
    };
  }

  function formatDate(value) {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T00:00:00`)
      : new Date(value);
    if (Number.isNaN(date.getTime())) return "Date unavailable";
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(date).replaceAll("/", ".");
  }

  function addText(parent, tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    element.textContent = text || "";
    parent.append(element);
    return element;
  }

  function createEntry(entry) {
    const article = document.createElement("article");
    article.className = "entry";

    const meta = document.createElement("div");
    meta.className = "entry-meta";
    addText(meta, "span", "entry-student", entry.student);
    const date = addText(meta, "time", "entry-date", formatDate(entry.entry_date));
    date.dateTime = entry.entry_date || "";
    article.append(meta);
    addText(article, "p", "entry-content", entry.content);
    return article;
  }

  function renderEntries() {
    const visibleEntries = selectedStudent === "all"
      ? entries
      : entries.filter((entry) => entry.student === selectedStudent);

    entriesList.replaceChildren();
    if (!visibleEntries.length) {
      addText(entriesList, "p", "empty-state", selectedStudent === "all" ? "No entries yet." : `No entries from ${selectedStudent}.`);
      return;
    }
    visibleEntries.forEach((entry) => entriesList.append(createEntry(entry)));
  }

  async function loadEntries() {
    setFeedStatus("Loading entries...", "loading");
    try {
      const { data, error } = await client
        .from("internship_entries")
        .select("id, student, content, entry_date, created_at")
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      entries = data || [];
      setFeedStatus("", "ready");
      renderEntries();
    } catch (error) {
      entries = [];
      entriesList.replaceChildren();
      setFeedStatus(getErrorMessage(error, "Could not load entries."), "error");
    }
  }

  function updateAuthUI(nextSession) {
    session = nextSession;
    logoutButton.hidden = !session;
    openButton.disabled = !authReady;
  }

  function openEntryDialog() {
    setFormMessage("");
    const today = getLocalDateString(new Date());
    entryDateInput.max = today;
    entryDateInput.value = today;
    dialog.showModal();
    document.getElementById("student").focus();
  }

  function openLoginDialog() {
    setLoginMessage("");
    loginDialog.showModal();
    document.getElementById("login-email").focus();
  }

  function openDialog() {
    if (session) {
      openEntryDialog();
      return;
    }
    openLoginDialog();
  }

  function closeDialog() {
    dialog.close();
    form.reset();
    setFormMessage("");
  }

  function closeLoginDialog() {
    loginDialog.close();
    loginForm.reset();
    setLoginMessage("");
  }

  async function handleLogin(event) {
    event.preventDefault();
    setLoginMessage("");
    const credentials = getLoginFromForm();
    if (!credentials.email || !credentials.email.includes("@") || !credentials.password) {
      setLoginMessage("Enter your email and password.");
      return;
    }

    loginSubmitButton.disabled = true;
    loginSubmitButton.textContent = "Logging in...";
    try {
      const { error } = await client.auth.signInWithPassword(credentials);
      if (error) throw error;
      closeLoginDialog();
      openEntryDialog();
      setPageMessage("Logged in.");
      window.setTimeout(() => setPageMessage(""), 3000);
    } catch (error) {
      setLoginMessage(`Could not log in. ${error.message || "Check your details and try again."}`);
    } finally {
      loginSubmitButton.disabled = false;
      loginSubmitButton.textContent = "Logg inn";
    }
  }

  async function handleLogout() {
    logoutButton.disabled = true;
    try {
      const { error } = await client.auth.signOut();
      if (error) throw error;
      setPageMessage("Logged out.");
      window.setTimeout(() => setPageMessage(""), 3000);
    } catch (error) {
      setPageMessage(`Could not log out. ${error.message || "Please try again."}`, "error");
    } finally {
      logoutButton.disabled = false;
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!session) {
      closeDialog();
      openLoginDialog();
      return;
    }
    setFormMessage("");
    const entry = getEntryFromForm();
    const validationMessage = validateEntry(entry);
    if (validationMessage) {
      setFormMessage(validationMessage);
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Publishing...";
    try {
      const { error } = await client.from("internship_entries").insert(entry);
      if (error) throw error;
      closeDialog();
      setPageMessage("Entry published.");
      await loadEntries();
      window.setTimeout(() => setPageMessage(""), 3000);
    } catch (error) {
      setFormMessage(getErrorMessage(error, "Could not publish entry."));
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Publish";
    }
  }

  function selectFilter(button) {
    selectedStudent = button.dataset.student;
    filterButtons.forEach((filterButton) => {
      const isActive = filterButton === button;
      filterButton.classList.toggle("active", isActive);
      filterButton.setAttribute("aria-pressed", String(isActive));
    });
    renderEntries();
  }

  function start() {
    openButton.disabled = true;
    openButton.addEventListener("click", openDialog);
    logoutButton.addEventListener("click", handleLogout);
    closeButton.addEventListener("click", closeDialog);
    closeLoginButton.addEventListener("click", closeLoginDialog);
    cancelButton.addEventListener("click", closeDialog);
    cancelLoginButton.addEventListener("click", closeLoginDialog);
    form.addEventListener("submit", handleSubmit);
    loginForm.addEventListener("submit", handleLogin);
    filterButtons.forEach((button) => button.addEventListener("click", () => selectFilter(button)));
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) closeDialog();
    });
    loginDialog.addEventListener("click", (event) => {
      if (event.target === loginDialog) closeLoginDialog();
    });

    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      openButton.disabled = true;
      setFeedStatus("Supabase could not load. Check your connection and reload.", "error");
      return;
    }
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      openButton.disabled = true;
      setFeedStatus("Supabase is not configured. Add the values in js/config.js.", "error");
      return;
    }

    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    client.auth.onAuthStateChange((_event, nextSession) => updateAuthUI(nextSession));
    client.auth.getSession().then(({ data, error }) => {
      if (error) throw error;
      updateAuthUI(data.session);
      authReady = true;
      updateAuthUI(session);
    }).catch((error) => {
      setPageMessage(`Authentication is unavailable. ${error.message || "Please try again later."}`, "error");
      updateAuthUI(null);
    });
    loadEntries();
  }

  start();
}());
