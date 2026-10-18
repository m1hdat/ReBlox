"""Kiểm tra cả 12 phép lăn (kết quả tính tay, xem docs/MOVEMENT_RULES.md)."""
import pytest

from app.core import Action, BlockState, Orientation
from app.core.transitions import roll

S, H, V = Orientation.STANDING, Orientation.HORIZONTAL, Orientation.VERTICAL
U, D, L, R = Action.UP, Action.DOWN, Action.LEFT, Action.RIGHT

CASES = [
    # (start, action, expected)   start luôn là (5,5) làm tham chiếu
    (BlockState(5, 5, S), U, BlockState(3, 5, V)),
    (BlockState(5, 5, S), D, BlockState(6, 5, V)),
    (BlockState(5, 5, S), L, BlockState(5, 3, H)),
    (BlockState(5, 5, S), R, BlockState(5, 6, H)),
    (BlockState(5, 5, H), U, BlockState(4, 5, H)),
    (BlockState(5, 5, H), D, BlockState(6, 5, H)),
    (BlockState(5, 5, H), L, BlockState(5, 4, S)),
    (BlockState(5, 5, H), R, BlockState(5, 7, S)),
    (BlockState(5, 5, V), U, BlockState(4, 5, S)),
    (BlockState(5, 5, V), D, BlockState(7, 5, S)),
    (BlockState(5, 5, V), L, BlockState(5, 4, V)),
    (BlockState(5, 5, V), R, BlockState(5, 6, V)),
]


@pytest.mark.parametrize("start,action,expected", CASES)
def test_roll(start, action, expected):
    assert roll(start, action) == expected


@pytest.mark.parametrize("start,action,expected", CASES)
def test_roll_is_reversible(start, action, expected):
    opposite = {U: D, D: U, L: R, R: L}[action]
    assert roll(expected, opposite) == start   # lăn lại hướng ngược về đúng chỗ cũ


def test_switch_cube_is_not_a_roll():
    with pytest.raises(ValueError):
        roll(BlockState(0, 0, S), Action.SWITCH_CUBE)
