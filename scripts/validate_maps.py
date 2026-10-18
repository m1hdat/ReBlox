"""Kiểm tra mọi map: cấu trúc, state đầu hợp lệ, và (dùng oracle) có nghiệm hay không.

  python scripts/validate_maps.py            # chỉ kiểm tra, lệch với file => báo lỗi
  python scripts/validate_maps.py --write    # ghi solvable + reference_solution vào file map
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(ROOT / "backend" / "tests"))

from app.core import Board, Game, UnsupportedMechanic, is_valid  # noqa: E402
from oracle import shortest_path  # noqa: E402


def main() -> int:
    write = "--write" in sys.argv
    bad = 0
    for p in sorted((ROOT / "maps").glob("*.json")):
        data = json.loads(p.read_text(encoding="utf-8"))
        try:
            board = Board.from_dict(data)
        except UnsupportedMechanic as e:
            print(f"[PENDING] {p.name}: {e}")
            if data.get("status") != "pending":
                print("   ^ LỖI: map dùng cơ chế pending nhưng status != pending"); bad += 1
            continue
        except Exception as e:
            print(f"[LỖI] {p.name}: {e}"); bad += 1; continue
        game = Game(board)
        if not is_valid(board, game.initial_state()):
            print(f"[LỖI] {p.name}: state đầu không hợp lệ"); bad += 1; continue
        solvable, path, visited = shortest_path(game)
        ok, _, _ = game.replay(path) if solvable else (True, None, 0)
        if solvable and not ok:
            print(f"[LỖI] {p.name}: oracle path không replay được"); bad += 1; continue
        print(f"[OK] {p.name}: solvable={solvable} shortest={len(path) if path else None} states={visited}")
        if write:
            data["solvable"] = solvable
            data["reference_solution"] = path if solvable else None
            p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        else:
            if data.get("solvable") != solvable:
                print("   ^ LỖI: 'solvable' trong file lệch với kết quả oracle"); bad += 1
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
