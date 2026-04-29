import "dotenv/config";
import { existsSync } from "node:fs";
import { extname, resolve } from "node:path";
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

const inputArg = process.argv[2];
const confirmed = process.argv.includes("--yes");

if (!inputArg) {
  console.error("Usage: npm run db:restore -- <backup.dump|backup.sql> --yes");
  process.exit(1);
}

if (!confirmed) {
  console.error("Refusing to restore without --yes. This replaces data in the target database.");
  process.exit(1);
}

const inputPath = resolve(inputArg);
if (!existsSync(inputPath)) {
  console.error(`Backup file not found: ${inputPath}`);
  process.exit(1);
}

const isSql = extname(inputPath).toLocaleLowerCase("en-US") === ".sql";
const command = isSql ? "psql" : "pg_restore";
const args = isSql
  ? [databaseUrl, "--file", inputPath]
  : [
      "--dbname",
      databaseUrl,
      "--clean",
      "--if-exists",
      "--no-owner",
      "--no-acl",
      inputPath,
    ];

const child = spawn(command, args, { stdio: "inherit", shell: false });
child.on("exit", (code) => {
  if (code === 0) {
    console.log(`Database restored from ${inputPath}`);
  }
  process.exit(code ?? 1);
});
