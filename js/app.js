(function () {
  "use strict";

  const STUDENTS = ["Kristian", "Hans Kristian", "Kasper", "Mats"];
  const STUDENT_INITIALS = {
    "Kristian": "KS",
    "Hans Kristian": "HK",
    "Kasper": "KP",
    "Mats": "MB"
  };
  const STUDENT_PHOTOS = {
    "Kristian": "img/team/kristian.png",
    "Hans Kristian": "img/team/hans-kristian.jpg",
    "Kasper": "img/team/kasper.png",
    "Mats": "img/team/mats.jpg"
  };

  // DOM Elements
  const form = document.getElementById("diary-form");
  const dialog = document.getElementById("entry-dialog");
  const loginDialog = document.getElementById("login-dialog");
  const loginForm = document.getElementById("login-form");
  const openButton = document.getElementById("open-entry");
  const headerLoginBtn = document.getElementById("header-login-btn");
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
  const searchInput = document.getElementById("feed-search");
  const navLinks = document.querySelectorAll("[data-view]");
  const viewPanels = document.querySelectorAll(".view-panel");
  const editStatusStrip = document.getElementById("edit-status-strip");
  const modeBadge = document.getElementById("mode-badge");
  const modeText = document.getElementById("mode-text");
  const toggleEditModeBtn = document.getElementById("toggle-edit-mode");
  const demoLoginBtn = document.getElementById("demo-login-btn");
  const authStatus = document.getElementById("auth-status");
  const resultsSummary = document.getElementById("results-summary");

  // State
  let entries = [];
  let selectedStudent = "all";
  let searchQuery = "";
  let client = null;
  let session = null;
  let authReady = false;
  let isSimulatedEditMode = false;

  function isUserAuthenticated() {
    return Boolean(session || isSimulatedEditMode);
  }

  function setFormMessage(message) {
    if (formMessage) formMessage.textContent = message;
  }

  function setLoginMessage(message) {
    if (loginMessage) loginMessage.textContent = message;
  }

  function setPageMessage(message, type) {
    if (!pageMessage) return;
    pageMessage.textContent = message;
    pageMessage.className = "page-message" + (type ? ` ${type}` : "") + (message ? " visible" : "");
    if (message && (!type || type === "success")) {
      window.setTimeout(() => {
        if (pageMessage.textContent === message) {
          pageMessage.textContent = "";
          pageMessage.className = "page-message";
        }
      }, 3500);
    }
  }

  function setFeedStatus(message, type) {
    if (!feedStatus) return;
    if (entriesList) entriesList.setAttribute("aria-busy", String(type === "loading"));
    if (resultsSummary && type !== "ready") resultsSummary.textContent = "";
    feedStatus.textContent = "";
    feedStatus.className = `feed-status ${type || ""}`.trim();
    if (type === "loading") {
      const spinner = document.createElement("span");
      spinner.className = "feed-spinner";
      spinner.setAttribute("aria-hidden", "true");
      feedStatus.append(spinner);
    }
    const text = document.createElement("span");
    text.textContent = message;
    feedStatus.append(text);
  }

  function getErrorMessage(error, action) {
    if (error && error.code === "PGRST205") {
      return "Supabase-tabellen mangler. Kjør supabase-setup.sql i SQL Editor.";
    }
    return `${action} ${error && error.message ? error.message : "Prøv igjen."}`;
  }

  function getLocalDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function getYesterdayDateString() {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return getLocalDateString(date);
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
    if (!STUDENTS.includes(entry.student)) return "Velg en student.";
    if (!isValidEntryDate(entry.entry_date)) return "Velg en gyldig dato.";
    if (entry.entry_date > getLocalDateString(new Date())) return "Datoen kan ikke være i fremtiden.";
    if (!entry.content) return "Skriv hva du har gjort først.";
    if (entry.content.length > 10000) return "Hold teksten under 10 000 tegn.";
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
    if (Number.isNaN(date.getTime())) return "Dato mangler";
    return new Intl.DateTimeFormat("no-NO", {
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(date);
  }

  function updateCounts() {
    const cntAll = document.getElementById("cnt-all");
    if (cntAll) cntAll.textContent = String(entries.length);

    STUDENTS.forEach((student) => {
      const slug = student.replace(/\s+/g, "-");
      const el = document.getElementById(`cnt-${slug}`);
      if (el) {
        const count = entries.filter((e) => e.student === student).length;
        el.textContent = String(count);
      }
    });
  }

  function updateAuthUI(nextSession) {
    session = nextSession;
    const isAuth = isUserAuthenticated();

    if (logoutButton) logoutButton.hidden = !session;
    if (headerLoginBtn) headerLoginBtn.hidden = Boolean(session);
    if (openButton) openButton.disabled = !authReady;
    if (authStatus) {
      authStatus.textContent = session ? "Innlogget" : isSimulatedEditMode ? "Testmodus" : "Ikke innlogget";
    }

    if (editStatusStrip) {
      editStatusStrip.classList.toggle("active", isAuth);
    }

    if (modeBadge) {
      modeBadge.textContent = isAuth ? "Redigering aktiv" : "Lesemodus";
    }

    if (modeText) {
      if (session) {
        const email = (session.user && session.user.email) || "Innlogget bruker";
        modeText.textContent = `Innlogget som ${email}. Du kan redigere datoer direkte på kortene.`;
      } else if (isSimulatedEditMode) {
        modeText.textContent = "Testmodus aktiv: Du kan redigere og endre datoer direkte på kortene.";
      } else {
        modeText.textContent = "Logg inn for å redigere datoer direkte på kortene.";
      }
    }

    if (toggleEditModeBtn) {
      toggleEditModeBtn.textContent = isAuth
        ? "Gå tilbake til lesemodus"
        : "Aktiver redigering (test)";
    }

    renderEntries();
  }

  // Direct in-place date update handler
  async function handleDateUpdate(entry, newDate, saveBtn, feedbackEl) {
    if (!isValidEntryDate(newDate)) {
      setPageMessage("Velg en gyldig dato.", "error");
      return;
    }
    if (newDate > getLocalDateString(new Date())) {
      setPageMessage("Datoen kan ikke være i fremtiden.", "error");
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Lagrer...";

    let updateRemoteOk = true;
    let errNotice = "";

    if (client && session) {
      try {
        const { error } = await client
          .from("internship_entries")
          .update({ entry_date: newDate })
          .eq("id", entry.id);
        if (error) throw error;
      } catch (err) {
        console.warn("Supabase update error:", err);
        updateRemoteOk = false;
        errNotice = err.message || "";
      }
    }

    entry.entry_date = newDate;

    // Re-sort newest first
    entries.sort((a, b) => {
      if (b.entry_date !== a.entry_date) {
        return b.entry_date.localeCompare(a.entry_date);
      }
      return (b.created_at || "").localeCompare(a.created_at || "");
    });

    saveBtn.disabled = false;
    saveBtn.textContent = "Lagre";

    if (feedbackEl) {
      feedbackEl.textContent = "✓ Lagret";
      feedbackEl.classList.add("visible");
      window.setTimeout(() => feedbackEl.classList.remove("visible"), 2000);
    }

    if (updateRemoteOk) {
      setPageMessage(`Dato for ${entry.student} ble oppdatert til ${formatDate(newDate)}.`, "success");
    } else {
      setPageMessage(`Dato er oppdatert lokalt (${errNotice}).`, "error");
    }

    renderEntries();
  }

  function createEntryElement(entry) {
    const isAuth = isUserAuthenticated();
    const initials = STUDENT_INITIALS[entry.student] || "ST";
    const today = getLocalDateString(new Date());
    const yesterday = getYesterdayDateString();

    const card = document.createElement("article");
    card.className = "entry-card";
    card.id = `entry-${entry.id}`;

    // Card Top
    const top = document.createElement("div");
    top.className = "entry-card-top";

    // Author
    const authorBlock = document.createElement("div");
    authorBlock.className = "author-block";

    const avatar = document.createElement("div");
    avatar.className = "author-avatar";
    avatar.setAttribute("aria-hidden", "true");

    const photoUrl = STUDENT_PHOTOS[entry.student];
    if (photoUrl) {
      const img = document.createElement("img");
      img.src = photoUrl;
      img.alt = "";
      img.className = "author-avatar-img";
      img.loading = "lazy";
      img.onerror = () => {
        img.remove();
        avatar.textContent = initials;
      };
      avatar.append(img);
    } else {
      avatar.textContent = initials;
    }

    const authorInfo = document.createElement("div");
    authorInfo.className = "author-info";

    const name = document.createElement("span");
    name.className = "author-name";
    name.textContent = entry.student;

    authorInfo.append(name);
    authorBlock.append(avatar, authorInfo);
    top.append(authorBlock);

    // Date / Direct Date Editor
    const dateBlock = document.createElement("div");
    dateBlock.className = "date-editor-block";

    if (isAuth) {
      // Inline Date Editor for authenticated users
      const box = document.createElement("div");
      box.className = "inline-edit-box";

      const dateInput = document.createElement("input");
      dateInput.type = "date";
      dateInput.className = "inline-date-input";
      dateInput.value = entry.entry_date || today;
      dateInput.max = today;
      dateInput.setAttribute("aria-label", `Dato for ${entry.student}`);

      const saveBtn = document.createElement("button");
      saveBtn.type = "button";
      saveBtn.className = "inline-save-btn";
      saveBtn.textContent = "Lagre";

      const todayBtn = document.createElement("button");
      todayBtn.type = "button";
      todayBtn.className = "inline-preset-btn";
      todayBtn.textContent = "I dag";
      todayBtn.title = "Sett til i dag";

      const yestBtn = document.createElement("button");
      yestBtn.type = "button";
      yestBtn.className = "inline-preset-btn";
      yestBtn.textContent = "I går";
      yestBtn.title = "Sett til i går";

      const feedback = document.createElement("span");
      feedback.className = "inline-feedback";

      todayBtn.addEventListener("click", () => {
        dateInput.value = today;
        handleDateUpdate(entry, today, saveBtn, feedback);
      });

      yestBtn.addEventListener("click", () => {
        dateInput.value = yesterday;
        handleDateUpdate(entry, yesterday, saveBtn, feedback);
      });

      saveBtn.addEventListener("click", () => {
        handleDateUpdate(entry, dateInput.value, saveBtn, feedback);
      });

      dateInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          handleDateUpdate(entry, dateInput.value, saveBtn, feedback);
        }
      });

      box.append(dateInput, saveBtn, todayBtn, yestBtn, feedback);
      dateBlock.append(box);
    } else {
      // Normal Read Mode Date with Edit prompt
      const dateText = document.createElement("time");
      dateText.className = "date-badge";
      dateText.dateTime = entry.entry_date || "";
      dateText.textContent = formatDate(entry.entry_date);

      const editPromptBtn = document.createElement("button");
      editPromptBtn.type = "button";
      editPromptBtn.className = "btn-inline-edit";
      editPromptBtn.textContent = "Endre dato";
      editPromptBtn.title = "Klikk for å aktivere datoredigering";

      editPromptBtn.addEventListener("click", () => {
        isSimulatedEditMode = true;
        updateAuthUI(session);
        setPageMessage("Redigeringsmodus aktivert. Du kan nå endre datoer direkte på kortene.", "success");
      });

      dateBlock.append(dateText, editPromptBtn);
    }

    top.append(dateBlock);
    card.append(top);

    // Card Body
    const body = document.createElement("div");
    body.className = "entry-card-body";

    const content = document.createElement("p");
    content.className = "entry-text";
    content.textContent = entry.content;

    body.append(content);
    card.append(body);

    return card;
  }

  function renderEntries() {
    if (!entriesList) return;
    // Authentication and filters can update while the initial read is pending.
    // Only show an empty result after a successful load, never alongside an error.
    if (!feedStatus.classList.contains("ready")) {
      entriesList.replaceChildren();
      return;
    }

    let filtered = entries;

    if (selectedStudent !== "all") {
      filtered = filtered.filter((e) => e.student === selectedStudent);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((e) => {
        return (
          (e.student && e.student.toLowerCase().includes(q)) ||
          (e.content && e.content.toLowerCase().includes(q)) ||
          (e.entry_date && e.entry_date.includes(q))
        );
      });
    }

    entriesList.replaceChildren();
    if (resultsSummary) {
      resultsSummary.textContent = `${filtered.length} innlegg vises${selectedStudent === "all" ? "" : ` fra ${selectedStudent}`}${searchQuery ? " for søket" : ""}.`;
    }

    if (!filtered.length) {
      const emptyMsg = document.createElement("div");
      emptyMsg.className = "feed-status";
      emptyMsg.textContent = selectedStudent === "all"
        ? (searchQuery ? "Ingen innlegg matchet søket." : "Ingen loggføringer ennå.")
        : `Ingen innlegg registrert på ${selectedStudent}${searchQuery ? " som matcher søket" : ""}.`;
      entriesList.append(emptyMsg);
      return;
    }

    filtered.forEach((entry) => {
      entriesList.append(createEntryElement(entry));
    });
  }

  async function loadEntries() {
    setFeedStatus("Laster logginnlegg...", "loading");
    try {
      const { data, error } = await client
        .from("internship_entries")
        .select("id, student, content, entry_date, created_at")
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      entries = data || [];
      setFeedStatus("", "ready");
      updateCounts();
      renderEntries();
    } catch (error) {
      entries = [];
      entriesList.replaceChildren();
      setFeedStatus(getErrorMessage(error, "Kunne ikke hente logginnlegg."), "error");
    }
  }

  // Switch views
  function switchView(targetView) {
    navLinks.forEach((link) => {
      const isTarget = link.dataset.view === targetView;
      link.classList.toggle("active", isTarget);
      if (isTarget) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });

    viewPanels.forEach((panel) => {
      const isTarget = panel.id === `view-${targetView}`;
      panel.classList.toggle("active", isTarget);
    });

    const heading = document.querySelector(`#view-${targetView} h1`);
    if (heading) {
      heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    }
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function jumpToStudent(studentName) {
    selectedStudent = studentName;
    filterButtons.forEach((btn) => {
      const isTarget = btn.dataset.student === studentName;
      btn.classList.toggle("active", isTarget);
      btn.setAttribute("aria-pressed", String(isTarget));
    });
    switchView("loggbok");
    renderEntries();
  }

  function openEntryDialog() {
    setFormMessage("");
    const today = getLocalDateString(new Date());
    if (entryDateInput) {
      entryDateInput.max = today;
      entryDateInput.value = today;
    }
    if (dialog) {
      dialog.showModal();
      const studentSelect = document.getElementById("student");
      if (studentSelect) studentSelect.focus();
    }
  }

  function openLoginDialog() {
    setLoginMessage("");
    if (loginDialog) {
      loginDialog.showModal();
      const emailInput = document.getElementById("login-email");
      if (emailInput) emailInput.focus();
    }
  }

  function closeDialog() {
    if (dialog) dialog.close();
    if (form) form.reset();
    setFormMessage("");
  }

  function closeLoginDialog() {
    if (loginDialog) loginDialog.close();
    if (loginForm) loginForm.reset();
    setLoginMessage("");
  }

  async function handleLogin(event) {
    event.preventDefault();
    setLoginMessage("");
    const credentials = getLoginFromForm();
    if (!credentials.email || !credentials.email.includes("@") || !credentials.password) {
      setLoginMessage("Skriv inn e-post og passord.");
      return;
    }

    loginSubmitButton.disabled = true;
    loginSubmitButton.textContent = "Logger inn...";
    try {
      const { error } = await client.auth.signInWithPassword(credentials);
      if (error) throw error;
      closeLoginDialog();
      setPageMessage("Logget inn.", "success");
    } catch (error) {
      setLoginMessage(`Kunne ikke logge inn: ${error.message || "Sjekk detaljene og prøv igjen."}`);
    } finally {
      loginSubmitButton.disabled = false;
      loginSubmitButton.textContent = "Logg inn";
    }
  }

  async function handleLogout() {
    logoutButton.disabled = true;
    isSimulatedEditMode = false;
    try {
      const { error } = await client.auth.signOut();
      if (error) throw error;
      setPageMessage("Logget ut.", "success");
    } catch (error) {
      setPageMessage(`Kunne ikke logge ut: ${error.message || "Prøv igjen."}`, "error");
    } finally {
      logoutButton.disabled = false;
      updateAuthUI(null);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!isUserAuthenticated()) {
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
    submitButton.textContent = "Publiserer...";
    try {
      const { error } = await client.from("internship_entries").insert(entry);
      if (error) throw error;
      closeDialog();
      setPageMessage("Logginnlegg publisert.", "success");
      await loadEntries();
    } catch (error) {
      setFormMessage(getErrorMessage(error, "Kunne ikke publisere innlegg."));
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Publiser";
    }
  }

  function start() {
    // Nav links
    navLinks.forEach((link) => {
      link.addEventListener("click", () => {
        const view = link.dataset.view;
        if (view) switchView(view);
      });
    });

    // Jump to student shortcuts
    document.addEventListener("click", (e) => {
      const target = e.target.closest("[data-jump-student]");
      if (target) {
        const student = target.getAttribute("data-jump-student");
        if (student) jumpToStudent(student);
      }
    });

    // Filters
    filterButtons.forEach((button) => {
      button.addEventListener("click", () => {
        selectedStudent = button.dataset.student;
        filterButtons.forEach((fb) => {
          fb.classList.toggle("active", fb === button);
          fb.setAttribute("aria-pressed", String(fb === button));
        });
        renderEntries();
      });
    });

    // Search
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        searchQuery = e.target.value;
        renderEntries();
      });
    }

    // Modal buttons
    if (openButton) openButton.addEventListener("click", () => {
      if (isUserAuthenticated()) {
        openEntryDialog();
      } else {
        openLoginDialog();
      }
    });

    if (headerLoginBtn) headerLoginBtn.addEventListener("click", openLoginDialog);
    if (logoutButton) logoutButton.addEventListener("click", handleLogout);
    if (closeButton) closeButton.addEventListener("click", closeDialog);
    if (closeLoginButton) closeLoginButton.addEventListener("click", closeLoginDialog);
    if (cancelButton) cancelButton.addEventListener("click", closeDialog);
    if (cancelLoginButton) cancelLoginButton.addEventListener("click", closeLoginDialog);
    if (form) form.addEventListener("submit", handleSubmit);
    if (loginForm) loginForm.addEventListener("submit", handleLogin);

    if (dialog) {
      dialog.addEventListener("click", (e) => {
        if (e.target === dialog) closeDialog();
      });
    }

    if (loginDialog) {
      loginDialog.addEventListener("click", (e) => {
        if (e.target === loginDialog) closeLoginDialog();
      });
    }

    // Toggle edit mode
    if (toggleEditModeBtn) {
      toggleEditModeBtn.addEventListener("click", () => {
        isSimulatedEditMode = !isSimulatedEditMode;
        updateAuthUI(session);
        setPageMessage(
          isSimulatedEditMode
            ? "Redigeringsmodus aktivert. Datoer kan nå oppdateres direkte på kortene."
            : "Lesemodus aktivert.",
          isSimulatedEditMode ? "success" : ""
        );
      });
    }

    if (demoLoginBtn) {
      demoLoginBtn.addEventListener("click", () => {
        isSimulatedEditMode = true;
        closeLoginDialog();
        updateAuthUI(session);
        switchView("loggbok");
        setPageMessage("Redigeringsmodus aktivert for testing.", "success");
      });
    }

    // Initialize Supabase
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      if (openButton) openButton.disabled = true;
      setFeedStatus("Kunne ikke laste Supabase-klienten.", "error");
      return;
    }

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      if (openButton) openButton.disabled = true;
      setFeedStatus("Supabase er ikke konfigurert i js/config.js.", "error");
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
      console.warn("Auth check error:", error);
      updateAuthUI(null);
    });

    loadEntries();
  }

  start();
}());
