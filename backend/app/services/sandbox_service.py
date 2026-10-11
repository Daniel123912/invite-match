"""Безопасный запуск кода кандидата: Python, JavaScript, SQL (SQLite)."""

from __future__ import annotations

import ast
import json
import os
import re
import shutil
import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path

MAX_CODE_LEN = 8000
TIMEOUT_SEC = 3
MAX_OUTPUT = 4000

SUPPORTED_LANGUAGES = ("python", "javascript", "sql")

_SAFE_BUILTIN_NAMES = (
    "abs",
    "all",
    "any",
    "bin",
    "bool",
    "chr",
    "dict",
    "divmod",
    "enumerate",
    "filter",
    "float",
    "format",
    "frozenset",
    "hex",
    "int",
    "isinstance",
    "issubclass",
    "len",
    "list",
    "map",
    "max",
    "min",
    "oct",
    "ord",
    "pow",
    "print",
    "range",
    "repr",
    "reversed",
    "round",
    "set",
    "slice",
    "sorted",
    "str",
    "sum",
    "tuple",
    "zip",
)

# input разрешён — подменяется безопасной обёрткой в runner
_FORBIDDEN_CALLS = frozenset(
    {
        "open",
        "eval",
        "exec",
        "compile",
        "__import__",
        "getattr",
        "setattr",
        "delattr",
        "globals",
        "locals",
        "vars",
        "dir",
        "type",
        "object",
        "super",
        "breakpoint",
        "memoryview",
        "help",
        "exit",
        "quit",
        "classmethod",
        "staticmethod",
        "property",
        "bytearray",
    }
)

_ALLOWED_NODE_TYPES = frozenset(
    {
        ast.Module,
        ast.Expression,
        ast.FunctionDef,
        ast.AsyncFunctionDef,
        ast.Return,
        ast.Assign,
        ast.AnnAssign,
        ast.AugAssign,
        ast.For,
        ast.AsyncFor,
        ast.While,
        ast.If,
        ast.With,
        ast.AsyncWith,
        ast.Raise,
        ast.Try,
        ast.Assert,
        ast.Expr,
        ast.Pass,
        ast.Break,
        ast.Continue,
        ast.Delete,
        ast.BoolOp,
        ast.BinOp,
        ast.UnaryOp,
        ast.Lambda,
        ast.IfExp,
        ast.Dict,
        ast.Set,
        ast.ListComp,
        ast.SetComp,
        ast.DictComp,
        ast.GeneratorExp,
        ast.Compare,
        ast.Call,
        ast.FormattedValue,
        ast.JoinedStr,
        ast.Constant,
        ast.Attribute,
        ast.Subscript,
        ast.Starred,
        ast.Name,
        ast.List,
        ast.Tuple,
        ast.Slice,
        ast.arguments,
        ast.arg,
        ast.keyword,
        ast.comprehension,
        ast.ExceptHandler,
        ast.withitem,
        ast.Load,
        ast.Store,
        ast.Del,
        ast.And,
        ast.Or,
        ast.Add,
        ast.Sub,
        ast.Mult,
        ast.Div,
        ast.FloorDiv,
        ast.Mod,
        ast.Pow,
        ast.LShift,
        ast.RShift,
        ast.BitOr,
        ast.BitXor,
        ast.BitAnd,
        ast.MatMult,
        ast.Invert,
        ast.Not,
        ast.UAdd,
        ast.USub,
        ast.Eq,
        ast.NotEq,
        ast.Lt,
        ast.LtE,
        ast.Gt,
        ast.GtE,
        ast.Is,
        ast.IsNot,
        ast.In,
        ast.NotIn,
    }
)

_SQL_FORBIDDEN = re.compile(
    r"\b(ATTACH|DETACH|LOAD_EXTENSION|VACUUM\s+INTO|PRAGMA)\b",
    re.IGNORECASE,
)

_SQL_SEED = """
CREATE TABLE employees (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  dept TEXT NOT NULL,
  salary INTEGER NOT NULL
);
CREATE TABLE departments (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  budget INTEGER NOT NULL
);
INSERT INTO departments (id, name, budget) VALUES
  (1, 'Engineering', 500000),
  (2, 'Product', 200000),
  (3, 'HR', 120000);
INSERT INTO employees (id, name, dept, salary) VALUES
  (1, 'Анна', 'Engineering', 180000),
  (2, 'Борис', 'Engineering', 150000),
  (3, 'Кира', 'Product', 160000),
  (4, 'Денис', 'HR', 90000),
  (5, 'Ева', 'Product', 140000);
"""


def _call_name(func: ast.AST) -> str | None:
    if isinstance(func, ast.Name):
        return func.id
    if isinstance(func, ast.Attribute):
        return func.attr
    return None


def _validate_code(code: str) -> str | None:
    try:
        tree = ast.parse(code, mode="exec")
    except SyntaxError as e:
        return f"Синтаксическая ошибка: {e.msg}"

    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            return "Импорты запрещены в песочнице"
        if type(node) not in _ALLOWED_NODE_TYPES:
            return f"Запрещённая конструкция: {type(node).__name__}"
        if isinstance(node, ast.Attribute) and node.attr.startswith("_"):
            return "Доступ к приватным атрибутам запрещён"
        if isinstance(node, ast.Name) and node.id.startswith("__"):
            return "Доступ к dunder-именам запрещён"
        if isinstance(node, ast.Call):
            name = _call_name(node.func)
            if name in _FORBIDDEN_CALLS:
                return f"Вызов {name}() запрещён"
    return None


_RUNNER = """
import ast
import builtins
import json
import sys

SAFE_NAMES = %s
FORBIDDEN = %s

def validate(src):
    tree = ast.parse(src, mode="exec")
    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            raise RuntimeError("import forbidden")
        if isinstance(node, ast.Attribute) and node.attr.startswith("_"):
            raise RuntimeError("private attr forbidden")
        if isinstance(node, ast.Name) and node.id.startswith("__"):
            raise RuntimeError("dunder name forbidden")
        if isinstance(node, ast.Call):
            func = node.func
            name = func.id if isinstance(func, ast.Name) else (
                func.attr if isinstance(func, ast.Attribute) else None
            )
            if name in FORBIDDEN:
                raise RuntimeError("call %%s forbidden" %% name)

def safe_input(prompt=""):
    line = sys.stdin.readline()
    if line == "":
        raise EOFError("EOF")
    return line.rstrip("\\n")

def main():
    meta = json.loads(sys.stdin.readline())
    src = meta["code"]
    validate(src)
    safe = {n: getattr(builtins, n) for n in SAFE_NAMES}
    safe["input"] = safe_input
    exec(compile(src, "<sandbox>", "exec"), {"__builtins__": safe}, {})

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(str(e), file=sys.stderr)
        sys.exit(1)
""" % (
    repr(list(_SAFE_BUILTIN_NAMES)),
    repr(set(_FORBIDDEN_CALLS)),
)

_JS_RUNNER = r"""
"use strict";
const vm = require("vm");

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { data += chunk; });
    process.stdin.on("end", () => resolve(data));
    if (process.stdin.isTTY) resolve("");
  });
}

function makeConsole(lines) {
  const write = (stream, args) => {
    const text = args.map((a) => {
      if (typeof a === "string") return a;
      try { return JSON.stringify(a); } catch { return String(a); }
    }).join(" ");
    stream.push(text);
  };
  return {
    log: (...args) => write(lines.out, args),
    info: (...args) => write(lines.out, args),
    warn: (...args) => write(lines.err, args),
    error: (...args) => write(lines.err, args),
  };
}

(async () => {
  const raw = await readStdin();
  const nl = raw.indexOf("\n");
  const metaLine = nl === -1 ? raw : raw.slice(0, nl);
  const userStdin = nl === -1 ? "" : raw.slice(nl + 1);
  let meta;
  try {
    meta = JSON.parse(metaLine || "{}");
  } catch (e) {
    process.stderr.write("Invalid payload\n");
    process.exit(1);
  }
  const src = meta.code || "";
  if (/\brequire\s*\(|\bprocess\b|\bglobal\b|\bBuffer\b|\b__dirname\b|\b__filename\b|\bimport\s*\(|\beval\s*\(|\bFunction\s*\(/.test(src)) {
    process.stderr.write("Запрещённые конструкции JS (require/process/eval/…)\n");
    process.exit(1);
  }

  const stdinLines = userStdin.split(/\r?\n/);
  let stdinIdx = 0;
  const lines = { out: [], err: [] };
  const sandbox = {
    console: makeConsole(lines),
    Math,
    JSON,
    Array,
    Object,
    String,
    Number,
    Boolean,
    Date,
    RegExp,
    Map,
    Set,
    WeakMap,
    WeakSet,
    Promise,
    Error,
    TypeError,
    RangeError,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    encodeURIComponent,
    decodeURIComponent,
    undefined,
    NaN,
    Infinity,
    input: () => {
      if (stdinIdx >= stdinLines.length) throw new Error("EOF");
      const line = stdinLines[stdinIdx++];
      return line === undefined ? "" : line;
    },
  };

  try {
    vm.runInNewContext(src, sandbox, { timeout: 2500, displayErrors: true });
    if (lines.out.length) process.stdout.write(lines.out.join("\n") + "\n");
    if (lines.err.length) process.stderr.write(lines.err.join("\n") + "\n");
  } catch (e) {
    process.stderr.write(String(e && e.message ? e.message : e) + "\n");
    process.exit(1);
  }
})();
"""


def _fail(msg: str) -> dict:
    return {"ok": False, "stdout": "", "stderr": msg, "exit_code": -1}


def _base_env() -> dict[str, str]:
    env: dict[str, str] = {
        "PYTHONNOUSERSITE": "1",
        "PYTHONDONTWRITEBYTECODE": "1",
        "PYTHONPATH": "",
    }
    if sys.platform == "win32":
        for key in ("SystemRoot", "SYSTEMROOT", "WINDIR", "PATH", "PATHEXT", "TEMP", "TMP"):
            if key in os.environ:
                env[key] = os.environ[key]
    else:
        env["PATH"] = "/usr/bin:/bin"
        env["LANG"] = "C.UTF-8"
    return env


def run_python(code: str, stdin: str = "") -> dict:
    if len(code) > MAX_CODE_LEN:
        return _fail("Код слишком длинный")

    err = _validate_code(code)
    if err:
        return _fail(err)

    payload = json.dumps({"code": code}, ensure_ascii=False) + "\n" + (stdin or "")

    with tempfile.TemporaryDirectory() as tmp:
        runner = Path(tmp) / "runner.py"
        runner.write_text(_RUNNER, encoding="utf-8")
        try:
            proc = subprocess.run(
                [sys.executable, "-I", str(runner)],
                input=payload,
                capture_output=True,
                text=True,
                timeout=TIMEOUT_SEC,
                cwd=tmp,
                env=_base_env(),
            )
            return {
                "ok": proc.returncode == 0,
                "stdout": (proc.stdout or "")[:MAX_OUTPUT],
                "stderr": (proc.stderr or "")[:MAX_OUTPUT],
                "exit_code": proc.returncode,
            }
        except subprocess.TimeoutExpired:
            return _fail("Превышен лимит времени (3 с)")


def run_javascript(code: str, stdin: str = "") -> dict:
    if len(code) > MAX_CODE_LEN:
        return _fail("Код слишком длинный")

    node = shutil.which("node")
    if not node:
        return _fail("Node.js не найден на сервере")

    if re.search(
        r"\b(require|process|global|Buffer|__dirname|__filename|eval|Function)\b|\bimport\s*\(",
        code,
    ):
        return _fail("Запрещённые конструкции JS (require/process/eval/…)")

    payload = json.dumps({"code": code}, ensure_ascii=False) + "\n" + (stdin or "")

    with tempfile.TemporaryDirectory() as tmp:
        runner = Path(tmp) / "runner.js"
        runner.write_text(_JS_RUNNER, encoding="utf-8")
        env = _base_env()
        # Node needs PATH to resolve itself on Windows
        if "PATH" not in env and "Path" in os.environ:
            env["PATH"] = os.environ["Path"]
        try:
            proc = subprocess.run(
                [node, "--no-warnings", str(runner)],
                input=payload,
                capture_output=True,
                text=True,
                timeout=TIMEOUT_SEC,
                cwd=tmp,
                env=env,
            )
            return {
                "ok": proc.returncode == 0,
                "stdout": (proc.stdout or "")[:MAX_OUTPUT],
                "stderr": (proc.stderr or "")[:MAX_OUTPUT],
                "exit_code": proc.returncode,
            }
        except subprocess.TimeoutExpired:
            return _fail("Превышен лимит времени (3 с)")


def _split_sql_statements(sql: str) -> list[str]:
    parts: list[str] = []
    buf: list[str] = []
    in_single = False
    i = 0
    while i < len(sql):
        ch = sql[i]
        if ch == "'" and not in_single:
            in_single = True
            buf.append(ch)
        elif ch == "'" and in_single:
            # handle escaped ''
            if i + 1 < len(sql) and sql[i + 1] == "'":
                buf.append("''")
                i += 2
                continue
            in_single = False
            buf.append(ch)
        elif ch == ";" and not in_single:
            stmt = "".join(buf).strip()
            if stmt:
                parts.append(stmt)
            buf = []
        else:
            buf.append(ch)
        i += 1
    tail = "".join(buf).strip()
    if tail:
        parts.append(tail)
    return parts


def _format_rows(columns: list[str], rows: list[tuple]) -> str:
    if not columns:
        return ""
    lines = [" | ".join(columns)]
    lines.append("-+-".join("-" * max(3, len(c)) for c in columns))
    for row in rows:
        lines.append(" | ".join("" if v is None else str(v) for v in row))
    return "\n".join(lines)


def run_sql(code: str, stdin: str = "") -> dict:
    del stdin  # unused; kept for uniform API
    if len(code) > MAX_CODE_LEN:
        return _fail("Код слишком длинный")

    if _SQL_FORBIDDEN.search(code):
        return _fail("Запрещены ATTACH/DETACH/PRAGMA/LOAD_EXTENSION")

    statements = _split_sql_statements(code)
    if not statements:
        return _fail("Пустой SQL")

    try:
        conn = sqlite3.connect(":memory:")
        conn.execute("PRAGMA soft_heap_limit=8000000")
        conn.executescript(_SQL_SEED)
        out_chunks: list[str] = []
        for stmt in statements:
            cur = conn.execute(stmt)
            if cur.description:
                cols = [d[0] for d in cur.description]
                rows = cur.fetchmany(200)
                table = _format_rows(cols, rows)
                if table:
                    out_chunks.append(table)
                if cur.fetchone() is not None:
                    out_chunks.append("… (показаны первые 200 строк)")
            else:
                out_chunks.append(f"OK · изменено строк: {cur.rowcount}")
        conn.commit()
        conn.close()
        stdout = "\n\n".join(out_chunks)[:MAX_OUTPUT]
        return {"ok": True, "stdout": stdout, "stderr": "", "exit_code": 0}
    except sqlite3.Error as e:
        return _fail(f"SQL ошибка: {e}")


def run(code: str, stdin: str = "", language: str = "python") -> dict:
    lang = (language or "python").strip().lower()
    if lang not in SUPPORTED_LANGUAGES:
        return _fail(f"Язык не поддерживается. Доступно: {', '.join(SUPPORTED_LANGUAGES)}")
    if lang == "python":
        return run_python(code, stdin)
    if lang == "javascript":
        return run_javascript(code, stdin)
    return run_sql(code, stdin)
