"""Solver ASTAR — PLACEHOLDER chờ Member 4 cài đặt.

Chỉ sửa file này (và test riêng tests/test_solver_astar.py). Đọc SOLVER_CONTRACT.md trước.
Dùng: game.initial_state(), game.is_goal(s), game.neighbors(s) -> [(action, next_state, cost)].
Hàm phải trả SolverResult với algorithm="ASTAR". Khi cài xong, xóa dòng raise bên dưới.
"""
from __future__ import annotations

from dataclasses import dataclass
from itertools import count # counter used as a tie-breaker in heap entries
from heapq import heappop, heappush # min heap
from typing import Callable , Hashable , Iterable


from ..core.engine import Game
from ..core.state import GameState
from ..core.board import FLOOR_TILES
from ..core.transitions import get_occupied_cells , roll
from .contract import SolverNotImplemented, SolverResult , failure
from ..core.state import DIRECTIONS, BlockState, GameState, Orientation

ALGORITHM = "ASTAR"
INF = float("inf")

Heuristic = Callable[[GameState] , float] # a function : state -> estimated remaining cost

def zero(_state) -> float:
    # Heuristic that knows nothing : A* become Dijkstra / UCS
    return 0.0

def never(_state) -> bool:
    # Goal test that always fails: the search run util nothing is left to explore
    return False

@dataclass
class Run:
    # Everything a best-first search leaves behind
    dist : dict # state -> cheapest known cost from the start
    parent : dict # state -> (previous state , action) or None for the start
    goal : Hashable | None = None # the goal state that was reach if any
    expanded : int = 0 # states whose successors were generated
    generated : int = 0 # successors generated in total
    max_heap_size : int = 1 # biggest heap size seen
    
    
def best_first(start : Hashable , successors : Callable[[Hashable] , Iterable[tuple]] , 
               h : Callable = zero , is_goal : Callable = never) -> Run:
    """
        Always expand the state with the smallest f = g + h
        
        successors(state) -> (action , next_state , cost) 
        h = zero  -> Dijkstra / UCS
        is_goal = never -> run until nothing is left to explore
    """
    
    run = Run(dist = {start : 0.0} , parent = {start : None})
    order = count()
    heap = [(h(start) , next(order) , 0.0 , start)]
    
    while heap:
        _, _ , cost , state = heappop(heap)
        if cost > run.dist[state]: continue
        
        if is_goal(state):
            run.goal = state
            return run
        
        edges = list(successors(state))
        run.expanded += 1
        run.generated += len(edges)
        
        for action , next_state , w in edges:
            new_cost = cost + w
            new_heuristic = h(next_state)

            if new_heuristic < INF and new_cost < run.dist.get(next_state , INF):
                run.dist[next_state] = new_cost
                run.parent[next_state] = (state , action)
                heappush(heap , (new_cost + new_heuristic , next(order) , new_cost , next_state))
            
        run.max_heap_size = max(run.max_heap_size , len(heap))
    return run
        

def prepare_heuristic(game : Game) -> Heuristic:
    """
    Build h(state) : the shortest distance from `state` to the goal in the BASIC game

    BASIC: ignore fragile tiles, treat every bridges as open, ignore switches.
    
    Why is true: the BASIC game has more moves than the real one so its shortest distance is never longer than the real one.

    The table is build once per call by running Dijkstra's algorithm from the goal to all reachable states.
    """
    
    board = game.board
    if board.splitters : return zero # if there are splitters, the BASIC game is not well defined
    
    def has_floor(b : BlockState) -> bool:
        # every covered cell must be on the board and not a void
        for r , c in get_occupied_cells(b):
            if board.in_bounds(r , c) == False : return False
            if board.grid[r][c] not in FLOOR_TILES and board.bridge_at(r , c) is None : return False
        return True
    
    def moves(block : BlockState):
        # Rolling is reversible, so exploring FROM the goal gives the cost to the goal
        for action in DIRECTIONS:
            next_block = roll(block , action)

            if has_floor(next_block):
                yield action , next_block , game.cost_model.cost(GameState(next_block) , action)
                
    goal = BlockState(*board.goal , Orientation.STANDING)
    
    dist = best_first(goal , moves).dist
    
    return lambda state : 0.0 if state.split is not None else dist.get(state.block , INF)


def path_to(run : Run) -> list[str]:
    # Follow parent links from a goal back to the start
    path , state = [] , run.goal
    while run.parent[state] is not None:
        state , action = run.parent[state]
        path.append(action.value)
        
    return path[::-1] # reverse


def search(game : Game , initial_state : GameState , h : Heuristic) -> SolverResult:
    """
    Run A* search from `initial_state` to a goal state, using heuristic `h`.
    Return a SolverResult.
    """
    
    run = best_first(initial_state , game.neighbors , h , game.is_goal)
    
    if run.goal is None:
        result = failure(ALGORITHM , run.expanded , run.generated , note = "Empty heap : no solution")
        result.max_frontier_size = run.max_heap_size
        return result
    
    path = path_to(run)
    
    return SolverResult(algorithm = ALGORITHM , solved = True , path = path , expanded_nodes = run.expanded ,
                        generated_nodes = run.generated , solution_length = len(path) , 
                        solution_cost = run.dist[run.goal] , max_frontier_size = run.max_heap_size)
    
    
def solve(game : Game , initial_state : GameState) -> SolverResult:
    return search(game , initial_state , prepare_heuristic(game))