"""Điểm vào FastAPI. Chạy (từ thư mục backend): uvicorn app.main:app --reload --port 8000"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import routes_game, routes_solver

app = FastAPI(title="Little Repair Shop API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
                   allow_methods=["*"], allow_headers=["*"])
app.include_router(routes_game.router)
app.include_router(routes_solver.router)
