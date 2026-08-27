import assert from "node:assert/strict";
import { prepareSubscriptionList } from "../lib/subscription-list.ts";

function subscription({
  id,
  name,
  status,
  startDate = null,
  nextRenewalDate = null,
  createdAt = null
}) {
  return {
    id,
    status,
    startDate,
    endDate: nextRenewalDate,
    nextRenewalDate,
    createdAt,
    serviceIdentifier: name,
    service: { id: `service-${id}`, name }
  };
}

const prepared = prepareSubscriptionList([
  subscription({ id: "youtube-expired", name: "YouTube Premium", status: "expired", nextRenewalDate: "2026-05-12" }),
  subscription({ id: "nord-old", name: "NordVPN", status: "expired", nextRenewalDate: "2026-05-12" }),
  subscription({ id: "nord-new", name: "Nord VPN", status: "active", startDate: "2026-08-25", nextRenewalDate: "2026-09-25" }),
  subscription({ id: "netflix-new", name: "Netflix", status: "due_soon", startDate: "2026-08-20", nextRenewalDate: "2026-09-20" }),
  subscription({ id: "netflix-old", name: "Netflix", status: "active", startDate: "2026-07-20", nextRenewalDate: "2026-12-20" })
]);

assert.deepEqual(
  prepared.map((item) => item.id),
  ["nord-new", "netflix-new", "youtube-expired"],
  "active subscriptions should be first, and each canonical service should appear once"
);
assert.equal(prepared.some((item) => item.id === "nord-old"), false, "an active NordVPN renewal should hide the expired record");
assert.equal(prepared.some((item) => item.id === "netflix-old"), false, "the newest active-like record should win even if the stale record has a later renewal date");

console.log("Verified active-first, duplicate-free tracked subscription ordering.");
