import fs from "node:fs";

const publicCatalog = fs.readFileSync(new URL("../lib/catalog.ts", import.meta.url), "utf8");
const fallbackSection = publicCatalog.split("function textArray")[0];
const forbidden = ["priceKes", "compareAtKes", "price_kes", "compare_at_kes", "KSh "];
const found = forbidden.filter((token) => fallbackSection.includes(token));
if (found.length) {
  console.error(`Public fallback contains forbidden pricing tokens: ${found.join(", ")}`);
  process.exit(1);
}
console.log("Public catalog fallback contains no pricing fields or values.");
