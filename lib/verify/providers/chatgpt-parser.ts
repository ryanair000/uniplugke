const rejectLanguage = /(?:password\s+reset|reset\s+(?:your|the)\s+password|change\s+your\s+password|magic\s+link|email\s+verification|verify\s+your\s+email\s+address)/i;

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
    .replace(/\s+/g, " ")
    .trim();
}

function codeAfterLabel(text: string, label: RegExp, maxDistance = 220) {
  for (const labelMatch of text.matchAll(label)) {
    const labelEnd = (labelMatch.index ?? 0) + labelMatch[0].length;
    const window = text.slice(labelEnd, labelEnd + maxDistance);
    for (const codeMatch of window.matchAll(/(?<!\d)(\d(?:[\s\u00a0]*\d){5})(?!\d)/g)) {
      const code = codeMatch[1].replace(/\D/g, "");
      if (code.length === 6) return code;
    }
  }
  return null;
}

export async function parseChatGptMessage(text: string) {
  const normalized = normalizedMessageText(text);
  if (rejectLanguage.test(normalized)) return null;

  const hasChatGptIdentity = /\b(?:chatgpt|openai)\b/i.test(normalized);
  if (!hasChatGptIdentity) return null;

  return codeAfterLabel(normalized, /\btemporary\s+verification\s+code\b/gi, 260)
    || codeAfterLabel(normalized, /\bverification\s+code\s+to\s+continue\b/gi, 260)
    || codeAfterLabel(normalized, /\b(?:enter|use)\s+(?:this\s+)?(?:temporary\s+)?verification\s+code\b/gi, 320)
    || codeAfterLabel(normalized, /\byour\s+(?:temporary\s+)?verification\s+code\b/gi, 220);
}
