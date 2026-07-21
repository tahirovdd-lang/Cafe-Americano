import json
import os
import sqlite3
from contextlib import closing
from datetime import datetime

DB_PATH = os.getenv("DB_PATH", "americano.db")


def now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def connect() -> sqlite3.Connection:
    folder = os.path.dirname(DB_PATH)
    if folder:
        os.makedirs(folder, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with closing(connect()) as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users(
                user_id INTEGER PRIMARY KEY,
                username TEXT NOT NULL DEFAULT '',
                first_name TEXT NOT NULL DEFAULT '',
                phone TEXT NOT NULL DEFAULT '',
                progress INTEGER NOT NULL DEFAULT 0,
                coffee_total INTEGER NOT NULL DEFAULT 0,
                free_total INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS orders(
                order_id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                branch_id TEXT NOT NULL DEFAULT '',
                branch_name TEXT NOT NULL DEFAULT '',
                coffee_qty INTEGER NOT NULL DEFAULT 0,
                free_qty INTEGER NOT NULL DEFAULT 0,
                discount INTEGER NOT NULL DEFAULT 0,
                original_total INTEGER NOT NULL DEFAULT 0,
                final_total INTEGER NOT NULL DEFAULT 0,
                payload TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_orders_user_created
              ON orders(user_id, created_at DESC);
            """
        )
        conn.commit()


def upsert_user(user_id: int, username: str = "", first_name: str = "", phone: str = "") -> None:
    stamp = now()
    with closing(connect()) as conn:
        conn.execute(
            """
            INSERT INTO users(user_id,username,first_name,phone,created_at,updated_at)
            VALUES(?,?,?,?,?,?)
            ON CONFLICT(user_id) DO UPDATE SET
              username=excluded.username,
              first_name=excluded.first_name,
              phone=CASE WHEN excluded.phone<>'' THEN excluded.phone ELSE users.phone END,
              updated_at=excluded.updated_at
            """,
            (user_id, username or "", first_name or "", phone or "", stamp, stamp),
        )
        conn.commit()


def get_user(user_id: int):
    with closing(connect()) as conn:
        return conn.execute("SELECT * FROM users WHERE user_id=?", (user_id,)).fetchone()


def get_orders(user_id: int, limit: int = 10) -> list[dict]:
    with closing(connect()) as conn:
        rows = conn.execute(
            """SELECT order_id,branch_name,coffee_qty,free_qty,final_total,created_at
               FROM orders WHERE user_id=? ORDER BY created_at DESC LIMIT ?""",
            (user_id, limit),
        ).fetchall()
    return [dict(row) for row in rows]


def order_exists(order_id: str) -> bool:
    with closing(connect()) as conn:
        return conn.execute("SELECT 1 FROM orders WHERE order_id=?", (order_id,)).fetchone() is not None


def save_order(*, order_id: str, user_id: int, branch_id: str, branch_name: str,
               coffee_qty: int, free_qty: int, discount: int, original_total: int,
               final_total: int, payload: dict) -> None:
    with closing(connect()) as conn:
        conn.execute(
            """INSERT INTO orders(order_id,user_id,branch_id,branch_name,coffee_qty,free_qty,
               discount,original_total,final_total,payload,created_at)
               VALUES(?,?,?,?,?,?,?,?,?,?,?)""",
            (order_id, user_id, branch_id, branch_name, coffee_qty, free_qty, discount,
             original_total, final_total, json.dumps(payload, ensure_ascii=False), now()),
        )
        conn.commit()


def stats() -> dict:
    with closing(connect()) as conn:
        users = conn.execute("SELECT COUNT(*) n FROM users").fetchone()["n"]
        orders = conn.execute("SELECT COUNT(*) n FROM orders").fetchone()["n"]
        coffee = conn.execute("SELECT COALESCE(SUM(coffee_qty),0) n FROM orders").fetchone()["n"]
        gifts = conn.execute("SELECT COALESCE(SUM(free_qty),0) n FROM orders").fetchone()["n"]
        branches = [dict(row) for row in conn.execute(
            """SELECT branch_name,COUNT(*) orders,COALESCE(SUM(coffee_qty),0) coffee,
               COALESCE(SUM(free_qty),0) gifts FROM orders GROUP BY branch_id,branch_name"""
        ).fetchall()]
    return {"users": users, "orders": orders, "coffee": coffee, "gifts": gifts, "branches": branches}
