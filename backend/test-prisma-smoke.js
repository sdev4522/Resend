// Prisma conversion smoke test — no database needed.
// Usage (from backend/): node test-prisma-smoke.js routes/phonebook.js [routes/kaban.js ...]
//   --verbose   print every route status
// Fails (exit 1) on: Prisma validation errors, remaining raw query() calls, HTTP 5xx.
const smoke = require("./test-support/prismaSmoke");

(async () => {
  const files = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const verbose = process.argv.includes("--verbose");
  smoke.installStubs();
  // background work started by helpers (timers, sockets) must not kill the run
  process.on("unhandledRejection", () => {});
  process.on("uncaughtException", () => {});
  const logger = smoke.backendRequire("./utils/logger.js");
  const origError = logger.error;
  const logged = [];
  logger.error = (...a) => { logged.push(a.map((x) => (x && x.message) || String(x)).join(" ").slice(0, 200)); };
  logger.log = () => {};
  logger.warn = () => {};
  logger.info = () => {};
  console.error = () => {};

  for (const f of files) {
    const isRouter = /(^|\/)routes\//.test(f);
    const statuses = isRouter ? await smoke.exerciseRouter(f) : await smoke.exerciseModule(f);
    console.log(`\n# ${f}: ${statuses.length} route calls`);
    if (verbose) statuses.forEach((s) => console.log("  " + s));
  }
  logger.error = origError;
  const r = smoke.report;
  const uniq = (arr) => [...new Map(arr.map((x) => [JSON.stringify(x), x])).values()];
  console.log(`\nPrisma calls validated: ${r.calls}`);
  console.log(`Validation errors: ${uniq(r.validation).length}`);
  uniq(r.validation).forEach((v) => console.log(`  ✗ ${v.call} @ ${v.where}\n      ${v.msg}`));
  const isTested = (where) => files.some((f) => where.includes(f.replace(/^\.\//, "") + ":"));
  const ownRaw = uniq(r.rawSql).filter((v) => isTested(v.where));
  const downstreamRaw = uniq(r.rawSql).filter((v) => !isTested(v.where));
  console.log(`Raw SQL calls in tested files: ${ownRaw.length}`);
  ownRaw.forEach((v) => console.log(`  ✗ ${v.where}  ${v.sql}`));
  if (downstreamRaw.length) {
    console.log(`Raw SQL in downstream modules (not under test, still to convert): ${downstreamRaw.length}`);
    downstreamRaw.forEach((v) => console.log(`  · ${v.where}  ${v.sql}`));
  }
  console.log(`HTTP 5xx: ${uniq(r.serverErrors).length}`);
  uniq(r.serverErrors).forEach((v) => console.log(`  ✗ ${v.where}  ${v.msg}`));
  const prismaErrLogs = uniq(logged).filter((l) => /prisma|Invalid `/.test(l));
  if (prismaErrLogs.length) {
    console.log(`Logged Prisma errors: ${prismaErrLogs.length}`);
    prismaErrLogs.forEach((l) => console.log(`  ✗ ${l}`));
  }
  process.removeAllListeners("unhandledRejection");
  const failed = r.validation.length + ownRaw.length + r.serverErrors.length + prismaErrLogs.length;
  console.log(failed ? "\nRESULT: FAIL" : "\nRESULT: PASS");
  process.exit(failed ? 1 : 0);
})();
