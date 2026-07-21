from contextlib import closing

from database import connect, get_user, now

LOYALTY_STEP = 6


def to_int(value) -> int:
    try:
        return max(0, int(float(value)))
    except (TypeError, ValueError):
        return 0


def is_coffee(item: dict) -> bool:
    if item.get("is_coffee") is True:
        return True
    category = str(item.get("category", "")).lower()
    text = " ".join(str(item.get(k, "")) for k in ("id", "name", "name_ru", "name_lang")).lower()
    markers = ("coffee", "кофе", "qahva", "espresso", "americano", "cappuccino", "latte", "раф", "flat white")
    return category in {"coffee", "hot", "cold_coffee", "кофе", "qahva"} or any(x in text for x in markers)


def coffee_prices(items: list[dict]) -> list[int]:
    prices: list[int] = []
    for item in items:
        if is_coffee(item):
            prices.extend([to_int(item.get("price"))] * to_int(item.get("qty")))
    return prices


def profile(user_id: int) -> dict:
    row = get_user(user_id)
    progress = int(row["progress"] if row else 0)
    total = int(row["coffee_total"] if row else 0)
    gifts = int(row["free_total"] if row else 0)
    return {
        "user_id": user_id,
        "progress": progress,
        "step": LOYALTY_STEP,
        "left": LOYALTY_STEP - progress,
        "coffee_total": total,
        "free_total": gifts,
        "phone": str(row["phone"] if row else ""),
        "first_name": str(row["first_name"] if row else ""),
        "username": str(row["username"] if row else ""),
    }


def apply(user_id: int, prices: list[int]) -> dict:
    with closing(connect()) as conn:
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute("SELECT * FROM users WHERE user_id=?", (user_id,)).fetchone()
        before = int(row["progress"] if row else 0)
        qty = len(prices)
        gifts = (before + qty) // LOYALTY_STEP
        after = (before + qty) % LOYALTY_STEP
        discount = sum(sorted(prices)[:gifts]) if gifts else 0
        conn.execute(
            """UPDATE users SET progress=?,coffee_total=coffee_total+?,
               free_total=free_total+?,updated_at=? WHERE user_id=?""",
            (after, qty, gifts, now(), user_id),
        )
        conn.commit()
    return {
        "coffee_qty": qty,
        "free_qty": gifts,
        "progress_before": before,
        "progress_after": after,
        "left": LOYALTY_STEP - after,
        "discount": discount,
    }
