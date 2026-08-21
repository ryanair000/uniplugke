export function decodedMimeText(source: Buffer) {
  const raw = source.toString("utf8");
  const quotedPrintable = raw
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-F]{2})/gi, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)));
  const decodedBlocks = [...raw.matchAll(/(?:^|\r?\n)([A-Za-z0-9+/]{40,}(?:\r?\n[A-Za-z0-9+/]{20,})*={0,2})(?=\r?\n|$)/gm)]
    .map((match) => {
      try {
        return Buffer.from(match[1].replace(/\s/g, ""), "base64").toString("utf8");
      } catch {
        return "";
      }
    });
  return [raw, quotedPrintable, ...decodedBlocks].join("\n");
}
