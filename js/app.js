(function () {
  "use strict";

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
  const searchInput = document.getElementById("feed-search");
  const navLinks = document.querySelectorAll(".main-nav [data-view]");
  const viewPanels = document.querySelectorAll(".view-panel");
  const authStatus = document.getElementById("auth-status");
  const resultsSummary = document.getElementById("results-summary");
  const cntAll = document.getElementById("cnt-all");

  // Attachment elements
  const attachmentInput = document.getElementById("entry-attachments-input");
  const attachmentDropZone = document.getElementById("attachment-drop-zone");
  const attachmentPreviewList = document.getElementById("attachment-preview-list");

  // State
  let entries = [];
  let searchQuery = "";
  let client = null;
  let session = null;
  let authReady = false;
  let pendingAttachments = [];

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function isUserAuthenticated() {
    return Boolean(session);
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

  function formatDate(dateString) {
    if (!dateString) return "";
    const [year, month, day] = dateString.split("-").map(Number);
    if (!year || !month || !day) return dateString;
    const date = new Date(year, month - 1, day);
    return new Intl.DateTimeFormat("no-NO", {
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(date);
  }

  function formatFileSize(bytes) {
    if (!bytes || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  }

  function getLocalDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function getYesterdayDateString() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return getLocalDateString(yesterday);
  }

  function isValidEntryDate(dateString) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return false;
    const [year, month, day] = dateString.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    );
  }

  // =========================================================================
  // TYPEWRITER & SCROLL REVEAL ANIMATIONS
  // =========================================================================
  function runTypewriter(el, targetText, speed = 25) {
    if (prefersReducedMotion) {
      el.textContent = targetText;
      el.dataset.typed = "true";
      return;
    }

    if (el.dataset.typed === "true" || el.dataset.typing === "true") return;
    el.dataset.typing = "true";

    const textToType = targetText || el.getAttribute("data-typewriter") || el.textContent;
    el.textContent = "";

    const cursor = document.createElement("span");
    cursor.className = "typewriter-cursor";
    cursor.setAttribute("aria-hidden", "true");
    el.append(cursor);

    let index = 0;
    function step() {
      if (index < textToType.length) {
        const char = textToType.charAt(index);
        cursor.before(document.createTextNode(char));
        index++;
        const delay = char === " " ? speed * 0.6 : speed + (Math.random() * 15 - 7);
        window.setTimeout(step, Math.max(12, delay));
      } else {
        el.dataset.typed = "true";
        delete el.dataset.typing;
        window.setTimeout(() => {
          cursor.classList.add("fade-out");
          window.setTimeout(() => cursor.remove(), 400);
        }, 1200);
      }
    }
    step();
  }

  function initScrollAndTypewriterAnimations() {
    if (prefersReducedMotion) {
      document.querySelectorAll("[data-reveal]").forEach((el) => el.classList.add("is-revealed"));
      document.querySelectorAll("[data-typewriter]").forEach((el) => {
        el.textContent = el.getAttribute("data-typewriter") || el.textContent;
      });
      return;
    }

    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            if (entry.target.hasAttribute("data-typewriter")) {
              runTypewriter(entry.target, entry.target.getAttribute("data-typewriter"));
            }
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );

    document.querySelectorAll("[data-reveal], [data-typewriter]").forEach((el) => {
      revealObserver.observe(el);
    });
  }

  function triggerAnimationsInPanel(panel) {
    if (!panel || prefersReducedMotion) return;
    panel.querySelectorAll("[data-reveal]:not(.is-revealed)").forEach((el) => {
      el.classList.add("is-revealed");
    });
    panel.querySelectorAll("[data-typewriter]:not([data-typed='true'])").forEach((el) => {
      runTypewriter(el, el.getAttribute("data-typewriter"));
    });
  }

  // =========================================================================
  // VIEW SWITCHING
  // =========================================================================
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
      if (isTarget) {
        triggerAnimationsInPanel(panel);
      }
    });

    const heading = document.querySelector(`#view-${targetView} h1, #view-${targetView} h2`);
    if (heading) {
      heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // =========================================================================
  // ATTACHMENTS HANDLING
  // =========================================================================
  function renderAttachmentPreviews() {
    if (!attachmentPreviewList) return;
    attachmentPreviewList.replaceChildren();

    if (pendingAttachments.length === 0) return;

    pendingAttachments.forEach((att, index) => {
      const item = document.createElement("div");
      item.className = "attachment-preview-item";

      const icon = document.createElement("span");
      icon.className = "attachment-preview-icon";
      icon.textContent = att.type.startsWith("image/") ? "🖼️" : att.type.includes("pdf") ? "📕" : "📄";
      icon.setAttribute("aria-hidden", "true");

      const info = document.createElement("div");
      info.className = "attachment-preview-info";

      const name = document.createElement("span");
      name.className = "attachment-preview-name";
      name.textContent = att.name;

      const size = document.createElement("span");
      size.className = "attachment-preview-size";
      size.textContent = formatFileSize(att.size);

      info.append(name, size);

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "attachment-remove-btn";
      removeBtn.setAttribute("aria-label", `Fjern ${att.name}`);
      removeBtn.innerHTML = "&times;";
      removeBtn.addEventListener("click", () => {
        pendingAttachments.splice(index, 1);
        renderAttachmentPreviews();
      });

      item.append(icon, info, removeBtn);
      attachmentPreviewList.append(item);
    });
  }

  function handleFiles(files) {
    if (!files || files.length === 0) return;
    const maxFileSize = 6 * 1024 * 1024; // 6MB limit per file for inline storage

    Array.from(files).forEach((file) => {
      if (file.size > maxFileSize) {
        setPageMessage(`Filen "${file.name}" er for stor (maks 6 MB).`, "error");
        return;
      }

      // Avoid duplicates
      if (pendingAttachments.some((a) => a.name === file.name && a.size === file.size)) {
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        pendingAttachments.push({
          name: file.name,
          size: file.size,
          type: file.type || "application/octet-stream",
          data: e.target.result
        });
        renderAttachmentPreviews();
      };
      reader.onerror = () => {
        setPageMessage(`Kunne ikke lese filen "${file.name}".`, "error");
      };
      reader.readAsDataURL(file);
    });
  }

  function initAttachmentZone() {
    if (!attachmentInput || !attachmentDropZone) return;

    attachmentInput.addEventListener("change", (e) => {
      handleFiles(e.target.files);
      attachmentInput.value = "";
    });

    ["dragenter", "dragover"].forEach((eventName) => {
      attachmentDropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        attachmentDropZone.classList.add("drag-over");
      });
    });

    ["dragleave", "drop"].forEach((eventName) => {
      attachmentDropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        attachmentDropZone.classList.remove("drag-over");
      });
    });

    attachmentDropZone.addEventListener("drop", (e) => {
      if (e.dataTransfer && e.dataTransfer.files) {
        handleFiles(e.dataTransfer.files);
      }
    });
  }

  // =========================================================================
  // AUTHENTICATION
  // =========================================================================
  function updateAuthUI(nextSession) {
    session = nextSession;
    const isAuth = isUserAuthenticated();

    if (logoutButton) logoutButton.hidden = !session;
    if (headerLoginBtn) headerLoginBtn.hidden = Boolean(session);
    if (openButton) openButton.disabled = !authReady;
    if (authStatus) {
      authStatus.textContent = session ? "Innlogget" : "Ikke innlogget";
    }

    renderEntries();
  }

  async function handleLogin(e) {
    e.preventDefault();
    if (!client) return;

    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;

    if (!email || !password) {
      setLoginMessage("Fyll ut både e-post og passord.");
      return;
    }

    loginSubmitButton.disabled = true;
    loginSubmitButton.textContent = "Logger inn...";
    setLoginMessage("");

    try {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      closeLoginDialog();
      setPageMessage("Du er nå logget inn.", "success");
      updateAuthUI(data.session);
    } catch (error) {
      setLoginMessage(error.message || "Feil ved innlogging.");
    } finally {
      loginSubmitButton.disabled = false;
      loginSubmitButton.textContent = "Logg inn";
    }
  }

  async function handleLogout() {
    if (!client) return;
    try {
      await client.auth.signOut();
      setPageMessage("Du er logget ut.", "success");
      updateAuthUI(null);
    } catch (error) {
      setPageMessage(error.message || "Feil ved utlogging.", "error");
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

  function closeLoginDialog() {
    if (loginDialog) loginDialog.close();
    if (loginForm) loginForm.reset();
    setLoginMessage("");
  }

  // =========================================================================
  // ENTRIES & LOGGBOK RENDERING
  // =========================================================================
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

    if (client && session) {
      try {
        const { error } = await client
          .from("internship_entries")
          .update({ entry_date: newDate })
          .eq("id", entry.id);
        if (error) throw error;
      } catch (err) {
        console.warn("Supabase update error:", err);
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
      feedbackEl.textContent = "Lagret!";
      feedbackEl.classList.add("visible");
      window.setTimeout(() => {
        feedbackEl.classList.remove("visible");
        renderEntries();
      }, 1000);
    } else {
      renderEntries();
    }
  }

  function createEntryElement(entry) {
    const isAuth = isUserAuthenticated();
    const today = getLocalDateString(new Date());
    const yesterday = getYesterdayDateString();

    const card = document.createElement("article");
    card.className = "entry-card";
    card.id = `entry-${entry.id}`;

    // Card Top
    const top = document.createElement("div");
    top.className = "entry-card-top";

    // Author: Teamet as a whole
    const authorBlock = document.createElement("div");
    authorBlock.className = "author-block";

    const avatar = document.createElement("div");
    avatar.className = "author-avatar author-team-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = "👥";

    const authorInfo = document.createElement("div");
    authorInfo.className = "author-info";

    const name = document.createElement("span");
    name.className = "author-name";
    name.textContent = "IS-302 Teamet";

    const sub = document.createElement("span");
    sub.className = "author-subtext";
    sub.textContent = "Kristiansand kommune · Plan og bygg";

    authorInfo.append(name, sub);
    authorBlock.append(avatar, authorInfo);
    top.append(authorBlock);

    // Date / Date Editor
    const dateBlock = document.createElement("div");
    dateBlock.className = "date-editor-block";

    if (isAuth) {
      const box = document.createElement("div");
      box.className = "inline-edit-box";

      const dateInput = document.createElement("input");
      dateInput.type = "date";
      dateInput.className = "inline-date-input";
      dateInput.value = entry.entry_date || today;
      dateInput.max = today;
      dateInput.setAttribute("aria-label", "Dato for innlegget");

      const saveBtn = document.createElement("button");
      saveBtn.type = "button";
      saveBtn.className = "inline-save-btn";
      saveBtn.textContent = "Lagre";

      const todayBtn = document.createElement("button");
      todayBtn.type = "button";
      todayBtn.className = "inline-preset-btn";
      todayBtn.textContent = "I dag";

      const yestBtn = document.createElement("button");
      yestBtn.type = "button";
      yestBtn.className = "inline-preset-btn";
      yestBtn.textContent = "I går";

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

      box.append(dateInput, saveBtn, todayBtn, yestBtn, feedback);
      dateBlock.append(box);
    } else {
      const dateText = document.createElement("time");
      dateText.className = "date-badge";
      dateText.dateTime = entry.entry_date || "";
      dateText.textContent = formatDate(entry.entry_date);
      dateBlock.append(dateText);
    }

    top.append(dateBlock);
    card.append(top);

    // Entry Body Text
    const body = document.createElement("div");
    body.className = "entry-text";
    body.textContent = entry.content;
    card.append(body);

    // Render Attachments if available
    let attachmentsList = entry.attachments;
    if (typeof attachmentsList === "string") {
      try {
        attachmentsList = JSON.parse(attachmentsList);
      } catch (e) {
        attachmentsList = null;
      }
    }

    if (Array.isArray(attachmentsList) && attachmentsList.length > 0) {
      const attContainer = document.createElement("div");
      attContainer.className = "entry-attachments-wrapper";

      const attHeader = document.createElement("span");
      attHeader.className = "entry-attachments-title";
      attHeader.textContent = `Vedlegg (${attachmentsList.length}):`;
      attContainer.append(attHeader);

      const attGrid = document.createElement("div");
      attGrid.className = "entry-attachments-grid";

      attachmentsList.forEach((att) => {
        const item = document.createElement("a");
        item.className = "entry-attachment-item";
        item.href = att.data || att.url || "#";
        item.download = att.name || "vedlegg";
        item.target = "_blank";
        item.rel = "noopener noreferrer";

        const isImg = att.type && att.type.startsWith("image/");
        const isPdf = att.type && att.type.includes("pdf");

        if (isImg && att.data) {
          const thumb = document.createElement("img");
          thumb.src = att.data;
          thumb.alt = att.name;
          thumb.className = "attachment-thumb";
          thumb.loading = "lazy";
          item.append(thumb);
        } else {
          const icon = document.createElement("span");
          icon.className = "attachment-item-icon";
          icon.textContent = isPdf ? "📕" : "📄";
          icon.setAttribute("aria-hidden", "true");
          item.append(icon);
        }

        const details = document.createElement("div");
        details.className = "attachment-item-details";

        const nameSpan = document.createElement("span");
        nameSpan.className = "attachment-item-name";
        nameSpan.textContent = att.name;

        const sizeSpan = document.createElement("span");
        sizeSpan.className = "attachment-item-size";
        sizeSpan.textContent = att.size ? formatFileSize(att.size) : "Last ned";

        details.append(nameSpan, sizeSpan);
        item.append(details);
        attGrid.append(item);
      });

      attContainer.append(attGrid);
      card.append(attContainer);
    }

    return card;
  }

  function renderEntries() {
    if (!entriesList) return;

    let filtered = entries.slice();

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((entry) => {
        const text = (entry.content || "").toLowerCase();
        const dateStr = (entry.entry_date || "").toLowerCase();
        return text.includes(q) || dateStr.includes(q);
      });
    }

    if (cntAll) {
      cntAll.textContent = String(filtered.length);
    }

    if (filtered.length === 0) {
      entriesList.replaceChildren();
      if (searchQuery.trim()) {
        setFeedStatus(`Ingen innlegg matcher søket «${searchQuery}».`, "ready");
      } else {
        setFeedStatus("Ingen innlegg publisert ennå.", "ready");
      }
      return;
    }

    setFeedStatus("", "ready");
    entriesList.replaceChildren();
    filtered.forEach((entry) => {
      entriesList.append(createEntryElement(entry));
    });
  }

  async function loadEntries() {
    setFeedStatus("Laster innlegg...", "loading");
    try {
      let loadedData = null;

      // Try reading with attachments column
      const { data: resWithAtt, error: errWithAtt } = await client
        .from("internship_entries")
        .select("id, student, content, entry_date, created_at, attachments")
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (errWithAtt) {
        // Fallback without attachments column if migration hasn't been run yet
        const { data: resNoAtt, error: errNoAtt } = await client
          .from("internship_entries")
          .select("id, student, content, entry_date, created_at")
          .order("entry_date", { ascending: false })
          .order("created_at", { ascending: false });
        if (errNoAtt) throw errNoAtt;
        loadedData = resNoAtt || [];
      } else {
        loadedData = resWithAtt || [];
      }

      entries = loadedData;
      setFeedStatus("", "ready");
      renderEntries();
    } catch (error) {
      entries = [];
      entriesList.replaceChildren();
      setFeedStatus(getErrorMessage(error, "Kunne ikke hente innlegg."), "error");
    }
  }

  // =========================================================================
  // NEW ENTRY DIALOG & PUBLISHING
  // =========================================================================
  function openEntryDialog() {
    setFormMessage("");
    const today = getLocalDateString(new Date());
    if (entryDateInput) {
      entryDateInput.max = today;
      entryDateInput.value = today;
    }
    pendingAttachments = [];
    renderAttachmentPreviews();
    if (dialog) {
      dialog.showModal();
      const contentEl = document.getElementById("content");
      if (contentEl) contentEl.focus();
    }
  }

  function closeDialog() {
    if (dialog) dialog.close();
    if (form) form.reset();
    pendingAttachments = [];
    renderAttachmentPreviews();
    setFormMessage("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!client) return;

    const contentInput = document.getElementById("content");
    const dateInput = document.getElementById("entry-date");

    const content = contentInput ? contentInput.value.trim() : "";
    const entryDate = dateInput ? dateInput.value : "";

    if (!content) {
      setFormMessage("Vennligst skriv innhold for innlegget.");
      return;
    }

    if (!isValidEntryDate(entryDate)) {
      setFormMessage("Velg en gyldig dato.");
      return;
    }

    if (entryDate > getLocalDateString(new Date())) {
      setFormMessage("Datoen kan ikke være i fremtiden.");
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Publiserer...";

    const payload = {
      student: "Teamet",
      content: content,
      entry_date: entryDate,
      attachments: pendingAttachments
    };

    try {
      // First attempt: insert with Teamet and attachments
      let { error } = await client.from("internship_entries").insert(payload);

      if (error) {
        // If attachments column doesn't exist yet, retry without attachments column
        const payloadNoAtt = {
          student: "Teamet",
          content: payload.attachments.length > 0
            ? `${content}\n\n---\n📎 Vedlegg: ${payload.attachments.map(a => a.name).join(", ")}`
            : content,
          entry_date: entryDate
        };
        const retry1 = await client.from("internship_entries").insert(payloadNoAtt);

        if (retry1.error) {
          // If check constraint requires individual student until SQL migration:
          const payloadFallback = {
            student: "Kristian",
            content: payloadNoAtt.content,
            entry_date: entryDate
          };
          const retry2 = await client.from("internship_entries").insert(payloadFallback);
          if (retry2.error) throw retry2.error;
        }
      }

      closeDialog();
      setPageMessage("Nytt innlegg publisert av teamet.", "success");
      await loadEntries();
    } catch (err) {
      setFormMessage(getErrorMessage(err, "Kunne ikke publisere innlegg."));
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Publiser";
    }
  }

  // =========================================================================
  // INITIALIZATION
  // =========================================================================
  function start() {
    // Global delegation for view switching
    document.addEventListener("click", (e) => {
      const target = e.target.closest("[data-view]");
      if (target) {
        const view = target.getAttribute("data-view");
        if (view) switchView(view);
      }
    });

    // Search input
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        searchQuery = e.target.value;
        renderEntries();
      });
    }

    // Modal triggers
    if (openButton) {
      openButton.addEventListener("click", () => {
        if (isUserAuthenticated()) {
          openEntryDialog();
        } else {
          openLoginDialog();
        }
      });
    }

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

    initAttachmentZone();
    initScrollAndTypewriterAnimations();

    // Trigger hero typewriter on initial load
    const heroTitle = document.querySelector(".hero-title[data-typewriter]");
    if (heroTitle) {
      runTypewriter(heroTitle, heroTitle.getAttribute("data-typewriter"), 28);
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
    }).catch((error) => {
      console.warn("Auth check error:", error);
      updateAuthUI(null);
    });

    loadEntries();
  }

  start();
}());
