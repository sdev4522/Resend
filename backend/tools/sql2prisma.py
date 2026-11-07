#!/usr/bin/env python3
"""
Convert simple raw mysql2 `query(sql, [params])` calls to Prisma.

Handles only single-table statements whose shape is unambiguous:
  SELECT cols|*|COUNT(*) AS x FROM t [WHERE conds] [ORDER BY ...] [LIMIT n|?]
  UPDATE t SET a = ?|literal|NOW() [, ...] WHERE conds
  DELETE FROM t WHERE conds
  INSERT INTO t (cols) VALUES (?|literal|NOW(), ...)
conds: col (=|!=|<>|>|>=|<|<=) ?|literal, col IN (?), col IS [NOT] NULL — joined by AND.

Everything else is left untouched and reported for manual conversion.
Return values stay mysql2-compatible:
  SELECT -> array of plain() rows; COUNT -> [{ alias: n }];
  INSERT -> { insertId, affectedRows } ; UPDATE/DELETE -> { affectedRows, changedRows }
  (wrappers only emitted when the call result is actually used).

Usage: sql2prisma.py <schema.prisma> <file.js> [--write]
"""
import re, sys, json

# ---------------- schema ----------------
def parse_schema(path):
    models = {}
    text = open(path).read()
    enums = {m.group(1): re.findall(r'^\s*(\w+)\s*$', m.group(2), re.M)
             for m in re.finditer(r'^enum\s+(\w+)\s*\{([^}]*)\}', text, re.M)}
    cur = None
    for line in open(path):
        s = line.strip()
        m = re.match(r'^(model|enum)\s+(\w+)\s*\{', s)
        if m:
            if m.group(1) == 'enum':
                cur = None
            else:
                cur = m.group(2); models[cur] = {}
            continue
        if s.startswith('}'):
            cur = None; continue
        if cur and s and not s.startswith('@@') and not s.startswith('//'):
            fm = re.match(r'^(\w+)\s+(\w+)(\[\])?(\?)?', s)
            if fm and not fm.group(3):
                typ = fm.group(2)
                values = None
                if typ in enums:
                    values = enums[typ]; typ = 'Enum'
                if typ in ('String','Int','BigInt','Boolean','DateTime','Decimal','Float','Json','Bytes','Enum'):
                    models[cur][fm.group(1)] = {'type': typ, 'values': values, 'optional': bool(fm.group(4)), 'default': '@default' in s or '@updatedAt' in s or '@id' in s}
    return models

# ---------------- JS scanning ----------------
def skip_string(src, i):
    q = src[i]; i += 1
    while i < len(src):
        c = src[i]
        if c == '\\': i += 2; continue
        if q == '`' and c == '$' and i + 1 < len(src) and src[i+1] == '{':
            i = skip_balanced(src, i + 1, '{', '}'); continue
        if c == q: return i + 1
        i += 1
    raise ValueError('unterminated string')

def skip_balanced(src, i, open_c, close_c):
    # src[i] == open_c ; returns index after matching close
    depth = 0
    while i < len(src):
        c = src[i]
        if c in '"\'`':
            i = skip_string(src, i); continue
        if src.startswith('//', i):
            j = src.find('\n', i); i = len(src) if j < 0 else j; continue
        if src.startswith('/*', i):
            j = src.find('*/', i); i = len(src) if j < 0 else j + 2; continue
        if c in '([{': depth += 1
        elif c in ')]}':
            depth -= 1
            if depth == 0: return i + 1
        i += 1
    raise ValueError('unbalanced')

def split_top(src):
    parts, depth, i, start = [], 0, 0, 0
    while i < len(src):
        c = src[i]
        if c in '"\'`':
            i = skip_string(src, i); continue
        if c in '([{': depth += 1
        elif c in ')]}': depth -= 1
        elif c == ',' and depth == 0:
            parts.append(src[start:i].strip()); start = i + 1
        i += 1
    tail = src[start:].strip()
    if tail: parts.append(tail)
    return parts

# ---------------- SQL parsing ----------------
IDENT = r'`?(\w+)`?'
def norm(sql):
    return re.sub(r'\s+', ' ', sql).strip().rstrip(';').strip()

def parse_literal(tok):
    tok = tok.strip()
    if tok == '?': return ('param', None)
    if re.fullmatch(r"'(?:[^'\\]|\\.)*'", tok) or re.fullmatch(r'"(?:[^"\\]|\\.)*"', tok):
        return ('lit', json.dumps(tok[1:-1].replace("\\'", "'")))
    if re.fullmatch(r'-?\d+(\.\d+)?', tok): return ('num', tok)
    if tok.upper() in ('NOW()', 'CURRENT_TIMESTAMP', 'CURRENT_TIMESTAMP()'): return ('now', None)
    if tok.upper() == 'NULL': return ('null', None)
    if tok.upper() in ('TRUE', 'FALSE'): return ('num', '1' if tok.upper() == 'TRUE' else '0')
    return None

def parse_conds(text):
    if not text: return []
    conds = []
    for part in re.split(r'\s+AND\s+', text, flags=re.I):
        part = part.strip()
        while part.startswith('(') and part.endswith(')'): part = part[1:-1].strip()
        m = re.fullmatch(IDENT + r'\s+IS\s+(NOT\s+)?NULL', part, re.I)
        if m:
            conds.append((m.group(1), 'notnull' if m.group(2) else 'isnull', None)); continue
        m = re.fullmatch(IDENT + r'\s+IN\s*\(\s*\?\s*\)', part, re.I)
        if m:
            conds.append((m.group(1), 'in', ('param', None))); continue
        m = re.fullmatch(IDENT + r'\s*(=|!=|<>|>=|<=|>|<)\s*(.+)', part)
        if not m: return None
        lit = parse_literal(m.group(3))
        if not lit or lit[0] == 'now' and m.group(2) == '=': return None
        conds.append((m.group(1), m.group(2), lit))
    return conds

def parse_sql(sql):
    s = norm(sql)
    m = re.fullmatch(r'SELECT (.+?) FROM ' + IDENT + r'(?: WHERE (.+?))?(?: ORDER BY (.+?))?(?: LIMIT (\d+|\?))?', s, re.I)
    if m:
        cols, table, where, order, limit = m.groups()
        conds = parse_conds(where)
        if conds is None: return None
        cm = re.fullmatch(r'COUNT\(\s*(\*|\w+)\s*\)\s+(?:AS\s+)?`?(\w+)`?', cols.strip(), re.I)
        if cm:
            return {'kind': 'count', 'table': table, 'conds': conds, 'alias': cm.group(2)}
        if cols.strip() == '*':
            sel = None
        else:
            sel = []
            for c in cols.split(','):
                c = c.strip().strip('`')
                if not re.fullmatch(r'\w+', c): return None
                sel.append(c)
        orders = []
        if order:
            for o in order.split(','):
                om = re.fullmatch(IDENT + r'(?:\s+(ASC|DESC))?', o.strip(), re.I)
                if not om: return None
                orders.append((om.group(1), (om.group(2) or 'ASC').lower()))
        return {'kind': 'select', 'table': table, 'conds': conds, 'select': sel, 'order': orders, 'limit': limit}
    m = re.fullmatch(r'UPDATE ' + IDENT + r' SET (.+?) WHERE (.+?)( LIMIT 1)?', s, re.I)
    if m:
        table, sets, where, limit1 = m.groups()
        assigns = []
        for a in split_top(sets):
            am = re.fullmatch(IDENT + r'\s*=\s*(.+)', a.strip())
            if not am: return None
            lit = parse_literal(am.group(2))
            if not lit: return None
            assigns.append((am.group(1), lit))
        conds = parse_conds(where)
        if conds is None: return None
        return {'kind': 'update', 'table': table, 'assigns': assigns, 'conds': conds, 'first': bool(limit1)}
    m = re.fullmatch(r'DELETE FROM ' + IDENT + r' WHERE (.+?)( LIMIT 1)?', s, re.I)
    if m:
        conds = parse_conds(m.group(2))
        if conds is None: return None
        return {'kind': 'delete', 'table': m.group(1), 'conds': conds, 'first': bool(m.group(3))}
    m = re.fullmatch(r'INSERT INTO ' + IDENT + r' ?\((.+?)\) VALUES ?\((.+)\)', s, re.I)
    if m:
        table, cols, vals = m.groups()
        cols = [c.strip().strip('`') for c in cols.split(',')]
        vals = split_top(vals)
        if len(cols) != len(vals): return None
        lits = [parse_literal(v) for v in vals]
        if any(l is None for l in lits): return None
        return {'kind': 'insert', 'table': table, 'assigns': list(zip(cols, lits))}
    return None

# ---------------- code generation ----------------
class Gen:
    def __init__(self, models):
        self.models = models; self.helpers = set()

    def h(self, name): self.helpers.add(name); return name

    def where_val(self, f, expr):
        t = f['type']
        if t == 'Int': return f'{self.h("idParam")}({expr})'
        if t == 'BigInt': return f'BigInt({self.h("idParam")}({expr}))'
        if t == 'Boolean': return f'{self.h("bool")}({expr})'
        if t == 'DateTime': return f'new Date({expr})'
        if t == 'Float' or t == 'Decimal': return f'Number({expr})'
        if t == 'Enum': return f'{{ in: {self.h("enumIn")}({expr}, {json.dumps(f["values"])}) }}'
        return f'{self.h("whereStr")}({expr})'

    def data_val(self, f, expr):
        t = f['type']
        if t == 'Int': return f'{self.h("intOrNull")}({expr})'
        if t == 'BigInt': return f'{self.h("bigOrNull")}({expr})'
        if t == 'Boolean': return f'{self.h("bool")}({expr})'
        if t == 'DateTime': return f'{self.h("dateOrNull")}({expr})'
        if t == 'Float': return f'({expr} == null ? null : Number({expr}))'
        if t == 'Decimal': return f'({expr} == null ? null : String({expr}))'
        return f'{self.h("str")}({expr})'

    def lit_val(self, f, lit, for_where):
        kind, v = lit
        t = f['type']
        if kind == 'now':
            if t == 'DateTime': return 'new Date()'
            if t == 'String': return f'{self.h("nowSqlString")}()'
            return None
        if kind == 'null': return 'null'
        if kind == 'num':
            if t in ('Int', 'Float', 'Decimal'): return v if t != 'Decimal' else json.dumps(v)
            if t == 'BigInt': return f'BigInt({v})'
            if t == 'Boolean': return 'true' if v != '0' else 'false'
            return json.dumps(v)
        if kind == 'lit':
            if t == 'Int' and re.fullmatch(r'"-?\d+"', v): return v.strip('"')
            if t == 'Boolean': return 'true' if v.strip('"') not in ('0', '', 'false') else 'false'
            if t == 'Enum':
                if v.strip('"') not in f['values']: return None
                return v
            if t != 'String': return None
            return v
        return None

    def build_where(self, model, conds, params, pi):
        parts = []
        for col, op, lit in conds:
            f = model.get(col)
            if not f: raise KeyError(col)
            if op == 'isnull': parts.append(f'{col}: null'); continue
            if op == 'notnull': parts.append(f'{col}: {{ not: null }}'); continue
            if lit[0] == 'param':
                expr = params[pi]; pi += 1
                if op == 'in':
                    if f['type'] == 'Int': val = f'{{ in: {self.h("idList")}({expr}) }}'
                    else: val = f'{{ in: {self.h("strList")}({expr}) }}'
                    parts.append(f'{col}: {val}'); continue
                val = self.where_val(f, expr)
            else:
                val = self.lit_val(f, lit, True)
                if val is None: raise ValueError(f'literal type mismatch {col}')
            opmap = {'=': None, '!=': 'not', '<>': 'not', '>': 'gt', '>=': 'gte', '<': 'lt', '<=': 'lte'}
            key = opmap[op]
            parts.append(f'{col}: {val}' if key is None else f'{col}: {{ {key}: {val} }}')
        return '{ ' + ', '.join(parts) + ' }' if parts else '{}', pi

    def convert(self, sql, params):
        p = parse_sql(sql)
        if not p: return None, 'unsupported SQL shape'
        model = self.models.get(p['table'])
        if model is None: return None, f'no Prisma model {p["table"]}'
        nparams = sql.count('?')
        if params is None: params = []
        if len(params) != nparams: return None, f'param count {len(params)} != placeholders {nparams}'
        try:
            if p['kind'] in ('select', 'count'):
                where, pi = self.build_where(model, p['conds'], params, 0)
                args = []
                if where != '{}': args.append(f'where: {where}')
                if p['kind'] == 'count':
                    return ('count', p['table'], ', '.join(args), p['alias']), None
                if p['select']:
                    for c in p['select']:
                        if c not in model: raise KeyError(c)
                    args.append('select: { ' + ', '.join(f'{c}: true' for c in p['select']) + ' }')
                if p['order']:
                    for c, _ in p['order']:
                        if c not in model: raise KeyError(c)
                    ob = ', '.join(f'{{ {c}: "{d}" }}' for c, d in p['order'])
                    args.append(f'orderBy: [{ob}]' if len(p['order']) > 1 else f'orderBy: {{ {p["order"][0][0]}: "{p["order"][0][1]}" }}')
                if p['limit']:
                    if p['limit'] == '?':
                        args.append(f'take: Math.max(0, parseInt({params[pi]}, 10) || 0)'); pi += 1
                    else:
                        args.append(f'take: {p["limit"]}')
                return ('select', p['table'], ', '.join(args), None), None
            if p['kind'] == 'update':
                data, pi = [], 0
                for col, lit in p['assigns']:
                    f = model.get(col)
                    if not f: raise KeyError(col)
                    if lit[0] == 'param':
                        data.append(f'{col}: {self.data_val(f, params[pi])}'); pi += 1
                    else:
                        v = self.lit_val(f, lit, False)
                        if v is None: raise ValueError(f'literal type mismatch {col}')
                        data.append(f'{col}: {v}')
                where, pi = self.build_where(model, p['conds'], params, pi)
                if p.get('first'):
                    self.h('updateFirst')
                    return ('updateFirst', p['table'], f'{where}|{{ ' + ', '.join(data) + ' }', None), None
                return ('update', p['table'], f'where: {where}, data: {{ ' + ', '.join(data) + ' }', None), None
            if p['kind'] == 'delete':
                where, _ = self.build_where(model, p['conds'], params, 0)
                if p.get('first'):
                    self.h('deleteFirst')
                    return ('deleteFirst', p['table'], where, None), None
                return ('delete', p['table'], f'where: {where}', None), None
            if p['kind'] == 'insert':
                data, pi = [], 0
                for col, lit in p['assigns']:
                    f = model.get(col)
                    if not f: raise KeyError(col)
                    if lit[0] == 'param':
                        data.append(f'{col}: {self.data_val(f, params[pi])}'); pi += 1
                    else:
                        v = self.lit_val(f, lit, False)
                        if v is None: raise ValueError(f'literal type mismatch {col}')
                        data.append(f'{col}: {v}')
                return ('insert', p['table'], 'data: { ' + ', '.join(data) + ' }', None), None
        except KeyError as e:
            return None, f'unknown column {e} on {p["table"]}'
        except (ValueError, IndexError) as e:
            return None, str(e)

INDENT = ['      ']
def fmt_obj(args, indent):
    """{ a, b } on one line when short, otherwise one property per line."""
    one = '{ ' + args + ' }'
    if len(one) + len(indent) <= 88:
        return one
    items = split_top(args)
    inner = indent + '  '
    lines = []
    for it in items:
        k, _, v = it.partition(':')
        v = v.strip()
        if v.startswith('{') and v.endswith('}') and len(inner) + len(it) > 88:
            v = fmt_obj(v[1:-1].strip(), inner)
        lines.append(f'{inner}{k.strip()}: {v},')
    return '{\n' + '\n'.join(lines) + '\n' + indent + '}'

def render(kind, table, args, alias, awaited, used):
    if kind in ('deleteFirst', 'updateFirst'):
        if kind == 'deleteFirst':
            core = f'deleteFirst(prisma.{table}, {args})'
        else:
            where, data = args.split('|', 1)
            core = f'updateFirst(prisma.{table}, {where}, {data})'
        if not used:
            return f'await {core}' if awaited else core
        return f'okPacket(await {core})' if awaited else f'{core}.then(okPacket)'
    call_args = fmt_obj(args, INDENT[0]) if args else ''
    if kind == 'select':
        core = f'prisma.{table}.findMany({call_args})'
        return f'plain(await {core})' if awaited else f'{core}.then(plain)'
    if kind == 'count':
        core = f'prisma.{table}.count({call_args})'
        return f'[{{ {alias}: await {core} }}]' if awaited else f'{core}.then((n) => [{{ {alias}: n }}])'
    if kind == 'update':
        core = f'prisma.{table}.updateMany({call_args})'
    elif kind == 'delete':
        core = f'prisma.{table}.deleteMany({call_args})'
    else:
        core = f'prisma.{table}.create({call_args})'
    if not used:
        return f'await {core}' if awaited else core
    wrap = 'insertResult' if kind == 'insert' else 'okPacket'
    return f'{wrap}(await {core})' if awaited else f'{core}.then({wrap})'

def process(src, gen):
    out, i, report, converted = [], 0, [], 0
    pat = re.compile(r'(\bawait\s+)?\bquery\(')
    pos = 0
    while True:
        m = pat.search(src, pos)
        if not m: break
        start = m.start()
        # skip definitions / property access like con.query( or function query(
        before = src[max(0, start - 20):start]
        if re.search(r'(function\s+|\.)\s*$', before) and not m.group(1):
            pos = m.end(); continue
        ls = src.rfind('\n', 0, start) + 1
        if '//' in src[ls:start] or src.rfind('/*', 0, start) > src.rfind('*/', 0, start):
            pos = m.end(); continue  # inside a comment
        paren = m.end() - 1
        try:
            end = skip_balanced(src, paren, '(', ')')
        except ValueError:
            pos = m.end(); continue
        inner = src[paren + 1:end - 1]
        args = split_top(inner)
        line = src.count('\n', 0, start) + 1
        sql_tok = args[0] if args else ''
        if not (sql_tok[:1] in '`"\'' and sql_tok[-1:] == sql_tok[:1]) or '${' in sql_tok:
            report.append((line, 'dynamic SQL', norm(sql_tok)[:80])); pos = end; continue
        sql = sql_tok[1:-1]
        params = None
        if len(args) > 1:
            ptok = args[1]
            if not (ptok.startswith('[') and ptok.endswith(']')):
                report.append((line, 'params not an array literal', norm(sql)[:80])); pos = end; continue
            params = split_top(ptok[1:-1])
        if len(args) > 2:
            report.append((line, 'extra args', norm(sql)[:80])); pos = end; continue
        res, err = gen.convert(sql, params)
        if not res:
            report.append((line, err, norm(sql)[:90])); pos = end; continue
        kind, table, cargs, alias = res
        # result used? statement form `await query(...);` at line start
        line_start = src.rfind('\n', 0, start) + 1
        prefix = src[line_start:start].strip()
        after = src[end:end + 3].lstrip()
        used = not (prefix == '' and after.startswith(';'))
        awaited = bool(m.group(1))
        INDENT[0] = re.match(r'\s*', src[line_start:]).group(0)
        replacement = render(kind, table, cargs, alias, awaited, used)
        if kind in ('update', 'delete', 'deleteFirst', 'updateFirst') and used: gen.h('okPacket')
        if kind == 'insert' and used: gen.h('insertResult')
        if kind == 'select': gen.h('plain')
        out.append((start, end, replacement))
        converted += 1
        pos = end
    for start, end, rep in reversed(out):
        src = src[:start] + rep + src[end:]
    return src, converted, report

def main():
    schema, path = sys.argv[1], sys.argv[2]
    write = '--write' in sys.argv
    models = parse_schema(schema)
    gen = Gen(models)
    src = open(path).read()
    new, n, report = process(src, gen)
    print(f'{path}: converted {n}, manual {len(report)}')
    for line, why, sql in report:
        print(f'  L{line}: {why} :: {sql}')
    print('helpers:', ','.join(sorted(gen.helpers)))
    if write and n:
        new = fix_imports(new, path, gen.helpers)
        open(path, 'w').write(new)

def fix_imports(src, path, helpers):
    import os
    path = os.path.abspath(path)
    backend = path[:path.index("/backend/") + len("/backend/")] if "/backend/" in path else None
    rel = os.path.relpath(os.path.join(backend, 'database'), os.path.dirname(os.path.abspath(path))) if backend else '../database'
    if not rel.startswith('.'): rel = './' + rel
    still_raw = re.search(r'(?<![.\w])query\(', src) is not None
    db_req = re.search(r'const \{\s*query\s*\} = require\(["\'][^"\']*dbpromise(\.js)?["\']\);\n', src)
    lines = []
    if 'require("' + rel + '/prisma")' not in src and "database/prisma\")" not in src and "database/prisma.js\")" not in src:
        lines.append(f'const {{ prisma }} = require("{rel}/prisma");')
    hm = re.search(r'const \{([^}]*)\} = require\("[^"]*prismaHelpers"\);', src)
    if hm:
        names = [x.strip() for x in hm.group(1).split(',') if x.strip()]
        for h in sorted(helpers):
            if h not in names: names.append(h)
        src = src[:hm.start(1)] + ' ' + ', '.join(names) + ' ' + src[hm.end(1):]
    elif helpers:
        lines.append(f'const {{ {", ".join(sorted(helpers))} }} = require("{rel}/prismaHelpers");')
    block = ''.join(l + '\n' for l in lines)
    if db_req:
        repl = (db_req.group(0) if still_raw else '') + block
        src = src[:db_req.start()] + repl + src[db_req.end():]
    else:
        # insert after the first require line
        m = re.search(r'^.*require\(.*\n', src, re.M)
        at = m.end() if m else 0
        src = src[:at] + block + src[at:]
    return src

if __name__ == '__main__':
    main()
