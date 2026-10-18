"""Endpoint chơi game: danh sách map, state ban đầu, bước đi, kiểm tra path."""
from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..core import Action, Board, Game, GameState, MapError, get_initial_state, maps_dir, step

router = APIRouter(prefix="/api", tags=["game"])


def _load_all() -> dict[str, Board]:
    boards: dict[str, Board] = {}
    for p in sorted(maps_dir().glob("*.json")):
        with open(p, encoding="utf-8") as f:
            data = json.load(f)
        try:
            boards[data["id"]] = Board.from_dict(data, allow_pending=True)
        except MapError as e:
            print(f"[WARN] bỏ qua map {p.name}: {e}")
    return boards


def get_board(map_id: str) -> Board:
    boards = _load_all()   # nạp lại mỗi lần: sửa JSON không cần restart server
    if map_id not in boards:
        raise HTTPException(404, f"không có map '{map_id}'")
    return boards[map_id]


class StepRequest(BaseModel):
    map_id: str
    state: dict
    action: str


class PathRequest(BaseModel):
    map_id: str
    path: list[str]


class MapRequest(BaseModel):
    map_id: str


@router.get("/health")
def health():
    return {"ok": True}


@router.get("/maps")
def list_maps():
    return [{"id": b.id, "name": b.name, "playable": b.is_playable,
             "status": b.meta.get("status", "playable"),
             "difficulty": b.meta.get("difficulty"),
             "pending_reason": b.meta.get("pending_reason")} for b in _load_all().values()]


@router.get("/maps/{map_id}")
def get_map(map_id: str):
    return get_board(map_id).to_dict()


@router.post("/game/initial")
def initial(req: MapRequest):
    return {"state": get_initial_state(get_board(req.map_id)).to_dict()}


@router.post("/game/step")
def game_step(req: StepRequest):
    b = get_board(req.map_id)
    if not b.is_playable:
        raise HTTPException(400, "map chưa playable (pending)")
    try:
        action = Action(req.action)
        st = GameState.from_dict(req.state)
    except (ValueError, KeyError, TypeError, IndexError) as e:
        raise HTTPException(422, f"dữ liệu không hợp lệ: {e}")
    r = step(b, st, action)
    att = r.attempted_block
    return {"valid": r.valid, "reason": r.reason, "reached_goal": r.reached_goal,
            "state": r.state.to_dict(),
            "attempted": None if att is None else {"row": att.row, "col": att.col,
                                                    "orientation": att.orientation.value}}


@router.post("/game/validate-path")
def validate_path(req: PathRequest):
    """Chạy lại path bằng luật chơi thật. Frontend CHỈ replay path đã qua bước này."""
    g = Game(get_board(req.map_id))
    ok, final, n = g.replay(req.path)
    return {"valid": ok, "steps_executed": n, "final_state": final.to_dict(),
            "reason": "ok" if ok else ("empty_path" if not req.path else "path_invalid_or_not_goal")}
