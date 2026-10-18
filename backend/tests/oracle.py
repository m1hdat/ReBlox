"""ORACLE chỉ dùng cho TEST/kiểm chứng map — KHÔNG phải solver của dự án.

Một BFS tối giản, viết độc lập, để (1) chứng minh map có/không có nghiệm,
(2) tạo reference_solution có độ dài ngắn nhất theo số nước đi.
Teammate vẫn phải tự cài BFS/DFS/UCS/A* trong backend/app/solvers/.
"""
from __future__ import annotations

from collections import deque

from app.core import Game


def shortest_path(game: Game, limit: int = 2_000_000):
    """Trả về (solvable, path | None, số state đã thăm). BFS exhaustive nên 'unsolvable' là chứng minh thật."""
    start = game.initial_state()
    prev = {start: None}
    q = deque([start])
    while q:
        s = q.popleft()
        if game.is_goal(s):
            path = []
            while prev[s] is not None:
                s, a = prev[s]
                path.append(a)
            return True, path[::-1], len(prev)
        for a, n, _ in game.neighbors(s):
            if n not in prev:
                prev[n] = (s, a.value)
                q.append(n)
        if len(prev) > limit:
            raise RuntimeError("vượt giới hạn state")
    return False, None, len(prev)
