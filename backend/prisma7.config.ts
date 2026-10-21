import path from "node:path";
import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

// Resolve environment variables from backend/.env
const candidates = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "backend/.env"),
  path.resolve(__dirname, ".env"),
];

for (const c of candidates) {
  dotenv.config({ path: c });
}

function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  const user = encodeURIComponent(process.env.DBUSER || "");
  const pass = encodeURIComponent(process.env.DBPASS || "");
  const host = process.env.DBHOST || "localhost";
  const port = process.env.DBPORT || "3306";
  const db = process.env.DBNAME || "whatscrm";
  const url = `mysql://${user}:${pass}@${host}:${port}/${db}`;
  // Ensure DATABASE_URL is set in process.env for Prisma engine child processes
  process.env.DATABASE_URL = url;
  return url;
}

const dbUrl = getDatabaseUrl();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: dbUrl,
  },
});
