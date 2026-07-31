import { config } from "../../../config/index.js";
import { Logger } from "../../../shared/logger/Logger.js";

function decodeHtmlEntities(str) {
  if (!str || typeof str !== "string") return "";
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Infrastructure adapter for the Firecrawl web-scraping API.
 * Extracts structured content and metadata from any public webpage URL.
 *
 * Falls back to a lightweight fetch-based extraction when no Firecrawl API key is configured.
 */
export class FirecrawlClient {
  constructor() {
    this.apiKey = config.FIRECRAWL_API_KEY || "";
    this.baseUrl = "https://api.firecrawl.dev/v1";
  }

  /**
   * Scrapes a webpage and returns structured metadata.
   * @param {string} url - The URL to scrape
   * @returns {Promise<ExtractedMetadata>}
   */
  async scrape(url) {
    if (!this.apiKey) {
      Logger.warn("FIRECRAWL_API_KEY not configured — using lightweight fallback extraction.");
      return this._fallbackExtract(url);
    }

    try {
      const response = await fetch(`${this.baseUrl}/scrape`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          url,
          formats: ["markdown", "extract"],
          extract: {
            schema: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                headings: {
                  type: "array",
                  items: { type: "string" },
                },
                topics: {
                  type: "array",
                  items: { type: "string" },
                },
                author: { type: "string" },
                publishedDate: { type: "string" },
                source: { type: "string" },
              },
              required: ["title"],
            },
          },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        Logger.error(`Firecrawl API error (${response.status}): ${errorBody}`);
        return this._fallbackExtract(url);
      }

      const result = await response.json();
      return this._normalizeFirecrawlResult(result, url);
    } catch (error) {
      Logger.error("Firecrawl scrape failed, using fallback:", error);
      return this._fallbackExtract(url);
    }
  }

  /**
   * Normalizes a raw Firecrawl response into our internal metadata schema.
   */
  _normalizeFirecrawlResult(result, originalUrl) {
    const data = result.data || {};
    const extract = data.extract || {};
    const metadata = data.metadata || {};

    const rawTitle = extract.title || metadata.title || metadata.ogTitle || "";
    const rawDescription = extract.description || metadata.description || metadata.ogDescription || "";
    const ogImage = metadata.ogImage || metadata.image || null;
    const headings = Array.isArray(extract.headings)
      ? extract.headings.map(decodeHtmlEntities).filter(Boolean)
      : [];
    const topics = Array.isArray(extract.topics)
      ? extract.topics.map(decodeHtmlEntities).filter(Boolean)
      : [];
    const author = decodeHtmlEntities(extract.author || metadata.author || null);
    const publishedDate = extract.publishedDate || metadata.publishedDate || null;
    const source = extract.source || this._extractDomain(originalUrl);

    return {
      url: originalUrl,
      title: decodeHtmlEntities(rawTitle),
      description: decodeHtmlEntities(rawDescription),
      ogImage,
      headings,
      topics,
      author,
      publishedDate,
      source,
      isStructured: !!(rawTitle && (headings.length > 0 || rawDescription)),
    };
  }

  /**
   * Lightweight fallback when Firecrawl is unavailable.
   * Uses native fetch to grab HTML and parses meta tags & paragraphs.
   */
  async _fallbackExtract(url) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        return this._emptyResult(url);
      }

      const html = await response.text();
      return this._parseHtml(html, url);
    } catch (error) {
      Logger.warn(`Fallback extraction failed for ${url}:`, error.message);
      return this._emptyResult(url);
    }
  }

  /**
   * Basic HTML meta-tag parser with entity unescaping and keyword extraction.
   */
  _parseHtml(html, url) {
    const getMetaContent = (name) => {
      const patterns = [
        new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']*)["']`, "i"),
        new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${name}["']`, "i"),
      ];
      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) return decodeHtmlEntities(match[1].trim());
      }
      return null;
    };

    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = getMetaContent("og:title") || getMetaContent("twitter:title") || (titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : "");
    
    let description = getMetaContent("og:description") || getMetaContent("description") || getMetaContent("twitter:description") || "";
    
    // If description is missing/short, extract first paragraph text from HTML
    if (!description || description.length < 20) {
      const pMatch = html.match(/<p[^>]*>([^<]{30,300})<\/p>/i);
      if (pMatch) {
        description = decodeHtmlEntities(pMatch[1].replace(/<[^>]*>/g, "").trim());
      }
    }

    const ogImage = getMetaContent("og:image") || getMetaContent("twitter:image") || null;
    const author = getMetaContent("author") || getMetaContent("article:author") || null;

    // Extract keywords meta if available
    const keywordsMeta = getMetaContent("keywords") || getMetaContent("article:tag") || "";
    const topics = keywordsMeta
      ? keywordsMeta.split(/[,;]+/).map((k) => k.trim()).filter((k) => k.length >= 2)
      : [];

    // Extract headings from HTML
    const headingRegex = /<h[12][^>]*>([^<]*(?:<[^/][^>]*>[^<]*)*)<\/h[12]>/gi;
    const headings = [];
    let headingMatch;
    while ((headingMatch = headingRegex.exec(html)) !== null && headings.length < 10) {
      const cleanHeading = decodeHtmlEntities(headingMatch[1].replace(/<[^>]*>/g, "").trim());
      if (cleanHeading && cleanHeading.length > 5) headings.push(cleanHeading);
    }

    return {
      url,
      title,
      description,
      ogImage,
      headings,
      topics,
      author,
      publishedDate: null,
      source: this._extractDomain(url),
      isStructured: !!(title && (headings.length > 0 || description)),
    };
  }

  _extractDomain(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  }

  _emptyResult(url) {
    return {
      url,
      title: "",
      description: "",
      ogImage: null,
      headings: [],
      topics: [],
      author: null,
      publishedDate: null,
      source: this._extractDomain(url),
      isStructured: false,
    };
  }
}
