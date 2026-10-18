# Hướng dẫn cài thuật toán (BFS / DFS / UCS / A\*)

Tài liệu dành cho 4 bạn cài thuật toán: sửa file nào, tuân theo quy ước nào, luật game cần biết.

## 1. Ai sửa file nào

| Thành viên | Nhánh | File được sửa |
|---|---|---|
| Member 1 | `solver/bfs` | `backend/app/solvers/bfs.py` |
| Member 2 | `solver/dfs` | `backend/app/solvers/dfs.py` |
| Member 3 | `solver/ucs` | `backend/app/solvers/ucs.py` |
| Member 4 | `solver/astar` | `backend/app/solvers/astar.py` (heuristic đặt trong chính file này) |

- Mỗi người **chỉ sửa 1 file** của mình. API và web tự nhận solver mới, không cần sửa gì khác.
- **Không sửa** `backend/app/core/`, `backend/app/solvers/contract.py`, `backend/app/api/`, `maps/`. Cần thay đổi phần này thì nhắn Member 5 trước.
- Được thêm file test mới (ví dụ `backend/tests/test_bfs.py`), không sửa test có sẵn.
- **Không** dùng thư viện bên thứ ba để cài thuật toán.

## 2. Quy trình làm việc

- Mỗi người làm trên nhánh riêng ở bảng trên. **Không push thẳng vào `main`.**
- Mỗi Pull Request: 1 mục đích, mô tả ngắn, và `python scripts/run_tests.py` phải xanh.
- Không commit `node_modules`, `.venv`, `dist`, `__pycache__`.
- Không bịa số liệu benchmark hay "kết quả test".
- Comment giải thích *vì sao*, không lặp lại *cái gì*. Tên biến/hàm bằng tiếng Anh, tài liệu bằng tiếng Việt.

Cách chạy thử: bật backend (`uvicorn app.main:app --reload --port 8000`) và frontend (`npm run dev`), vào **Sổ kỹ thuật** để chạy solver trên từng map và xem replay. Cài đặt chi tiết xem [README.md](README.md).

## 3. Hàm cần cài

```python
def solve(game: Game, initial_state: GameState) -> SolverResult
```

Đặt trong `backend/app/solvers/<tên>.py`.

### Giao diện `Game` (chỉ dùng những thứ này)

| Gọi | Ý nghĩa |
|---|---|
| `game.initial_state()` | State đầu |
| `game.is_goal(s)` | Kiểm tra đích |
| `game.neighbors(s)` | `[(action, next_state, step_cost), ...]`, chỉ gồm nước hợp lệ, thứ tự cố định **UP, DOWN, LEFT, RIGHT** |
| `game.cost_model.min_cost` | Chi phí tối thiểu 1 cạnh (dùng cho heuristic) |

`action` là `Action` enum. Trong `path` ghi **tên chuỗi** (`action.value`): `"UP" "DOWN" "LEFT" "RIGHT"`. Hành động `"SWITCH_CUBE"` dành cho split (chưa cài), solver hiện tại **không** cần xử lý.

### State

`GameState` đã hashable, dùng thẳng làm key của `set`/`dict`. Hai state bằng nhau ⇔ cùng vị trí khối **và** cùng tập cầu mở. **Đừng** dùng riêng `(row, col, orientation)` làm khóa, sẽ sai với map có cầu.

### Kết quả trả về: `SolverResult`

Các trường: `algorithm, solved, path, expanded_nodes, generated_nodes, solution_length, solution_cost` (tùy chọn thêm `max_frontier_size`, `note`).

Không giải được → `solved=False, path=[], solution_length=None, solution_cost=None` (dùng hàm `failure(...)` trong `contract.py`). Không raise exception cho trường hợp vô nghiệm, chỉ raise cho lỗi lập trình.

## 4. Những điều đã thống nhất

### Cách đếm số liệu

- **expanded**: state bị lấy khỏi frontier **và** gọi `neighbors` để sinh successor. Đếm 1 lần mỗi lần mở (không đếm state bị bỏ vì đã thăm).
- **generated**: tổng số successor nhận từ `neighbors`, đếm **trước** khi lọc trùng.
- `solution_cost` = tổng `step_cost` dọc `path`; `solution_length = len(path)`.
- Thời gian và bộ nhớ **không** đo trong solver, do `benchmarking/metrics.py` đo.

### Trạng thái lặp

Dùng graph search với tập `visited`/`explored`. UCS và A\*: cho phép cập nhật nếu tìm được `g` nhỏ hơn.

### Tie-breaking (để kết quả lặp lại được)

- Duyệt successor theo đúng thứ tự `game.neighbors` (UP, DOWN, LEFT, RIGHT).
- Hàng đợi ưu tiên: khóa là `(f hoặc g, thứ tự sinh tăng dần)`.
- DFS dùng stack: đẩy successor theo thứ tự **ngược** để UP được mở trước, và ghi rõ lựa chọn trong docstring.

### Chi phí và tính tối ưu

Chỉ so sánh tối ưu chi phí khi **cùng cost model**.

| Thuật toán | Tính tối ưu |
|---|---|
| BFS | Tối ưu theo **số nước**; tối ưu theo chi phí chỉ khi cost model là `uniform` |
| DFS | Không đảm bảo tối ưu |
| UCS | Tối ưu theo chi phí với mọi cost model không âm |
| A\* | Tối ưu nếu heuristic admissible (với graph search cần thêm consistent) |

Cost model: `uniform` (mỗi nước = 1, mặc định, dùng để so sánh) và `orientation_weighted` (nước bắt đầu từ STANDING tốn 2, còn lại 1, dùng cho thí nghiệm UCS). Mọi chi phí ≥ 1.

### Heuristic cho A\*

Chữ ký gợi ý: `def h(game, state) -> float`. Yêu cầu:

- **Admissible**: `h(s) ≤ chi phí thật còn lại`.
- **Consistent**: `h(s) ≤ cost(s, a, s') + h(s')`.

Cả hai cost model đều có `min_cost = 1`, nên `h = (số nước tối thiểu ước lượng) × min_cost` có thể vẫn admissible, nhưng **phải tự chứng minh hoặc kiểm thử**. Ví dụ an toàn: `h = 0` (suy biến thành UCS). Khoảng cách Manhattan **chia cho 2** (mỗi nước lăn dịch tối đa 2 ô) là ứng viên, nhưng với cầu/công tắc cần cẩn thận. Gợi ý kiểm thử: trên cùng map và cost model, A\* và UCS phải cho cùng `solution_cost`.

## 5. Luật game (bản cài đặt hiện tại)

### Khối

Kích thước 1×1×2. `BlockState(row, col, orientation)`, trong đó `(row, col)` là **ô trên-trái** mà khối chiếm.

- STANDING: `(r,c)`
- HORIZONTAL: `(r,c)`, `(r,c+1)`
- VERTICAL: `(r,c)`, `(r+1,c)`

Trục: `row` tăng = xuống, `col` tăng = sang phải.

### Ký hiệu ô trong `grid`

| Ký hiệu | Ý nghĩa |
|---|---|
| `.` | Void (không có sàn) |
| `#` | Sàn |
| `F` | Ô dễ vỡ |
| `G` | Ô đích |
| `s` | Soft switch |
| `h` | Heavy switch |
| `X` | Split switch (**chưa cài**) |

Ô cầu được ghi `.` trong `grid` và liệt kê trong `bridges`; ô cầu có sàn **chỉ khi cầu đang mở**.

### Hợp lệ (`is_valid`)

1. Mọi ô khối chiếm phải nằm trong biên và có sàn (ô sàn hoặc cầu đang mở).
2. Đứng thẳng (STANDING) trên `F` → **vỡ, bất hợp lệ**. Nằm trên `F` thì được.

### Thắng (`is_goal`)

STANDING đúng ô `G`. Nằm ngang/dọc qua `G` **không** thắng. Đến goal rồi, mọi nước tiếp theo bị từ chối (`already_goal`).

### Công tắc

- **soft**: kích hoạt khi **bất kỳ** ô khối chiếm trùng công tắc. **heavy**: chỉ khi STANDING.
- Mỗi **nước đi** mà vị trí đáp trùng công tắc → kích hoạt **một lần**.
- `effect`: `toggle` (đảo mỗi lần), `open` (mở, không tự đóng), `close` (đóng). "Cầu vĩnh viễn" = effect `open`.

### Thứ tự xử lý một nước đi

1. `roll` → vị trí mới (hình học).
2. Kiểm tra hợp lệ bằng cấu hình cầu **hiện tại**; sai ⇒ "fell".
3. Kích hoạt công tắc dưới khối ⇒ cấu hình cầu mới.
4. Kiểm tra hợp lệ lại bằng cấu hình cầu **mới** (cầu đóng ngay dưới khối ⇒ "fell").

> Quy ước bước 4 là lựa chọn thiết kế hiện tại, cần đối chiếu lại với đề bài.

### Giá trị trả về của nước đi

`apply_action(board, state, action)` trả về **state mới** hoặc **`None`** nếu bất hợp lệ, **không bao giờ raise exception** cho nước đi sai. `step()` cho thêm lý do: `ok | fell | unsupported_action | already_goal`.

### Chưa cài

Split switch, tách thành 2 khối nhỏ, hành động `SWITCH_CUBE`, di chuyển từng khối, gộp lại. Map có `X` bị `UnsupportedMechanic` (trừ khi `allow_pending=True`), và API từ chối chơi/giải map `pending`.
