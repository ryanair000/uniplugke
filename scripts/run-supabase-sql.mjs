import { readFile } from "node:fs/promises";

const projectRef = process.env.SUPABASE_PROJECT_REF;
const token = process.env.SUPABASE_ACCESS_TOKEN;
const sqlPath = process.argv[2];

if (!projectRef || !token || !sqlPath) {
  throw new Error("SUPABASE_PROJECT_REF, SUPABASE_ACCESS_TOKEN, and a SQL file path are required");
}

const query = await readFile(sqlPath, "utf8");
const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
  method: "POST",
  headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
  body: JSON.stringify({ query })
});
const body = await response.text();
if (!response.ok) throw new Error(`Supabase SQL failed (${response.status}): ${body}`);
console.log(body || "SQL applied successfully");
