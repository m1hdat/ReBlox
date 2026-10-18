"""Công cụ dev: sinh file map JSON từ định nghĩa gọn bên dưới.
Chạy: python scripts/build_maps.py   (sau đó chạy validate_maps.py --write để điền solvable/reference_solution)."""
import json
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "maps"

def mk(id, name, desc, diff, grid, start, goal, theme, status="playable", **kw):
    d = {"id": id, "name": name, "description": desc, "difficulty": diff, "status": status,
         "rows": len(grid), "cols": len(grid[0]), "grid": grid, "start": list(start),
         "goal": list(goal), "switches": [], "bridges": [], "theme": theme}
    d.update(kw)
    (OUT / f"{id}.json").write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

mk("easy_01", "Chú robot buồn ngủ", "Robot nhỏ hết pin. Lăn viên pin vào ổ cắm để đánh thức nó.", "easy",
   ["####......",
    "#######...",
    "#########G",
    "####......"],
   (0, 0), (2, 9), {"object": "sleepy_robot", "palette": "cream"})

mk("easy_02", "Hộp nhạc nhỏ", "Hành lang hẹp buộc phải đổi tư thế của viên pin.", "easy",
   ["####........",
    "####........",
    "..##........",
    "..#########G"],
   (0, 0), (3, 11), {"object": "music_box", "palette": "peach"})

mk("medium_01", "Đoàn tàu gỗ", "Có hai đường vòng quanh khoảng trống; thử tìm đường ngắn nhất.", "medium",
   ["############",
    "##........##",
    "##........##",
    "###########G"],
   (0, 0), (3, 11), {"object": "toy_train", "palette": "blue"})

mk("fragile_01", "Chiếc đồng hồ nhỏ", "Ô kính mỏng 'F' sẽ vỡ nếu đứng thẳng lên. Hãy nằm xuống khi băng qua.", "medium",
   ["####....####",
    "####FFFF###G",
    "####FFFF####"],
   (0, 0), (1, 11), {"object": "tiny_clock", "palette": "lavender"})

mk("bridge_01", "Chiếc đèn bàn", "Nút cảm ứng 's' mở cây cầu; không có cầu thì không tới được ổ cắm.", "medium",
   ["####.......",
    "####.......",
    "#s##......G",
    "####......."],
   (0, 0), (2, 10), {"object": "toy_lamp", "palette": "yellow"},
   switches=[{"pos": [2, 1], "kind": "soft", "targets": ["bridge_a"], "effect": "open"}],
   bridges=[{"id": "bridge_a", "cells": [[2, 4], [2, 5], [2, 6], [2, 7], [2, 8], [2, 9]], "initially_open": False}])

mk("unsolvable_01", "Hòn đảo xa", "Khoảng trống rộng 2 ô giữa hai đảo: nhìn như gần nhưng viên pin không thể qua.", "easy",
   ["####....",
    "####..#G",
    "####...."],
   (0, 0), (1, 7), {"object": "island", "palette": "sage"})

mk("split_pending_01", "Máy tách linh kiện (PENDING)", "Cần cơ chế split switch — CHƯA cài. Bị loại khỏi danh sách chơi/test.", "pending",
   ["####...",
    "#X##..G",
    "####..."],
   (0, 0), (1, 6), {"object": "splitter_machine", "palette": "lavender"}, status="pending",
   pending_reason="Cơ chế split/cube switching/rejoin chưa được cài đặt (xem PROJECT_STATUS.md).")
