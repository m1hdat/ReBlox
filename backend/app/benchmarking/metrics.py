"""Wrapper đo đạc dùng chung. Thời gian/bộ nhớ đo Ở ĐÂY, không trong từng solver.

Định nghĩa:
- expanded_nodes: state bị lấy khỏi frontier và successor thực sự được sinh.
- generated_nodes: số successor được sinh ra.
- search_time_s: perf_counter quanh solve(); KHÔNG gồm render/replay.
- peak_memory_bytes: đỉnh tracemalloc (chỉ cấp phát Python; không gồm C-extension/interpreter).
  tracemalloc làm chậm chương trình => thời gian đo ở lần chạy RIÊNG, không bật tracemalloc.
"""
from __future__ import annotations

import time
import tracemalloc
from dataclasses import dataclass

from ..core.engine import Game
from ..solvers.contract import SolverResult


@dataclass
class BenchmarkResult:
    result: SolverResult
    search_time_s: float
    peak_memory_bytes: int
    replay_valid: bool          # path có thật sự tới goal khi chạy lại bằng game core?
    verified_cost: float | None

    def to_dict(self) -> dict:
        d = self.result.to_dict()
        d.update(search_time_s=self.search_time_s, peak_memory_bytes=self.peak_memory_bytes,
                 replay_valid=self.replay_valid, verified_cost=self.verified_cost)
        return d


def run_benchmark(solve_fn, game: Game) -> BenchmarkResult:
    init = game.initial_state()
    t0 = time.perf_counter()                       # lần 1: chỉ đo thời gian
    res = solve_fn(game, init)
    elapsed = time.perf_counter() - t0
    tracemalloc.start()                            # lần 2: chỉ đo bộ nhớ
    try:
        solve_fn(game, init)
        _, peak = tracemalloc.get_traced_memory()
    finally:
        tracemalloc.stop()
    ok = game.replay(res.path)[0] if res.solved else False
    cost = game.path_cost(res.path) if ok else None
    return BenchmarkResult(res, elapsed, peak, ok, cost)
