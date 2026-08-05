/**
 * useModerationCheck
 *
 * Real-time message moderation hook powered by XLM-RoBERTa Large via the
 * server's /api/moderation/analyze endpoint.
 *
 * Features:
 *  - Debounced analysis (fires after `debounceMs` of inactivity, default 500ms)
 *  - AbortController per request (cancels stale in-flight requests)
 *  - Client-side fast heuristics for instant feedback before the model responds
 *  - Idempotent: won't re-check the same text twice
 *  - Returns structured result used to show warning UI and disable Send button
 *
 * Usage:
 *   const { moderationState, checkText, resetModeration } = useModerationCheck();
 *
 *   moderationState shape:
 *   {
 *     status: "idle" | "checking" | "safe" | "unsafe" | "error",
 *     safe: boolean,
 *     categories: string[],          // e.g. ["threat", "harassment"]
 *     categoryDetails: { category: string, score: number }[],
 *     confidence: number,
 *     source: string,
 *     processingMs: number,
 *     lastCheckedText: string,
 *   }
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { apiClient } from "@/services/apiClient";

// ─── Client-side fast heuristics (mirrors server-side, coarse pass only) ─────

const FAST_BLOCK_PATTERNS = [
  /\b(fuck(?:ing)?|shit|bitch(?:es)?|cunt|nigger|faggot|kike|slut|whore)\b/i,
  /\b(kill\s+(?:yourself|urself|him|her|them)|kys)\b/i,
  /\b(rape|molest)\b/i,
  /\b(go\s+(?:die|kill\s+yourself))\b/i,
];

function fastLocalCheck(text) {
  const normalised = text
    .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, "")
    .replace(/[4@]/g, "a")
    .replace(/[3]/g, "e")
    .replace(/[1!|]/g, "i")
    .replace(/[0]/g, "o")
    .replace(/[5$]/g, "s")
    .trim();

  for (const p of FAST_BLOCK_PATTERNS) {
    if (p.test(normalised)) {
      let category = "harassment";
      const src = p.source.toLowerCase();
      if (src.includes("kill") || src.includes("kys")) category = "threat";
      if (src.includes("rape") || src.includes("molest")) category = "sexual_abuse";
      return { blocked: true, category };
    }
  }
  return { blocked: false };
}

// ─── Category → Human-readable label map ──────────────────────────────────────

export const CATEGORY_LABELS = {
  harassment:      "Harassment",
  threat:          "Threats",
  hate_speech:     "Hate Speech",
  profanity:       "Profanity",
  insult:          "Insults",
  sexual_abuse:    "Sexual Content",
  violent_language:"Violent Language",
};

// ─── Initial state ─────────────────────────────────────────────────────────────

const IDLE_STATE = {
  status: "idle",
  safe: true,
  categories: [],
  categoryDetails: [],
  confidence: 0,
  source: null,
  processingMs: 0,
  lastCheckedText: "",
};

// ─── Hook ──────────────────────────────────────────────────────────────────────

/**
 * @param {object} options
 * @param {number} [options.debounceMs=500]  — ms to wait after typing stops
 * @param {boolean} [options.enabled=true]  — set false to disable all checks
 */
export function useModerationCheck({ debounceMs = 500, enabled = true } = {}) {
  const [moderationState, setModerationState] = useState(IDLE_STATE);

  const debounceTimerRef  = useRef(null);
  const abortControllerRef = useRef(null);
  const lastCheckedTextRef = useRef("");
  const isMountedRef       = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (debounceTimerRef.current)  clearTimeout(debounceTimerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  /**
   * Trigger an immediate (non-debounced) moderation check.
   * Used for the final pre-send gate.
   *
   * @param {string} text
   * @returns {Promise<boolean>} true if safe to send
   */
  const checkNow = useCallback(async (text) => {
    if (!enabled) return true;
    const trimmed = (text || "").trim();
    if (!trimmed) return true;

    // Fast local check first
    const local = fastLocalCheck(trimmed);
    if (local.blocked) {
      const unsafeState = {
        status: "unsafe",
        safe: false,
        categories: [local.category],
        categoryDetails: [{ category: local.category, score: 0.97 }],
        confidence: 0.97,
        source: "client_heuristic",
        processingMs: 0,
        lastCheckedText: trimmed,
      };
      if (isMountedRef.current) setModerationState(unsafeState);
      return false;
    }

    try {
      const res = await apiClient.post("/moderation/analyze", { text: trimmed });
      const data = res.data.data;
      const nextState = {
        status: data.safe ? "safe" : "unsafe",
        safe: data.safe,
        categories: data.categories || [],
        categoryDetails: data.categoryDetails || [],
        confidence: data.confidence || 0,
        source: data.source || "model",
        processingMs: data.processingMs || 0,
        lastCheckedText: trimmed,
      };
      if (isMountedRef.current) setModerationState(nextState);
      return data.safe;
    } catch {
      // On network error, fail open (allow send) — server will do final check
      return true;
    }
  }, [enabled]);

  /**
   * Schedule a debounced moderation check.
   * Call this from the textarea's onChange handler.
   *
   * @param {string} text - current textarea value
   */
  const checkText = useCallback((text) => {
    if (!enabled) return;

    const trimmed = (text || "").trim();

    // Clear existing debounce
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    // Empty input → reset to idle
    if (!trimmed) {
      lastCheckedTextRef.current = "";
      setModerationState(IDLE_STATE);
      return;
    }

    // Skip if same text was already checked and result is cached in state
    if (trimmed === lastCheckedTextRef.current && moderationState.status !== "idle") {
      return;
    }

    // Fast local check → give instant feedback while model loads
    const local = fastLocalCheck(trimmed);
    if (local.blocked) {
      lastCheckedTextRef.current = trimmed;
      setModerationState({
        status: "unsafe",
        safe: false,
        categories: [local.category],
        categoryDetails: [{ category: local.category, score: 0.97 }],
        confidence: 0.97,
        source: "client_heuristic",
        processingMs: 0,
        lastCheckedText: trimmed,
      });
      // Still schedule model check so it can potentially override to safe
    }

    // Show "checking" indicator only if we haven't instantly blocked
    if (!local.blocked) {
      setModerationState((prev) => ({
        ...prev,
        status: prev.status === "unsafe" ? "unsafe" : "checking",
        lastCheckedText: trimmed,
      }));
    }

    // Debounce the model call
    debounceTimerRef.current = setTimeout(async () => {
      // Cancel previous in-flight request
      if (abortControllerRef.current) abortControllerRef.current.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const res = await apiClient.post(
          "/moderation/analyze",
          { text: trimmed },
          { signal: controller.signal }
        );
        const data = res.data.data;

        if (!isMountedRef.current || controller.signal.aborted) return;

        lastCheckedTextRef.current = trimmed;
        setModerationState({
          status: data.safe ? "safe" : "unsafe",
          safe: data.safe,
          categories: data.categories || [],
          categoryDetails: data.categoryDetails || [],
          confidence: data.confidence || 0,
          source: data.source || "model",
          processingMs: data.processingMs || 0,
          lastCheckedText: trimmed,
        });
      } catch (err) {
        if (!isMountedRef.current || err.name === "CanceledError" || err.code === "ERR_CANCELED") return;
        // Network error or rate-limit — keep local heuristic result if unsafe, else idle
        if (!local.blocked && isMountedRef.current) {
          setModerationState((prev) => ({
            ...prev,
            status: prev.status === "unsafe" ? "unsafe" : "idle",
          }));
        }
      }
    }, debounceMs);
  }, [enabled, debounceMs, moderationState.status]);

  /**
   * Reset moderation state (e.g. after message is sent).
   */
  const resetModeration = useCallback(() => {
    if (debounceTimerRef.current)  clearTimeout(debounceTimerRef.current);
    if (abortControllerRef.current) abortControllerRef.current.abort();
    lastCheckedTextRef.current = "";
    if (isMountedRef.current) setModerationState(IDLE_STATE);
  }, []);

  return { moderationState, checkText, checkNow, resetModeration };
}
