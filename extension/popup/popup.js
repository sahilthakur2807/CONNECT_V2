/**
 * CONNECT Browser Extension — Popup Controller
 *
 * Implements a state-machine driven popup that handles:
 * - Authentication verification
 * - Text-selection mode (search existing rooms)
 * - Structured-webpage mode (extract → match → suggest)
 * - Room creation with editable pre-filled fields
 */

(() => {
  // ─── Configuration ────────────────────────────────────────────────────
  let CONNECT_URL = "http://localhost:5173";

  // ─── DOM References ───────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);

  const screens = {
    auth: $("screen-auth"),
    detecting: $("screen-detecting"),
    text: $("screen-text"),
    page: $("screen-page"),
    create: $("screen-create"),
    success: $("screen-success"),
  };

  const elements = {
    userBadge: $("userBadge"),
    userAvatar: $("userAvatar"),
    selectedTextPreview: $("selectedTextPreview"),
    textResultsTitle: $("textResultsTitle"),
    textResults: $("textResults"),
    pageFavicon: $("pageFavicon"),
    pageTitle: $("pageTitle"),
    pageSource: $("pageSource"),
    extractionProgress: $("extractionProgress"),
    progressFill: $("progressFill"),
    progressText: $("progressText"),
    pageMatchResults: $("pageMatchResults"),
    matchResults: $("matchResults"),
    matchCount: $("matchCount"),
    pageSuggestions: $("pageSuggestions"),
    suggestionCards: $("suggestionCards"),
    roomTitle: $("roomTitle"),
    roomDescription: $("roomDescription"),
    roomCategory: $("roomCategory"),
    roomTags: $("roomTags"),
    titleCharCount: $("titleCharCount"),
    bannerPreviewField: $("bannerPreviewField"),
    bannerPreview: $("bannerPreview"),
    sourceUrlField: $("sourceUrlField"),
    sourceUrlBadge: $("sourceUrlBadge"),
    btnLogin: $("btnLogin"),
    btnBack: $("btnBack"),
    btnCreateRoom: $("btnCreateRoom"),
    btnOpenRoom: $("btnOpenRoom"),
    successRoomTitle: $("successRoomTitle"),
    errorToast: $("errorToast"),
    errorMessage: $("errorMessage"),
  };

  // ─── State ────────────────────────────────────────────────────────────
  let currentScreen = null;
  let currentUser = null;
  let extractedMetadata = null;
  let createdRoomId = null;
  let selectedSuggestion = null;

  // ─── Screen Management ────────────────────────────────────────────────

  function showScreen(name) {
    Object.entries(screens).forEach(([key, el]) => {
      el.style.display = key === name ? "block" : "none";
    });
    currentScreen = name;
  }

  // ─── API Communication ────────────────────────────────────────────────

  function sendMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        resolve(response || { error: "No response from service worker" });
      });
    });
  }

  async function apiPost(endpoint, body) {
    return sendMessage({ type: "API_REQUEST", endpoint, method: "POST", body });
  }

  async function apiGet(endpoint) {
    return sendMessage({ type: "API_REQUEST", endpoint, method: "GET" });
  }

  // ─── Error Handling ───────────────────────────────────────────────────

  function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorToast.style.display = "flex";
    setTimeout(() => {
      elements.errorToast.style.display = "none";
    }, 4000);
  }

  // ─── Auth Flow ────────────────────────────────────────────────────────

  async function checkAuth() {
    showScreen("detecting");

    const result = await sendMessage({ type: "CHECK_AUTH" });

    if (result.authenticated && result.user) {
      currentUser = result.user;
      showUserBadge(result.user);
      await detectContext();
    } else {
      showScreen("auth");
    }
  }

  function showUserBadge(user) {
    elements.userBadge.style.display = "flex";
    if (user.avatar) {
      elements.userAvatar.innerHTML = `<img src="${CONNECT_URL}${user.avatar}" alt="${user.username}">`;
    } else {
      elements.userAvatar.textContent = (user.username || "U")[0].toUpperCase();
    }
  }

  // ─── Context Detection ────────────────────────────────────────────────

  async function detectContext() {
    // Get selection and page metadata from content script
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    let selectionData = {};
    let pageMeta = {};

    try {
      // Try getting live selection from content script
      selectionData = await chrome.tabs.sendMessage(tab.id, { type: "GET_SELECTION" });
    } catch {
      // Content script not available (e.g., chrome:// pages)
      const stored = await chrome.storage.local.get("connectExtension");
      selectionData = stored.connectExtension || {};
    }

    try {
      pageMeta = await chrome.tabs.sendMessage(tab.id, { type: "GET_PAGE_META" });
    } catch {
      const stored = await chrome.storage.local.get("connectPageMeta");
      pageMeta = stored.connectPageMeta || {};
    }

    const selectedText = selectionData?.selectedText?.trim() || "";
    const pageUrl = pageMeta?.pageUrl || tab?.url || "";
    const isStructured = pageMeta?.isStructured || false;

    // Decision: If there's selected text and the page isn't structured, go text mode
    // If the page is structured (article/blog), go page mode
    if (selectedText && !isStructured) {
      startTextMode(selectedText);
    } else if (isStructured && pageUrl && !pageUrl.startsWith("chrome")) {
      startPageMode(pageUrl, pageMeta);
    } else if (selectedText) {
      // Fallback: even on structured pages, if user selected text, use it
      startTextMode(selectedText);
    } else if (pageUrl && !pageUrl.startsWith("chrome")) {
      // No selection on a regular page — try page mode anyway
      startPageMode(pageUrl, pageMeta);
    } else {
      showScreen("auth");
      showError("Navigate to a webpage or select some text to get started.");
    }
  }

  // ─── Text Mode ────────────────────────────────────────────────────────

  async function startTextMode(selectedText) {
    showScreen("text");
    elements.selectedTextPreview.textContent = selectedText;
    elements.textResultsTitle.textContent = "Searching rooms…";
    elements.textResults.innerHTML = `
      <div class="ext-skeleton-list">
        <div class="ext-skeleton-card"></div>
        <div class="ext-skeleton-card"></div>
      </div>`;

    const result = await apiPost("/extension/match", { selectedText });

    if (result.error) {
      elements.textResultsTitle.textContent = "Search Results";
      elements.textResults.innerHTML = renderNoResults(selectedText);
      return;
    }

    const rooms = result.data?.rooms || [];

    if (rooms.length > 0) {
      elements.textResultsTitle.textContent = `Found ${rooms.length} discussion${rooms.length > 1 ? "s" : ""}`;
      elements.textResults.innerHTML = rooms.map(renderRoomCard).join("");
      bindRoomCardClicks();
    } else {
      elements.textResultsTitle.textContent = "No existing discussions";
      elements.textResults.innerHTML = renderNoResults(selectedText);
    }
  }

  // ─── Page Mode ────────────────────────────────────────────────────────

  async function startPageMode(pageUrl, pageMeta) {
    showScreen("page");

    // Show page info
    const domain = extractDomain(pageUrl);
    elements.pageTitle.textContent = pageMeta?.ogTitle || pageMeta?.pageTitle || "Loading…";
    elements.pageSource.textContent = domain;
    elements.pageFavicon.innerHTML = `<img src="https://www.google.com/s2/favicons?domain=${domain}&sz=32" alt="">`;

    // Start extraction progress animation
    let progress = 10;
    elements.progressFill.style.width = "10%";
    elements.progressText.textContent = "Extracting content…";

    const progressInterval = setInterval(() => {
      progress = Math.min(progress + Math.random() * 15, 85);
      elements.progressFill.style.width = `${progress}%`;
    }, 400);

    // Call the extract API
    const extractResult = await apiPost("/extension/extract", { url: pageUrl });

    clearInterval(progressInterval);
    elements.progressFill.style.width = "100%";
    elements.progressText.textContent = "Extraction complete";

    if (extractResult.error) {
      showError("Failed to extract page content. Try selecting text instead.");
      return;
    }

    extractedMetadata = extractResult.data;

    // Update page info with extracted data
    if (extractedMetadata.title) {
      elements.pageTitle.textContent = extractedMetadata.title;
    }
    if (extractedMetadata.source) {
      elements.pageSource.textContent = extractedMetadata.source;
    }

    // Now check for existing rooms
    const matchResult = await apiPost("/extension/match", {
      url: pageUrl,
      title: extractedMetadata.title,
    });

    const matchedRooms = matchResult.data?.rooms || [];

    if (matchedRooms.length > 0) {
      // Show matched rooms
      elements.pageMatchResults.style.display = "block";
      elements.matchCount.textContent = `${matchedRooms.length} found`;
      elements.matchResults.innerHTML = matchedRooms.map(renderRoomCard).join("");
      bindRoomCardClicks();
    }

    // Get suggestions regardless (user can still create new room)
    const suggestResult = await apiPost("/extension/suggest", {
      title: extractedMetadata.title,
      description: extractedMetadata.description,
      headings: extractedMetadata.headings,
      topics: extractedMetadata.topics,
      ogImage: extractedMetadata.ogImage,
      source: extractedMetadata.source,
      url: pageUrl,
    });

    if (suggestResult.data?.suggestions?.length > 0) {
      elements.pageSuggestions.style.display = "block";
      elements.suggestionCards.innerHTML = suggestResult.data.suggestions
        .map(renderSuggestionCard)
        .join("");
      bindSuggestionClicks();
    }

    // Hide extraction progress after content is loaded
    setTimeout(() => {
      elements.extractionProgress.style.display = "none";
    }, 500);
  }

  // ─── Room Creation ────────────────────────────────────────────────────

  function openCreateForm(prefill = {}) {
    showScreen("create");
    selectedSuggestion = prefill;

    elements.roomTitle.value = prefill.title || "";
    elements.roomDescription.value = prefill.description || "";
    elements.roomCategory.value = prefill.category || "";
    elements.roomTags.value = (prefill.tags || []).join(", ");
    elements.titleCharCount.textContent = (prefill.title || "").length;

    // Banner preview
    if (prefill.imageUrl) {
      elements.bannerPreviewField.style.display = "block";
      elements.bannerPreview.style.backgroundImage = `url(${prefill.imageUrl})`;
    } else {
      elements.bannerPreviewField.style.display = "none";
    }

    // Source URL
    if (prefill.sourceUrl) {
      elements.sourceUrlField.style.display = "block";
      elements.sourceUrlBadge.textContent = `🔗 ${extractDomain(prefill.sourceUrl)}`;
    } else {
      elements.sourceUrlField.style.display = "none";
    }

    validateCreateForm();
  }

  function validateCreateForm() {
    const title = elements.roomTitle.value.trim();
    const category = elements.roomCategory.value;
    const tags = elements.roomTags.value.trim();
    const isValid = title.length >= 10 && category && tags;
    elements.btnCreateRoom.disabled = !isValid;
  }

  async function handleCreateRoom() {
    const title = elements.roomTitle.value.trim();
    const description = elements.roomDescription.value.trim();
    const category = elements.roomCategory.value;
    const tags = elements.roomTags.value
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    elements.btnCreateRoom.disabled = true;
    elements.btnCreateRoom.querySelector("span").textContent = "Creating…";

    const body = {
      title,
      description,
      category,
      tags,
    };

    // Add optional fields
    if (selectedSuggestion?.sourceUrl) {
      body.sourceUrl = selectedSuggestion.sourceUrl;
    }
    if (selectedSuggestion?.imageUrl) {
      body.imageUrl = selectedSuggestion.imageUrl;
    }

    const result = await apiPost("/rooms", body);

    if (result.error) {
      showError(result.error);
      elements.btnCreateRoom.disabled = false;
      elements.btnCreateRoom.querySelector("span").textContent = "Create Discussion";
      return;
    }

    createdRoomId = result.data?.id;
    elements.successRoomTitle.textContent = `"${title}"`;
    showScreen("success");
  }

  // ─── Rendering Helpers ────────────────────────────────────────────────

  function renderRoomCard(room) {
    const members = room._count?.members || 0;
    const messages = room._count?.messages || 0;
    const badge = room.matchSource === "article" || room.matchSource === "sourceUrl"
      ? '<span class="ext-room-card__badge">EXACT</span>'
      : "";

    return `
      <div class="ext-room-card" data-room-id="${room.id}">
        <div class="ext-room-card__icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <div class="ext-room-card__body">
          <div class="ext-room-card__title">${escapeHtml(room.title)}</div>
          <div class="ext-room-card__meta">
            <span>${members} member${members !== 1 ? "s" : ""}</span>
            <span class="ext-room-card__meta-dot"></span>
            <span>${messages} message${messages !== 1 ? "s" : ""}</span>
            ${badge}
          </div>
        </div>
      </div>`;
  }

  function renderSuggestionCard(suggestion, index) {
    const variantLabels = {
      article_title: "From Article",
      heading: "From Heading",
      discussion: "Discussion Topic",
      community: "Community Topic",
    };

    const tags = (suggestion.tags || []).slice(0, 3);

    return `
      <div class="ext-suggestion-card" data-suggestion-index="${index}">
        <div class="ext-suggestion-card__variant">${variantLabels[suggestion.variant] || "Suggestion"}</div>
        <div class="ext-suggestion-card__title">${escapeHtml(suggestion.title)}</div>
        <div class="ext-suggestion-card__meta">
          <span>${suggestion.category || "all topics"}</span>
          ${suggestion.source ? `<span class="ext-room-card__meta-dot"></span><span>${escapeHtml(suggestion.source)}</span>` : ""}
        </div>
        ${tags.length > 0
          ? `<div class="ext-suggestion-card__tags">${tags.map((t) => `<span class="ext-tag">#${escapeHtml(t)}</span>`).join("")}</div>`
          : ""}
      </div>`;
  }

  function renderNoResults(searchText) {
    const safeTruncated = escapeHtml(searchText.substring(0, 60));
    return `
      <div class="ext-no-results">
        <div class="ext-no-results__title">No discussions found</div>
        <p>No existing rooms match "${safeTruncated}${searchText.length > 60 ? "…" : ""}"</p>
        <div class="ext-no-results__action">
          <button class="ext-btn ext-btn--primary ext-btn--sm" id="btnCreateFromText">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            <span>Create Discussion</span>
          </button>
        </div>
      </div>`;
  }

  // ─── Event Binding ────────────────────────────────────────────────────

  function bindRoomCardClicks() {
    document.querySelectorAll(".ext-room-card").forEach((card) => {
      card.addEventListener("click", () => {
        const roomId = card.dataset.roomId;
        if (roomId) {
          chrome.tabs.create({ url: `${CONNECT_URL}/rooms/${roomId}` });
        }
      });
    });
  }

  function bindSuggestionClicks() {
    document.querySelectorAll(".ext-suggestion-card").forEach((card) => {
      card.addEventListener("click", () => {
        const index = parseInt(card.dataset.suggestionIndex);
        const suggestions = extractedMetadata?._suggestions || window._lastSuggestions || [];
        // Re-fetch suggestion data from the card content
        openCreateFormFromSuggestionIndex(index);
      });
    });
  }

  function openCreateFormFromSuggestionIndex(index) {
    // Get suggestions from the last suggest API call cached in the popup
    if (window._lastSuggestionsData && window._lastSuggestionsData[index]) {
      openCreateForm(window._lastSuggestionsData[index]);
    }
  }

  // ─── Utility ──────────────────────────────────────────────────────────

  function escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function extractDomain(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return url;
    }
  }

  // ─── Event Listeners ─────────────────────────────────────────────────

  elements.btnLogin.addEventListener("click", () => {
    chrome.tabs.create({ url: CONNECT_URL });
  });

  elements.btnBack.addEventListener("click", () => {
    if (extractedMetadata) {
      showScreen("page");
    } else {
      showScreen("text");
    }
  });

  elements.roomTitle.addEventListener("input", () => {
    elements.titleCharCount.textContent = elements.roomTitle.value.length;
    validateCreateForm();
  });

  elements.roomDescription.addEventListener("input", validateCreateForm);
  elements.roomCategory.addEventListener("change", validateCreateForm);
  elements.roomTags.addEventListener("input", validateCreateForm);

  elements.btnCreateRoom.addEventListener("click", handleCreateRoom);

  elements.btnOpenRoom.addEventListener("click", () => {
    if (createdRoomId) {
      chrome.tabs.create({ url: `${CONNECT_URL}/rooms/${createdRoomId}` });
    }
  });

  // Delegate click for dynamically created "Create from text" button
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("#btnCreateFromText");
    if (btn) {
      const text = elements.selectedTextPreview?.textContent || "";
      openCreateForm({
        title: text.substring(0, 100),
        description: `Discussion about: "${text.substring(0, 300)}"`,
        category: "",
        tags: [],
      });
    }
  });

  // ─── Override suggestion click to cache data ──────────────────────────

  const _originalStartPageMode = startPageMode;

  // We need to intercept suggestion data — override the page mode to cache it
  const originalApiPost = apiPost;

  // Monkey-patch to capture suggestion data (cleaner than global vars)
  window._lastSuggestionsData = [];

  const originalSuggestHandler = async function(pageUrl) {
    const suggestResult = await originalApiPost("/extension/suggest", {
      title: extractedMetadata?.title,
      description: extractedMetadata?.description,
      headings: extractedMetadata?.headings,
      topics: extractedMetadata?.topics,
      ogImage: extractedMetadata?.ogImage,
      source: extractedMetadata?.source,
      url: pageUrl,
    });

    if (suggestResult.data?.suggestions) {
      window._lastSuggestionsData = suggestResult.data.suggestions;
    }

    return suggestResult;
  };

  // Re-bind suggestion clicks to use cached data
  const _bindSuggestionClicks = () => {
    document.querySelectorAll(".ext-suggestion-card").forEach((card) => {
      card.addEventListener("click", () => {
        const index = parseInt(card.dataset.suggestionIndex);
        if (window._lastSuggestionsData[index]) {
          openCreateForm(window._lastSuggestionsData[index]);
        }
      });
    });
  };

  // Override startPageMode to cache suggestions properly
  async function startPageModeWithCache(pageUrl, pageMeta) {
    showScreen("page");

    const domain = extractDomain(pageUrl);
    elements.pageTitle.textContent = pageMeta?.ogTitle || pageMeta?.pageTitle || "Loading…";
    elements.pageSource.textContent = domain;
    elements.pageFavicon.innerHTML = `<img src="https://www.google.com/s2/favicons?domain=${domain}&sz=32" alt="">`;

    let progress = 10;
    elements.progressFill.style.width = "10%";
    elements.progressText.textContent = "Extracting content…";

    const progressInterval = setInterval(() => {
      progress = Math.min(progress + Math.random() * 15, 85);
      elements.progressFill.style.width = `${progress}%`;
    }, 400);

    const extractResult = await apiPost("/extension/extract", { url: pageUrl });

    clearInterval(progressInterval);
    elements.progressFill.style.width = "100%";
    elements.progressText.textContent = "Extraction complete";

    if (extractResult.error) {
      showError("Failed to extract page content. Try selecting text instead.");
      return;
    }

    extractedMetadata = extractResult.data;

    if (extractedMetadata.title) {
      elements.pageTitle.textContent = extractedMetadata.title;
    }
    if (extractedMetadata.source) {
      elements.pageSource.textContent = extractedMetadata.source;
    }

    const matchResult = await apiPost("/extension/match", {
      url: pageUrl,
      title: extractedMetadata.title,
    });

    const matchedRooms = matchResult.data?.rooms || [];

    if (matchedRooms.length > 0) {
      elements.pageMatchResults.style.display = "block";
      elements.matchCount.textContent = `${matchedRooms.length} found`;
      elements.matchResults.innerHTML = matchedRooms.map(renderRoomCard).join("");
      bindRoomCardClicks();
    }

    const suggestResult = await apiPost("/extension/suggest", {
      title: extractedMetadata.title,
      description: extractedMetadata.description,
      headings: extractedMetadata.headings,
      topics: extractedMetadata.topics,
      ogImage: extractedMetadata.ogImage,
      source: extractedMetadata.source,
      url: pageUrl,
    });

    if (suggestResult.data?.suggestions?.length > 0) {
      window._lastSuggestionsData = suggestResult.data.suggestions;
      elements.pageSuggestions.style.display = "block";
      elements.suggestionCards.innerHTML = suggestResult.data.suggestions
        .map(renderSuggestionCard)
        .join("");
      _bindSuggestionClicks();
    }

    setTimeout(() => {
      elements.extractionProgress.style.display = "none";
    }, 500);
  }

  // Replace original startPageMode reference in detectContext
  // (The IIFE closure handles this — startPageModeWithCache is the real implementation)

  // Re-wire detectContext to use the cached version
  async function detectContextImpl() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    let selectionData = {};
    let pageMeta = {};

    try {
      selectionData = await chrome.tabs.sendMessage(tab.id, { type: "GET_SELECTION" });
    } catch {
      const stored = await chrome.storage.local.get("connectExtension");
      selectionData = stored.connectExtension || {};
    }

    try {
      pageMeta = await chrome.tabs.sendMessage(tab.id, { type: "GET_PAGE_META" });
    } catch {
      const stored = await chrome.storage.local.get("connectPageMeta");
      pageMeta = stored.connectPageMeta || {};
    }

    const selectedText = selectionData?.selectedText?.trim() || "";
    const pageUrl = pageMeta?.pageUrl || tab?.url || "";
    const isStructured = pageMeta?.isStructured || false;

    if (selectedText && !isStructured) {
      startTextMode(selectedText);
    } else if (isStructured && pageUrl && !pageUrl.startsWith("chrome")) {
      startPageModeWithCache(pageUrl, pageMeta);
    } else if (selectedText) {
      startTextMode(selectedText);
    } else if (pageUrl && !pageUrl.startsWith("chrome")) {
      startPageModeWithCache(pageUrl, pageMeta);
    } else {
      showScreen("auth");
      showError("Navigate to a webpage or select some text to get started.");
    }
  }

  // ─── Initialize ──────────────────────────────────────────────────────

  async function init() {
    showScreen("detecting");

    try {
      const urlRes = await sendMessage({ type: "GET_APP_URL" });
      if (urlRes && urlRes.appUrl) {
        CONNECT_URL = urlRes.appUrl;
      }
    } catch (e) {
      console.error("Failed to get app URL:", e);
    }

    const result = await sendMessage({ type: "CHECK_AUTH" });

    if (result.authenticated && result.user) {
      currentUser = result.user;
      showUserBadge(result.user);
      await detectContextImpl();
    } else {
      showScreen("auth");
    }
  }

  // Clear badge on popup open
  chrome.action.setBadgeText({ text: "" });

  // Boot
  init();
})();
