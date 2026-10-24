"""UCS graph search with a min-heap, cost relaxation and stale-entry skipping."""
from __future__ import annotations

from ..core.engine import Game
from ..core.state import GameState
from .contract import SolverResult

from itertools import count
import heapq
from .contract import failure


ALGORITHM = "UCS"

def _reconstruct_path(
    parent: dict[GameState, tuple[GameState, str] | None],
    goal_state: GameState,
) -> list[str]:
    path: list[str] = []
    state = goal_state

    while parent[state] is not None:
        previous_state, action = parent[state]
        path.append(action)
        state = previous_state

    path.reverse()
    return path

def solve(game: Game, initial_state: GameState) -> SolverResult:
    if game.is_goal(initial_state):
        return SolverResult(
            algorithm=ALGORITHM, 
            solved=True, 
            path=[],
            expanded_nodes=0,
            generated_nodes=0,
            solution_length=0,
            solution_cost=0.0,
            max_frontier_size=0,
            note="có nghiệm"
        )
    order = count()
    frontier: list[tuple[float, int, GameState]] = [(0, next(order), initial_state)]
    g_score: dict[GameState, float] = {
        initial_state: 0
    }
    parent: dict[GameState, tuple[GameState, str] | None] = {
        initial_state: None
    }
    expanded = 0
    generated = 0
    max_frontier_size = 1
    while frontier:
        g, _, state = heapq.heappop(frontier)


        if g != g_score[state]:
            continue

        if game.is_goal(state):
            path = _reconstruct_path(parent, state)
            return SolverResult(
                algorithm=ALGORITHM, 
                solved=True, 
                path=path,
                expanded_nodes=expanded,
                generated_nodes=generated,
                solution_length=len(path),
                solution_cost=g,
                max_frontier_size=max_frontier_size,
                note="có nghiệm"
            )

        neighbors = game.neighbors(state)
        expanded += 1
        generated += len(neighbors)

        for action, next_state, step_cost in neighbors:
            new_g = g + step_cost

            if new_g < g_score.get(next_state, float('inf')):
                g_score[next_state] = new_g
                parent[next_state] = (state, action.value)
                heapq.heappush(
                    frontier, 
                    (new_g, next(order), next_state),
                )

        max_frontier_size = max(max_frontier_size, len(frontier))


    return SolverResult(
        algorithm=ALGORITHM, 
        solved=False, 
        path=[],
        expanded_nodes=expanded,
        generated_nodes=generated,
        solution_length=None,
        solution_cost=None,
        max_frontier_size=max_frontier_size,
        note="vô nghiệm"
    )
