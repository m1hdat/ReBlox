"""Chuyển tiếp hình học thuần túy của khối 1x1x2 (CHƯA kiểm tra sàn/công tắc)."""
from __future__ import annotations

from .state import Action, BlockState, Orientation

S, H, V = Orientation.STANDING, Orientation.HORIZONTAL, Orientation.VERTICAL


def get_occupied_cells(block: BlockState) -> tuple[tuple[int, int], ...]:
    r, c, o = block.row, block.col, block.orientation
    if o is S:
        return ((r, c),)
    if o is H:
        return ((r, c), (r, c + 1))
    return ((r, c), (r + 1, c))


def roll(block: BlockState, action: Action) -> BlockState:
    """Bảng 12 trường hợp (xem docs/MOVEMENT_RULES.md). Luôn trả về BlockState mới."""
    r, c, o = block.row, block.col, block.orientation
    if o is S:
        if action is Action.UP:    return BlockState(r - 2, c, V)
        if action is Action.DOWN:  return BlockState(r + 1, c, V)
        if action is Action.LEFT:  return BlockState(r, c - 2, H)
        if action is Action.RIGHT: return BlockState(r, c + 1, H)
    elif o is H:   # chiếm (r,c),(r,c+1)
        if action is Action.UP:    return BlockState(r - 1, c, H)
        if action is Action.DOWN:  return BlockState(r + 1, c, H)
        if action is Action.LEFT:  return BlockState(r, c - 1, S)
        if action is Action.RIGHT: return BlockState(r, c + 2, S)
    else:          # V: chiếm (r,c),(r+1,c)
        if action is Action.UP:    return BlockState(r - 1, c, S)
        if action is Action.DOWN:  return BlockState(r + 2, c, S)
        if action is Action.LEFT:  return BlockState(r, c - 1, V)
        if action is Action.RIGHT: return BlockState(r, c + 1, V)
    raise ValueError(f"Action không phải hướng di chuyển: {action}")
