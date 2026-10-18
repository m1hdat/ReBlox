"""API công khai của Game Core. Teammate chỉ cần dùng file này (qua class Game)."""
from __future__ import annotations

from dataclasses import dataclass

from .board import Board
from .rules import CostModel, apply_switches, apply_cell_switches, is_goal as _is_goal, is_valid as _is_valid
from .state import DIRECTIONS, Action, GameState, BlockState, SplitState, Orientation
from .transitions import get_occupied_cells as _occ, roll


def get_initial_state(board: Board) -> GameState:
    from .state import BlockState, Orientation
    st = GameState(BlockState(board.start[0], board.start[1], Orientation.STANDING),
                   board.initial_open_bridges)
    return st


def get_occupied_cells(state: GameState):
    return state.split.cubes if state.split is not None else _occ(state.block)


def is_valid(board: Board, state: GameState) -> bool:
    return _is_valid(board, state)


def is_goal(board: Board, state: GameState) -> bool:
    return _is_goal(board, state)


@dataclass(frozen=True)
class StepResult:
    """Kết quả chi tiết (dùng cho API/frontend: cần biết VÌ SAO nước đi hỏng)."""
    valid: bool
    state: GameState          # state mới nếu valid; ngược lại là state cũ
    reason: str               # "ok" | "fell" | "unsupported_action" | "already_goal"
    reached_goal: bool = False
    attempted_block: object = None   # vị trí đã định đặt (để animate rơi)


def _merge(state: GameState) -> GameState:
    if state.split is None:
        return state
    (r1, c1), (r2, c2) = state.split.cubes
    if abs(r1-r2) + abs(c1-c2) != 1:
        return state
    orientation = Orientation.HORIZONTAL if r1 == r2 else Orientation.VERTICAL
    return GameState(BlockState(min(r1, r2), min(c1, c2), orientation), state.open_bridges)


def step(board: Board, state: GameState, action: Action) -> StepResult:
    if _is_goal(board, state):
        return StepResult(False, state, "already_goal")
    if action is Action.SWITCH_CUBE:
        if state.split is None:
            return StepResult(False, state, "unsupported_action")
        sp = state.split
        return StepResult(True, GameState(state.block, state.open_bridges, SplitState(sp.cubes, 1-sp.active)), "ok")
    if action not in DIRECTIONS:
        return StepResult(False, state, "unsupported_action")
    if state.split is not None:
        sp = state.split
        dr, dc = {Action.UP: (-1, 0), Action.DOWN: (1, 0), Action.LEFT: (0, -1), Action.RIGHT: (0, 1)}[action]
        r, c = sp.cubes[sp.active]
        target = (r+dr, c+dc)
        if target == sp.cubes[1-sp.active]:
            return StepResult(False, state, "occupied_cube")
        cells = list(sp.cubes); cells[sp.active] = target
        candidate = GameState(state.block, state.open_bridges, SplitState(tuple(cells), sp.active))
        if not _is_valid(board, candidate):
            return StepResult(False, state, "fell")
        bridges = apply_cell_switches(board, (target,), state.open_bridges)
        candidate = _merge(GameState(state.block, bridges, candidate.split))
        if not _is_valid(board, candidate):
            return StepResult(False, state, "fell")
        return StepResult(True, candidate, "ok", _is_goal(board, candidate))
    moved = roll(state.block, action)
    tentative = GameState(moved, state.open_bridges)
    if not _is_valid(board, tentative):                      # bước 2
        return StepResult(False, state, "fell", attempted_block=moved)
    new_bridges = apply_switches(board, moved, state.open_bridges)   # bước 3
    new_state = GameState(moved, new_bridges)
    if moved.orientation is Orientation.STANDING:
        splitter = next((s for s in board.splitters if s.pos == (moved.row, moved.col)), None)
        if splitter is not None:
            new_state = GameState(moved, new_bridges, SplitState(splitter.destinations))
            if not _is_valid(board, new_state):
                return StepResult(False, state, "fell", attempted_block=moved)
            landed = apply_cell_switches(board, splitter.destinations, new_bridges)
            new_state = _merge(GameState(moved, landed, new_state.split))
    if not _is_valid(board, new_state):                      # bước 4
        return StepResult(False, state, "fell", attempted_block=moved)
    return StepResult(True, new_state, "ok", _is_goal(board, new_state), moved)


def apply_action(board: Board, state: GameState, action: Action) -> GameState | None:
    """HỢP ĐỒNG: trả về state mới, hoặc None nếu nước đi bất hợp lệ. KHÔNG raise exception."""
    r = step(board, state, action)
    return r.state if r.valid else None


def get_neighbors(board: Board, state: GameState) -> list[tuple[Action, GameState]]:
    """Các (action, state_kế) hợp lệ, theo thứ tự cố định UP, DOWN, LEFT, RIGHT."""
    out = []
    for a in (*DIRECTIONS, Action.SWITCH_CUBE) if state.split is not None else DIRECTIONS:
        nxt = apply_action(board, state, a)
        if nxt is not None:
            out.append((a, nxt))
    return out


class Game:
    """Facade đưa cho solver: `solve(game, initial_state)`."""

    def __init__(self, board: Board, cost_model: CostModel | None = None):
        self.board = board
        self.cost_model = cost_model or CostModel("uniform")

    def initial_state(self) -> GameState:
        return get_initial_state(self.board)

    def is_goal(self, state: GameState) -> bool:
        return _is_goal(self.board, state)

    def neighbors(self, state: GameState) -> list[tuple[Action, GameState, float]]:
        """[(action, next_state, step_cost)] — thứ tự UP, DOWN, LEFT, RIGHT."""
        return [(a, n, self.cost_model.cost(state, a)) for a, n in get_neighbors(self.board, state)]

    def apply(self, state: GameState, action: Action) -> GameState | None:
        return apply_action(self.board, state, action)

    def replay(self, actions: list[str]) -> tuple[bool, GameState, int]:
        """Chạy lại path từ trạng thái đầu: (hợp lệ & kết thúc ở goal?, state cuối, số bước hợp lệ đã chạy)."""
        st = self.initial_state()
        n = 0
        for name in actions:
            try:
                a = Action(name)
            except ValueError:
                return False, st, n
            nxt = self.apply(st, a)
            if nxt is None:
                return False, st, n
            st, n = nxt, n + 1
        return self.is_goal(st), st, n

    def path_cost(self, actions: list[str]) -> float:
        st, total = self.initial_state(), 0.0
        for name in actions:
            a = Action(name)
            total += self.cost_model.cost(st, a)
            st = self.apply(st, a)
        return total
