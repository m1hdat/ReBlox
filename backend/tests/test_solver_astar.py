"""Test riêng cho solver A*: hợp đồng kết quả, tối ưu, heuristic admissible/consistent, trường hợp biên."""
from collections import Counter
from heapq import heappop, heappush
from itertools import count

import pytest

from app.core import BlockState, CostModel, Game, GameState, Orientation, load_board, maps_dir
from app.solvers.astar import prepare_heuristic, search, solve
from helpers import make_board
from oracle import shortest_path

SOLVABLE = ("easy_01", "easy_02", "medium_01", "fragile_01", "bridge_01", "heavy_01", "toggle_01",
            "permanent_01", "advanced_01", "split_01")
COSTS = ("uniform", "orientation_weighted")
CASES = [(m, c) for m in SOLVABLE for c in COSTS]
EPS = 1e-9


def game_of(name, cost="uniform"):
    return Game(load_board(maps_dir() / f"{name}.json"), CostModel(cost))


def dijkstra(game, start):
    """Oracle chi phí độc lập (không dùng code A*): chi phí nhỏ nhất từ start tới đích, None nếu vô nghiệm."""
    best, tie, heap = {start: 0.0}, count(), [(0.0, 0, start)]
    while heap:
        d, _, s = heappop(heap)
        if d > best[s]:
            continue
        if game.is_goal(s):
            return d
        for _, n, c in game.neighbors(s):
            if d + c < best.get(n, float("inf")):
                best[n] = d + c
                heappush(heap, (d + c, next(tie), n))
    return None


def walk(game, state, path):
    """Đi theo path từ state bất kỳ: trả (state cuối, tổng chi phí); None nếu có nước không hợp lệ."""
    total = 0.0
    for name in path:
        step = next(((n, c) for a, n, c in game.neighbors(state) if a.value == name), None)
        if step is None:
            return None
        state, total = step[0], total + step[1]
    return state, total


@pytest.mark.parametrize("name,cost", CASES)
def test_solution_replays_and_is_optimal(name, cost):
    game = game_of(name, cost)
    r = solve(game, game.initial_state())
    assert r.algorithm == "ASTAR" and r.solved
    valid, _, steps = game.replay(r.path)
    assert valid and steps == r.solution_length == len(r.path)
    assert r.solution_cost == pytest.approx(game.path_cost(r.path))
    assert r.solution_cost == pytest.approx(dijkstra(game, game.initial_state()))
    assert 0 <= r.expanded_nodes <= r.generated_nodes + 1 and r.max_frontier_size >= 1
    if cost == "uniform":
        assert r.solution_length == len(shortest_path(game)[1])


@pytest.mark.parametrize("name,cost", CASES)
def test_heuristic_is_admissible_and_consistent(name, cost):
    game = game_of(name, cost)
    h = prepare_heuristic(game)
    edges, seen, stack = {}, {game.initial_state()}, [game.initial_state()]
    while stack:                                # toàn bộ state tới được + cạnh
        s = stack.pop()
        edges[s] = [(n, c) for _, n, c in game.neighbors(s)]
        for n, _ in edges[s]:
            if n not in seen:
                seen.add(n); stack.append(n)
    rev = {s: [] for s in seen}
    for s, outs in edges.items():
        for n, c in outs:
            rev[n].append((s, c))
    true, tie = {}, count()                     # chi phí thật còn lại: Dijkstra ngược từ các state đích
    heap = [(0.0, next(tie), s) for s in seen if game.is_goal(s)]
    for _, _, s in heap:
        true[s] = 0.0
    while heap:
        d, _, s = heappop(heap)
        if d > true[s]:
            continue
        for p, c in rev[s]:
            if d + c < true.get(p, float("inf")):
                true[p] = d + c
                heappush(heap, (d + c, next(tie), p))
    assert all(h(s) == 0.0 for s in true if true[s] == 0.0)
    assert all(h(s) <= t + EPS for s, t in true.items())                                    # admissible
    assert all(h(s) <= c + h(n) + EPS for s, outs in edges.items() for n, c in outs)        # consistent


@pytest.mark.parametrize("name,cost", CASES)
def test_consistent_heuristic_expands_each_state_at_most_once(name, cost):
    game = game_of(name, cost)
    calls, real = Counter(), game.neighbors
    game.neighbors = lambda s: (calls.update([s]), real(s))[1]
    r = solve(game, game.initial_state())
    assert max(calls.values()) == 1 and sum(calls.values()) == r.expanded_nodes   # entry lỗi thời không được mở lại


@pytest.mark.parametrize("name,cost", CASES)
def test_reopens_state_when_heuristic_is_only_admissible(name, cost):
    game = game_of(name, cost)
    s0, base = game.initial_state(), prepare_heuristic(game)
    want = dijkstra(game, s0)
    for k in range(5):      # h chỉ NHỎ hơn bảng nới lỏng (admissible) nhưng lệch mạnh giữa state kề nhau (không consistent)
        h = lambda s, k=k: base(s) * (((s.block.row * 7 + s.block.col * 13 + k) % 5) / 4)
        assert search(game, s0, h).solution_cost == pytest.approx(want)


def test_informed_heuristic_expands_fewer_nodes_than_zero_heuristic():
    game = game_of("easy_01")
    s0 = game.initial_state()
    zero = search(game, s0, lambda s: 0.0)
    astar = solve(game, s0)
    assert astar.solution_cost == zero.solution_cost and astar.expanded_nodes < zero.expanded_nodes


def test_unsolvable_map_returns_failure():
    game = game_of("unsolvable_01")
    r = solve(game, game.initial_state())
    assert not r.solved and r.path == [] and r.solution_length is None and r.solution_cost is None
    assert r.note and r.max_frontier_size >= 1


def test_initial_state_already_goal():
    game = game_of("easy_01")
    gr, gc = game.board.goal
    r = solve(game, GameState(BlockState(gr, gc, Orientation.STANDING), game.board.initial_open_bridges))
    assert r.solved and r.path == [] and r.solution_length == 0 and r.solution_cost == 0.0
    assert r.expanded_nodes == 0 and r.generated_nodes == 0


@pytest.mark.parametrize("cost", COSTS)
def test_searches_from_given_state_not_map_start(cost):
    game = game_of("medium_01", cost)
    start = game.neighbors(game.initial_state())[0][1]     # đã đi một nước, khác đầu map
    r = solve(game, start)
    end, total = walk(game, start, r.path)
    assert game.is_goal(end) and r.solution_cost == pytest.approx(total)
    assert r.solution_cost == pytest.approx(dijkstra(game, start))


@pytest.mark.parametrize("cost,total", [("uniform", 2.0), ("orientation_weighted", 3.0)])
def test_metrics_on_one_row_board(cost, total):
    game = Game(make_board(["###G"], (0, 0)), CostModel(cost))
    r = solve(game, game.initial_state())
    assert r.path == ["RIGHT", "RIGHT"] and r.solution_length == 2 and r.solution_cost == total
    assert (r.expanded_nodes, r.generated_nodes) == (2, 3)    # goal không tính expanded; successor quay lại start vẫn tính


def test_repeated_runs_are_deterministic():
    game = game_of("advanced_01")
    a, b = solve(game, game.initial_state()), solve(game, game.initial_state())
    assert a.to_dict() == b.to_dict()
