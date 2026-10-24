"""Solver BFS — PLACEHOLDER chờ Member 1 cài đặt.

Chỉ sửa file này (và test riêng tests/test_solver_bfs.py). Đọc SOLVER_CONTRACT.md trước.
Dùng: game.initial_state(), game.is_goal(s), game.neighbors(s) -> [(action, next_state, cost)].
Hàm phải trả SolverResult với algorithm="BFS". Khi cài xong, xóa dòng raise bên dưới.
"""
from __future__ import annotations

from ..core.engine import Game
from ..core.state import GameState
from .contract import SolverNotImplemented, SolverResult, failure

from collections import deque

ALGORITHM = "BFS"


def solve(game: Game, initial_state: GameState) -> SolverResult:
    frontier = deque([initial_state])
    visited = {initial_state}

    # parent[next_state] = (previous_state, action, cost)
    parent: dict[GameState, tuple[GameState, str, float]] = {}

    generated_nodes = 0
    expanded_nodes = 0
    max_frontier_size = 1
    goal_state: GameState | None = None

    while frontier:
        state = frontier.popleft()

        if game.is_goal(state):
            goal_state = state
            break

        neighbors = game.neighbors(state)
        expanded_nodes += 1

        for action, next_state, cost in neighbors:
            generated_nodes += 1

            if next_state in visited:
                continue

            visited.add(next_state)
            parent[next_state] = (
                state,
                action.value if hasattr(action, "value") else str(action),
                float(cost),
            )
            frontier.append(next_state)

        max_frontier_size = max(max_frontier_size, len(frontier))

    if goal_state is None:
        return failure(
            ALGORITHM,
            expanded_nodes,
            generated_nodes,
            "frontier rỗng: vô nghiệm",
        )

    path: list[str] = []
    total_cost = 0.0
    state = goal_state

    while state != initial_state:
        previous_state, action, cost = parent[state]
        path.append(action)
        total_cost += cost
        state = previous_state

    path.reverse()

    return SolverResult(
        algorithm=ALGORITHM,
        solved=True,
        path=path,
        expanded_nodes=expanded_nodes,
        generated_nodes=generated_nodes,
        solution_length=len(path),
        solution_cost=total_cost,
        max_frontier_size=max_frontier_size,
    )
