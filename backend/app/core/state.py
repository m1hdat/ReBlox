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
    SWITCH_CUBE = "SWITCH_CUBE"  # CHƯA DÙNG: đổi khối đang điều khiển ở chế độ split (pending)


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
    """DÀNH SẴN cho split-block (PENDING, chưa có luật chạy).
    cubes: vị trí 2 khối lập phương nhỏ; active: 0 hoặc 1."""
    cubes: tuple[tuple[int, int], tuple[int, int]]
    active: int = 0


@dataclass(frozen=True)
class GameState:
    """Trạng thái đầy đủ = vị trí khối + cấu hình cầu.

    open_bridges: frozenset id cầu đang MỞ (frozenset => hashable và chuẩn tắc,
    không phụ thuộc thứ tự thêm vào).
    split: None khi ở chế độ bình thường. Khi khác None, `block` không còn ý nghĩa
    (tính năng pending)."""
    block: BlockState
    open_bridges: frozenset[str] = field(default_factory=frozenset)
    split: SplitState | None = None

    def to_dict(self) -> dict:
        return {
            "row": self.block.row,
            "col": self.block.col,
            "orientation": self.block.orientation.value,
            "open_bridges": sorted(self.open_bridges),
        }

    @staticmethod
    def from_dict(d: dict) -> "GameState":
        return GameState(
            BlockState(int(d["row"]), int(d["col"]), Orientation(d["orientation"])),
            frozenset(d.get("open_bridges", [])),
        )
