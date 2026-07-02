export function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

export function sanitizeRequestData(data) {
  if (data === null || data === undefined) return data;

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeRequestData(item));
  }

  if (typeof data === "object") {
    const result = {};
    for (const key of Object.keys(data)) {
      result[key] = sanitizeRequestData(data[key]);
    }
    return result;
  }

  if (typeof data === "string") {
    return escapeHtml(data.trim());
  }

  return data;
}

export function extractHashtags(text) {
  if (!text || typeof text !== "string") return [];
  const regex = /#([a-zA-Z0-9_]+)/g;
  const matches = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    matches.push(match[1].toLowerCase());
  }
  return [...new Set(matches)];
}
