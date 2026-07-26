import fs from "node:fs";

const publicCatalog = fs.readFileSync(new URL("../lib/catalog.ts", import.meta.url), "utf8");
const fallbackSection = publicCatalog.split("function textArray")[0];
const catalogUi = fs.readFileSync(new URL("../components/catalog.tsx", import.meta.url), "utf8");
const forbidden = ["priceKes", "compareAtKes", "price_kes", "compare_at_kes", "KSh "];
const found = forbidden.filter((token) => fallbackSection.includes(token));
if (found.length) {
  console.error(`Public fallback exposes private KSh pricing tokens: ${found.join(", ")}`);
  process.exit(1);
}
for (const token of ["startingPriceUsd", "formatUsd", "exact KSh pricing after sign-in"]) {
  if (!publicCatalog.includes(token) && !catalogUi.includes(token)) {
    console.error(`Public USD storefront pricing is missing token: ${token}`);
    process.exit(1);
  }
}
console.log("Public catalog exposes USD starting prices without private KSh plan fields.");
