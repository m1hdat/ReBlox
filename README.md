# Little Repair Shop · ReBlox

**Every Piece Has Its Place**

Trò chơi giải đố lấy cảm hứng từ **Bloxorz**, kết hợp giao diện 3D trên trình duyệt với môi trường thực nghiệm các thuật toán tìm kiếm **BFS, DFS, UCS và A\***. Dự án phục vụ đồ án môn **Nhập môn Trí tuệ nhân tạo — HCMUS**.

Trong một tiệm sửa đồ chơi, bạn lăn linh kiện 1×1×2 qua bàn lắp ráp và đưa nó **đứng thẳng tại ô đích** để hoàn thành việc sửa chữa. Cùng một bộ luật được dùng cho chơi tay, tìm kiếm và kiểm chứng lời giải.

[Cài đặt](#cài-đặt-và-chạy) · [Cách chơi](#cách-chơi) · [Hướng dẫn solver](SOLVER_GUIDE.md) · [Kiểm tra](#kiểm-tra) · [Kiến trúc](#kiến-trúc)

## Dự án hiện có gì?

| Hạng mục | Trạng thái trong mã nguồn |
|---|---|
| Khối 1×1×2 và chuyển động theo ba tư thế | Đã triển khai, có kiểm thử backend |
| Ô dễ vỡ, cầu, công tắc soft/heavy, hiệu ứng toggle/open/close | Đã triển khai trong lõi game |
| Giao diện Three.js, chọn nhiệm vụ, xem trước bản đồ, chơi tay và màn kết quả | Đã triển khai |
| Tiến độ và kỷ lục chơi tay | Lưu trong `localStorage` của trình duyệt |
| Sổ kỹ thuật: gọi solver, chọn cost model, hiển thị metric và replay | Đã có luồng tích hợp |
| BFS / DFS / UCS / A\* | **Cả bốn còn là placeholder** trong `backend/app/solvers/` |
| Split switch, tách/đổi/gộp hai khối nhỏ | Chưa hỗ trợ; bản đồ thử nghiệm được đánh dấu `pending` |

> Có nút thuật toán trên giao diện chưa có nghĩa thuật toán đã được cài đặt. Solver còn thiếu trả `not_implemented`. Chức năng **MOCK** chỉ phát lời giải tham chiếu có sẵn trong map, không tạo số liệu thuật toán.

## Cài đặt và chạy

### Yêu cầu

- Python **3.11+** và Node.js **20+** được khuyến nghị cho môi trường phát triển.
- Git, npm và trình duyệt hỗ trợ WebGL.
- Các lệnh dưới đây dành cho **Windows PowerShell**. Chạy backend và frontend trong hai terminal riêng.

### 1. Lấy mã nguồn

```powershell
git clone https://github.com/m1hdat/ReBlox.git
cd ReBlox
```

Nếu đã có checkout, bắt đầu từ thư mục gốc `ReBlox`.

### 2. Khởi động backend — terminal thứ nhất

```powershell
python -m venv backend/.venv
./backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt
cd backend
./.venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000
```

API chạy tại <http://127.0.0.1:8000>; tài liệu API tương tác tại <http://127.0.0.1:8000/docs>. Các lệnh dùng trực tiếp Python trong môi trường ảo nên không cần kích hoạt `Activate.ps1` hay thay đổi execution policy.

### 3. Khởi động frontend — terminal thứ hai

Từ thư mục gốc `ReBlox`:

```powershell
cd frontend
npm ci
npm run dev
```

Mở <http://localhost:5173>. Vite chuyển tiếp `/api` đến backend tại `127.0.0.1:8000` theo [vite.config.ts](frontend/vite.config.ts).

### 4. Kiểm tra kết nối

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/health
```

Phản hồi mong đợi là `ok: True`. Nếu giao diện không tải được map, kiểm tra backend và cấu hình proxy trước.

## Cách chơi

**Trang chủ → Chọn linh kiện → Chọn bản đồ → Chơi → Kết quả.**

- Di chuyển bằng phím mũi tên, **WASD** hoặc D-pad trên màn hình.
- Đưa khối **đứng thẳng trên ô `G`**. Nằm ngang hoặc nằm dọc qua ô đích chưa hoàn thành màn chơi.
- Không để bất kỳ phần nào của khối ra ngoài sàn. Ô `F` chịu được khối nằm nhưng vỡ khi khối đứng.
- Công tắc có thể thay đổi cầu; cần tính cả tư thế khối và trạng thái cầu khi tìm đường.
- Màn chọn bản đồ hỗ trợ xoay, zoom, nhìn từ trên xuống và đặt lại camera trước khi chơi.
- Tiến độ thuộc về trình duyệt đang dùng; xóa dữ liệu trang sẽ xóa tiến độ cục bộ.

Các nhiệm vụ chính được nhóm theo đồ chơi trong [catalog.ts](frontend/src/app/catalog.ts):

| Nhóm | Bản đồ |
|---|---|
| Robot Bíp | `easy_01`, `bridge_01` |
| Hộp nhạc | `easy_02` |
| Tàu gỗ | `medium_01` |
| Đồng hồ | `fragile_01` |

**Sổ kỹ thuật** cung cấp danh sách đầy đủ 7 map, trong đó `unsolvable_01` dùng để thử trường hợp vô nghiệm và `split_pending_01` bị vô hiệu hóa vì chưa hỗ trợ split. Replay trong Sổ kỹ thuật không cộng tiến độ hoặc kỷ lục chơi tay; giao diện hiện chưa hiển thị trace mở rộng từng node.

## Kiến trúc

```text
Trình duyệt · TypeScript / Three.js
  Màn hình, camera, animation, GameSession, localStorage
                         │ REST / JSON qua /api
                         ▼
FastAPI · Python
  API game ──────────────► Game Core ◄──────────── Solver
  API solver ───────────► Benchmark wrapper       BFS / DFS / UCS / A*
                              │
                              └── đo đạc và kiểm chứng path
                         │
                         ▼
                    maps/*.json
```

**Backend là nơi quyết định luật chơi.** Frontend gửi nước đi đến `/api/game/step` rồi diễn hoạt theo kết quả. Solver sử dụng `Game.neighbors()` để mở rộng trạng thái, dùng cùng luật cầu/công tắc với chơi tay. Benchmark wrapper replay lời giải bằng lõi game trước khi API trả trạng thái `solved`.

| Thư mục | Vai trò |
|---|---|
| [`backend/app/core/`](backend/app/core/) | Board, trạng thái bất biến, phép lăn, luật chơi và cost model |
| [`backend/app/solvers/`](backend/app/solvers/) | Bốn solver, `SolverResult` và registry thuật toán |
| [`backend/app/benchmarking/`](backend/app/benchmarking/) | Đo thời gian, bộ nhớ và kiểm chứng lời giải |
| [`backend/app/api/`](backend/app/api/) | REST API cho map, chơi game và solver |
| [`backend/tests/`](backend/tests/) | Kiểm thử và oracle độc lập phục vụ kiểm chứng map |
| [`frontend/src/`](frontend/src/) | Luồng ứng dụng, màn hình, mô hình 3D và bảng solver |
| [`maps/`](maps/) | Bản đồ JSON dùng chung |
| [`scripts/`](scripts/) | Kiểm tra map và chạy kiểm thử backend |
| [`artifacts/`](artifacts/) | Ảnh và báo cáo từ các đợt kiểm tra giao diện |

### Các endpoint chính

| Method | Endpoint | Chức năng |
|---|---|---|
| `GET` | `/api/health` | Kiểm tra backend |
| `GET` | `/api/maps`, `/api/maps/{map_id}` | Danh sách và chi tiết map |
| `POST` | `/api/game/initial` | Trạng thái khởi đầu |
| `POST` | `/api/game/step` | Áp dụng một nước đi |
| `POST` | `/api/game/validate-path` | Replay và kiểm tra path có đến đích |
| `GET` | `/api/solvers` | Tên thuật toán đã đăng ký và cost model; không xác nhận đã cài solver |
| `POST` | `/api/solve` | Chạy solver và benchmark |
| `POST` | `/api/solve/mock-demo` | Lấy lời giải tham chiếu, có nhãn MOCK |

Chi tiết request/response có tại `/docs` khi backend đang chạy. Ví dụ gọi solver từ PowerShell:

```powershell
$body = @{ map_id = "easy_01"; algorithm = "BFS"; cost_model = "uniform" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/api/solve -ContentType "application/json" -Body $body
```

Với checkout hiện tại, lời gọi này trả `status: not_implemented`. Sau khi solver được triển khai, API có thể trả `solved`, `unsolved` hoặc `invalid_path`.

## Kiểm tra

**Backend và bản đồ** — từ thư mục gốc, không cần bật server:

```powershell
./backend/.venv/Scripts/python.exe scripts/run_tests.py
```

Lệnh này chạy validator map rồi `pytest`. Muốn chỉ kiểm tra map, dùng `./backend/.venv/Scripts/python.exe scripts/validate_maps.py`. Oracle kiểm chứng map độc lập với bốn solver của đồ án; các kiểm tra này vượt qua không đồng nghĩa solver đã hoàn thành.

**Build frontend** — từ `frontend/`, không cần bật server:

```powershell
npm run build
```

**Kiểm tra tích hợp giao diện** — từ `frontend/`, khi backend và Vite đều đang chạy:

```powershell
npm run test:frontend
npm run test:browser
```

`test:frontend` kiểm tra DOM, API thật và geometry, với renderer WebGL được thay thế trong môi trường test. `test:browser` chạy trình duyệt Microsoft Edge qua Playwright và cần Edge được cài trên máy. Có thể đổi URL kiểm tra bằng biến môi trường `FRONTEND_TEST_URL`.

## Phát triển tiếp

- **Cài thuật toán:** bắt đầu tại [SOLVER_GUIDE.md](SOLVER_GUIDE.md). Tài liệu mô tả phạm vi file, hợp đồng solver, cách triển khai, heuristic A\*, kiểm thử và tiêu chí bàn giao.
- **Thêm bản đồ:** tham khảo [map có cầu mẫu](maps/bridge_01.json) và [bộ nạp/kiểm tra cấu trúc](backend/app/core/board.py), thêm JSON vào `maps/` rồi chạy validator. Cập nhật `frontend/src/app/catalog.ts` nếu muốn đưa map vào nhóm nhiệm vụ chính.
- **Thay đổi luật hoặc hợp đồng chung:** thống nhất với người phụ trách tích hợp trước khi chỉnh core, API, benchmark hoặc `SolverResult`.
- **Gửi thay đổi:** dùng nhánh riêng và Pull Request có mô tả hành vi, phạm vi file và kết quả kiểm tra thực tế. Không commit môi trường ảo, `node_modules`, cache hoặc thư mục build.
