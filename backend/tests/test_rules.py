from app.core import (Action, BlockState, Game, GameState, Orientation, apply_action,
                      get_initial_state, get_neighbors, is_goal, is_valid, step)
from helpers import big_floor, make_board

S, H, V = Orientation.STANDING, Orientation.HORIZONTAL, Orientation.VERTICAL


def gs(r, c, o, bridges=()):
    return GameState(BlockState(r, c, o), frozenset(bridges))


def test_invalid_move_returns_none_not_exception():
    b = make_board(["##G"], (0, 0))
    assert apply_action(b, get_initial_state(b), Action.UP) is None   # rơi ra ngoài biên
    assert step(b, get_initial_state(b), Action.UP).reason == "fell"


def test_neighbors_order_is_up_down_left_right():
    b = make_board(big_floor(), (5, 3))
    assert [a for a, _ in get_neighbors(b, get_initial_state(b))] == [Action.UP, Action.DOWN, Action.LEFT, Action.RIGHT]


def test_every_occupied_cell_needs_floor():
    b = make_board(["#.#", "#G#"], (0, 0))
    assert not is_valid(b, gs(0, 0, H))    # (0,1) là void
    assert is_valid(b, gs(0, 0, V))


def test_goal_requires_standing():
    b = make_board(["###", "#G#", "###"], (0, 0))
    assert is_goal(b, gs(1, 1, S))
    assert not is_goal(b, gs(1, 0, H))     # nằm ngang qua goal: chưa thắng
    assert not is_goal(b, gs(0, 1, V))


def test_fragile_standing_breaks_lying_ok():
    b = make_board(["#F#G", "#F##"], (0, 0))
    assert not is_valid(b, gs(0, 1, S))
    assert is_valid(b, gs(0, 1, V))        # nằm dọc trên 2 ô F: ổn
    assert is_valid(b, gs(0, 0, H))


def test_soft_switch_triggers_when_lying_on_it():
    sw = [{"pos": [0, 1], "kind": "soft", "targets": ["b"], "effect": "open"}]
    br = [{"id": "b", "cells": [[0, 3]], "initially_open": False}]
    b = make_board(["#s#.G"], (0, 0), switches=sw, bridges=br)
    n = apply_action(b, gs(0, 0, S), Action.RIGHT)    # H trên (0,1),(0,2): chạm công tắc
    assert n is not None and "b" in n.open_bridges


def test_heavy_switch_needs_standing():
    sw = [{"pos": [0, 1], "kind": "heavy", "targets": ["b"], "effect": "open"}]
    br = [{"id": "b", "cells": [[0, 4]], "initially_open": False}]
    b = make_board(["#h##.", "#####", "####G"], (0, 0), switches=sw, bridges=br, goal=(2, 4))
    lying = apply_action(b, gs(0, 0, S), Action.RIGHT)           # H (0,1),(0,2)
    assert lying is not None and "b" not in lying.open_bridges
    standing = apply_action(b, gs(0, 0, H), Action.LEFT)         # đứng ở (0,-1)? ra ngoài -> None
    assert standing is None
    st = apply_action(b, gs(1, 1, V), Action.UP)                 # V (1,1),(2,1) UP -> standing (0,1)
    assert st is not None and st.block.orientation is S and "b" in st.open_bridges


def test_toggle_flips_each_time():
    sw = [{"pos": [0, 0], "kind": "soft", "targets": ["b"], "effect": "toggle"}]
    br = [{"id": "b", "cells": [[1, 2]], "initially_open": False}]
    b = make_board(["s##", "##.", "##G"], (0, 0), switches=sw, bridges=br, goal=(2, 2))
    a = apply_action(b, gs(0, 1, H), Action.LEFT)     # standing (0,0)
    assert a is not None and "b" in a.open_bridges
    a2 = apply_action(b, a, Action.RIGHT)             # H (0,1),(0,2): rời công tắc, không đổi
    assert "b" in a2.open_bridges
    a3 = apply_action(b, a2, Action.LEFT)             # lại đứng trên công tắc -> toggle đóng cầu
    assert a3 is not None and "b" not in a3.open_bridges


def test_permanent_open_never_closes_without_close_switch():
    sw = [{"pos": [0, 0], "kind": "soft", "targets": ["b"], "effect": "open"}]
    br = [{"id": "b", "cells": [[1, 2]], "initially_open": False}]
    b = make_board(["s##", "##.", "##G"], (0, 0), switches=sw, bridges=br, goal=(2, 2))
    s = apply_action(b, gs(0, 1, H), Action.LEFT)
    assert "b" in s.open_bridges
    s = apply_action(b, s, Action.RIGHT)
    s = apply_action(b, s, Action.LEFT)               # lại đứng trên công tắc
    assert "b" in s.open_bridges


def test_bridge_closing_under_block_is_invalid_move():
    # Công tắc toggle nằm trên chính cây cầu mà khối đang nằm -> hợp lệ trước, bất hợp lệ sau khi đóng cầu.
    sw = [{"pos": [0, 2], "kind": "soft", "targets": ["b"], "effect": "toggle"}]
    br = [{"id": "b", "cells": [[0, 1]], "initially_open": True}]
    b = make_board(["#.sG"], (0, 0), switches=sw, bridges=br)
    # H nằm ở (0,1),(0,2): hợp lệ trước khi kích hoạt; công tắc (0,2) toggle đóng cầu (0,1) ngay dưới khối
    assert apply_action(b, gs(0, 0, S), Action.RIGHT) is None
    assert step(b, gs(0, 0, S), Action.RIGHT).reason == "fell"


def test_goal_state_blocks_further_moves():
    b = make_board(["#G#"], (0, 0))
    g = gs(0, 1, S)
    assert step(b, g, Action.RIGHT).reason == "already_goal"


def test_switch_cube_unsupported_in_normal_mode():
    b = make_board(["#G"], (0, 0))
    assert step(b, get_initial_state(b), Action.SWITCH_CUBE).reason == "unsupported_action"


def test_cost_models():
    b = make_board(big_floor(), (5, 3))
    from app.core import CostModel
    g = Game(b, CostModel("orientation_weighted"))
    s0 = g.initial_state()
    assert [c for _, _, c in g.neighbors(s0)] == [2.0, 2.0, 2.0, 2.0]
    assert Game(b).neighbors(s0)[0][2] == 1.0
