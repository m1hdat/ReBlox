"""Luật Advanced và chứng cứ map mới có nghiệm, thật sự sử dụng cơ chế."""
import copy
import json

import pytest
from fastapi.testclient import TestClient

from app.core import Action, Board, BlockState, Game, GameState, Orientation, maps_dir, step
from app.core.state import SplitState
from app.core.rules import apply_cell_switches
from app.main import app
from helpers import make_board
from oracle import shortest_path

S = Orientation.STANDING
NEW_MAPS = ("heavy_01", "toggle_01", "permanent_01", "advanced_01", "split_01")


def data(name):
    return json.loads((maps_dir() / f"{name}.json").read_text(encoding="utf-8"))


def split_state(a, b, active=0, bridges=()):
    return GameState(BlockState(9, 9, S), frozenset(bridges), SplitState((a, b), active))


def test_split_hash_identity_and_api_roundtrip():
    a = split_state((1, 2), (3, 4), 0, ("b",))
    b = split_state((3, 4), (1, 2), 1, ("b",))
    assert a == b and hash(a) == hash(b)
    assert GameState.from_dict(a.to_dict()) == a
    assert a != split_state((1, 2), (3, 4), 1, ("b",))
    assert a != split_state((1, 2), (3, 4), 0)


def test_split_only_standing_and_fixed_teleport_positions():
    game = Game(Board.from_dict(data("split_01")))
    lying = game.apply(game.initial_state(), Action.RIGHT)
    assert lying.split is None
    result = game.apply(lying, Action.RIGHT)
    assert result.split == SplitState(((1, 7), (3, 10)), 0)
    assert [a for a, _, _ in game.neighbors(result)] == [Action.SWITCH_CUBE]


def test_switch_cube_changes_active_only_and_costs_one():
    game = Game(make_board(["#####", "#####", "####G"], (0, 0)))
    before = split_state((0, 0), (2, 2))
    after = game.apply(before, Action.SWITCH_CUBE)
    assert after.split.cubes == before.split.cubes and after.split.active == 1
    assert after.open_bridges == before.open_bridges
    assert game.apply(after, Action.SWITCH_CUBE) == before
    assert game.cost_model.cost(before, Action.SWITCH_CUBE) == 1


def test_cube_only_moves_one_cell_and_stationary_cube_does_not_toggle():
    b = make_board(["s####", "####.", "####G"], (0, 1),
                   switches=[dict(pos=[0, 0], kind="soft", targets=["b"], effect="toggle")],
                   bridges=[dict(id="b", cells=[[1, 4]], initially_open=False)])
    after = Game(b).apply(split_state((0, 0), (2, 2), 1), Action.RIGHT)
    assert after.split.cubes == ((0, 0), (2, 3))
    assert not after.open_bridges


@pytest.mark.parametrize("tile,kind,triggered", [("s", "soft", True), ("h", "heavy", False)])
def test_single_cube_soft_but_not_heavy(tile, kind, triggered):
    board = make_board([f"#{tile}###", "####.", "####G"], (0, 0),
                       switches=[dict(pos=[0, 1], kind=kind, targets=["b"], effect="open")],
                       bridges=[dict(id="b", cells=[[1, 4]], initially_open=False)])
    before = split_state((0, 0), (2, 3))
    after = Game(board).apply(before, Action.RIGHT)
    assert after.split is not None and (0, 1) in after.split.cubes
    assert ("b" in after.open_bridges) is triggered


def test_cube_can_cross_fragile_and_goal_does_not_win():
    game = Game(make_board(["#FG##", "#####", "#####"], (0, 0), goal=(0, 2)))
    before = split_state((0, 0), (2, 4))
    fragile = game.apply(before, Action.RIGHT)
    assert fragile is not None and fragile.split is not None
    goal = game.apply(fragile, Action.RIGHT)
    assert goal is not None and not game.is_goal(goal)
    assert game.apply(goal, Action.UP) is None


@pytest.mark.parametrize("a,b,action,orientation,anchor", [
    ((0, 0), (0, 2), Action.RIGHT, Orientation.HORIZONTAL, (0, 1)),
    ((0, 0), (2, 0), Action.DOWN, Orientation.VERTICAL, (1, 0)),
])
def test_adjacent_cubes_automatically_merge(a, b, action, orientation, anchor):
    game = Game(make_board(["#####", "#####", "####G"], (0, 0)))
    after = game.apply(split_state(a, b), action)
    assert after.split is None
    assert after.block == BlockState(*anchor, orientation)


@pytest.mark.parametrize("name", NEW_MAPS)
def test_new_maps_have_verified_shortest_solution(name):
    d = data(name)
    game = Game(Board.from_dict(d))
    solved, path, _ = shortest_path(game)
    assert solved and d["solvable"] is True
    assert path == d["reference_solution"]
    assert game.replay(path)[0]


@pytest.mark.parametrize("name", ["heavy_01", "toggle_01", "advanced_01"])
def test_bridges_require_their_switches(name):
    original = data(name)
    for disabled in original["switches"]:
        d = copy.deepcopy(original)
        d["switches"] = [s for s in d["switches"] if s["pos"] != disabled["pos"]]
        r, c = disabled["pos"]
        row = list(d["grid"][r]); row[c] = "#"; d["grid"][r] = "".join(row)
        assert not shortest_path(Game(Board.from_dict(d)))[0]


def test_permanent_close_is_used_by_reference_and_cannot_toggle_back():
    game = Game(Board.from_dict(data("permanent_01")))
    state = game.initial_state()
    assert "side_bridge" in state.open_bridges
    for action in data("permanent_01")["reference_solution"]:
        state = game.apply(state, Action(action))
    assert game.is_goal(state) and "side_bridge" not in state.open_bridges
    assert not apply_cell_switches(game.board, ((2, 4),), state.open_bridges)


def test_cube_cannot_close_bridge_beneath_other_cube():
    board = make_board([".####", "#s###", "####G"], (0, 1),
                       switches=[dict(pos=[1, 1], kind="soft", targets=["b"], effect="close")],
                       bridges=[dict(id="b", cells=[[0, 0]], initially_open=True)])
    before = split_state((0, 0), (1, 2), 1, ("b",))
    result = step(board, before, Action.LEFT)
    assert not result.valid and result.state == before


@pytest.mark.parametrize("destinations", [[[1, 7], [1, 7]], [[-1, 0], [3, 10]], [[1, 6], [3, 10]]])
def test_bad_teleport_definitions_are_rejected(destinations):
    from app.core import MapError
    d = data("split_01")
    d["splitters"][0]["destinations"] = destinations
    with pytest.raises(MapError):
        Board.from_dict(d)


def test_split_destination_on_closed_bridge_fails_without_changing_state():
    d = data("split_01")
    d["splitters"][0]["destinations"][0] = [1, 8]
    game = Game(Board.from_dict(d))
    lying = game.apply(game.initial_state(), Action.RIGHT)
    result = step(game.board, lying, Action.RIGHT)
    assert not result.valid and result.state == lying


def test_split_requires_switching_cubes_opening_bridge_and_rejoining():
    game = Game(Board.from_dict(data("split_01")))
    path = data("split_01")["reference_solution"]
    assert "SWITCH_CUBE" in path
    state = game.initial_state(); seen_split = seen_open = seen_merge = False
    for name in path:
        before = state
        state = game.apply(state, Action(name))
        seen_split |= state.split is not None
        seen_open |= "cube_bridge" in state.open_bridges
        seen_merge |= before.split is not None and state.split is None
    assert seen_split and seen_open and seen_merge and game.is_goal(state)
    class NoSwitch(Game):
        def neighbors(self, s):
            return [edge for edge in super().neighbors(s) if edge[0] is not Action.SWITCH_CUBE]
    assert not shortest_path(NoSwitch(game.board))[0]


@pytest.mark.parametrize("name", NEW_MAPS)
def test_reference_paths_through_stateless_http_api(name):
    client = TestClient(app)
    state = client.post("/api/game/initial", json={"map_id": name}).json()["state"]
    for action in data(name)["reference_solution"]:
        response = client.post("/api/game/step", json={"map_id": name, "state": state, "action": action})
        assert response.status_code == 200
        result = response.json()
        assert result["valid"]
        state = result["state"]
    assert result["reached_goal"]
    assert client.post("/api/game/validate-path", json={"map_id": name, "path": data(name)["reference_solution"]}).json()["valid"]
