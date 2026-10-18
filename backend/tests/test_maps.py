import json

import pytest

from app.core import Board, Game, UnsupportedMechanic, is_valid, maps_dir
from oracle import shortest_path

FILES = sorted(maps_dir().glob("*.json"))


def load(p):
    return json.loads(p.read_text(encoding="utf-8"))


PLAYABLE = [p for p in FILES if load(p).get("status", "playable") == "playable"]
PENDING = [p for p in FILES if load(p).get("status") == "pending"]


def test_there_are_maps():
    assert len(PLAYABLE) >= 6 and len(PENDING) >= 1


@pytest.mark.parametrize("p", PLAYABLE, ids=lambda p: p.stem)
def test_playable_map_structure_and_initial_state(p):
    board = Board.from_dict(load(p))
    assert is_valid(board, Game(board).initial_state())


@pytest.mark.parametrize("p", PLAYABLE, ids=lambda p: p.stem)
def test_solvable_flag_matches_exhaustive_search(p):
    data = load(p)
    solvable, _, _ = shortest_path(Game(Board.from_dict(data)))
    assert data["solvable"] is solvable          # nhãn trong file phải do kiểm chứng thật


@pytest.mark.parametrize("p", [q for q in PLAYABLE if load(q).get("solvable")], ids=lambda p: p.stem)
def test_reference_solution_replays_to_goal(p):
    data = load(p)
    ok, _, n = Game(Board.from_dict(data)).replay(data["reference_solution"])
    assert ok and n == len(data["reference_solution"])


def test_unsolvable_map_is_really_unsolvable():
    data = load(maps_dir() / "unsolvable_01.json")
    assert shortest_path(Game(Board.from_dict(data)))[0] is False


@pytest.mark.parametrize("p", PENDING, ids=lambda p: p.stem)
def test_pending_maps_are_rejected_by_default(p):
    with pytest.raises(UnsupportedMechanic):
        Board.from_dict(load(p))


def test_fragile_and_bridge_maps_exist_and_use_mechanics():
    assert "F" in "".join(load(maps_dir() / "fragile_01.json")["grid"])
    assert load(maps_dir() / "bridge_01.json")["bridges"]


def test_bridge_level_needs_the_switch():
    data = load(maps_dir() / "bridge_01.json")
    data["switches"] = []                        # bỏ công tắc (đổi tile 's' thành '#')
    data["grid"] = [row.replace("s", "#") for row in data["grid"]]
    assert shortest_path(Game(Board.from_dict(data)))[0] is False
