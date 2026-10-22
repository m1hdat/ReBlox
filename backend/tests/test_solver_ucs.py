import pytest

from app.core import (
    Action,
    BlockState,
    CostModel,
    Game,
    GameState,
    Orientation,
    load_board,
    maps_dir,
)
from app.solvers.ucs import solve
from helpers import make_board


@pytest.mark.parametrize(
    ("cost_model", "expected_cost"),
    [("uniform", 2.0), ("orientation_weighted", 3.0)],
)
def test_ucs_small_board_solution_cost_and_metrics(cost_model, expected_cost):
    game = Game(make_board(["###G"], (0, 0)), CostModel(cost_model))

    result = solve(game, game.initial_state())

    assert result.algorithm == "UCS"
    assert result.solved
    assert result.path == ["RIGHT", "RIGHT"]
    assert result.solution_length == 2
    assert result.solution_cost == pytest.approx(expected_cost)
    assert result.expanded_nodes == 2
    assert result.generated_nodes == 3
    assert result.max_frontier_size is not None
    assert result.max_frontier_size >= 1


def test_ucs_initial_state_already_at_goal():
    game = Game(make_board(["###G"], (0, 0)))
    goal_state = GameState(BlockState(0, 3, Orientation.STANDING))

    result = solve(game, goal_state)

    assert result.solved
    assert result.path == []
    assert result.solution_length == 0
    assert result.solution_cost == pytest.approx(0.0)
    assert result.expanded_nodes == 0
    assert result.generated_nodes == 0
    assert result.max_frontier_size == 0


def test_ucs_starts_from_the_passed_state():
    game = Game(make_board(["###G"], (0, 0)))
    custom_start = game.apply(game.initial_state(), Action.RIGHT)
    assert custom_start is not None

    result = solve(game, custom_start)

    assert result.solved
    assert result.path == ["RIGHT"]
    assert result.solution_length == 1
    assert result.solution_cost == pytest.approx(1.0)

    state = custom_start
    for action_name in result.path:
        next_state = game.apply(state, Action(action_name))
        assert next_state is not None
        state = next_state
    assert game.is_goal(state)


def test_ucs_relaxes_a_state_when_a_cheaper_path_is_found():
    start = GameState(BlockState(0, 0, Orientation.STANDING))
    expensive = GameState(BlockState(0, 1, Orientation.STANDING))
    detour = GameState(BlockState(1, 0, Orientation.STANDING))
    goal = GameState(BlockState(1, 1, Orientation.STANDING))

    class WeightedGraphGame:
        def is_goal(self, state):
            return state == goal

        def neighbors(self, state):
            return {
                start: [
                    (Action.RIGHT, expensive, 5.0),
                    (Action.DOWN, detour, 1.0),
                ],
                detour: [
                    (Action.LEFT, expensive, 1.0),
                    (Action.RIGHT, goal, 10.0),
                ],
                expensive: [(Action.UP, goal, 1.0)],
                goal: [],
            }[state]

    result = solve(WeightedGraphGame(), start)

    assert result.solved
    assert result.path == ["DOWN", "LEFT", "UP"]
    assert result.solution_cost == pytest.approx(3.0)
    assert result.solution_length == 3


@pytest.mark.parametrize("map_id", ["easy_01", "bridge_01", "split_01"])
def test_ucs_solves_and_replays_representative_maps(map_id):
    game = Game(load_board(maps_dir() / f"{map_id}.json"))

    result = solve(game, game.initial_state())

    assert result.solved
    valid, _, steps = game.replay(result.path)
    assert valid
    assert steps == result.solution_length == len(result.path)
    assert result.solution_cost == pytest.approx(game.path_cost(result.path))


def test_ucs_reports_unsolvable_map():
    game = Game(load_board(maps_dir() / "unsolvable_01.json"))

    result = solve(game, game.initial_state())

    assert not result.solved
    assert result.path == []
    assert result.solution_length is None
    assert result.solution_cost is None
    assert result.expanded_nodes >= 1
    assert result.generated_nodes >= 0
