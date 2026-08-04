/**
 * ContentModerationService
 *
 * Provides real-time multi-label content moderation using:
 *   Primary  → XLM-RoBERTa Large via Hugging Face Inference API
 *              (unitary/multilingual-toxic-xlm-roberta — multi-label toxic classifier)
 *   Fallback → Lightweight local heuristic fast-path (regex + word-list)
 *
 * Architecture:
 *   1. Local heuristic pre-check  (<1ms, no network)
 *      → Catches blatant slurs / explicit threats; returns immediately if confident
 *   2. HF Inference API call      (~100-400ms, XLM-R Large)
 *      → Full sentence-context multi-label classification
 *   3. Result merging              → worst-case score wins
 *   4. LRU cache (content hash)   → deduplicates identical texts in same session
 *
 * Detects: toxic, severe_toxic, obscene, threat, insult, identity_hate
 *          (mapped to: profanity, harassment, threat, hate_speech, sexual_abuse,
 *           violent_language, insult)
 */

import crypto from "crypto";

// ─── Configuration ────────────────────────────────────────────────────────────

const HF_API_URL =
  "https://router.huggingface.co/hf-inference/models/unitary/multilingual-toxic-xlm-roberta";

const getHfToken = () => process.env.HUGGINGFACE_API_TOKEN || "";

// Safety threshold: labels with confidence >= this value flag the content.
const SAFETY_THRESHOLD = 0.55;

// Absolute-block threshold: anything above this overrides leniency heuristics.
const BLOCK_THRESHOLD = 0.75;

// TTL for in-process LRU cache entries (ms)
const CACHE_TTL_MS = 60_000;

// Maximum cache entries before eviction
const CACHE_MAX_SIZE = 256;

// ─── Local heuristic word-list ─────────────────────────────────────────────────
// Intentionally kept short — this is a FAST coarse pass only.
// The XLM-R model does the heavy semantic lifting.
const EXPLICIT_BLOCK_PATTERNS = [
  /\b(fuck(?:ing)?|shit|bitch(?:es)?|cunt|nigger|faggot|kike|spic|chink|slut|whore)\b/i,
  /\b(kill\s+(?:yourself|urself|him|her|them)|i(?:'ll|'m going to|'ma)\s+(?:kill|murder|shoot|stab|rape))\b/i,
  /\b(rape|molest|child\s+porn|cp\s+link)\b/i,
  /\b(go\s+(?:die|kill\s+yourself)|kys)\b/i,
];

// Patterns that are almost never toxic (whitelist override for heuristics only)
const WHITELIST_PATTERNS = [
  /\b(dam(?:n)?\s+good|shoot\s+the\s+(?:breeze|shot)|kill\s+it)\b/i,
];

// ─── Label mapping (HF model → our categories) ────────────────────────────────
const LABEL_MAP = {
  toxic: "harassment",
  severe_toxic: "violent_language",
  obscene: "profanity",
  threat: "threat",
  insult: "insult",
  identity_hate: "hate_speech",
  // Additional labels some XLM-R variants emit:
  "label_0": null, // non-toxic (ignored)
  "label_1": "harassment",
  "LABEL_0": null,
  "LABEL_1": "harassment",
};

// ─── In-process LRU Cache ─────────────────────────────────────────────────────

class LRUCache {
  constructor(maxSize) {
    this.maxSize = maxSize;
    this.map = new Map(); // key → { value, expiry }
  }

  get(key) {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      this.map.delete(key);
      return null;
    }
    // LRU: refresh position
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key, value, ttl = CACHE_TTL_MS) {
    if (this.map.size >= this.maxSize) {
      // Evict oldest entry
      const firstKey = this.map.keys().next().value;
      this.map.delete(firstKey);
    }
    this.map.set(key, { value, expiry: Date.now() + ttl });
  }
}

const cache = new LRUCache(CACHE_MAX_SIZE);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function contentHash(text) {
  return crypto.createHash("sha1").update(text.toLowerCase().trim()).digest("hex").slice(0, 16);
}

/**
 * Normalise text: collapse whitespace, expand common l33t-speak substitutions,
 * strip zero-width chars used to evade filters.
 */
function normaliseText(text) {
  return text
    .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, "") // zero-width / soft-hyphen
    .replace(/[4@]/g, "a")
    .replace(/[3]/g, "e")
    .replace(/[1!|]/g, "i")
    .replace(/[0]/g, "o")
    .replace(/[5$]/g, "s")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Local heuristic fast-path.
 * Returns { safe: false, categories, confidence } if a pattern fires,
 * or null if undecided (defer to model).
 */
function localHeuristicCheck(text) {
  const normalised = normaliseText(text);

  // Whitelist override (only for heuristics — model still runs)
  for (const wp of WHITELIST_PATTERNS) {
    if (wp.test(normalised)) return null; // undecided, let model decide
  }

  for (const pattern of EXPLICIT_BLOCK_PATTERNS) {
    if (pattern.test(normalised)) {
      // Determine most likely category from which pattern matched
      let category = "harassment";
      const src = pattern.source.toLowerCase();
      if (src.includes("kill") || src.includes("murder") || src.includes("shoot") || src.includes("stab")) {
        category = "threat";
      } else if (src.includes("rape") || src.includes("molest") || src.includes("porn")) {
        category = "sexual_abuse";
      } else if (src.includes("kys") || src.includes("die")) {
        category = "violent_language";
      }
      return {
        safe: false,
        categories: [category],
        confidence: 0.97,
        source: "heuristic",
        flaggedTerms: [],
      };
    }
  }

  return null; // undecided
}

/**
 * Call the Hugging Face Inference API.
 * Handles model loading (503 with "loading" in body) with a single retry.
 */
async function callHuggingFaceModel(text, retryOnLoading = true) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000); // 6s hard timeout

  try {
    const response = await fetch(HF_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getHfToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: text, options: { wait_for_model: true } }),
      signal: controller.signal,
    });

    const body = await response.json();

    // Model still loading → retry once after a short delay
    if (response.status === 503 && body?.error?.toLowerCase().includes("loading")) {
      if (retryOnLoading) {
        await new Promise((r) => setTimeout(r, 2000));
        return callHuggingFaceModel(text, false);
      }
      return null;
    }

    if (!response.ok) {
      console.warn("[Moderation] HF API returned non-OK status:", response.status, body);
      return null;
    }

    return body;
  } catch (err) {
    if (err.name === "AbortError") {
      console.warn("[Moderation] HF API request timed out");
    } else {
      console.warn("[Moderation] HF API request failed:", err.message);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Parse the raw HF API response (various output shapes) into a normalised
 * { label → score } map.
 */
function parseHFResponse(raw) {
  if (!raw) return null;

  // Shape A: [ [{ label, score }, ...] ]  (single-input batch)
  // Shape B: [ { label, score }, ... ]    (flat array)
  const arr = Array.isArray(raw[0]) ? raw[0] : Array.isArray(raw) ? raw : null;
  if (!arr) return null;

  const scores = {};
  for (const item of arr) {
    if (item && typeof item.label === "string" && typeof item.score === "number") {
      scores[item.label] = item.score;
    }
  }
  return Object.keys(scores).length > 0 ? scores : null;
}

/**
 * Convert raw HF label scores into our structured moderation result.
 */
function buildResultFromScores(scores) {
  const flaggedCategories = [];
  let maxScore = 0;

  for (const [rawLabel, score] of Object.entries(scores)) {
    const category = LABEL_MAP[rawLabel];
    if (category && score >= SAFETY_THRESHOLD) {
      flaggedCategories.push({ category, score: Math.round(score * 100) / 100 });
    }
    if (score > maxScore) maxScore = score;
  }

  // Non-toxic label (label_0 / LABEL_0) with high score = safe
  const nonToxicScore =
    scores["label_0"] ?? scores["LABEL_0"] ?? scores["non-toxic"] ?? null;

  const isSafe =
    flaggedCategories.length === 0 &&
    (nonToxicScore === null || nonToxicScore >= 0.5);

  return {
    safe: isSafe,
    categories: flaggedCategories.map((f) => f.category),
    categoryDetails: flaggedCategories,
    confidence: Math.round(maxScore * 100) / 100,
    source: "model",
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * analyzeContent(text)
 *
 * @param {string} text - The raw message text to analyse.
 * @returns {Promise<ModerationResult>}
 *
 * ModerationResult shape:
 * {
 *   safe: boolean,
 *   categories: string[],          // e.g. ["threat", "harassment"]
 *   categoryDetails: { category, score }[],
 *   confidence: number,            // highest label score (0–1)
 *   source: "heuristic"|"model"|"cache"|"fallback",
 *   processingMs: number,
 * }
 */
export async function analyzeContent(text) {
  const start = Date.now();

  const trimmed = (text || "").trim();
  if (!trimmed || trimmed.length < 2) {
    return { safe: true, categories: [], categoryDetails: [], confidence: 0, source: "trivial", processingMs: 0 };
  }

  // 1. Cache look-up
  const cacheKey = contentHash(trimmed);
  const cached = cache.get(cacheKey);
  if (cached) {
    return { ...cached, source: "cache", processingMs: Date.now() - start };
  }

  // 2. Local heuristic fast-path
  const heuristicResult = localHeuristicCheck(trimmed);
  if (heuristicResult && heuristicResult.confidence >= BLOCK_THRESHOLD) {
    // Very high confidence block — no need to call the model
    const result = { ...heuristicResult, processingMs: Date.now() - start };
    cache.set(cacheKey, result);
    return result;
  }

  // 3. HF Inference API (XLM-R Large)
  let modelResult = null;
  const token = getHfToken();
  if (token) {
    const raw = await callHuggingFaceModel(trimmed);
    const scores = parseHFResponse(raw);
    if (scores) {
      modelResult = buildResultFromScores(scores);
    }
  }

  // 4. Merge: if heuristic fired AND model confirms → enforce block
  //           if only heuristic fired (moderate confidence) → use heuristic
  //           if only model fired → use model
  //           if both say safe → safe
  let finalResult;

  if (modelResult) {
    if (heuristicResult && !heuristicResult.safe && !modelResult.safe) {
      // Both flag it — use model's category detail but mark as doubly confirmed
      finalResult = { ...modelResult, source: "model+heuristic" };
    } else if (!modelResult.safe) {
      finalResult = { ...modelResult };
    } else if (heuristicResult && !heuristicResult.safe) {
      // Heuristic fired but model says safe — trust model, but log
      finalResult = { ...modelResult, source: "model_override_heuristic" };
    } else {
      finalResult = { ...modelResult };
    }
  } else {
    // Model unavailable — fall back to heuristic if it fired, else safe
    finalResult = heuristicResult || {
      safe: true,
      categories: [],
      categoryDetails: [],
      confidence: 0,
      source: "fallback",
    };
  }

  finalResult.processingMs = Date.now() - start;
  cache.set(cacheKey, finalResult);
  return finalResult;
}

/**
 * Quick heuristic-only check (no network). Used for the pre-send gate.
 * Resolves in <1ms.
 */
export function quickLocalCheck(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return { safe: true, categories: [], confidence: 0, source: "trivial" };
  const result = localHeuristicCheck(trimmed);
  return result || { safe: true, categories: [], confidence: 0, source: "heuristic_clean" };
}
