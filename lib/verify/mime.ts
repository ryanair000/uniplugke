import PostalMime from "postal-mime";

export async function decodedMimeText(source: Buffer) {
  const message = await PostalMime.parse(source, {
    maxHeadersSize: 256 * 1024,
    maxNestingDepth: 20,
    maxRfc822NestingDepth: 3
  });

  // Deliberately exclude subject and all RFC headers. A header date such as
  // 2026 must never become a verification-code candidate.
  return [message.text, message.html]
    .filter((part): part is string => Boolean(part?.trim()))
    .join("\n");
}
