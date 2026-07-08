// URL → link-card helpers. Static-site constraint: we can't reliably fetch
// cross-origin HTML for a page's real <title>, so titles are derived locally
// from the URL and stay inline-editable on the card.

// Strictly a single well-formed absolute http(s) URL — nothing else should
// unfurl (multi-line paste, "see https://…" prose, ftp:, javascript:, etc.).
export const isHttpUrl = (text) => {
  if (!/^https?:\/\/\S+$/i.test(text)) return false;
  try {
    const u = new URL(text);
    return (u.protocol === "http:" || u.protocol === "https:") && !!u.hostname;
  } catch {
    return false;
  }
};

export const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

// Default title: the cleaned last path segment ("my-article_v2.html" →
// "My article v2"). Opaque slugs (video ids, "watch", bare digits) and empty
// paths fall back to the hostname — a wrong-but-plausible guess is worse
// than an honest "youtube.com". Always user-editable afterwards.
export const defaultLinkTitle = (url) => {
  const host = hostOf(url);
  try {
    const u = new URL(url);
    const segs = u.pathname.split("/").filter(Boolean);
    let last = segs.length ? decodeURIComponent(segs[segs.length - 1]) : "";
    last = last
      .replace(/\.(html?|php|aspx?|jsp|md)$/i, "")
      .replace(/[-_+]+/g, " ")
      .trim();
    const compact = last.replace(/\s+/g, "");
    // Reject non-titles: too short, no letters, one opaque id-like token, or a
    // lone endpoint word in front of a query string ("watch?v=…", "item?id=…").
    if (
      !last ||
      last.length < 4 ||
      !/[a-z]/i.test(last) ||
      (!last.includes(" ") && /^[a-z0-9]{10,}$/i.test(compact)) ||
      (!last.includes(" ") && !!u.search)
    ) {
      return host || url;
    }
    return last.charAt(0).toUpperCase() + last.slice(1);
  } catch {
    return host || url;
  }
};

// Google's favicon service: reliable, hotlink-friendly, fine as an <img> src.
export const faviconUrl = (url, size = 64) => {
  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return "";
    }
  })();
  return host ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=${size}` : "";
};
