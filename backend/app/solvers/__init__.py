"""Registry solver. API gọi qua đây nên teammate KHÔNG cần sửa API."""
from . import astar, bfs, dfs, ucs

SOLVERS = {"BFS": bfs.solve, "DFS": dfs.solve, "UCS": ucs.solve, "ASTAR": astar.solve}
