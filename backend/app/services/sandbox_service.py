"""Изолированный запуск Python-кода (демо-песочница, без сети)."""

import subprocess
import sys
import tempfile
from pathlib import Path

MAX_CODE_LEN = 8000
TIMEOUT_SEC = 3


def run_python(code: str, stdin: str = "") -> dict:
    if len(code) > MAX_CODE_LEN:
        return {"ok": False, "stdout": "", "stderr": "Код слишком длинный", "exit_code": -1}
    banned = ("import os", "import subprocess", "open(", "__import__", "eval(", "exec(")
    lowered = code.lower()
    if any(b in lowered for b in banned):
        return {
            "ok": False,
            "stdout": "",
            "stderr": "Запрещённые конструкции (os, subprocess, open, eval)",
            "exit_code": -1,
        }

    with tempfile.TemporaryDirectory() as tmp:
        script = Path(tmp) / "main.py"
        script.write_text(code, encoding="utf-8")
        try:
            proc = subprocess.run(
                [sys.executable, str(script)],
                input=stdin or "",
                capture_output=True,
                text=True,
                timeout=TIMEOUT_SEC,
                cwd=tmp,
            )
            return {
                "ok": proc.returncode == 0,
                "stdout": proc.stdout[:4000],
                "stderr": proc.stderr[:4000],
                "exit_code": proc.returncode,
            }
        except subprocess.TimeoutExpired:
            return {"ok": False, "stdout": "", "stderr": "Превышен лимит времени (3 с)", "exit_code": -1}
