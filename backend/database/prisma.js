const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const { PrismaMariaDb } = require("@prisma/adapter-mariadb");
const { PrismaClient } = require("@prisma/client");

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

module.exports = { prisma, PrismaClient };
