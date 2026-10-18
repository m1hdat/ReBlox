"""Mô hình trạng thái BẤT BIẾN và HASHABLE của trò chơi.

Mọi thuật toán tìm kiếm dùng GameState làm khóa trong visited-set / dict.
Vì vậy: frozen dataclass + chỉ chứa kiểu hashable (int, enum, frozenset, tuple).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class Orientation(str, Enum):
    STANDING = "STANDING"      # đứng: chiếm 1 ô
    HORIZONTAL = "HORIZONTAL"  # nằm ngang theo cột: (r,c) và (r,c+1)
    VERTICAL = "VERTICAL"      # nằm dọc theo hàng: (r,c) và (r+1,c)


class Action(str, Enum):
    UP = "UP"                  # row - 1
    DOWN = "DOWN"              # row + 1
    LEFT = "LEFT"              # col - 1
    RIGHT = "RIGHT"            # col + 1
    SWITCH_CUBE = "SWITCH_CUBE"  # đổi cube đang điều khiển; cũng là một action có chi phí


DIRECTIONS: tuple[Action, ...] = (Action.UP, Action.DOWN, Action.LEFT, Action.RIGHT)
# Thứ tự cố định -> tie-breaking xác định (xem SOLVER_CONTRACT.md)


@dataclass(frozen=True, order=True)
class BlockState:
    """Khối 1x1x2 ở chế độ bình thường. (row, col) = ô chiếm giữ phía trên-trái."""
    row: int
    col: int
    orientation: Orientation


@dataclass(frozen=True, order=True)
class SplitState:
    """Hai cube theo thứ tự tọa độ chuẩn; active chỉ cube đang điều khiển."""
    cubes: tuple[tuple[int, int], tuple[int, int]]
    active: int = 0

    def __post_init__(self):
        if self.active not in (0, 1) or len(self.cubes) != 2 or self.cubes[0] == self.cubes[1]:
            raise ValueError("split cần hai vị trí khác nhau và active bằng 0 hoặc 1")
        if any(len(cell) != 2 or any(type(v) is not int for v in cell) for cell in self.cubes):
            raise ValueError("tọa độ cube phải là cặp số nguyên")
        if self.cubes[0] > self.cubes[1]:
            object.__setattr__(self, "cubes", (self.cubes[1], self.cubes[0]))
            object.__setattr__(self, "active", 1 - self.active)


@dataclass(frozen=True)
class GameState:
    """Trạng thái đầy đủ = vị trí khối + cấu hình cầu.

    open_bridges: frozenset id cầu đang MỞ (frozenset => hashable và chuẩn tắc,
    không phụ thuộc thứ tự thêm vào).
    split: None khi ở chế độ bình thường. Khi khác None, hai cube và active
    mô tả toàn bộ vị trí; `block` được chuẩn hóa để không làm sai khóa state."""
    block: BlockState
    open_bridges: frozenset[str] = field(default_factory=frozenset)
    split: SplitState | None = None

    def __post_init__(self):
        # Không để block cũ tạo ra các key khác nhau cho cùng một cấu hình split.
        if self.split is not None:
            object.__setattr__(self, "block", BlockState(0, 0, Orientation.STANDING))

    def to_dict(self) -> dict:
        result = {
            "row": self.block.row,
            "col": self.block.col,
            "orientation": self.block.orientation.value,
            "open_bridges": sorted(self.open_bridges),
        }
        if self.split is not None:
            result["split"] = {"cubes": [list(cell) for cell in self.split.cubes], "active": self.split.active}
        return result

    @staticmethod
    def from_dict(d: dict) -> "GameState":
        raw = d.get("split")
        split = None if raw is None else SplitState(tuple(tuple(cell) for cell in raw["cubes"]), raw["active"])
        return GameState(
            BlockState(int(d["row"]), int(d["col"]), Orientation(d["orientation"])),
            frozenset(d.get("open_bridges", [])),
            split,
        )
