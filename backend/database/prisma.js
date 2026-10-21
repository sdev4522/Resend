const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const { PrismaMariaDb } = require("@prisma/adapter-mariadb");
const { PrismaClient, Prisma } = require("@prisma/client");

const adapter = new PrismaMariaDb({
  host: process.env.DBHOST || "localhost",
  port: parseInt(process.env.DBPORT || "3306", 10),
  user: process.env.DBUSER,
  password: process.env.DBPASS,
  database: process.env.DBNAME,
  connectionLimit: 50,
  idleTimeout: 30000,
});

const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
});

process.on("beforeExit", async () => {
  await prisma.$disconnect();
});

/**
 * Recursively converts BigInt and Prisma.Decimal values to standard JavaScript numbers for JSON safety.
 */
function sanitizeBigInt(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "bigint") return Number(obj);
  if (typeof obj === "object") {
    if (typeof obj.toNumber === "function") {
      return obj.toNumber();
    }
    if (obj instanceof Date) {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitizeBigInt);
    }
    const res = {};
    for (const [k, v] of Object.entries(obj)) {
      res[k] = sanitizeBigInt(v);
    }
    return res;
  }
  return obj;
}

module.exports = { prisma, PrismaClient, Prisma, sanitizeBigInt };
