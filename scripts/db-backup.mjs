import "dotenv/config";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";

const rawDatabaseUrl = process.env.DATABASE_URL;
if (!rawDatabaseUrl) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

function toPostgresToolUrl(value) {
  const url = new URL(value);
  url.searchParams.delete("schema");
  return url.toString();
}

const databaseUrl = toPostgresToolUrl(rawDatabaseUrl);

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outputPath = resolve(process.argv[2] || `backups/filo-db-${stamp}.dump`);
mkdirSync(dirname(outputPath), { recursive: true });

const args = [
  "--dbname",
  databaseUrl,
  "--format",
  "custom",
  "--no-owner",
  "--no-acl",
  "--file",
  outputPath,
];

const child = spawn("pg_dump", args, { stdio: "inherit", shell: false });
child.on("exit", (code) => {
  if (code === 0) {
    console.log(`Database backup written to ${outputPath}`);
  }
  process.exit(code ?? 1);
});
