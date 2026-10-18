"""Endpoint solver. Không cần sửa khi teammate cài thuật toán (registry trong solvers/__init__.py)."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..benchmarking.metrics import run_benchmark
from ..core import COST_MODELS, CostModel, Game
from ..solvers import SOLVERS
from ..solvers.contract import SolverNotImplemented
from .routes_game import get_board

router = APIRouter(prefix="/api", tags=["solver"])


class SolveRequest(BaseModel):
    map_id: str
    algorithm: str = "BFS"
    cost_model: str = "uniform"


@router.get("/solvers")
def list_solvers():
    return {"algorithms": list(SOLVERS), "cost_models": list(COST_MODELS)}


@router.post("/solve")
def solve(req: SolveRequest):
    algo = req.algorithm.upper()
    if algo not in SOLVERS:
        raise HTTPException(404, f"thuật toán lạ: {req.algorithm}")
    if req.cost_model not in COST_MODELS:
        raise HTTPException(422, "cost_model không hợp lệ")
    board = get_board(req.map_id)
    if not board.is_playable:
        raise HTTPException(400, "map chưa playable (pending)")
    game = Game(board, CostModel(req.cost_model))
    try:
        bench = run_benchmark(SOLVERS[algo], game)
    except SolverNotImplemented:
        return {"status": "not_implemented", "algorithm": algo, "mock": False}
    d = bench.to_dict()
    if d["solved"] and not d["replay_valid"]:
        return {"status": "invalid_path", "algorithm": algo, "mock": False,
                "message": "solver báo solved nhưng path không tới goal khi chạy lại", "result": d}
    return {"status": "solved" if d["solved"] else "unsolved", "algorithm": algo,
            "mock": False, "result": d}


@router.post("/solve/mock-demo")
def mock_demo(req: SolveRequest):
    """MOCK: trả lời giải tham chiếu ghi trong file map (do test oracle kiểm chứng).
    KHÔNG phải kết quả thuật toán; không có metric."""
    board = get_board(req.map_id)
    sol = board.meta.get("reference_solution")
    if not sol:
        return {"status": "no_reference", "mock": True}
    return {"status": "mock", "mock": True, "path": sol,
            "label": "MOCK DEMO — lời giải tham chiếu từ map, không phải kết quả của thuật toán nào"}
