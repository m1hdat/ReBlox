"""Chạy toàn bộ kiểm tra backend: validate map + pytest. Dùng: python scripts/run_tests.py"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def run(cmd, cwd):
    print("\n$", " ".join(cmd))
    return subprocess.call(cmd, cwd=cwd)


code = run([sys.executable, "scripts/validate_maps.py"], ROOT)
code |= run([sys.executable, "-m", "pytest", "-q"], ROOT / "backend")
sys.exit(1 if code else 0)
