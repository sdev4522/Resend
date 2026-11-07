/**
 * Helpers used while replacing raw mysql2 `query()` calls with Prisma.
 *
 * Goal: converted endpoints must return EXACTLY what the raw-SQL version returned,
 * and must accept the same loosely-typed input MySQL used to coerce silently.
 */

/**
 * Make Prisma results look like mysql2 rows:
 *  - BigInt  -> Number   (mysql2 returned numbers; BigInt also breaks JSON.stringify)
 *  - Decimal -> String   (mysql2 returns DECIMAL columns as strings)
 *  - Boolean -> 1 / 0    (columns are TINYINT(1); clients compare with === 1)
 * Dates and everything else are kept as-is. Works on objects, arrays and nested values.
 */
function plain(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value instanceof Date || Buffer.isBuffer(value)) return value;
  if (Array.isArray(value)) return value.map(plain);
  if (typeof value === "object") {
    // Prisma.Decimal (decimal.js) instances
    if (typeof value.toFixed === "function" && typeof value.isFinite === "function" && "d" in value) {
      return value.toString();
    }
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = plain(v);
    return out;
  }
  return value;
}

/**
 * Integer id taken from request input. MySQL coerced `WHERE id = 'abc'` to 0 and matched
 * nothing; Prisma throws a validation error instead. Return -1 (never a real autoincrement id)
 * for invalid input so the query simply matches nothing, like before.
 */
function idParam(value) {
  const n = typeof value === "number" ? value : parseInt(String(value ?? "").trim(), 10);
  return Number.isInteger(n) ? n : -1;
}

/** Nullable integer for INT columns on write (`'5'` -> 5, `''`/invalid -> null). */
function intOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? Math.trunc(value) : parseInt(String(value).trim(), 10);
  return Number.isInteger(n) ? n : null;
}

/** Nullable string for VARCHAR/TEXT columns (mysql2 turned undefined into NULL). */
function str(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Truthy flag for TINYINT(1)/Boolean columns. Accepts 1, "1", true, "true". */
function bool(value) {
  return value === true || value === 1 || value === "1" || value === "true";
}

/** Array of integer ids from request input (`IN (?)` replacement). */
function idList(values) {
  const arr = Array.isArray(values) ? values : [values];
  return arr.map(idParam).filter((n) => n > 0);
}

module.exports = { plain, idParam, intOrNull, str, bool, idList };

/** [start, end) of the local calendar day containing `date` — replaces `DATE(col) = ?`. */
function dayRange(date) {
  const d =
    date instanceof Date
      ? new Date(date)
      : /^\d{4}-\d{2}-\d{2}$/.test(String(date))
      ? new Date(`${date}T00:00:00`)
      : new Date(date);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { gte: start, lt: end };
}

/** Inclusive local-date range `DATE(col) BETWEEN from AND to`. */
function dateBetween(from, to) {
  return { gte: dayRange(from).gte, lt: dayRange(to).lt };
}

/** Rolling window: `col >= NOW() - INTERVAL n DAY`. */
function lastDays(n) {
  return { gte: new Date(Date.now() - n * 24 * 60 * 60 * 1000) };
}

/** Current calendar month (local time). */
function thisMonth() {
  const now = new Date();
  return {
    gte: new Date(now.getFullYear(), now.getMonth(), 1),
    lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
  };
}

module.exports.dayRange = dayRange;
module.exports.dateBetween = dateBetween;
module.exports.lastDays = lastDays;
module.exports.thisMonth = thisMonth;
