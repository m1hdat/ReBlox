from app.core import BlockState, GameState, Orientation, get_occupied_cells
from app.core.state import SplitState


def test_state_hashable_and_equal():
    a = GameState(BlockState(1, 2, Orientation.STANDING), frozenset({"b1", "b2"}))
    b = GameState(BlockState(1, 2, Orientation.STANDING), frozenset({"b2", "b1"}))
    assert a == b and hash(a) == hash(b)
    assert len({a, b}) == 1


def test_bridge_config_changes_state_identity():
    a = GameState(BlockState(0, 0, Orientation.STANDING), frozenset())
    b = GameState(BlockState(0, 0, Orientation.STANDING), frozenset({"x"}))
    assert a != b


def test_state_is_immutable():
    import dataclasses, pytest
    s = GameState(BlockState(0, 0, Orientation.STANDING))
    with pytest.raises(dataclasses.FrozenInstanceError):
        s.block = BlockState(1, 1, Orientation.STANDING)


def test_occupied_cells():
    assert get_occupied_cells(GameState(BlockState(3, 4, Orientation.STANDING))) == ((3, 4),)
    assert get_occupied_cells(GameState(BlockState(3, 4, Orientation.HORIZONTAL))) == ((3, 4), (3, 5))
    assert get_occupied_cells(GameState(BlockState(3, 4, Orientation.VERTICAL))) == ((3, 4), (4, 4))


def test_roundtrip_dict():
    s = GameState(BlockState(3, 4, Orientation.VERTICAL), frozenset({"a"}))
    assert GameState.from_dict(s.to_dict()) == s


def test_split_state_reserved_and_hashable():
    sp = SplitState(((0, 0), (0, 1)), 0)
    assert hash(sp) == hash(SplitState(((0, 0), (0, 1)), 0))
