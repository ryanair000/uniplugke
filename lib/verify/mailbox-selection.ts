type MailboxCandidate = {
  path: string;
  specialUse?: string | null;
};

export function verificationMailboxPath(mailboxes: readonly MailboxCandidate[]) {
  return mailboxes.find((mailbox) => mailbox.specialUse?.toLowerCase() === "\\all")?.path || "INBOX";
}
