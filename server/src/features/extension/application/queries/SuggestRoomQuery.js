// --- Helper ---

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

// --- Query ---

export class SuggestRoomQuery {
  /**
   * @param {Object} metadata - Extracted webpage metadata
   * @param {string} metadata.title
   * @param {string} metadata.description
   * @param {string[]} metadata.headings
   * @param {string[]} metadata.topics
   * @param {string} metadata.ogImage
   * @param {string} metadata.source
   * @param {string} metadata.url
   */
  constructor(metadata) {
    this.metadata = metadata;
  }
}

// --- Handler ---

const CATEGORY_MAP = {
  politics: "Politics",
  technology: "Technology",
  economy: "Economy",
  environment: "Environment",
  "world affairs": "World Affairs",
  science: "Science",
  health: "Health",
  culture: "Culture",
  sports: "Sports",
};

const CATEGORY_KEYWORDS = {
  technology: ["tech", "technology", "software", "ai", "artificial intelligence", "machine learning", "cursor", "app", "digital", "cyber", "computer", "programming", "code", "developer", "web", "internet", "cloud", "api", "framework", "database"],
  politics: ["politics", "election", "government", "congress", "senate", "democrat", "republican", "legislation", "policy", "vote", "president", "parliament", "law"],
  economy: ["economy", "economic", "finance", "market", "stock", "trade", "gdp", "inflation", "recession", "bank", "investment", "fiscal", "monetary", "business", "startup"],
  environment: ["environment", "climate", "carbon", "emission", "renewable", "sustainability", "pollution", "green", "energy", "solar", "wind", "ocean"],
  "world affairs": ["global", "international", "war", "conflict", "diplomacy", "united nations", "nato", "foreign", "geopolitics", "treaty", "sanctions"],
  science: ["science", "research", "study", "discovery", "physics", "chemistry", "biology", "space", "nasa", "experiment", "quantum"],
  health: ["health", "medical", "disease", "vaccine", "hospital", "doctor", "patient", "mental health", "wellness", "fda", "who"],
  culture: ["culture", "art", "music", "film", "movie", "book", "literature", "museum", "fashion", "entertainment", "gaming", "game"],
  sports: ["sports", "football", "basketball", "soccer", "tennis", "olympic", "nba", "nfl", "fifa", "championship", "athlete"],
};

const STOP_WORDS = new Set([
  "introducing", "start", "with", "the", "a", "an", "and", "or", "to", "for",
  "of", "in", "on", "at", "from", "by", "is", "are", "was", "were", "be", "been",
  "that", "this", "these", "those", "it", "its", "your", "my", "our", "how", "what",
  "why", "when", "where", "who", "which", "new", "about", "top", "best"
]);

export class SuggestRoomHandler {
  async execute(query) {
    const rawMetadata = query.metadata || {};

    const metadata = {
      title: decodeHtmlEntities(rawMetadata.title || "").trim(),
      description: decodeHtmlEntities(rawMetadata.description || "").trim(),
      headings: (rawMetadata.headings || []).map(decodeHtmlEntities).filter(Boolean),
      topics: (rawMetadata.topics || []).map(decodeHtmlEntities).filter(Boolean),
      ogImage: rawMetadata.ogImage || null,
      source: decodeHtmlEntities(rawMetadata.source || "").trim(),
      url: rawMetadata.url || "",
    };

    const suggestions = [];

    // Determine the best category from content
    const category = this._detectCategory(metadata);
    const tags = this._extractTags(metadata);
    const imageUrl = metadata.ogImage || null;

    // Suggestion 1: Direct article title (cleaned up)
    if (metadata.title) {
      const cleanTitle = this._cleanTitle(metadata.title);
      if (cleanTitle.length >= 10) {
        suggestions.push({
          title: cleanTitle,
          description: this._buildDescription(metadata, "article"),
          category,
          tags: [...tags],
          imageUrl,
          sourceUrl: metadata.url,
          source: metadata.source,
          variant: "article_title",
        });
      }
    }

    // Suggestion 2: From primary heading (often more specific than title)
    if (metadata.headings && metadata.headings.length > 0) {
      const primaryHeading = this._cleanTitle(metadata.headings[0]);
      if (primaryHeading.length >= 10 && primaryHeading !== suggestions[0]?.title) {
        suggestions.push({
          title: primaryHeading,
          description: this._buildDescription(metadata, "heading"),
          category,
          tags: [...tags],
          imageUrl,
          sourceUrl: metadata.url,
          source: metadata.source,
          variant: "heading",
        });
      }
    }

    // Suggestion 3: Discussion-focused title from topics or description
    const discussionTitle = this._generateDiscussionTitle(metadata);
    if (discussionTitle && discussionTitle.length >= 10 && !suggestions.some((s) => s.title === discussionTitle)) {
      suggestions.push({
        title: discussionTitle,
        description: this._buildDescription(metadata, "discussion"),
        category,
        tags: [...tags],
        imageUrl,
        sourceUrl: metadata.url,
        source: metadata.source,
        variant: "discussion",
      });
    }

    // If we don't have enough suggestions, generate a community-focused variant
    if (suggestions.length < 3 && metadata.title) {
      const communityTitle = this._generateCommunityTitle(metadata);
      if (communityTitle && communityTitle.length >= 10 && !suggestions.some((s) => s.title === communityTitle)) {
        suggestions.push({
          title: communityTitle,
          description: this._buildDescription(metadata, "community"),
          category,
          tags: [...tags],
          imageUrl,
          sourceUrl: metadata.url,
          source: metadata.source,
          variant: "community",
        });
      }
    }

    return {
      suggestions: suggestions.slice(0, 3),
      metadata: {
        extractedTitle: metadata.title,
        source: metadata.source,
        ogImage: metadata.ogImage,
        headingCount: metadata.headings?.length || 0,
      },
    };
  }

  /**
   * Detects the best CONNECT category by scoring content keywords.
   */
  _detectCategory(metadata) {
    const contentBlob = [
      metadata.title || "",
      metadata.description || "",
      ...(metadata.headings || []),
      ...(metadata.topics || []),
    ]
      .join(" ")
      .toLowerCase();

    let bestCategory = "Technology";
    let bestScore = 0;

    for (const [key, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      let score = 0;
      for (const keyword of keywords) {
        if (contentBlob.includes(keyword)) {
          score += keyword.length > 5 ? 2 : 1;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestCategory = CATEGORY_MAP[key] || "Technology";
      }
    }

    return bestCategory;
  }

  /**
   * Extracts relevant hashtags from metadata.
   */
  _extractTags(metadata) {
    const tagCandidates = new Set();

    // 1. From topics meta
    if (metadata.topics) {
      metadata.topics.forEach((topic) => {
        const normalized = topic.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
        if (normalized.length >= 3 && normalized.length <= 25) {
          tagCandidates.add(normalized.replace(/\s+/g, "-"));
        }
      });
    }

    // 2. From title keywords (skipping stop words)
    if (metadata.title) {
      const words = metadata.title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .split(/\s+/)
        .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
      words.forEach((w) => tagCandidates.add(w));
    }

    // 3. From headings keywords
    if (metadata.headings) {
      metadata.headings.slice(0, 2).forEach((heading) => {
        const words = heading
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, "")
          .split(/\s+/)
          .filter((w) => w.length >= 4 && !STOP_WORDS.has(w));
        words.slice(0, 2).forEach((w) => tagCandidates.add(w));
      });
    }

    // 4. From source domain
    if (metadata.source) {
      const sourceName = metadata.source.replace(/\.(com|org|net|io|dev|co|ai|app)$/i, "");
      if (sourceName.length >= 3 && sourceName !== "localhost") {
        tagCandidates.add(sourceName);
      }
    }

    // Fallbacks if list is small
    if (tagCandidates.size === 0) {
      tagCandidates.add("discussion");
      tagCandidates.add("news");
    }

    return Array.from(tagCandidates).slice(0, 5);
  }

  /**
   * Cleans a title string for use as a room title (strips site suffixes like "· Cursor", "| TechCrunch").
   */
  _cleanTitle(title) {
    return decodeHtmlEntities(title)
      .replace(/\s*[-–—·|]\s*[^-–—·|]*$/, "") // Strip "· Cursor", "- Site"
      .replace(/^\s*\[.*?\]\s*/, "")
      .replace(/\s+/g, " ")
      .trim()
      .substring(0, 100);
  }

  /**
   * Generates a discussion-focused title.
   */
  _generateDiscussionTitle(metadata) {
    if (metadata.topics && metadata.topics.length > 0) {
      const primaryTopic = metadata.topics[0];
      if (primaryTopic.length >= 5) {
        return `Discussion: ${primaryTopic}`.substring(0, 100);
      }
    }

    if (metadata.description) {
      const firstSentence = metadata.description.split(/[.!?]/)[0]?.trim();
      if (firstSentence && firstSentence.length >= 10 && firstSentence.length <= 90) {
        return firstSentence;
      }
    }

    if (metadata.title) {
      return `Discussing: ${this._cleanTitle(metadata.title)}`.substring(0, 100);
    }

    return null;
  }

  /**
   * Generates a community-focused title variant.
   */
  _generateCommunityTitle(metadata) {
    const cleanTitle = this._cleanTitle(metadata.title);

    if (cleanTitle.length <= 60) {
      return `What do you think about: ${cleanTitle}?`.substring(0, 100);
    }

    const words = cleanTitle.split(/\s+/).slice(0, 8).join(" ");
    if (words.length >= 10) {
      return `Let's discuss: ${words}`.substring(0, 100);
    }

    return null;
  }

  /**
   * Builds a room description from metadata.
   */
  _buildDescription(metadata, variant) {
    const parts = [];

    if (metadata.description) {
      parts.push(metadata.description.substring(0, 350));
    } else if (metadata.title) {
      parts.push(`A discussion space dedicated to "${this._cleanTitle(metadata.title)}".`);
    }

    if (metadata.source) {
      parts.push(`Source: ${metadata.source}`);
    }

    return parts.join(" ").substring(0, 500);
  }
}
