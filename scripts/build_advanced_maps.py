"""Sinh riêng các map Advanced; chỉ ghi khi oracle tìm được path replay hợp lệ.

Không thay map cũ, không cài bốn solver của nhóm. Chạy từ repo root:
  backend/.venv/Scripts/python.exe scripts/build_advanced_maps.py
"""
import copy
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / "backend"), str(ROOT / "backend/tests")]
from app.core import Board, Game
from oracle import shortest_path


def definitions():
    base = json.loads((ROOT / "maps/bridge_01.json").read_text(encoding="utf-8"))
    heavy = copy.deepcopy(base)
    heavy.update(id="heavy_01", name="Chốt chịu lực", difficulty="advanced",
                 description="Đứng thẳng lên nút dấu × để mở cầu. Nằm ngang trên nút không đủ lực.")
    heavy["grid"][0] = "###h......."
    heavy["grid"][2] = "####......G"
    heavy["switches"][0].update(pos=[0, 3], kind="heavy")
    toggle = copy.deepcopy(base)
    toggle.update(id="toggle_01", name="Cầu đảo trạng thái", difficulty="advanced",
                  description="Nút tròn đảo trạng thái cầu mỗi lần chạm. Đừng vô tình đóng lại đường đi.")
    toggle["switches"][0]["effect"] = "toggle"
    close = dict(id="permanent_01", name="Chốt đóng cố định", difficulty="advanced", status="playable",
                 description="Đi qua nút tròn trên hành lang để đóng cố định cầu phụ. Chạm lại vẫn giữ cầu đóng.",
                 grid=["####......", "####......", "####s####G", "####......"], start=[0, 0], goal=[2, 9],
                 switches=[dict(pos=[2, 4], kind="soft", targets=["side_bridge"], effect="close")],
                 bridges=[dict(id="side_bridge", cells=[[0, 6]], initially_open=True)], theme=base["theme"])
    mixed = dict(id="advanced_01", name="Mạch cầu và phiến mỏng", difficulty="advanced", status="playable",
                 description="Nút tròn đảo cầu đầu, nút chịu lực mở cầu sau. Nằm xuống khi qua phiến mỏng.",
                 grid=["#s#h....####", "####..FF###G", "####..FF####"], start=[0, 0], goal=[1, 11],
                 switches=[dict(pos=[0, 1], kind="soft", targets=["first"], effect="toggle"),
                           dict(pos=[0, 3], kind="heavy", targets=["second"], effect="open")],
                 bridges=[dict(id="first", cells=[[1, 4], [2, 4]], initially_open=False),
                          dict(id="second", cells=[[1, 5], [2, 5]], initially_open=False)], theme=base["theme"])
    split = dict(id="split_01", name="Hai nửa mạch điện", difficulty="advanced", status="playable",
                 description="Đứng lên ô ( ) để tách khối. Nhấn Space hoặc Đổi khối; mở cầu bằng cube rồi đưa hai cube kề nhau để gộp.",
                 grid=["###X......####", "####...#..####", "..........###G", "..........#s##", "..........####"],
                 start=[0, 0], goal=[2, 13],
                 splitters=[dict(pos=[0, 3], destinations=[[1, 7], [3, 10]])],
                 switches=[dict(pos=[3, 11], kind="soft", targets=["cube_bridge"], effect="open")],
                 bridges=[dict(id="cube_bridge", cells=[[1, 8], [1, 9]], initially_open=False)],
                 theme=dict(object="splitter_machine", palette="lavender"))
    return [heavy, toggle, close, mixed, split]


def main():
    verified = []
    for data in definitions():
        data.update(rows=len(data["grid"]), cols=len(data["grid"][0]))
        game = Game(Board.from_dict(data))
        solved, path, visited = shortest_path(game)
        if not solved or not game.replay(path)[0]:
            raise RuntimeError(f"{data['id']}: không có lời giải hợp lệ, không ghi map")
        data.update(solvable=True, reference_solution=path)
        verified.append(data)
        print(f"{data['id']}: {len(path)} actions, {visited} states, replay OK")
    for data in verified:
        (ROOT / "maps" / f"{data['id']}.json").write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
