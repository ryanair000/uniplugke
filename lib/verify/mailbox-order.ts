export type MailboxMessageCandidate<T> = {
  uid: number;
  receivedAt: Date;
  value: T;
};

export function newestMailboxMessagesFirst<T>(candidates: readonly MailboxMessageCandidate<T>[]) {
  return [...candidates].sort((left, right) => {
    const receivedAtDifference = right.receivedAt.getTime() - left.receivedAt.getTime();
    return receivedAtDifference || right.uid - left.uid;
  });
}
