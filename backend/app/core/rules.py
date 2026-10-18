"""Luật chơi: ô nào đỡ được khối, công tắc, goal, chi phí.

THỨ TỰ XỬ LÝ MỘT NƯỚC ĐI (cố định, xem GAME_SPEC.md):
 1. roll()           -> vị trí mới (hình học)
 2. is_valid(...)    -> kiểm tra bằng cấu hình cầu HIỆN TẠI (trước khi kích hoạt công tắc)
 3. kích hoạt công tắc ở các ô khối đang chiếm -> cấu hình cầu mới
 4. is_valid(...)    -> kiểm tra lại bằng cấu hình cầu MỚI (cầu đóng ngay dưới khối => nước đi bất hợp lệ)
"""
from __future__ import annotations

from dataclasses import dataclass

from .board import FLOOR_TILES, FRAGILE, GOAL, Board
from .state import Action, BlockState, GameState, Orientation
from .transitions import get_occupied_cells


def cell_supported(board: Board, r: int, c: int, open_bridges: frozenset[str]) -> bool:
    if not board.in_bounds(r, c):
        return False
    if board.grid[r][c] in FLOOR_TILES:
        return True
    bid = board.bridge_at(r, c)
    return bid is not None and bid in open_bridges


def is_valid(board: Board, state: GameState) -> bool:
    """Mọi ô chiếm giữ phải có sàn; đứng thẳng trên ô FRAGILE là không hợp lệ (vỡ)."""
    b = state.block
    cells = get_occupied_cells(b)
    for (r, c) in cells:
        if not cell_supported(board, r, c, state.open_bridges):
            return False
    if b.orientation is Orientation.STANDING and board.tile(b.row, b.col) == FRAGILE:
        return False
    return True


def is_goal(board: Board, state: GameState) -> bool:
    b = state.block
    return b.orientation is Orientation.STANDING and (b.row, b.col) == board.goal


def apply_switches(board: Board, block: BlockState, open_bridges: frozenset[str]) -> frozenset[str]:
    """Kích hoạt công tắc dưới khối. soft: bất kỳ ô nào chạm; heavy: chỉ khi STANDING."""
    cells = get_occupied_cells(block)
    bridges = set(open_bridges)
    for (r, c) in cells:
        sw = board.switch_at(r, c)
        if sw is None:
            continue
        if sw.kind == "heavy" and block.orientation is not Orientation.STANDING:
            continue
        for t in sw.targets:
            if sw.effect == "toggle":
                bridges ^= {t}
            elif sw.effect == "open":
                bridges.add(t)
            else:
                bridges.discard(t)
    return frozenset(bridges)


# ---------------- chi phí ----------------
@dataclass(frozen=True)
class CostModel:
    """Mọi chi phí >= 1 (không âm, và có cận dưới dương => heuristic 'số nước' vẫn admissible
    nếu nhân với min_cost). Xem SOLVER_CONTRACT.md."""
    name: str = "uniform"

    @property
    def min_cost(self) -> float:
        return 1.0

    def cost(self, before: GameState, action: Action) -> float:
        if self.name == "uniform":
            return 1.0
        if self.name == "orientation_weighted":
            # Đang đứng mà lăn tốn 2, còn lại tốn 1 (ví dụ cho thí nghiệm UCS).
            return 2.0 if before.block.orientation is Orientation.STANDING else 1.0
        raise ValueError(f"cost model lạ: {self.name}")


COST_MODELS = ("uniform", "orientation_weighted")
