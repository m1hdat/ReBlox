"""Solver BFS — PLACEHOLDER chờ Member 1 cài đặt.

Chỉ sửa file này (và test riêng tests/test_solver_bfs.py). Đọc SOLVER_CONTRACT.md trước.
Dùng: game.initial_state(), game.is_goal(s), game.neighbors(s) -> [(action, next_state, cost)].
Hàm phải trả SolverResult với algorithm="BFS". Khi cài xong, xóa dòng raise bên dưới.
"""
from __future__ import annotations

from ..core.engine import Game
from ..core.state import GameState
from .contract import SolverNotImplemented, SolverResult

ALGORITHM = "BFS"


def solve(game: Game, initial_state: GameState) -> SolverResult:
    raise SolverNotImplemented("BFS chưa được cài đặt")
