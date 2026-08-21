const resetLanguage = /(?:password\s+reset|reset\s+(?:your|the)\s+password|change\s+your\s+password|forgot\s+your\s+password)/i;

type LinkResolver = (url: string) => Promise<string | null>;

function codeNearLabel(text: string) {
  const normalized = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  if (resetLanguage.test(normalized)) return null;
  return normalized.match(/(?:temporary|access|verification)\s+code\D{0,80}(\d{4})(?!\d)/i)?.[1]
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
