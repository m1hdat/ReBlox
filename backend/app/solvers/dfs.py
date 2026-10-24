"""DFS graph search bằng stack, theo hợp đồng trong SOLVER_GUIDE.md.

Đánh dấu khi push và giữ parent của lần khám phá đầu tiên. Push successor
theo thứ tự đảo của core để ưu tiên pop UP, DOWN, LEFT, RIGHT, SWITCH_CUBE.
Quy ước này có thể khác DFS đệ quy; không bảo đảm lời giải ngắn/rẻ nhất.
"""
from __future__ import annotations

from ..core.engine import Game
from ..core.state import GameState
from .contract import SolverResult, failure

ALGORITHM = "DFS"


def solve(game: Game, initial_state: GameState) -> SolverResult:
    # parent đồng thời là tập đã thấy; key giữ toàn bộ cầu và trạng thái split.
    parent: dict[GameState, tuple[GameState, str] | None] = {initial_state: None}
    stack: list[tuple[GameState, float]] = [(initial_state, 0.0)]
    expanded = generated = 0
    max_frontier = 1

    while stack:
        state, cost = stack.pop()
        if game.is_goal(state):
            path: list[str] = []
            link = parent[state]
            while link is not None:
                previous, action = link
                path.append(action)
                link = parent[previous]
            path.reverse()
            return SolverResult(
                algorithm=ALGORITHM,
                solved=True,
                path=path,
                expanded_nodes=expanded,
                generated_nodes=generated,
                solution_length=len(path),
                solution_cost=cost,
                max_frontier_size=max_frontier,
            )

        successors = game.neighbors(state)
        expanded += 1
        generated += len(successors)  # Tính cả successor đã thấy, trước lọc trùng.
        for action, next_state, step_cost in reversed(successors):
            if next_state in parent:
                continue
            parent[next_state] = (state, action.value)
            stack.append((next_state, cost + step_cost))
        max_frontier = max(max_frontier, len(stack))

    result = failure(ALGORITHM, expanded, generated, note="Frontier rỗng: không có nghiệm")
    result.max_frontier_size = max_frontier
    return result
