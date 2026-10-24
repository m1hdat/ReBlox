"""Kiểm chứng DFS: luật game thật, contract, thứ tự duyệt và metric."""
from copy import deepcopy

import pytest
from fastapi.testclient import TestClient

from app.core import Action, BlockState, CostModel, Game, GameState, Orientation, load_board, maps_dir
from app.core.state import SplitState
from app.main import app
from app.solvers.dfs import solve
from helpers import make_board


SOLVABLE_MAPS = (
    "easy_01", "easy_02", "medium_01", "fragile_01", "bridge_01",
    "heavy_01", "toggle_01", "permanent_01", "advanced_01", "split_01",
)
COST_MODELS = ("uniform", "orientation_weighted")


@pytest.mark.parametrize("map_id", SOLVABLE_MAPS)
@pytest.mark.parametrize("cost_model", COST_MODELS)
def test_real_maps_replay_cost_determinism_and_no_mutation(map_id, cost_model):
    board = load_board(maps_dir() / f"{map_id}.json")
    # DFS phải tự tìm nghiệm ngay cả khi không có lời giải tham chiếu.
    board.meta.pop("reference_solution", None)
    game = Game(board, CostModel(cost_model))
    initial = game.initial_state()
    before = deepcopy(board.to_dict())

    result = solve(game, initial)

    assert result.algorithm == "DFS"
    assert result.solved
    valid, final, steps = game.replay(result.path)
    assert valid and game.is_goal(final)
    assert steps == result.solution_length == len(result.path)
    assert result.solution_cost == pytest.approx(game.path_cost(result.path))
    assert result.expanded_nodes > 0
    assert result.generated_nodes >= result.expanded_nodes
    assert result.max_frontier_size >= 1
    if map_id == "split_01":
        assert Action.SWITCH_CUBE.value in result.path
    assert solve(game, initial) == result
    assert board.to_dict() == before
    assert game.initial_state() == initial


@pytest.mark.parametrize("cost_model", COST_MODELS)
def test_unsolvable_map_exhausts_frontier(cost_model):
    game = Game(load_board(maps_dir() / "unsolvable_01.json"), CostModel(cost_model))
    result = solve(game, game.initial_state())

    assert result.algorithm == "DFS"
    assert not result.solved
    assert result.path == []
    assert result.solution_length is None
    assert result.solution_cost is None
    assert result.expanded_nodes >= 1
    assert result.max_frontier_size >= 1
    assert result.note


@pytest.mark.parametrize("cost_model,expected_cost", [("uniform", 2.0), ("orientation_weighted", 3.0)])
def test_small_board_has_exact_cost_and_metrics(cost_model, expected_cost):
    game = Game(make_board(["###G"], (0, 0)), CostModel(cost_model))
    result = solve(game, game.initial_state())

    assert result.solved
    assert result.path == ["RIGHT", "RIGHT"]
    assert result.solution_length == 2
    assert result.solution_cost == expected_cost
    assert result.expanded_nodes == 2
    assert result.generated_nodes == 3  # Bao gồm cạnh quay lại start.
    assert result.max_frontier_size == 1


@pytest.mark.parametrize("cost_model", COST_MODELS)
def test_initial_goal_is_not_expanded(cost_model, monkeypatch):
    game = Game(make_board(["###G"], (0, 0)), CostModel(cost_model))
    goal = GameState(BlockState(0, 3, Orientation.STANDING))
    monkeypatch.setattr(game, "neighbors", lambda _: pytest.fail("Không mở rộng goal"))

    result = solve(game, goal)

    assert result.solved
    assert result.path == []
    assert result.solution_length == 0
    assert result.solution_cost == 0.0
    assert result.expanded_nodes == result.generated_nodes == 0
    assert result.max_frontier_size == 1


@pytest.mark.parametrize("cost_model", COST_MODELS)
def test_search_starts_at_supplied_state(cost_model):
    game = Game(make_board(["###G"], (0, 0)), CostModel(cost_model))
    initial = game.apply(game.initial_state(), Action.RIGHT)
    result = solve(game, initial)

    assert result.solved and result.path == ["RIGHT"]
    state, total = initial, 0.0
    for name in result.path:
        action = Action(name)
        total += game.cost_model.cost(state, action)
        state = game.apply(state, action)
        assert state is not None
    assert game.is_goal(state)
    assert result.solution_length == 1
    assert result.solution_cost == total == 1.0
    # LEFT được pop trước RIGHT: ghé start cũ rồi mới pop goal đang chờ.
    assert result.expanded_nodes == 2
    assert result.generated_nodes == 3
    assert result.max_frontier_size == 2


def node(index):
    return GameState(BlockState(0, index, Orientation.STANDING))


class GraphGame(Game):
    """Đồ thị nhỏ để kiểm chứng thứ tự/metric độc lập với hình học của map."""

    def __init__(self, edges, goal):
        self.edges = edges
        self.goal = goal
        self.expanded = []

    def initial_state(self):
        pytest.fail("Solver phải dùng initial_state được truyền vào")

    def is_goal(self, state):
        return state == self.goal

    def neighbors(self, state):
        assert state != self.goal, "Goal không được mở rộng"
        assert state not in self.expanded, "Không mở rộng lại trạng thái đã thấy"
        self.expanded.append(state)
        return self.edges.get(state, [])


def test_depth_first_order_goal_on_pop_and_frontier_size():
    start, up, down, left, right, deep, goal = [node(i) for i in range(7)]
    game = GraphGame({
        start: [(Action.UP, up, 2.0), (Action.DOWN, down, 3.0),
                (Action.LEFT, left, 4.0), (Action.RIGHT, right, 5.0)],
        up: [(Action.UP, deep, 7.0)],
        deep: [(Action.DOWN, up, 1.0), (Action.RIGHT, goal, 11.0)],
    }, goal)

    result = solve(game, start)

    assert result.solved
    assert result.path == ["UP", "UP", "RIGHT"]
    assert result.solution_length == 3
    assert result.solution_cost == 20.0
    assert game.expanded == [start, up, deep]
    assert result.expanded_nodes == 3
    assert result.generated_nodes == 7
    assert result.max_frontier_size == 4


def test_cycle_and_cross_edge_keep_first_parent_and_branch_cost():
    start, up, right, goal = [node(i) for i in range(4)]
    game = GraphGame({
        start: [(Action.UP, up, 2.0), (Action.RIGHT, right, 5.0)],
        up: [(Action.UP, right, 7.0), (Action.RIGHT, up, 1.0)],
        right: [(Action.DOWN, start, 1.0), (Action.RIGHT, goal, 3.0)],
    }, goal)

    result = solve(game, start)

    assert result.solved
    assert result.path == ["RIGHT", "RIGHT"]
    assert result.solution_cost == 8.0
    assert game.expanded == [start, up, right]
    assert result.expanded_nodes == 3
    assert result.generated_nodes == 6
    assert result.max_frontier_size == 2


def test_goal_is_checked_on_pop_after_earlier_branch():
    start, up, goal = [node(i) for i in range(3)]
    game = GraphGame({
        start: [(Action.UP, up, 2.0), (Action.RIGHT, goal, 5.0)],
        up: [(Action.DOWN, start, 1.0)],
    }, goal)

    result = solve(game, start)

    assert result.solved and result.path == ["RIGHT"]
    assert result.solution_cost == 5.0
    assert game.expanded == [start, up]
    assert result.expanded_nodes == 2
    assert result.generated_nodes == 3
    assert result.max_frontier_size == 2


def test_cyclic_graph_without_goal_is_fully_exhausted():
    start, other, goal = [node(i) for i in range(3)]
    game = GraphGame({
        start: [(Action.UP, start, 1.0), (Action.RIGHT, other, 1.0)],
        other: [(Action.LEFT, start, 1.0)],
    }, goal)

    result = solve(game, start)

    assert not result.solved and result.path == []
    assert result.solution_length is result.solution_cost is None
    assert game.expanded == [start, other]
    assert result.expanded_nodes == 2
    assert result.generated_nodes == 3
    assert result.max_frontier_size == 1


@pytest.mark.parametrize("start,changed", [
    (node(0), GameState(node(0).block, frozenset({"bridge"}))),
    (GameState(node(0).block, split=SplitState(((0, 0), (2, 2)), 0)),
     GameState(node(0).block, split=SplitState(((0, 0), (2, 2)), 1))),
    (GameState(node(0).block, split=SplitState(((0, 0), (2, 2)), 0)),
     GameState(node(0).block, split=SplitState(((0, 1), (2, 2)), 0))),
], ids=["open-bridges", "active-cube", "cube-positions"])
def test_visited_key_preserves_complete_state(start, changed):
    goal = node(9)
    game = GraphGame({
        start: [(Action.UP, changed, 1.0)],
        changed: [(Action.RIGHT, goal, 2.0)],
    }, goal)

    result = solve(game, start)

    assert result.solved and result.path == ["UP", "RIGHT"]
    assert result.solution_cost == 3.0
    assert game.expanded == [start, changed]


def test_long_chain_does_not_depend_on_python_recursion():
    states = [node(i) for i in range(1501)]
    game = GraphGame({
        state: [(Action.RIGHT, next_state, 1.0)]
        for state, next_state in zip(states, states[1:])
    }, states[-1])

    result = solve(game, states[0])

    assert result.solved
    assert result.path == ["RIGHT"] * 1500
    assert result.solution_length == result.solution_cost == 1500
    assert result.expanded_nodes == result.generated_nodes == 1500
    assert result.max_frontier_size == 1


@pytest.mark.parametrize("map_id,status", [("easy_01", "solved"), ("split_01", "solved"),
                                          ("unsolvable_01", "unsolved")])
@pytest.mark.parametrize("cost_model", COST_MODELS)
def test_dfs_api_and_benchmark_integration(map_id, status, cost_model):
    with TestClient(app) as client:
        response = client.post("/api/solve", json={
            "map_id": map_id, "algorithm": "DFS", "cost_model": cost_model,
        })

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == status
    assert payload["algorithm"] == "DFS" and payload["mock"] is False
    result = payload["result"]
    assert result["algorithm"] == "DFS"
    assert result["search_time_s"] >= 0
    assert result["peak_memory_bytes"] > 0
    if status == "solved":
        assert result["solved"] and result["replay_valid"]
        assert result["solution_length"] == len(result["path"])
        assert result["solution_cost"] == pytest.approx(result["verified_cost"])
    else:
        assert not result["solved"] and not result["replay_valid"]
        assert result["path"] == []
        assert result["solution_length"] is result["solution_cost"] is None
        assert result["verified_cost"] is None
