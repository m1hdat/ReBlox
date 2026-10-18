# 🔧 Little Repair Shop

*Every Piece Has Its Place*

Game **Bloxorz** chạy trên trình duyệt (đồ họa 3D) kèm bộ giải bằng các thuật toán tìm kiếm **BFS, DFS, UCS, A\***, làm cho đồ án môn **Nhập môn Trí tuệ nhân tạo** (HCMUS).

Bạn là một linh kiện nhỏ (viên pin pastel 1×1×2) trong tiệm sửa đồ chơi. Lăn linh kiện qua bàn làm việc và đặt nó **đứng thẳng** vào ổ cắm còn thiếu để món đồ (robot, hộp nhạc, đồng hồ...) sống lại.

## Trạng thái

| Hạng mục | Trạng thái |
|---|---|
| Khối 1×1×2, 12 phép lăn | ✅ Hoàn thành, có test |
| Ô dễ vỡ (fragile) | ✅ |
| Cầu + công tắc soft/heavy (toggle / open / close) | ✅ |
| Công tắc split, tách / đổi / gộp khối | ⏳ Chưa cài (map dùng split bị backend từ chối rõ ràng) |
| BFS / DFS / UCS / A\* | ⏳ Đang cài, xem [SOLVER_GUIDE.md](SOLVER_GUIDE.md) |
| Web 3D chơi tay, replay lời giải, bảng solver | ✅ |

## Công nghệ

- **Backend:** Python 3.11+, FastAPI, Pydantic, Pytest
- **Frontend:** TypeScript, Vite, Three.js (camera trực giao)
- Hai bên giao tiếp qua REST/JSON

## Cài đặt (Windows + PowerShell)

Cần: Python 3.11+, Node.js 18+ (khuyến nghị 20+), Git.

```powershell
git clone https://github.com/m1hdat/ReBlox.git
cd ReBlox

# --- Backend ---
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1          # nếu bị chặn: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
pip install -r requirements.txt
python -m pytest -q                   # chạy test
uvicorn app.main:app --reload --port 8000

# --- Frontend (mở terminal MỚI, từ thư mục ReBlox) ---
cd frontend
npm install
npm run dev                           # mở http://localhost:5173
npm run build                         # kiểm tra build production
```

Kiểm tra bản đồ và chạy test cùng lúc (từ thư mục gốc, đã bật venv):

```powershell
python scripts\run_tests.py
```

## Cách chơi

Luồng chính: **Trang chủ → Menu linh kiện → Các map của linh kiện → Chơi → Kết quả**.

- Điều khiển: phím ←↑↓→, WASD hoặc D-pad cảm ứng. Mục tiêu: đưa khối **đứng thẳng** vào ô đích vàng.
- Các nhóm linh kiện: Robot Bíp (`easy_01`, `bridge_01`), Hộp nhạc (`easy_02`), Tàu gỗ (`medium_01`), Đồng hồ (`fragile_01`). Mỗi nhóm có tiến độ và kỷ lục riêng, lưu trong `localStorage`.
- Ở màn chọn map có thể xoay / zoom / nhìn từ trên xuống / đặt lại góc nhìn trên bàn lắp ráp LEGO 3D trước khi chơi.
- Kết quả có **Chơi lại**, **Map tiếp theo** (trong cùng nhóm) và **Chọn map**.
- **Sổ kỹ thuật** (Workshop Lab) chứa toàn bộ 7 map, các thuật toán, cost model, số liệu và replay lời giải.

Muốn thêm map: đặt file JSON mới vào `maps/` rồi kiểm tra bằng `python scripts\validate_maps.py`. Nhóm hiển thị ở menu chính được khai báo trong `frontend/src/app/catalog.ts`.

## Kiến trúc

```text
Frontend TypeScript + Three.js ── REST/JSON ──> FastAPI
  màn game + GameSession                        core / solvers / benchmark
  lưu tiến độ localStorage                      maps/*.json
```

**Python là nguồn luật duy nhất.** Frontend gọi `/api/game/step` để kiểm tra nước đi trước khi diễn hoạt, không tự tính nước hợp lệ.

```
backend/
  app/core/          luật chơi, trạng thái, chuyển trạng thái
  app/solvers/       bfs.py, dfs.py, ucs.py, astar.py, contract.py
  app/api/           route game và solver
  app/benchmarking/  đo thời gian, bộ nhớ
  tests/             kiểm thử (pytest)
frontend/
  src/app/           catalog, tiến độ, phiên chơi
  src/screens/       các màn hình
  src/game/          renderer, camera, input, animation
  src/objects/       mô hình 3D (xưởng LEGO, khối, ô, đồ chơi)
  src/ui/            thành phần giao diện
maps/                bản đồ JSON
scripts/             chạy test, kiểm tra và dựng bản đồ
```

Một renderer/canvas dùng chung cho mọi màn; khi đổi map, geometry/material/texture được giải phóng, khối người chơi được giữ lại.

## Đóng góp

Người cài thuật toán xem [SOLVER_GUIDE.md](SOLVER_GUIDE.md): file được sửa, hợp đồng solver, luật game và quy ước làm việc.

## Nhóm thực hiện

| Thành viên | Phần phụ trách |
|---|---|
| Member 1 | BFS |
| Member 2 | DFS |
| Member 3 | UCS |
| Member 4 | A\* |
| Member 5 | Lõi game, giao diện web, solver API, tích hợp |

> Thay "Member N" bằng tên thật.
