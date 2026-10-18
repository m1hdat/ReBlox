"""Hợp đồng solver dùng chung. KHÔNG sửa nếu chưa thống nhất cả nhóm (Member 5 sở hữu)."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class SolverResult:
    algorithm: str                 # "BFS" | "DFS" | "UCS" | "ASTAR"
    solved: bool
    path: list[str]                # tên Action: "UP"/"DOWN"/"LEFT"/"RIGHT"; [] nếu không giải được
    expanded_nodes: int            # số state được lấy khỏi frontier VÀ sinh successor
    generated_nodes: int           # số state successor được sinh ra
    solution_length: int | None    # len(path) nếu solved, ngược lại None
    solution_cost: float | None    # tổng chi phí theo game.cost_model nếu solved, ngược lại None
    max_frontier_size: int | None = None   # tùy chọn
    note: str = ""                 # ghi chú (vd "frontier rỗng: vô nghiệm")

    def to_dict(self) -> dict:
        return self.__dict__.copy()


class SolverNotImplemented(NotImplementedError):
    """Solver còn là placeholder; API trả 'not_implemented' thay vì giả vờ giải."""


def failure(algorithm: str, expanded: int, generated: int, note: str = "") -> SolverResult:
    """Helper tạo kết quả 'không tìm thấy nghiệm'."""
    return SolverResult(algorithm, False, [], expanded, generated, None, None, None, note)
