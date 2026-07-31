import { Router } from "express";
import { z } from "zod";
import { authenticateJWT } from "../../../presentation/middlewares/AuthMiddleware.js";

// Handlers
import {
  ExtractWebpageCommand,
  ExtractWebpageHandler,
} from "../application/commands/ExtractWebpageCommand.js";
import {
  MatchRoomQuery,
  MatchRoomHandler,
} from "../application/queries/MatchRoomQuery.js";
import {
  SuggestRoomQuery,
  SuggestRoomHandler,
} from "../application/queries/SuggestRoomQuery.js";

const extractHandler = new ExtractWebpageHandler();
const matchHandler = new MatchRoomHandler();
const suggestHandler = new SuggestRoomHandler();

export function createExtensionRouter() {
  const router = Router();

  /**
   * POST /api/extension/extract
   * Extracts structured content and metadata from a webpage URL via Firecrawl.
   */
  router.post("/extract", authenticateJWT, async (req, res, next) => {
    const schema = z.object({
      url: z.string().url("A valid URL is required"),
    });

    try {
      const parsed = schema.parse(req.body);
      const command = new ExtractWebpageCommand(parsed.url);
      const result = await extractHandler.execute(command);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /api/extension/match
   * Finds existing CONNECT rooms that match a selected text or a webpage URL.
   * Supports two modes:
   *   - Text mode: { selectedText: "..." }
   *   - URL mode:  { url: "...", title: "..." }
   */
  router.post("/match", authenticateJWT, async (req, res, next) => {
    const schema = z.object({
      selectedText: z.string().max(500).optional(),
      url: z.string().url().optional(),
      title: z.string().max(300).optional(),
    }).refine(
      (data) => data.selectedText || data.url,
      { message: "Either selectedText or url must be provided" }
    );

    try {
      const parsed = schema.parse(req.body);
      const query = new MatchRoomQuery(req.user.id, parsed);
      const result = await matchHandler.execute(query);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /api/extension/suggest
   * Generates intelligent room title, description, category and tag suggestions
   * from extracted webpage metadata.
   */
  router.post("/suggest", authenticateJWT, async (req, res, next) => {
    const schema = z.object({
      title: z.string().max(300).optional().default(""),
      description: z.string().max(2000).optional().default(""),
      headings: z.array(z.string()).optional().default([]),
      topics: z.array(z.string()).optional().default([]),
      ogImage: z.string().optional().nullable().default(null),
      source: z.string().optional().default(""),
      url: z.string().optional().nullable().transform((val) => {
        if (!val) return undefined;
        try {
          const u = new URL(val);
          return ["http:", "https:"].includes(u.protocol) ? val : undefined;
        } catch {
          return undefined;
        }
      }),
    });

    try {
      const parsed = schema.parse(req.body);
      const query = new SuggestRoomQuery(parsed);
      const result = await suggestHandler.execute(query);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export const extensionRouter = createExtensionRouter();
