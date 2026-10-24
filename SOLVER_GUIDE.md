# Hướng dẫn phát triển solver

Tài liệu triển khai **BFS, DFS, UCS và A\*** cho ReBlox, từ hợp đồng dữ liệu đến kiểm thử và tích hợp. Đọc [README](README.md) trước để thiết lập môi trường.

> **Trạng thái hiện tại:** đã merge BFS, DFS, UCS và A* từ bốn nhánh của nhóm. Có test riêng từng solver và kiểm tra API cả bốn thuật toán trên 11 map playable với hai cost model.

## Mục lục

1. [Phạm vi và quy trình làm việc](#1-phạm-vi-và-quy-trình-làm-việc)
2. [Mô hình bài toán và giao diện core](#2-mô-hình-bài-toán-và-giao-diện-core)
3. [Hợp đồng đầu vào và kết quả](#3-hợp-đồng-đầu-vào-và-kết-quả)
4. [Quy ước tìm kiếm và metric](#4-quy-ước-tìm-kiếm-và-metric)
5. [Hướng triển khai từng thuật toán](#5-hướng-triển-khai-từng-thuật-toán)
6. [Heuristic A* có chứng minh](#6-heuristic-a-có-chứng-minh)
7. [Luật game ảnh hưởng đến tìm kiếm](#7-luật-game-ảnh-hưởng-đến-tìm-kiếm)
8. [Kiểm thử và chạy thử](#8-kiểm-thử-và-chạy-thử)
9. [API, benchmark và chẩn đoán](#9-api-benchmark-và-chẩn-đoán)
10. [Tiêu chí hoàn thành Pull Request](#10-tiêu-chí-hoàn-thành-pull-request)

## 1. Phạm vi và quy trình làm việc

| Phân công | Nhánh đề xuất | File thuật toán | File test mới |
|---|---|---|---|
| BFS | `solver/bfs` | `backend/app/solvers/bfs.py` | `backend/tests/test_solver_bfs.py` |
| DFS | `solver/dfs` | `backend/app/solvers/dfs.py` | `backend/tests/test_solver_dfs.py` |
| UCS | `solver/ucs` | `backend/app/solvers/ucs.py` | `backend/tests/test_solver_ucs.py` |
| A\* | `solver/astar` | `backend/app/solvers/astar.py` | `backend/tests/test_solver_astar.py` |

- Mỗi người chỉnh file thuật toán của mình và thêm test riêng. Heuristic A\* đặt trong `astar.py`.
- Giữ nguyên chữ ký `solve()` và định dạng `SolverResult`; registry hiện tự nối từng module với API.
- Không sửa core, API, benchmark wrapper, contract, map hoặc test có sẵn nếu chưa thống nhất với người phụ trách tích hợp.
- Dùng thư viện chuẩn Python như `collections`, `heapq`, `itertools`; không dùng thư viện tìm kiếm bên thứ ba.
- Làm trên nhánh riêng, gửi Pull Request; không push trực tiếp vào `main`. Kiểm tra `git diff` để tránh đưa file của người khác vào PR.

Các docstring cũ còn nhắc `SOLVER_CONTRACT.md`; hợp đồng và hướng dẫn hiện được trình bày tại **chính tài liệu này** cùng [contract.py](backend/app/solvers/contract.py).

## 2. Mô hình bài toán và giao diện core

Không gian tìm kiếm là đồ thị: **node = `GameState`**, **cạnh = một action hợp lệ (lăn, di chuyển cube hoặc đổi cube)**, **trọng số = `step_cost`**. Mục tiêu là tìm path từ trạng thái được truyền vào đến trạng thái đứng tại đích.

### Các thành phần nên đọc

| File | Nội dung cần nắm |
|---|---|
| [engine.py](backend/app/core/engine.py) | `Game`, `neighbors`, `apply`, `replay`, `path_cost` |
| [state.py](backend/app/core/state.py) | `GameState`, `BlockState`, `Orientation`, `Action` |
| [rules.py](backend/app/core/rules.py) | Công tắc, tính hợp lệ và hai cost model |
| [contract.py](backend/app/solvers/contract.py) | `SolverResult`, `failure`, `SolverNotImplemented` |
| [metrics.py](backend/app/benchmarking/metrics.py) | Cách gọi solver, đo đạc và replay |

### Giao diện dành cho solver

```python
from ..core.engine import Game
from ..core.state import GameState
from .contract import SolverResult, failure

ALGORITHM = "BFS"  # DFS / UCS / ASTAR tùy module

def solve(game: Game, initial_state: GameState) -> SolverResult:
    ...
```

| Giao diện | Ý nghĩa |
|---|---|
| `game.is_goal(state)` | Trạng thái đã đứng đúng ô đích hay chưa |
| `game.neighbors(state)` | Danh sách `(action, next_state, step_cost)` hợp lệ |
| `game.cost_model.min_cost` | Cận dưới chi phí mỗi cạnh, hiện là `1.0` |
| `game.board.goal` | Tọa độ đích `(row, col)`, dùng khi tính heuristic |
| `game.initial_state()` | Trạng thái khởi đầu của bản đồ |

**Tìm kiếm từ đối số `initial_state`**, không tự thay bằng `game.initial_state()`. API hiện truyền trạng thái đầu bản đồ, nhưng hàm solver vẫn phải làm đúng khi nhận một trạng thái hợp lệ khác.

`game.neighbors()` trả các hành động theo thứ tự cố định **UP → DOWN → LEFT → RIGHT**, thêm **SWITCH_CUBE** ở cuối khi đang tách, bỏ qua nước không hợp lệ. Solver không cần tự tính phép lăn, kiểm tra sàn hay kích hoạt công tắc.

### Khóa trạng thái phải đầy đủ

`GameState` là frozen dataclass và hashable; dùng trực tiếp làm key:

```python
visited: set[GameState] = {initial_state}
g_score: dict[GameState, float] = {initial_state: 0.0}
parent: dict[GameState, tuple[GameState, str] | None] = {initial_state: None}
```

State chứa `block`, `open_bridges` và trường `split` chứa hai vị trí cube và chỉ số cube đang điều khiển khi đã tách. Hai trạng thái có cùng vị trí/tư thế nhưng khác cầu mở **là hai node khác nhau**. Dùng riêng `(row, col, orientation)` sẽ làm mất đường đi hợp lệ trên map có công tắc.

Không chỉnh sửa `game.board`, trạng thái hay dữ liệu map trong quá trình tìm kiếm.

## 3. Hợp đồng đầu vào và kết quả

Hàm luôn trả một `SolverResult` khi tìm thấy hoặc không tìm thấy nghiệm. Sau khi cài xong, bỏ dòng raise `SolverNotImplemented`; không thay nó bằng lời giải tham chiếu.

| Trường | Quy ước |
|---|---|
| `algorithm` | Chính xác `"BFS"`, `"DFS"`, `"UCS"` hoặc `"ASTAR"` |
| `solved` | `True` khi đã tìm thấy path đến đích |
| `path` | `list[str]`, mỗi phần tử là `action.value`: `"UP"`, `"DOWN"`, `"LEFT"`, `"RIGHT"`, `"SWITCH_CUBE"` |
| `expanded_nodes` | Số lần lấy một entry hợp lệ khỏi frontier và gọi `neighbors()` |
| `generated_nodes` | Tổng successor được trả về từ `neighbors()`, trước lọc trùng |
| `solution_length` | `len(path)` khi solved; `None` khi không có nghiệm |
| `solution_cost` | Tổng chi phí các cạnh trong path; `None` khi không có nghiệm |
| `max_frontier_size` | Tùy chọn: số entry lớn nhất cùng nằm trong queue/stack/heap; để `None` nếu chưa đo |
| `note` | Ghi chú ngắn, mặc định `""` |

Tạo kết quả thành công bằng keyword để tránh nhầm vị trí các trường:

```python
return SolverResult(
    algorithm=ALGORITHM,
    solved=True,
    path=path,
    expanded_nodes=expanded,
    generated_nodes=generated,
    solution_length=len(path),
    solution_cost=g_score[goal_state],  # hoặc tổng cost đã lưu dọc nhánh
    max_frontier_size=max_frontier,
)
```

Khi frontier đã cạn mà chưa có đích:

```python
return failure(ALGORITHM, expanded, generated, note="Frontier rỗng: không có nghiệm")
```

`failure()` đặt `max_frontier_size=None`. Nếu cần giữ metric này khi thất bại, tạo `SolverResult` bằng keyword hoặc gán vào kết quả helper trước khi trả.

Nếu `initial_state` đã là đích: trả `solved=True`, `path=[]`, `solution_length=0`, `solution_cost=0.0`, `expanded_nodes=0`, `generated_nodes=0`. Path rỗng không tự động có nghĩa là thất bại.

Trường hợp vô nghiệm là kết quả bình thường, không raise exception. Nếu chủ động áp giới hạn tài nguyên, ghi rõ lý do dừng trong `note`; dừng vì giới hạn **không chứng minh** map vô nghiệm. Contract hiện chưa có status riêng cho trường hợp này.

## 4. Quy ước tìm kiếm và metric

### Thứ tự xử lý một entry

```text
Lấy entry khỏi frontier
  → Bỏ entry trùng/đã lỗi thời nếu có
  → Kiểm tra goal; nếu đúng, dựng path và trả kết quả
  → Gọi neighbors đúng một lần; expanded += 1
  → generated += len(neighbors)
  → Lọc hoặc relax successor rồi đưa vào frontier
```

- Goal được kiểm tra trước khi mở rộng nên **node đích không tăng `expanded_nodes`**.
- `generated_nodes` gồm cả successor đã gặp, không chỉ node được thêm vào frontier; không tính trạng thái đầu như một successor.
- UCS/A\* có thể mở lại một state nếu tìm thấy `g` tốt hơn. Mỗi lần thực sự gọi `neighbors()` đều được tính vào expanded.
- Không đếm entry heap lỗi thời bị bỏ qua. Không gọi lại `neighbors()` chỉ để đếm metric.
- Nếu đo frontier, tính cả các entry lỗi thời còn trong heap; với frontier ban đầu chứa một state, kích thước ban đầu là 1.

### Tính xác định và dựng path

Giữ thứ tự successor của core. Với heap, dùng counter tăng dần để phân xử cùng độ ưu tiên:

```python
from heapq import heappush
from itertools import count

order = count()
heappush(frontier, (priority, next(order), g, state))
```

Counter duy nhất giúp heap không phải so sánh `GameState` khi priority bằng nhau. Với DFS dùng stack, duyệt danh sách successor theo thứ tự đảo để UP được lấy ra trước; ghi rõ quy ước trong docstring.

Lưu `parent[next_state] = (state, action.value)` khi nhận node mới hoặc khi cập nhật `g` tốt hơn. Khi đến đích, lần ngược về `initial_state`, thu hành động rồi đảo danh sách. Không cần sao chép cả path cho từng node.

### Hai mô hình chi phí

| Cost model | Chi phí một nước đi |
|---|---|
| `uniform` | Luôn `1.0` |
| `orientation_weighted` | `2.0` nếu khối nguyên đứng trước nước lăn; di chuyển cube/đổi cube và các nước còn lại `1.0` |

Mô hình `orientation_weighted` là giả định thực nghiệm: lăn từ đứng sang nằm được gán chi phí gấp đôi các nước khác để phân biệt tối ưu số nước và tối ưu tổng cost; đây không phải mô phỏng năng lượng vật lý. Báo cáo cần công bố và giải thích giả định này.

Luôn dùng `step_cost` từ `neighbors()`. BFS/DFS cũng phải báo đúng chi phí khi chạy với `orientation_weighted`; không gán `solution_cost = len(path)` trong mọi trường hợp.

## 5. Hướng triển khai từng thuật toán

Các bước dưới đây mô tả nguyên tắc của bốn solver đã tích hợp trong repository.

### BFS — Breadth-First Search

1. Dùng `collections.deque`, lấy đầu bằng `popleft()` và thêm cuối bằng `append()`.
2. Đánh dấu đã thấy **khi đưa vào queue**, kể cả trạng thái đầu, để tránh enqueue trùng.
3. Lấy state ra, kiểm tra goal rồi mới mở rộng.
4. Với successor chưa thấy: lưu parent, chi phí tích lũy dọc nhánh và thêm vào queue.
5. Queue cạn thì trả thất bại.

BFS tìm lời giải ít nước nhất. Chỉ bảo đảm tối ưu chi phí khi mọi cạnh đồng giá, như `uniform`.

### DFS — Depth-First Search

1. Dùng list làm stack, lấy cuối bằng `pop()`; tránh đệ quy để không phụ thuộc giới hạn recursion của Python.
2. Dùng graph search với tập đã thấy để chặn chu trình. Có thể đánh dấu khi push; giữ parent của lần khám phá đầu tiên.
3. Sau khi kiểm tra goal và lấy successor, push theo thứ tự đảo **RIGHT → LEFT → DOWN → UP** đối với những hướng có trong danh sách.
4. Lưu chi phí tích lũy của nhánh được chọn, không dùng độ sâu thay cho cost trong mọi cost model.
5. Stack cạn thì trả thất bại.

DFS không bảo đảm đường đi ngắn nhất hoặc rẻ nhất. Đánh dấu khi push cũng có thể khiến đường đi khác DFS đệ quy; điều cần giữ là tính hợp lệ, quy ước đã công bố và kết quả lặp lại được.

### UCS — Uniform-Cost Search

1. Dùng min-heap với priority bằng `g`, khởi tạo `g_score[initial_state] = 0.0`.
2. Mỗi entry lưu cả `g` tại thời điểm push. Khi pop, bỏ entry nếu `g` không còn khớp `g_score[state]` tốt nhất.
3. Kiểm tra goal **khi pop entry tốt nhất**, không trả ngay khi vừa sinh ra goal.
4. Với mỗi cạnh, tính `new_g = g + step_cost`. Chỉ khi `new_g` nhỏ hơn giá trị đã biết mới cập nhật `g_score`, parent và push entry mới.
5. Không cần sửa entry cũ trong heap; cơ chế bỏ entry lỗi thời xử lý việc này.

Với chi phí hiện tại đều dương, UCS tối ưu tổng chi phí. Không dùng một visited-set khóa state ngay từ lúc push như BFS: một đường đến cùng state với cost thấp hơn có thể được tìm thấy sau.

### A* — A-Star Search

Giữ cơ chế `g_score`, parent, counter, bỏ entry lỗi thời và relax giống UCS; đổi priority thành **`f = g + h(state)`**.

- Dùng `h=0` để kiểm tra bản triển khai ban đầu có hành vi tương đương UCS.
- Sau đó thêm heuristic có giải thích và kiểm thử; một lựa chọn an toàn nằm ở mục 6.
- Dừng khi pop goal hợp lệ. Nếu heuristic chỉ admissible nhưng không consistent, cần cho phép **mở lại state** khi `g` tốt hơn; không khóa vĩnh viễn bằng closed-set.
- Với heuristic consistent, A\* graph search có thể đóng state sau khi pop tốt nhất mà vẫn giữ tối ưu. Dùng cơ chế relax/mở lại vẫn giúp triển khai rõ ràng.

| Thuật toán | Frontier | Bảo đảm trên đồ thị trạng thái hữu hạn hiện tại |
|---|---|---|
| BFS | FIFO queue | Đầy đủ, tối ưu số nước |
| DFS | LIFO stack + chặn lặp | Đầy đủ nếu không cắt giới hạn, không bảo đảm tối ưu |
| UCS | Heap theo `g` | Đầy đủ, tối ưu chi phí với cost hiện tại |
| A\* | Heap theo `g+h` | Tối ưu với heuristic admissible và xử lý mở lại phù hợp; consistent cho phép đóng state |

## 6. Heuristic A* có chứng minh

### Heuristic đang dùng trong astar.py

Trên map không có splitter, `prepare_heuristic()` chạy Dijkstra ngược từ goal để tạo bảng khoảng cách cho bài toán nới lỏng: giữ tư thế và phép lăn, bỏ hạn chế fragile, coi mọi cầu đều mở, bỏ tác động công tắc. Bảng được tạo lại trong mỗi lần gọi solve; benchmark tính cả chi phí chuẩn bị bảng.

Mỗi cạnh thật cũng có trong đồ thị nới lỏng, cùng chi phí, nên khoảng cách nới lỏng không vượt chi phí thật (admissible). Bất đẳng thức đường đi ngắn nhất cho `h(s) <= cost(s,s') + h(s')` chứng minh consistency. Dijkstra ngược tính chi phí cạnh từ trạng thái tiền nhiệm; hai chiều có thể khác cost với `orientation_weighted`. Block không tới được goal ngay cả trong đồ thị nới lỏng có h vô cực và có thể bỏ nhánh đó.

Trên toàn bộ map có splitter, h bằng 0: A* tương đương UCS, vẫn tối ưu nhưng không có lợi thế định hướng. Cơ chế relax cho phép mở lại state khi g tốt hơn. Test kiểm tra admissibility/consistency trên toàn bộ state tới được của bộ map với hai cost model và đối chiếu nghiệm bằng Dijkstra độc lập.

### Phương án Manhattan tham khảo

Khởi đầu bằng `h=0` là hợp lệ. Khi cần heuristic có thông tin, dùng khoảng cách Manhattan từ **ô neo trên-trái** của khối đến ô đích, chia 2:

```python
def heuristic(game: Game, state: GameState) -> float:
    if game.board.splitters or state.split is not None:
        return 0.0  # teleport phá vỡ cận dưới Manhattan; baseline an toàn cho map split
    goal_row, goal_col = game.board.goal
    block = state.block
    distance = abs(block.row - goal_row) + abs(block.col - goal_col)
    return (distance / 2.0) * game.cost_model.min_cost
```

Manhattan/2 chỉ áp dụng trên map không có teleport/split. Trên **toàn bộ state của map có splitter**, ví dụ dùng `h=0` để giữ admissible/consistent. Muốn cải thiện hiệu năng phải thiết kế cận dưới có tính cả các cạnh teleport; không chỉ trả 0 khi state đang split rồi dùng Manhattan khi đã gộp.

**Vì sao admissible?** Mỗi nước lăn chỉ thay đổi một tọa độ của ô neo, nhiều nhất 2 ô. Để giảm khoảng cách Manhattan `d` về 0 cần ít nhất `d/2` nước; mỗi nước tốn ít nhất `min_cost`. Việc bỏ qua vật cản, tư thế cuối và cầu/công tắc chỉ làm cận dưới này yếu hơn. Tại goal, `h=0`.

**Vì sao consistent?** Với hai trạng thái kề nhau `s → s'`, bất đẳng thức tam giác cho `d(s) ≤ 2 + d(s')`. Suy ra `h(s) ≤ min_cost + h(s') ≤ step_cost + h(s')`.

Điều kiện chứng minh vẫn đúng trên map có cầu/công tắc vì chúng thay đổi tính hợp lệ của cạnh, không tạo dịch chuyển xa hơn một phép lăn. Nếu core bổ sung teleport, split hoặc chi phí nhỏ hơn cận dưới đã công bố, phải đánh giá lại heuristic.

Kiểm tra heuristic bằng ba lớp bằng chứng:

1. `h(goal) == 0`, `h(state) >= 0`.
2. Với các cạnh được duyệt, kiểm tra `h(s) <= step_cost + h(s')` (thêm sai số nhỏ nếu cần cho số thực).
3. Trên cùng map và cost model, A\* và UCS phải có cùng `solved` và cùng `solution_cost` khi có nghiệm. Path không nhất thiết giống nhau.

So sánh với UCS trên vài map là kiểm tra hồi quy hữu ích, không thay thế chứng minh admissibility/consistency. Heuristic mạnh hơn có thể dựa trên khoảng cách trong bài toán nới lỏng, nhưng cần mô tả rõ điều kiện và cách kiểm chứng.

## 7. Luật game ảnh hưởng đến tìm kiếm

### Tư thế và tọa độ

`BlockState(row, col, orientation)` dùng ô neo **trên-trái**. `row` tăng theo chiều xuống; `col` tăng sang phải.

| Tư thế | Các ô chiếm giữ |
|---|---|
| `STANDING` | `(r, c)` |
| `HORIZONTAL` | `(r, c)`, `(r, c+1)` |
| `VERTICAL` | `(r, c)`, `(r+1, c)` |

### Sàn, cầu và công tắc

| Ký hiệu | Ý nghĩa |
|---|---|
| `.` | Không có sàn; có thể là ô cầu nếu được khai báo trong `bridges` |
| `#` | Sàn thường |
| `F` | Ô dễ vỡ: nằm được, đứng không được |
| `G` | Ô đích: chỉ thắng khi đứng đúng ô |
| `s` | Soft switch: kích hoạt khi bất kỳ phần khối nào chạm |
| `h` | Heavy switch: chỉ kích hoạt khi đứng |
| `X` | Split switch: đứng lên để teleport và tách; cần `splitters[].destinations` |

Công tắc tác động khi khối đáp xuống sau mỗi nước đi: `toggle` đảo trạng thái cầu, `open` mở cầu, `close` đóng cầu. `open` không tự đóng khi rời công tắc; một công tắc khác vẫn có thể đóng cầu đó. Nếu khối chạm nhiều công tắc, core xử lý từng công tắc theo các ô chiếm giữ.

Thứ tự core xử lý một nước đi:

1. Lăn khối theo hình học.
2. Kiểm tra sàn và ô dễ vỡ với trạng thái cầu **trước** khi kích hoạt công tắc.
3. Áp dụng các công tắc dưới khối.
4. Kiểm tra lại với cấu hình cầu mới; đóng cầu ngay dưới khối khiến nước đi bị loại.

Solver chỉ lấy successor hợp lệ từ core, không tự viết phiên bản luật khác. Goal là trạng thái kết thúc; core không cho đi tiếp từ goal.

`SWITCH_CUBE` đổi cube điều khiển, chi phí 1 và tính là một action trong `solution_length`. `neighbors` tự sinh khi đang split; solver không hard-code bốn hướng. Đứng trên X sẽ teleport tới hai `splitters[].destinations`; cube đi từng ô, kích hoạt soft nhưng không heavy, không thể thắng một mình; hai cube kề cạnh tự gộp thành khối nằm. Cube đứng yên không kích hoạt lại công tắc mỗi khi cube kia di chuyển. `split_01` là map split chơi được; `split_pending_01` cũ vẫn là template thiếu destinations và bị loại khỏi chơi.

## 8. Kiểm thử và chạy thử

### Chạy các kiểm tra có sẵn

Từ thư mục gốc, sau khi cài dependencies theo README:

```powershell
./backend/.venv/Scripts/python.exe scripts/run_tests.py
```

Chạy riêng test solver của mình:

```powershell
cd backend
./.venv/Scripts/python.exe -m pytest tests/test_solver_bfs.py -q
```

Đổi tên file theo thuật toán. Bộ test gồm core, API, map, benchmark và test riêng của cả bốn solver; test API bắt buộc trả kết quả thật thay vì chấp nhận `not_implemented`.

### Ma trận kiểm thử cần bổ sung

| Trường hợp | Điều cần xác nhận |
|---|---|
| `easy_01`, `easy_02`, `medium_01` | Có nghiệm; path hợp lệ, đến goal, length và cost đúng |
| `fragile_01` | Path không đứng trên ô dễ vỡ |
| `bridge_01` | Tìm kiếm giữ trạng thái cầu, path replay được qua công tắc |
| `heavy_01`, `toggle_01`, `permanent_01`, `advanced_01` | Kiểm tra đủ loại công tắc, hành vi cầu và fragile kết hợp |
| `split_01` | Path chứa SWITCH_CUBE; teleport, cube nhấn soft, gộp và tới đích; khóa state gồm active |
| `unsolvable_01` | Dừng, `solved=False`, path rỗng, length/cost là `None` |
| Cả hai cost model | Cost bằng tổng chi phí thật, không mặc định bằng số nước |
| Initial state đã là goal | Nghiệm rỗng, cost 0, không mở rộng |
| Initial state khác đầu map | Bắt đầu đúng đối số truyền vào, không tự reset |
| Đồ thị có chu trình | Không lặp vô hạn; thống kê tuân theo quy ước |
| Hai đường đến cùng state với cost khác nhau | UCS/A\* relax đúng, bỏ entry lỗi thời và không dừng sớm khi sinh goal |
| Chạy nhiều lần cùng input | Path và metric đếm node nhất quán; thời gian/bộ nhớ có thể khác |

Trên `uniform`, đối chiếu độ dài tối ưu của BFS/UCS/A\* với oracle trong `backend/tests/oracle.py`. Trên `orientation_weighted`, oracle BFS đó **không phải oracle chi phí**; cần kiểm tra UCS bằng trường hợp nhỏ có cost tính tay hoặc oracle Dijkstra độc lập trong test. A\* phải khớp cost với UCS đã được kiểm chứng. DFS chỉ cần hợp lệ, không buộc khớp nghiệm tối ưu.

Oracle và `reference_solution` chỉ dùng để kiểm thử; solver không được đọc/chạy chúng để tạo kết quả.

### Ví dụ test lời giải thật

Ví dụ kiểm tra BFS đã tích hợp:

```python
import pytest

from app.core import CostModel, Game, load_board, maps_dir
from app.solvers.bfs import solve


@pytest.mark.parametrize("cost_model", ["uniform", "orientation_weighted"])
def test_solution_replays_and_cost_matches(cost_model):
    game = Game(load_board(maps_dir() / "easy_01.json"), CostModel(cost_model))
    result = solve(game, game.initial_state())

    assert result.algorithm == "BFS"
    assert result.solved
    valid, _, steps = game.replay(result.path)
    assert valid
    assert steps == result.solution_length == len(result.path)
    assert result.solution_cost == pytest.approx(game.path_cost(result.path))
    assert result.expanded_nodes >= 0
    assert result.generated_nodes >= 0
```

Đổi import và tên thuật toán khi dùng cho module khác; bổ sung test vô nghiệm, tối ưu và các trường hợp biên riêng. `game.replay()` và `game.path_cost()` luôn bắt đầu từ **đầu bản đồ**. Khi test `initial_state` tùy chọn, phải tự áp dụng từng action từ state đã truyền, cộng cost từ trạng thái trước nước đi rồi kiểm tra goal cuối.

### Kiểm tra metric bằng trường hợp nhỏ

Tạo board một hàng `grid=["###G"]`, start `(0, 0)`, goal `(0, 3)` qua `Board.from_dict()` hoặc helper `make_board` trong `backend/tests/helpers.py`. Lời giải là `RIGHT, RIGHT`:

- `solution_length = 2`.
- `solution_cost = 2.0` với `uniform`, `3.0` với `orientation_weighted`.
- Theo quy ước pop-goal trước mở rộng: `expanded_nodes = 2`, `generated_nodes = 3` (successor quay về start vẫn được tính).

Trường hợp này bắt được lỗi đếm goal, bỏ successor trùng khỏi generated và tính cost theo tư thế sau nước đi.

### Chạy trên giao diện

Bật backend và frontend theo README, mở **Sổ kỹ thuật**, chọn map và cost model, rồi bấm thuật toán. Kiểm tra cả kết quả, metric và replay. Thử thêm `unsolvable_01` để xác nhận giao diện nhận kết quả thất bại bình thường. Nút MOCK không chứng minh solver hoạt động.

## 9. API, benchmark và chẩn đoán

### Luồng tích hợp

```text
POST /api/solve
  → registry chọn solve()
  → run_benchmark() gọi solve hai lần
  → replay và tính lại cost của kết quả lần đầu
  → API trả status cùng result
  → frontend hiển thị metric và replay path đã kiểm tra
```

Benchmark wrapper gọi solver **hai lần độc lập**: lần đầu đo `perf_counter`, lần hai đo bộ nhớ bằng `tracemalloc`. Chỉ kết quả lần đầu được trả về; số đo bộ nhớ thuộc lần thứ hai. Vì vậy mọi dữ liệu tìm kiếm phải khởi tạo trong `solve()`, tránh cache/tập visited toàn cục hay dữ liệu còn lại từ lần trước.

| Số đo do wrapper thêm | Ý nghĩa và giới hạn |
|---|---|
| `search_time_s` | Thời gian lần gọi solver đầu, không gồm render hoặc replay |
| `peak_memory_bytes` | Đỉnh cấp phát Python do `tracemalloc` ghi nhận trong lần gọi thứ hai; không phải tổng RAM tiến trình |
| `replay_valid` | Path của kết quả solved có hợp lệ và kết thúc ở goal hay không |
| `verified_cost` | Cost tính lại từ path hợp lệ; `None` khi không có path được xác nhận |

Không tự đo thời gian hoặc bộ nhớ trong solver. Khi so sánh, giữ cùng map, cost model và môi trường chạy; không lấy một lần đo nhỏ để kết luận tuyệt đối về tốc độ.

### Các trạng thái cần phân biệt

| `status` | Ý nghĩa | Cách xử lý |
|---|---|---|
| `not_implemented` | Solver vẫn raise `SolverNotImplemented` | Cài thuật toán; kiểm tra đúng module/checkout đang chạy |
| `solved` | Solver báo có nghiệm và wrapper replay đến goal | Kiểm tra thêm length/cost và tính tối ưu trong test |
| `unsolved` | Solver trả `solved=False` | Xem `note`; kiểm tra có cạn frontier hay bị cắt giới hạn |
| `invalid_path` | Solver báo solved nhưng replay thất bại | Kiểm tra dựng parent, thứ tự action, khóa trạng thái và xử lý goal |
| `mock` | Endpoint demo trả path tham chiếu | Chỉ dùng trình diễn replay; không báo là kết quả thuật toán |
| `no_reference` | Endpoint demo không có path tham chiếu | Không suy diễn thành kết luận từ solver |

Map `pending` bị `/api/solve` từ chối bằng HTTP 400; thuật toán lạ trả 404, cost model không hợp lệ trả 422.

**Giới hạn kiểm chứng hiện tại:** wrapper kiểm tra path và tính `verified_cost`, nhưng không tự đối chiếu `solution_cost`, `solution_length` hoặc các bộ đếm do solver khai báo. `status=solved` không bảo đảm tất cả metric đều đúng hay lời giải tối ưu; test riêng phải xác nhận các điều này.

## 10. Tiêu chí hoàn thành Pull Request

- [ ] `solve(game, initial_state)` dùng đúng đầu vào, không còn placeholder hoặc phụ thuộc oracle/reference path.
- [ ] Trả đúng contract cho cả có nghiệm, vô nghiệm và initial state đã là goal.
- [ ] State-key giữ đầy đủ cấu hình cầu; không sửa core/board hay dùng dữ liệu tìm kiếm toàn cục.
- [ ] Path, cost, length và bộ đếm đã được kiểm chứng; UCS/A\* xử lý cập nhật `g` đúng.
- [ ] Có test riêng cho tính hợp lệ, trường hợp biên và bảo đảm tối ưu phù hợp thuật toán.
- [ ] A\* có giải thích heuristic và bằng chứng admissible/consistent hoặc xử lý mở lại state phù hợp.
- [ ] `scripts/run_tests.py` và test riêng đều vượt qua; đã thử API/giao diện nếu báo hoàn thành tích hợp.
- [ ] PR chỉ gồm file được phân công và test riêng, không chứa cache hay môi trường cài đặt.
- [ ] Mô tả PR nêu thay đổi, quy ước tie-breaking, lệnh kiểm tra và kết quả thực tế; không đưa metric chưa đo.

## Bộ map Advanced đã kiểm chứng

| Map | Cơ chế | Lời giải tham chiếu (actions) |
|---|---|---|
| `heavy_01` | Heavy mở cầu | 13 |
| `toggle_01` | Soft đảo cầu | 10 |
| `permanent_01` | Soft đóng cố định | 8 |
| `advanced_01` | Fragile + soft toggle + heavy permanent | 12 |
| `split_01` | Teleport, đổi cube, cube nhấn soft, gộp và tới đích | 13 |

Sinh lại riêng 5 map: `python scripts/build_advanced_maps.py`. Mọi map mới phải có nghiệm và replay hợp lệ trước khi được ghi. `unsolvable_01` cũ cố ý vô nghiệm, không thuộc bộ Advanced mới.
