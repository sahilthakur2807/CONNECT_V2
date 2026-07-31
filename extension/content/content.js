/**
 * CONNECT Browser Extension — Content Script
 *
 * Injected into every webpage. Captures text selections and page metadata,
 * making them available to the popup via chrome.storage.local.
 */

(() => {
  // Track the latest selection and page context
  let lastSelection = "";
  let selectionTimestamp = 0;

  /**
   * Captures the current text selection and stores it alongside page metadata.
   */
  function captureSelection() {
    const selection = window.getSelection();
    const selectedText = selection ? selection.toString().trim() : "";

    if (selectedText && selectedText !== lastSelection) {
      lastSelection = selectedText;
      selectionTimestamp = Date.now();

      chrome.storage.local.set({
        connectExtension: {
          selectedText: selectedText.substring(0, 500),
          pageUrl: window.location.href,
          pageTitle: document.title,
          timestamp: selectionTimestamp,
        },
      });
    }
  }

  /**
   * Determines if the current page is a "structured" content page
   * (article, blog post, documentation, news story).
   */
  function detectStructuredPage() {
    const indicators = {
      hasArticleTag: !!document.querySelector("article"),
      hasOgTitle: !!document.querySelector('meta[property="og:title"]'),
      hasOgDescription: !!document.querySelector('meta[property="og:description"]'),
      hasArticleType: (() => {
        const ogType = document.querySelector('meta[property="og:type"]');
        return ogType && ["article", "blog", "website"].includes(ogType.content);
      })(),
      hasStructuredHeadings: document.querySelectorAll("h1, h2").length >= 2,
      hasPublishedDate: !!(
        document.querySelector('meta[property="article:published_time"]') ||
        document.querySelector("time[datetime]")
      ),
    };

    // Score the page — 2+ indicators = structured
    const score = Object.values(indicators).filter(Boolean).length;
    return score >= 2;
  }

  /**
   * Gathers basic page metadata for the popup.
   */
  function getPageMetadata() {
    const getMetaContent = (selector) => {
      const el = document.querySelector(selector);
      return el ? el.content || el.getAttribute("content") : null;
    };

    return {
      pageUrl: window.location.href,
      pageTitle: document.title,
      ogTitle: getMetaContent('meta[property="og:title"]'),
      ogDescription: getMetaContent('meta[property="og:description"]'),
      ogImage: getMetaContent('meta[property="og:image"]'),
      isStructured: detectStructuredPage(),
    };
  }

  // Listen for text selection events
  document.addEventListener("mouseup", () => {
    // Small debounce to let selection finalize
    setTimeout(captureSelection, 50);
  });

  // Also capture on keyboard selection (Shift+Arrow)
  document.addEventListener("keyup", (e) => {
    if (e.shiftKey) {
      setTimeout(captureSelection, 50);
    }
  });

  // Auto-detect and register host origin if currently running on CONNECT app
  try {
    if (window.location.port === "5173" || document.title.includes("CONNECT")) {
      chrome.storage.local.set({ connectAppUrl: window.location.origin });
    }
  } catch (e) {
    // Ignore
  }

  // Store initial page metadata when the content script loads
  chrome.storage.local.set({
    connectPageMeta: getPageMetadata(),
  });

  // Listen for messages from the popup or service worker
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "GET_SELECTION") {
      const selection = window.getSelection();
      sendResponse({
        selectedText: selection ? selection.toString().trim().substring(0, 500) : "",
        pageUrl: window.location.href,
        pageTitle: document.title,
      });
      return true;
    }

    if (message.type === "GET_PAGE_META") {
      sendResponse(getPageMetadata());
      return true;
    }

    return false;
  });
})();
