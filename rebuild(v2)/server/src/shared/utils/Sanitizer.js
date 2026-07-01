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
