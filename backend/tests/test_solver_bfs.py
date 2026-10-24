"""BFS: shortest paths, full advanced state, metrics and custom starts."""
import pytest

from app.core import Action, BlockState, CostModel, Game, GameState, Orientation, load_board, maps_dir
from app.solvers.bfs import solve
from helpers import make_board
from oracle import shortest_path


@pytest.mark.parametrize("cost", ["uniform", "orientation_weighted"])
@pytest.mark.parametrize("name", [
    "easy_01", "easy_02", "medium_01", "fragile_01", "bridge_01", "heavy_01",
    "toggle_01", "permanent_01", "advanced_01", "split_01", "unsolvable_01",
])
def test_bfs_matches_shortest_path_oracle(name, cost):
    game = Game(load_board(maps_dir() / f"{name}.json"), CostModel(cost))
    result = solve(game, game.initial_state())
    solved, path, _ = shortest_path(game)
    assert result.algorithm == "BFS" and result.solved == solved
    assert result.expanded_nodes >= 0 and result.generated_nodes >= 0
    assert result.to_dict() == solve(game, game.initial_state()).to_dict()
    if solved:
        assert game.replay(result.path)[0]
        assert result.solution_length == len(result.path) == len(path)
        assert result.solution_cost == pytest.approx(game.path_cost(result.path))
    else:
        assert result.path == []
        assert result.solution_length is result.solution_cost is None


@pytest.mark.parametrize("cost,total", [("uniform", 2.0), ("orientation_weighted", 3.0)])
def test_bfs_metrics_and_passed_initial_state(cost, total):
    game = Game(make_board(["###G"], (0, 0)), CostModel(cost))
    result = solve(game, game.initial_state())
    assert result.path == ["RIGHT", "RIGHT"] and result.solution_cost == total
    assert (result.expanded_nodes, result.generated_nodes) == (2, 3)
    custom = game.apply(game.initial_state(), Action.RIGHT)
    result = solve(game, custom)
    assert result.path == ["RIGHT"] and result.solution_cost == 1.0
    assert game.is_goal(game.apply(custom, Action.RIGHT))


def test_bfs_initial_goal():
    game = Game(make_board(["###G"], (0, 0)))
    result = solve(game, GameState(BlockState(0, 3, Orientation.STANDING)))
    assert result.solved and result.path == [] and result.solution_length == 0
    assert result.solution_cost == 0.0
    assert (result.expanded_nodes, result.generated_nodes) == (0, 0)
