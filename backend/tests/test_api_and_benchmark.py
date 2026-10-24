from fastapi.testclient import TestClient
import pytest

from app.core import Game
from app.main import app
from app.benchmarking.metrics import run_benchmark
from app.solvers.contract import SolverResult
from helpers import big_floor, make_board

client = TestClient(app)


def test_maps_endpoint_lists_pending_flagged():
    data = client.get("/api/maps").json()
    ids = {m["id"]: m for m in data}
    assert ids["easy_01"]["playable"] is True
    assert ids["split_pending_01"]["playable"] is False


def test_step_and_fall():
    st = client.post("/api/game/initial", json={"map_id": "easy_01"}).json()["state"]
    ok = client.post("/api/game/step", json={"map_id": "easy_01", "state": st, "action": "RIGHT"}).json()
    assert ok["valid"] and ok["state"]["orientation"] == "HORIZONTAL"
    fell = client.post("/api/game/step", json={"map_id": "easy_01", "state": st, "action": "UP"}).json()
    assert not fell["valid"] and fell["reason"] == "fell" and fell["attempted"] is not None


def test_step_on_pending_map_rejected():
    r = client.post("/api/game/step", json={"map_id": "split_pending_01", "state": {"row": 0, "col": 0, "orientation": "STANDING"}, "action": "RIGHT"})
    assert r.status_code == 400


def test_validate_path():
    import json
    from app.core import maps_dir
    sol = json.loads((maps_dir() / "easy_01.json").read_text(encoding="utf-8"))["reference_solution"]
    assert client.post("/api/game/validate-path", json={"map_id": "easy_01", "path": sol}).json()["valid"]
    assert not client.post("/api/game/validate-path", json={"map_id": "easy_01", "path": []}).json()["valid"]
    assert not client.post("/api/game/validate-path", json={"map_id": "easy_01", "path": ["UP"]}).json()["valid"]
    assert not client.post("/api/game/validate-path", json={"map_id": "easy_01", "path": ["JUMP"]}).json()["valid"]


@pytest.mark.parametrize("algorithm", ["BFS", "DFS", "UCS", "ASTAR"])
@pytest.mark.parametrize("cost_model", ["uniform", "orientation_weighted"])
@pytest.mark.parametrize("map_id", [
    "easy_01", "easy_02", "medium_01", "fragile_01", "bridge_01",
    "heavy_01", "toggle_01", "permanent_01", "advanced_01", "split_01", "unsolvable_01",
])
def test_all_solvers_return_real_verified_results(algorithm, cost_model, map_id):
    response = client.post("/api/solve", json={
        "map_id": map_id, "algorithm": algorithm, "cost_model": cost_model,
    })
    assert response.status_code == 200
    payload = response.json()
    solved = map_id != "unsolvable_01"
    assert payload["status"] == ("solved" if solved else "unsolved")
    assert payload["mock"] is False and payload["algorithm"] == algorithm
    result = payload["result"]
    assert result["algorithm"] == algorithm and result["solved"] is solved
    assert result["replay_valid"] is solved
    assert result["search_time_s"] >= 0 and result["peak_memory_bytes"] > 0
    if solved:
        assert result["solution_length"] == len(result["path"])
        assert result["solution_cost"] == pytest.approx(result["verified_cost"])
    else:
        assert result["path"] == []
        assert result["solution_length"] is result["solution_cost"] is result["verified_cost"] is None


def test_mock_is_labeled():
    r = client.post("/api/solve/mock-demo", json={"map_id": "easy_01"}).json()
    assert r["mock"] is True and "MOCK" in r["label"]


def test_benchmark_wrapper_verifies_path():
    board = make_board(["###G"], (0, 0))
    game = Game(board)

    def tiny_solver(g, s):   # solver giả CHỈ để thử wrapper (không phải thuật toán dự án)
        return SolverResult("TEST", True, ["RIGHT", "RIGHT"][:0] + ["RIGHT"], 1, 1, 1, 1.0)

    b = run_benchmark(tiny_solver, game)
    assert b.search_time_s >= 0 and b.peak_memory_bytes >= 0
    assert b.replay_valid is False    # 1 bước không tới goal => wrapper phát hiện path sai
