const resetLanguage = /(?:password\s+reset|reset\s+(?:your|the)\s+password|change\s+your\s+password|forgot\s+your\s+password)/i;
const expiryLanguage = /(?:this\s+)?code\s+(?:will\s+)?expir(?:e|es)|expir(?:e|es)\s+in\s+\d+\s+minutes/i;

type LinkResolver = (url: string) => Promise<string | null>;

function htmlDecode(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&#x3D;", "=")
    .replaceAll("=3D", "=")
    .replaceAll("&quot;", '"')
    .replace(/(?:&nbsp;|&#160;|&#xA0;)/gi, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number.parseInt(decimal, 10)));
}

function normalizedMessageText(text: string) {
  return htmlDecode(text)
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(?:style|script)\b[^>]*>[\s\S]*?<\/(?:style|script)>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
}

function codeFollowingLabel({
  text,
  label,
  maxDistance,
  requireExpiry = false
}: {
  text: string;
  label: RegExp;
  maxDistance: number;
  requireExpiry?: boolean;
}) {
  for (const labelMatch of text.matchAll(label)) {
    const labelEnd = (labelMatch.index ?? 0) + labelMatch[0].length;
    const searchWindow = text.slice(labelEnd, labelEnd + maxDistance);
    for (const codeMatch of searchWindow.matchAll(/(?<!\d)(\d(?:[\s\u00a0]*\d){3})(?!\d)/g)) {
      const code = codeMatch[1].replace(/\D/g, "");
      if (code.length !== 4) continue;
      const codeEnd = labelEnd + (codeMatch.index ?? 0) + codeMatch[0].length;
      if (requireExpiry && !expiryLanguage.test(text.slice(codeEnd, codeEnd + 500))) continue;
      return code;
    }
  }
  return null;
}

function codeNearLabel(text: string) {
  const normalized = normalizedMessageText(text);
  if (resetLanguage.test(normalized)) return null;

  return codeFollowingLabel({
    text: normalized,
    label: /\b(?:temporary|access|verification)\s+code\b/gi,
    maxDistance: 160
  }) || codeFollowingLabel({
    text: normalized,
    label: /\b(?:your\s+code|code\s+is)\b/gi,
    maxDistance: 120
  }) || codeFollowingLabel({
    text: normalized,
    label: /\bsign(?:-|\s)?in\s+code\b/gi,
    maxDistance: 400,
    requireExpiry: true
  }) || codeFollowingLabel({
    text: normalized,
    label: /\b(?:enter|use)(?:\s+(?:this|the|your|a))?(?:\s+secure)?\s+code(?:\s+below)?\s+to\s+(?:finish\s+)?sign(?:ing)?\s+in\b/gi,
    maxDistance: 500,
    requireExpiry: true
  });
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
  const normalized = normalizedMessageText(text);
  if (resetLanguage.test(normalized)) return null;
  const directCode = codeNearLabel(text);
  if (directCode) return directCode;
  const links = netflixLinks(text);
  for (const link of links.slice(0, 4)) {
    const code = await resolveLink(link);
    if (code) return code;
  }
  console.info("Netflix message parser rejected candidate", {
    hasSignInCodeLabel: /sign(?:-|\s)?in\s+code/i.test(normalized),
    hasCodeLabel: /\bcode\b/i.test(normalized),
    hasContiguousFourDigits: /(?:^|\D)\d{4}(?!\d)/.test(normalized),
    hasSpacedFourDigits: /(?:^|\D)\d(?:\s+\d){3}(?!\d)/.test(normalized),
    netflixLinkCount: links.length
  });
  return null;
}
