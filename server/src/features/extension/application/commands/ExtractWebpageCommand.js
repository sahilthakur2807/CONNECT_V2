import { BadRequestError } from "../../../../shared/errors/AppError.js";
import { FirecrawlClient } from "../../infrastructure/FirecrawlClient.js";

// --- Command ---

export class ExtractWebpageCommand {
  constructor(url) {
    this.url = url;
  }
}

// --- Handler ---

export class ExtractWebpageHandler {
  constructor() {
    this.firecrawlClient = new FirecrawlClient();
  }

  async execute(command) {
    // Validate URL format
    let parsedUrl;
    try {
      parsedUrl = new URL(command.url);
    } catch {
      throw new BadRequestError("Invalid URL provided. Please provide a valid http or https URL.");
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      throw new BadRequestError("Only http and https URLs are supported.");
    }

    // Extract content via Firecrawl (or fallback)
    const metadata = await this.firecrawlClient.scrape(command.url);

    return {
      url: metadata.url,
      title: metadata.title,
      description: metadata.description,
      ogImage: metadata.ogImage,
      headings: metadata.headings,
      topics: metadata.topics,
      author: metadata.author,
      publishedDate: metadata.publishedDate,
      source: metadata.source,
      isStructured: metadata.isStructured,
    };
  }
}
