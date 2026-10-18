"""Board: lưới tile tĩnh + định nghĩa cầu/công tắc, nạp từ JSON (xem maps/README.md)."""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

# Ký hiệu trong "grid"
VOID, NORMAL, FRAGILE, GOAL = ".", "#", "F", "G"
SOFT_SWITCH, HEAVY_SWITCH, SPLIT_SWITCH = "s", "h", "X"
BASE_TILES = {VOID, NORMAL, FRAGILE, GOAL, SOFT_SWITCH, HEAVY_SWITCH, SPLIT_SWITCH}
# Các ô được coi là "có sàn" (không tính cầu - cầu xử lý riêng)
FLOOR_TILES = {NORMAL, FRAGILE, GOAL, SOFT_SWITCH, HEAVY_SWITCH, SPLIT_SWITCH}


class MapError(ValueError):
    """Map sai cấu trúc."""


class UnsupportedMechanic(MapError):
    """Map dùng cơ chế chưa được cài (vd split) -> bị từ chối rõ ràng."""


@dataclass(frozen=True)
class Switch:
    pos: tuple[int, int]
    kind: str                 # "soft" | "heavy"
    targets: tuple[str, ...]  # id các cầu bị tác động
    effect: str               # "toggle" | "open" | "close"
    # open/close là vĩnh viễn nếu không có công tắc nào đảo lại; toggle đảo mỗi lần kích hoạt.


@dataclass(frozen=True)
class Bridge:
    id: str
    cells: tuple[tuple[int, int], ...]
    initially_open: bool


@dataclass
class Board:
    id: str
    name: str
    rows: int
    cols: int
    grid: list[str]
    start: tuple[int, int]
    goal: tuple[int, int]
    switches: tuple[Switch, ...] = ()
    bridges: tuple[Bridge, ...] = ()
    theme: dict = field(default_factory=dict)       # KHÔNG ảnh hưởng solver
    meta: dict = field(default_factory=dict)        # status, solvable, reference_solution...
    _bridge_cells: dict = field(default_factory=dict, repr=False)  # cell -> bridge id

    # ---- truy vấn tile ----
    def in_bounds(self, r: int, c: int) -> bool:
        return 0 <= r < self.rows and 0 <= c < self.cols

    def tile(self, r: int, c: int) -> str:
        return self.grid[r][c] if self.in_bounds(r, c) else VOID

    def bridge_at(self, r: int, c: int) -> str | None:
        return self._bridge_cells.get((r, c))

    def switch_at(self, r: int, c: int) -> Switch | None:
        for s in self.switches:
            if s.pos == (r, c):
                return s
        return None

    @property
    def initial_open_bridges(self) -> frozenset[str]:
        return frozenset(b.id for b in self.bridges if b.initially_open)

    @property
    def is_playable(self) -> bool:
        return self.meta.get("status", "playable") == "playable"

    # ---- nạp / kiểm tra ----
    @staticmethod
    def from_dict(d: dict, allow_pending: bool = False) -> "Board":
        try:
            grid = list(d["grid"])
            rows, cols = int(d["rows"]), int(d["cols"])
            if len(grid) != rows or any(len(line) != cols for line in grid):
                raise MapError(f"{d.get('id')}: grid không khớp rows/cols")
            for line in grid:
                for ch in line:
                    if ch not in BASE_TILES:
                        raise MapError(f"{d.get('id')}: ký tự tile lạ '{ch}'")
            bridges = tuple(
                Bridge(b["id"], tuple(tuple(x) for x in b["cells"]), bool(b.get("initially_open", False)))
                for b in d.get("bridges", [])
            )
            switches = tuple(
                Switch(tuple(s["pos"]), s["kind"], tuple(s["targets"]), s.get("effect", "toggle"))
                for s in d.get("switches", [])
            )
            board = Board(
                id=d["id"], name=d["name"], rows=rows, cols=cols, grid=grid,
                start=tuple(d["start"]), goal=tuple(d["goal"]),
                switches=switches, bridges=bridges,
                theme=d.get("theme", {}),
                meta={k: d[k] for k in ("status", "difficulty", "solvable", "reference_solution",
                                        "description", "pending_reason") if k in d},
            )
        except KeyError as e:
            raise MapError(f"map thiếu trường {e}") from e
        for b in bridges:
            for cell in b.cells:
                board._bridge_cells[cell] = b.id
        board._validate(allow_pending)
        return board

    def _validate(self, allow_pending: bool) -> None:
        sr, sc = self.start
        gr, gc = self.goal
        if self.tile(gr, gc) != GOAL:
            raise MapError(f"{self.id}: goal {self.goal} không phải ô 'G'")
        if sum(line.count(GOAL) for line in self.grid) != 1:
            raise MapError(f"{self.id}: phải có đúng 1 ô goal")
        if self.tile(sr, sc) not in FLOOR_TILES:
            raise MapError(f"{self.id}: start không nằm trên sàn")
        bridge_ids = {b.id for b in self.bridges}
        if len(bridge_ids) != len(self.bridges):
            raise MapError(f"{self.id}: id cầu bị trùng")
        for b in self.bridges:
            for (r, c) in b.cells:
                if not self.in_bounds(r, c) or self.grid[r][c] != VOID:
                    raise MapError(f"{self.id}: ô cầu {b.id} {(r, c)} phải là '.' trong grid")
        for s in self.switches:
            want = {"soft": SOFT_SWITCH, "heavy": HEAVY_SWITCH}.get(s.kind)
            if want is None or self.tile(*s.pos) != want:
                raise MapError(f"{self.id}: công tắc {s.pos} không khớp ký hiệu tile/kind")
            if s.effect not in ("toggle", "open", "close"):
                raise MapError(f"{self.id}: effect lạ '{s.effect}'")
            for t in s.targets:
                if t not in bridge_ids:
                    raise MapError(f"{self.id}: công tắc trỏ tới cầu không tồn tại '{t}'")
        for r, line in enumerate(self.grid):
            for c, ch in enumerate(line):
                if ch in (SOFT_SWITCH, HEAVY_SWITCH) and self.switch_at(r, c) is None:
                    raise MapError(f"{self.id}: tile công tắc {(r, c)} chưa có định nghĩa")
        uses_split = any(SPLIT_SWITCH in line for line in self.grid)
        if uses_split and not allow_pending:
            raise UnsupportedMechanic(f"{self.id}: dùng split switch — cơ chế split CHƯA được cài (pending)")

    def to_dict(self) -> dict:
        return {
            "id": self.id, "name": self.name, "rows": self.rows, "cols": self.cols,
            "grid": self.grid, "start": list(self.start), "goal": list(self.goal),
            "switches": [{"pos": list(s.pos), "kind": s.kind, "targets": list(s.targets), "effect": s.effect}
                         for s in self.switches],
            "bridges": [{"id": b.id, "cells": [list(c) for c in b.cells], "initially_open": b.initially_open}
                        for b in self.bridges],
            "theme": self.theme, **self.meta,
        }


def load_board(path: str | Path, allow_pending: bool = False) -> Board:
    with open(path, encoding="utf-8") as f:
        return Board.from_dict(json.load(f), allow_pending)


def maps_dir() -> Path:
    # backend/app/core/board.py -> repo root / maps
    return Path(__file__).resolve().parents[3] / "maps"
