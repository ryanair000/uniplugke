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

function signInCodeClosestToLabel(text: string) {
  const normalized = text
    .replace(/[A-Za-z0-9+/]{40,}={0,2}/g, " ")
    .replace(/https:\/\/\S+/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
  const labels = [...normalized.matchAll(/sign(?:-|\s)?in\s+code/gi)];
  if (!labels.length) return null;

  const nearestByValue = new Map<string, number>();
  for (const match of normalized.matchAll(/\d{4}/g)) {
    const index = match.index ?? 0;
    if (/\d/.test(normalized[index - 1] || "") || /\d/.test(normalized[index + 4] || "")) continue;
    const distance = Math.min(...labels.map((label) => index - ((label.index ?? 0) + label[0].length)).filter((value) => value >= 0));
    if (!Number.isFinite(distance) || distance > 2_000) continue;
    const previous = nearestByValue.get(match[0]);
    if (previous === undefined || distance < previous) nearestByValue.set(match[0], distance);
  }

  const candidates = [...nearestByValue.entries()].sort((left, right) => left[1] - right[1]);
  return candidates[0]?.[0] || null;
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
  const signInCode = signInCodeClosestToLabel(text);
  if (signInCode) return signInCode;
  const links = netflixLinks(text);
  for (const link of links.slice(0, 4)) {
    const code = await resolveLink(link);
    if (code) return code;
  }
  const normalized = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  console.info("Netflix message parser rejected candidate", {
    hasSignInCodeLabel: /sign(?:-|\s)?in\s+code/i.test(normalized),
    hasCodeLabel: /\bcode\b/i.test(normalized),
    hasContiguousFourDigits: /(?:^|\D)\d{4}(?!\d)/.test(normalized),
    hasSpacedFourDigits: /(?:^|\D)\d(?:\s+\d){3}(?!\d)/.test(normalized),
    netflixLinkCount: links.length
  });
  return null;
}
