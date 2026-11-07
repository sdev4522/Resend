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

/**
 * String value for a WHERE equality. SQL `col = NULL` matched nothing, but in Prisma
 * `{ col: null }` means IS NULL and `{ col: undefined }` DROPS the filter (matches all rows!).
 * Missing input therefore maps to a value no row can have.
 */
const NO_MATCH = "\u0000__no_match__";
function whereStr(value) {
  if (value === null || value === undefined) return NO_MATCH;
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

/** DateTime for writes; invalid/missing -> null. */
function dateOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

module.exports.whereStr = whereStr;
module.exports.dateOrNull = dateOrNull;
module.exports.NO_MATCH = NO_MATCH;

/** Array of strings from request input (`IN (?)` on VARCHAR columns). */
function strList(values) {
  const arr = Array.isArray(values) ? values : [values];
  return arr.filter((v) => v !== null && v !== undefined).map(String);
}

/** Nullable BigInt for BIGINT columns on write. */
function bigOrNull(value) {
  const n = intOrNull(value);
  return n === null ? null : BigInt(n);
}

/** mysql2-compatible result for UPDATE/DELETE converted to updateMany/deleteMany. */
function okPacket(result) {
  const count = result?.count ?? 0;
  return { affectedRows: count, changedRows: count };
}

/** mysql2-compatible result for INSERT converted to create(). */
function insertResult(row) {
  return { insertId: row?.id, affectedRows: row ? 1 : 0 };
}

module.exports.strList = strList;
module.exports.bigOrNull = bigOrNull;
module.exports.okPacket = okPacket;
module.exports.insertResult = insertResult;

/**
 * Enum column WHERE value: `{ in: enumIn(v, allowed) }`. Unknown values match nothing
 * (SQL behaviour) instead of throwing a Prisma validation error.
 */
function enumIn(value, allowed) {
  const arr = Array.isArray(value) ? value : [value];
  return arr.filter((v) => v !== null && v !== undefined).map(String).filter((v) => allowed.includes(v));
}

module.exports.enumIn = enumIn;

/** Calendar month "YYYY-MM" (local time) — replaces `DATE_FORMAT(col, '%Y-%m') = ?`. */
function monthRange(yyyyMm) {
  const [y, m] = String(yyyyMm).split("-").map((n) => parseInt(n, 10));
  if (!y || !m) return { gte: new Date(0), lt: new Date(0) }; // matches nothing
  return { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) };
}

/** Replaces `JSON_SEARCH(col, 'one', value) IS NOT NULL` on JSON text columns. */
function jsonHasString(value) {
  return { contains: JSON.stringify(String(value ?? "")) };
}

module.exports.monthRange = monthRange;
module.exports.jsonHasString = jsonHasString;

/**
 * Coerce a plain JS object to Prisma `data` for `model`, using the schema field types.
 * Replaces mysql2 `INSERT INTO t SET ?` / `UPDATE t SET ?`, where MySQL coerced values silently.
 * Unknown keys are kept so Prisma rejects them (MySQL rejected unknown columns too);
 * undefined values are dropped (mysql2 skipped them in SET ?).
 */
let fieldTypes = null;
function modelFieldTypes(model) {
  if (!fieldTypes) {
    const { Prisma } = require("@prisma/client");
    fieldTypes = new Map(
      Prisma.dmmf.datamodel.models.map((m) => [
        m.name,
        new Map(m.fields.filter((f) => f.kind !== "object").map((f) => [f.name, f])),
      ]),
    );
  }
  const fields = fieldTypes.get(model);
  if (!fields) throw new Error(`toData: unknown Prisma model "${model}"`);
  return fields;
}
function toData(model, obj) {
  const fields = modelFieldTypes(model);
  const out = {};
  for (const [key, value] of Object.entries(obj || {})) {
    if (value === undefined) continue;
    const f = fields.get(key);
    if (!f || value === null) {
      out[key] = value;
      continue;
    }
    if (f.kind === "enum") out[key] = String(value);
    else if (f.type === "Int") out[key] = intOrNull(value);
    else if (f.type === "BigInt") out[key] = bigOrNull(value);
    else if (f.type === "Boolean") out[key] = bool(value) || value === "TRUE";
    else if (f.type === "DateTime") out[key] = dateOrNull(value);
    else if (f.type === "Float") out[key] = Number(value);
    else if (f.type === "Decimal") out[key] = String(value);
    else if (f.type === "Json") out[key] = value;
    else out[key] = str(value);
  }
  return out;
}

module.exports.toData = toData;

/**
 * WHERE fragment for a monotonic message-status update (former SQL CASE):
 * 'read' is never overwritten, and 'delivered' is not downgraded to 'sent'.
 * Usage: updateMany({ where: { ...key, ...statusAdvanceWhere(newStatus) }, data: { status } })
 */
function statusAdvanceWhere(newStatus) {
  const keep = newStatus === "sent" ? ["read", "delivered"] : ["read"];
  return { OR: [{ status: null }, { status: { notIn: keep } }] };
}

module.exports.statusAdvanceWhere = statusAdvanceWhere;

/** What MySQL NOW() wrote into a VARCHAR column: local 'YYYY-MM-DD HH:MM:SS'. */
function nowSqlString(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

module.exports.nowSqlString = nowSqlString;

/** `DELETE FROM t WHERE ... LIMIT 1`: delete only the first matching row. */
async function deleteFirst(delegate, where) {
  const row = await delegate.findFirst({ where, select: { id: true } });
  if (!row) return { count: 0 };
  return delegate.deleteMany({ where: { id: row.id } });
}

/** `UPDATE t SET ... WHERE ... LIMIT 1`: update only the first matching row. */
async function updateFirst(delegate, where, data) {
  const row = await delegate.findFirst({ where, select: { id: true } });
  if (!row) return { count: 0 };
  return delegate.updateMany({ where: { id: row.id }, data });
}

module.exports.deleteFirst = deleteFirst;
module.exports.updateFirst = updateFirst;
