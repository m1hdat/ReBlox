from app.core import Board


def make_board(grid, start, goal=None, switches=(), bridges=(), id="t"):
    """Tạo Board nhanh cho test. Nếu grid chưa có 'G', cần truyền goal có sẵn trong grid."""
    rows, cols = len(grid), len(grid[0])
    if goal is None:
        for r, line in enumerate(grid):
            if "G" in line:
                goal = (r, line.index("G"))
    return Board.from_dict({"id": id, "name": id, "rows": rows, "cols": cols, "grid": list(grid),
                            "start": list(start), "goal": list(goal),
                            "switches": list(switches), "bridges": list(bridges)})


def big_floor(n=10, goal=(5, 5)):
    g = [["#"] * n for _ in range(n)]
    g[goal[0]][goal[1]] = "G"
    return ["".join(r) for r in g]
