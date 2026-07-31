/**
 * CONNECT Browser Extension — Service Worker (Background Script)
 *
 * Manages authentication state, context menu integration, and acts as
 * a messaging proxy between the popup and the CONNECT backend API.
 * Automatically resolves local host vs network host for seamless redirection.
 */

// ─── Dynamic Host Resolution ──────────────────────────────────────────

/**
 * Resolves the CONNECT application base URL (e.g., http://localhost:5173 or http://192.168.x.x:5173).
 * Checks active Chrome tabs for port 5173 first, then chrome.storage.local, defaulting to localhost:5173.
 */
async function resolveAppUrl() {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.url) {
        try {
          const urlObj = new URL(tab.url);
          if (urlObj.port === "5173") {
            const detectedAppUrl = urlObj.origin;
            await chrome.storage.local.set({ connectAppUrl: detectedAppUrl });
            return detectedAppUrl;
          }
        } catch {
          // Ignore invalid URL structures
        }
      }
    }
  } catch (err) {
    console.error("[CONNECT Extension] Error searching tabs for CONNECT app URL:", err);
  }

  const stored = await chrome.storage.local.get("connectAppUrl");
  if (stored.connectAppUrl) {
    return stored.connectAppUrl;
  }

  return "http://localhost:5173";
}

/**
 * Resolves the CONNECT backend API base URL based on the resolved application origin.
 */
async function getApiBase() {
  const appUrl = await resolveAppUrl();
  try {
    const urlObj = new URL(appUrl);
    urlObj.port = "3000";
    urlObj.pathname = "/api";
    return urlObj.toString().replace(/\/$/, "");
  } catch {
    return "http://localhost:3000/api";
  }
}

// ─── Context Menu Integration & Auto-Redirection ───────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "connect-discuss",
    title: "Discuss on CONNECT",
    contexts: ["selection", "page"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "connect-discuss") {
    const selectedText = (info.selectionText || "").trim().substring(0, 500);
    const pageUrl = tab?.url || "";
    const pageTitle = tab?.title || "";

    // Persist contextual selection data for popup/app sync
    await chrome.storage.local.set({
      connectExtension: {
        selectedText,
        pageUrl,
        pageTitle,
        timestamp: Date.now(),
      },
    });

    // Resolve target application URL (localhost vs network host)
    const appUrl = await resolveAppUrl();

    // Build redirection target URL
    let targetUrl = `${appUrl}/discover`;
    if (pageUrl && !pageUrl.startsWith("chrome")) {
      const q = selectedText || pageTitle || "";
      targetUrl = `${appUrl}/discover?q=${encodeURIComponent(q)}&url=${encodeURIComponent(pageUrl)}`;
    } else if (selectedText) {
      targetUrl = `${appUrl}/discover?q=${encodeURIComponent(selectedText)}`;
    }

    // Automatically redirect user to the CONNECT web application
    try {
      const tabs = await chrome.tabs.query({});
      const existingTab = tabs.find(
        (t) => t.url && (t.url.startsWith(appUrl) || t.url.includes(":5173"))
      );

      if (existingTab) {
        await chrome.tabs.update(existingTab.id, { url: targetUrl, active: true });
        if (existingTab.windowId) {
          await chrome.windows.update(existingTab.windowId, { focused: true });
        }
      } else {
        await chrome.tabs.create({ url: targetUrl, active: true });
      }
    } catch (err) {
      console.error("[CONNECT Extension] Failed to redirect to CONNECT application:", err);
      // Fallback: create a new tab directly
      await chrome.tabs.create({ url: targetUrl, active: true });
    }
  }
});

// ─── Auth Management ────────────────────────────────────────────────────────

/**
 * Retrieves the stored access token.
 */
async function getAccessToken() {
  const result = await chrome.storage.local.get("connectAccessToken");
  return result.connectAccessToken || null;
}

/**
 * Stores the access token.
 */
async function setAccessToken(token) {
  await chrome.storage.local.set({ connectAccessToken: token });
}

/**
 * Clears auth state.
 */
async function clearAuth() {
  await chrome.storage.local.remove(["connectAccessToken", "connectUser"]);
}

/**
 * Attempts to refresh the access token using the httpOnly refresh cookie.
 */
async function refreshAccessToken() {
  try {
    const apiBase = await getApiBase();
    const response = await fetch(`${apiBase}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      await clearAuth();
      return null;
    }

    const data = await response.json();
    const newToken = data.data?.accessToken;

    if (newToken) {
      await setAccessToken(newToken);
      return newToken;
    }

    return null;
  } catch (error) {
    console.error("[CONNECT Extension] Token refresh failed:", error);
    await clearAuth();
    return null;
  }
}

/**
 * Makes an authenticated API request, handling token refresh automatically.
 */
async function apiRequest(endpoint, options = {}) {
  let token = await getAccessToken();
  const apiBase = await getApiBase();

  const makeRequest = async (accessToken) => {
    const headers = {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    };

    return fetch(`${apiBase}${endpoint}`, {
      ...options,
      headers: { ...headers, ...options.headers },
      credentials: "include",
    });
  };

  let response = await makeRequest(token);

  // If 401, try refreshing the token once
  if (response.status === 401 && token) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      response = await makeRequest(newToken);
    }
  }

  return response;
}

// ─── Message Handler ────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "API_REQUEST") {
    handleApiRequest(message)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true; // Indicates async response
  }

  if (message.type === "CHECK_AUTH") {
    handleCheckAuth()
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }

  if (message.type === "GET_APP_URL") {
    resolveAppUrl()
      .then((appUrl) => sendResponse({ appUrl }))
      .catch(() => sendResponse({ appUrl: "http://localhost:5173" }));
    return true;
  }

  if (message.type === "LOGIN_WITH_TOKEN") {
    setAccessToken(message.token)
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }

  if (message.type === "LOGOUT") {
    clearAuth()
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }

  return false;
});

async function handleApiRequest(message) {
  const { endpoint, method = "GET", body } = message;

  const response = await apiRequest(endpoint, {
    method,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const data = await response.json();

  if (!response.ok) {
    return {
      error: data.error?.message || data.message || "Request failed",
      status: response.status,
    };
  }

  return { data: data.data, success: true };
}

async function handleCheckAuth() {
  const token = await getAccessToken();

  if (!token) {
    // Try refreshing (user may have an active session cookie from CONNECT web app)
    const newToken = await refreshAccessToken();
    if (!newToken) {
      return { authenticated: false };
    }
  }

  // Verify token by calling refresh — this returns user data and validates session
  try {
    const apiBase = await getApiBase();
    const response = await fetch(`${apiBase}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });

    if (response.ok) {
      const data = await response.json();
      const newToken = data.data?.accessToken;
      const user = data.data?.user;

      if (newToken && user) {
        await setAccessToken(newToken);
        await chrome.storage.local.set({ connectUser: user });
        return { authenticated: true, user };
      }
    }

    await clearAuth();
    return { authenticated: false };
  } catch {
    return { authenticated: false };
  }
}

// Clear badge when popup is opened
chrome.action.onClicked?.addListener(() => {
  chrome.action.setBadgeText({ text: "" });
});
