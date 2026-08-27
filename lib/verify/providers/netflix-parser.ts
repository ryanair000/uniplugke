const resetLanguage = /(?:password\s+reset|reset\s+(?:your|the)\s+password|change\s+your\s+password|forgot\s+your\s+password)/i;

type LinkResolver = (url: string) => Promise<string | null>;

function codeNearLabel(text: string) {
  const normalized = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  if (resetLanguage.test(normalized)) return null;
  return normalized.match(/(?:temporary|access|verification)\s+code\D{0,80}(\d{4})(?!\d)/i)?.[1]
    || normalized.match(/sign(?:-|\s)?in\s+code\D{0,80}(\d{4})(?!\d)/i)?.[1]
    || normalized.match(/(?:your\s+code|code\s+is)\D{0,40}(\d{4})(?!\d)/i)?.[1]
    || null;
}

function htmlDecode(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&#x3D;", "=")
    .replaceAll("=3D", "=")
    .replaceAll("&quot;", '"');
}

function textContent(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function netflixLinks(text: string) {
  const matches = htmlDecode(text).match(/https:\/\/[^\s"'<>]+/gi) || [];
  return [...new Set(matches.map((link) => link.replace(/[)>.,]+$/, "")))].filter((link) => {
    try {
      const hostname = new URL(link).hostname.toLowerCase();
      return hostname === "netflix.com" || hostname.endsWith(".netflix.com");
    } catch {
      return false;
    }
  });
}

function safeNetflixUrl(value: string, base?: string) {
  try {
    const url = new URL(value, base);
    const hostname = url.hostname.toLowerCase();
    return url.protocol === "https:" && (hostname === "netflix.com" || hostname.endsWith(".netflix.com")) ? url : null;
  } catch {
    return null;
  }
}

export async function resolveNetflixLink(link: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    let current = safeNetflixUrl(link);
    for (let redirect = 0; current && redirect <= 3; redirect += 1) {
      const response = await fetch(current, {
        redirect: "manual",
        cache: "no-store",
        signal: controller.signal,
        headers: { "User-Agent": "UniPlug VeriFy code assistant" }
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        current = location ? safeNetflixUrl(location, current.toString()) : null;
        continue;
      }
      if (!response.ok) return null;
      return codeNearLabel(await response.text());
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function parseNetflixMessage(text: string, resolveLink: LinkResolver = resolveNetflixLink) {
  if (resetLanguage.test(text)) return null;
  const directCode = codeNearLabel(text);
  if (directCode) return directCode;
  for (const link of netflixLinks(text).slice(0, 4)) {
    const code = await resolveLink(link);
    if (code) return code;
  }
  return null;
}

export function parseNetflixHouseholdMessage(text: string) {
  if (resetLanguage.test(text)) return null;
  const decoded = htmlDecode(text);
  const normalized = textContent(decoded);
  if (!/netflix\s+household/i.test(normalized) || !/yes,?\s+this\s+was\s+me/i.test(normalized)) return null;

  const anchors = decoded.matchAll(/<a\b[^>]*href=["'](https:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi);
  for (const anchor of anchors) {
    if (!/yes,?\s+this\s+was\s+me/i.test(textContent(anchor[2]))) continue;
    const url = safeNetflixUrl(anchor[1]);
    if (url) return url.toString();
  }

  for (const link of netflixLinks(decoded)) {
    const at = decoded.indexOf(link);
    const nearby = textContent(decoded.slice(Math.max(0, at - 180), at + link.length + 180));
    if (/yes,?\s+this\s+was\s+me/i.test(nearby)) return link;
  }
  return null;
}

export async function confirmNetflixHouseholdLink(link: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    let current = safeNetflixUrl(link);
    for (let redirect = 0; current && redirect <= 4; redirect += 1) {
      if (/\/(?:login|signin)(?:\/|$)/i.test(current.pathname)) return false;
      const response = await fetch(current, {
        redirect: "manual",
        cache: "no-store",
        signal: controller.signal,
        headers: { "User-Agent": "UniPlug VeriFy household assistant" }
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        current = location ? safeNetflixUrl(location, current.toString()) : null;
        continue;
      }
      if (!response.ok) return false;
      const body = (await response.text()).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
      if (/(?:link|request).{0,50}(?:expired|invalid)|something\s+went\s+wrong/i.test(body)) return false;
      return true;
    }
    return false;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
