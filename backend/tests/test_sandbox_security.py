"""Песочница не должна выполнять опасный код."""

from app.services.sandbox_service import run, run_javascript, run_python, run_sql


def test_sandbox_allows_print():
    r = run_python("print(2 + 2)")
    assert r["ok"] is True
    assert "4" in r["stdout"]


def test_sandbox_blocks_import_os():
    r = run_python("from os import system\nprint(1)")
    assert r["ok"] is False
    assert "Импорт" in r["stderr"] or "import" in r["stderr"].lower()


def test_sandbox_blocks_dunder_escape():
    r = run_python("print(().__class__)")
    assert r["ok"] is False


def test_sandbox_blocks_open():
    r = run_python("open('x.txt','w')")
    assert r["ok"] is False


def test_js_allows_console():
    r = run_javascript("console.log(2 + 2);")
    assert r["ok"] is True
    assert "4" in r["stdout"]


def test_js_blocks_require():
    r = run_javascript("require('fs');")
    assert r["ok"] is False


def test_js_input():
    r = run_javascript("console.log('hi ' + input());", stdin="Alex")
    assert r["ok"] is True
    assert "hi Alex" in r["stdout"]


def test_sql_select():
    r = run_sql("SELECT name FROM employees WHERE id = 1;")
    assert r["ok"] is True
    assert "Анна" in r["stdout"]


def test_sql_blocks_attach():
    r = run_sql("ATTACH DATABASE 'evil.db' AS e;")
    assert r["ok"] is False


def test_run_dispatch():
    assert run("print(1)", language="python")["ok"] is True
    assert run("console.log(1)", language="javascript")["ok"] is True
    assert run("SELECT 1 AS x;", language="sql")["ok"] is True
    assert run("print(1)", language="ruby")["ok"] is False
