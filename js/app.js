(function () {
  "use strict";

  const STUDENTS = ["Kristian", "Hans Kristian", "Kasper", "Mats"];
  const form = document.getElementById("diary-form");
  const dialog = document.getElementById("entry-dialog");
  const openButton = document.getElementById("open-entry");
  const closeButton = document.getElementById("close-entry");
  const cancelButton = document.getElementById("cancel-entry");
  const submitButton = document.getElementById("submit-button");
  const formMessage = document.getElementById("form-message");
  const pageMessage = document.getElementById("page-message");
  const feedStatus = document.getElementById("feed-status");
  const entriesList = document.getElementById("entries-list");
  const filterButtons = document.querySelectorAll("[data-student]");
  let entries = [];
  let selectedStudent = "all";
  let client = null;

  function setFormMessage(message) {
    formMessage.textContent = message;
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

  function validateEntry(entry) {
    if (!STUDENTS.includes(entry.student)) return "Select a student.";
    if (!entry.content) return "Write something in the entry first.";
    if (entry.content.length > 10000) return "Keep the entry under 10,000 characters.";
    return "";
  }

  function getEntryFromForm() {
    const formData = new FormData(form);
    return {
      student: String(formData.get("student") || "").trim(),
      content: String(formData.get("content") || "").trim()
    };
  }

  function formatDate(value) {
    const date = new Date(value);
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
    const date = addText(meta, "time", "entry-date", formatDate(entry.created_at));
    date.dateTime = entry.created_at || "";
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
        .select("id, student, content, created_at")
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

  function openDialog() {
    setFormMessage("");
    dialog.showModal();
    document.getElementById("student").focus();
  }

  function closeDialog() {
    dialog.close();
    form.reset();
    setFormMessage("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
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
    openButton.addEventListener("click", openDialog);
    closeButton.addEventListener("click", closeDialog);
    cancelButton.addEventListener("click", closeDialog);
    form.addEventListener("submit", handleSubmit);
    filterButtons.forEach((button) => button.addEventListener("click", () => selectFilter(button)));
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) closeDialog();
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
    loadEntries();
  }

  start();
}());
