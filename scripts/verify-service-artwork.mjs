import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";

const directory = new URL("../public/brands/catalog/", import.meta.url);
const files = (await readdir(directory)).filter((file) => file.endsWith(".svg")).sort();
const generated = await readFile(new URL("../lib/service-artwork.generated.ts", import.meta.url), "utf8");
const registered = [...generated.matchAll(/"([a-z0-9-]+)"/g)].map((match) => `${match[1]}.svg`).sort();

assert.equal(files.length, 92, "Every public subscription service must have artwork");
assert.deepEqual(files, registered, "Generated artwork registry must match bundled assets");

for (const file of files) {
  const svg = await readFile(new URL(file, directory), "utf8");
  assert.match(svg, /^<svg /, `${file} must be an SVG`);
  assert.doesNotMatch(svg, /undefined|null|<script/i, `${file} contains invalid or unsafe markup`);
}

console.log(`Verified ${files.length} locally bundled service artwork files.`);
