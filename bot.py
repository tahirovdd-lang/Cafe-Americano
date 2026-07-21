import asyncio
import html
import json
import logging
import os
import sqlite3
from contextlib import closing
from datetime import datetime

from aiogram import Bot, Dispatcher, F, types
from aiogram.client.default import DefaultBotProperties
from aiogram.filters import Command, CommandStart
from aiogram.types import KeyboardButton, ReplyKeyboardMarkup, WebAppInfo

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("americano")

BOT_TOKEN = os.getenv("BOT_TOKEN")
if not BOT_TOKEN:
    raise RuntimeError("BOT_TOKEN не найден в переменных окружения")

WEBAPP_URL = os.getenv("WEBAPP_URL", "https://tahirovdd-lang.github.io/Cafe-Americano/")
DB_PATH = os.getenv("DB_PATH", "americano.db")
LOYALTY_STEP = 6
BRAND = "АМЕРИКАНО"
PHONE = "+998 (91) 314-30-07"
INSTAGRAM = "americano.coffeeuz"


def parse_ids(value: str) -> set[int]:
    return {int(x.strip()) for x in value.split(",") if x.strip().isdigit()}


ADMIN_IDS = parse_ids(os.getenv("ADMIN_IDS", os.getenv("ADMIN_ID", "6013591658")))
BRANCH_ADMINS = {
    "branch_1": parse_ids(os.getenv("BRANCH_1_ADMIN_IDS", "")) or ADMIN_IDS,
    "branch_2": parse_ids(os.getenv("BRANCH_2_ADMIN_IDS", "")) or ADMIN_IDS,
    "branch_3": parse_ids(os.getenv("BRANCH_3_ADMIN_IDS", "")) or ADMIN_IDS,
}

bot = Bot(BOT_TOKEN, default=DefaultBotProperties(parse_mode="HTML"))
dp = Dispatcher()
MENU_BTN = "☕ Открыть Americano"
CARD_BTN = "🎁 Моя кофейная карта"


def keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text=MENU_BTN, web_app=WebAppInfo(url=WEBAPP_URL))],
            [KeyboardButton(text=CARD_BTN)],
        ],
        resize_keyboard=True,
    )


def db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    folder = os.path.dirname(DB_PATH)
    if folder:
        os.makedirs(folder, exist_ok=True)
    with closing(db()) as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users(
                user_id INTEGER PRIMARY KEY,
                username TEXT,
                first_name TEXT,
                phone TEXT,
                progress INTEGER NOT NULL DEFAULT 0,
                coffee_total INTEGER NOT NULL DEFAULT 0,
                free_total INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS orders(
                order_id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                branch_id TEXT,
                branch_name TEXT,
                coffee_qty INTEGER NOT NULL DEFAULT 0,
                free_qty INTEGER NOT NULL DEFAULT 0,
                discount INTEGER NOT NULL DEFAULT 0,
                original_total INTEGER NOT NULL DEFAULT 0,
                final_total INTEGER NOT NULL DEFAULT 0,
                payload TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            """
        )
        conn.commit()


def now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def esc(value) -> str:
    return html.escape(str(value or ""))


def to_int(value) -> int:
    try:
        return max(0, int(float(value)))
    except (TypeError, ValueError):
        return 0


def money(value) -> str:
    return f"{to_int(value):,}".replace(",", " ")


def upsert_user(user: types.User, phone: str = "") -> None:
    stamp = now()
    with closing(db()) as conn:
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
            (user.id, user.username or "", user.first_name or "", phone, stamp, stamp),
        )
        conn.commit()


def get_user(user_id: int):
    with closing(db()) as conn:
        return conn.execute("SELECT * FROM users WHERE user_id=?", (user_id,)).fetchone()


def is_coffee(item: dict) -> bool:
    if item.get("is_coffee") is True:
        return True
    category = str(item.get("category", "")).lower()
    text = " ".join(str(item.get(k, "")) for k in ("id", "name", "name_ru", "name_lang")).lower()
    markers = ("coffee", "кофе", "qahva", "espresso", "americano", "cappuccino", "latte", "раф", "flat white")
    return category in {"coffee", "hot", "кофе", "qahva"} or any(x in text for x in markers)


def coffee_prices(items: list[dict]) -> list[int]:
    result = []
    for item in items:
        if is_coffee(item):
            result.extend([to_int(item.get("price"))] * to_int(item.get("qty")))
    return result


def apply_loyalty(user_id: int, prices: list[int]) -> dict:
    with closing(db()) as conn:
        conn.execute("BEGIN IMMEDIATE")
        user = conn.execute("SELECT * FROM users WHERE user_id=?", (user_id,)).fetchone()
        progress_before = int(user["progress"] if user else 0)
        coffee_qty = len(prices)
        free_qty = (progress_before + coffee_qty) // LOYALTY_STEP
        progress_after = (progress_before + coffee_qty) % LOYALTY_STEP
        discount = sum(sorted(prices)[:free_qty]) if free_qty else 0
        conn.execute(
            """UPDATE users SET progress=?, coffee_total=coffee_total+?,
               free_total=free_total+?, updated_at=? WHERE user_id=?""",
            (progress_after, coffee_qty, free_qty, now(), user_id),
        )
        conn.commit()
    return {
        "coffee_qty": coffee_qty,
        "free_qty": free_qty,
        "progress_before": progress_before,
        "progress_after": progress_after,
        "left": LOYALTY_STEP - progress_after,
        "discount": discount,
    }


def user_link(user: types.User) -> str:
    if user.username:
        return f'<a href="https://t.me/{esc(user.username)}">@{esc(user.username)}</a>'
    return f'<a href="tg://user?id={user.id}">{esc(user.first_name or "Клиент")}</a>'


def card_text(user_id: int) -> str:
    row = get_user(user_id)
    progress = int(row["progress"] if row else 0)
    total = int(row["coffee_total"] if row else 0)
    gifts = int(row["free_total"] if row else 0)
    marks = " ".join("☕" if i < progress else "🎁" if i == LOYALTY_STEP - 1 else "○" for i in range(LOYALTY_STEP))
    left = LOYALTY_STEP - progress
    next_line = "🎉 <b>Следующий кофе бесплатно!</b>" if left == 1 else f"До бесплатного кофе осталось: <b>{left}</b>"
    return (
        f"☕ <b>{BRAND}</b>\n"
        "<i>Просто. Вкусно. С душой.</i>\n\n"
        f"{marks}\n"
        f"Прогресс: <b>{progress}/{LOYALTY_STEP}</b>\n"
        f"{next_line}\n\n"
        f"Всего учтено кофе: <b>{total}</b>\n"
        f"Получено подарков: <b>{gifts}</b>\n\n"
        "Карта действует во всех трёх филиалах Американо.\n"
        f"📞 {PHONE}\n📸 @{INSTAGRAM}"
    )


def history_text(user_id: int) -> str:
    with closing(db()) as conn:
        rows = conn.execute(
            "SELECT order_id,branch_name,coffee_qty,free_qty,final_total,created_at FROM orders WHERE user_id=? ORDER BY created_at DESC LIMIT 10",
            (user_id,),
        ).fetchall()
    if not rows:
        return "🧾 <b>История заказов</b>\n\nУ вас пока нет оформленных заказов."
    text = "🧾 <b>Последние заказы</b>"
    for row in rows:
        date = str(row["created_at"]).replace("T", " ")[:16]
        text += (
            f"\n\n<b>{esc(row['order_id'])}</b> · {date}\n"
            f"🏪 {esc(row['branch_name'])}\n"
            f"☕ Кофе: <b>{row['coffee_qty']}</b> · Подарков: <b>{row['free_qty']}</b>\n"
            f"💰 К оплате: <b>{money(row['final_total'])}</b> сум"
        )
    return text


@dp.message(CommandStart())
async def start(message: types.Message):
    upsert_user(message.from_user)
    await message.answer(
        f"☕ <b>Добро пожаловать в сеть кофеен {BRAND}!</b>\n"
        "<i>Просто. Вкусно. С душой.</i>\n\n"
        "Бот автоматически считает кофе во всех трёх филиалах. "
        "Каждый шестой кофе — бесплатно. Кассиру ничего подтверждать не нужно.\n\n"
        f"📞 {PHONE}\n📸 @{INSTAGRAM}",
        reply_markup=keyboard(),
    )


@dp.message(Command("menu"))
@dp.message(F.text == MENU_BTN)
async def menu(message: types.Message):
    await message.answer("Откройте меню кнопкой ниже 👇", reply_markup=keyboard())


@dp.message(Command("card"))
@dp.message(F.text == CARD_BTN)
async def card(message: types.Message):
    upsert_user(message.from_user)
    await message.answer(card_text(message.from_user.id), reply_markup=keyboard())


@dp.message(Command("history"))
async def history(message: types.Message):
    upsert_user(message.from_user)
    await message.answer(history_text(message.from_user.id), reply_markup=keyboard())


@dp.message(Command("stats"))
async def stats(message: types.Message):
    if message.from_user.id not in ADMIN_IDS:
        return
    with closing(db()) as conn:
        users = conn.execute("SELECT COUNT(*) n FROM users").fetchone()["n"]
        orders = conn.execute("SELECT COUNT(*) n FROM orders").fetchone()["n"]
        coffee = conn.execute("SELECT COALESCE(SUM(coffee_qty),0) n FROM orders").fetchone()["n"]
        gifts = conn.execute("SELECT COALESCE(SUM(free_qty),0) n FROM orders").fetchone()["n"]
        rows = conn.execute("SELECT branch_name,COUNT(*) orders,COALESCE(SUM(coffee_qty),0) coffee,COALESCE(SUM(free_qty),0) gifts FROM orders GROUP BY branch_id,branch_name").fetchall()
    text = f"📊 <b>Статистика {BRAND}</b>\n\nКлиентов: <b>{users}</b>\nЗаказов: <b>{orders}</b>\nКофе: <b>{coffee}</b>\nПодарков: <b>{gifts}</b>"
    for row in rows:
        text += f"\n\n🏪 {esc(row['branch_name'])}\nЗаказов: <b>{row['orders']}</b> · Кофе: <b>{row['coffee']}</b> · Подарков: <b>{row['gifts']}</b>"
    await message.answer(text)


@dp.message(F.web_app_data)
async def webapp_data(message: types.Message):
    try:
        data = json.loads(message.web_app_data.data)
        if not isinstance(data, dict):
            raise ValueError
    except (json.JSONDecodeError, ValueError):
        await message.answer("Не удалось прочитать данные. Откройте приложение и попробуйте ещё раз.")
        return

    action = str(data.get("action") or "order")
    upsert_user(message.from_user)
    if action == "card":
        await message.answer(card_text(message.from_user.id), reply_markup=keyboard())
        return
    if action == "history":
        await message.answer(history_text(message.from_user.id), reply_markup=keyboard())
        return

    items = data.get("items") if isinstance(data.get("items"), list) else []
    phone = str(data.get("phone") or "")
    branch_id = str(data.get("branch_id") or "")
    branch_name = str(data.get("branch_name") or branch_id or "Филиал")
    order_id = str(data.get("order_id") or f"AM-{message.from_user.id}-{int(datetime.now().timestamp())}")
    original_total = to_int(data.get("total_num", data.get("total")))
    if not branch_id:
        await message.answer("Выберите филиал и повторите заказ.")
        return

    upsert_user(message.from_user, phone)
    prices = coffee_prices(items)
    with closing(db()) as conn:
        if conn.execute("SELECT 1 FROM orders WHERE order_id=?", (order_id,)).fetchone():
            await message.answer("Этот заказ уже был обработан.")
            return

    loyalty = apply_loyalty(message.from_user.id, prices)
    final_total = max(0, original_total - loyalty["discount"])
    with closing(db()) as conn:
        conn.execute(
            "INSERT INTO orders VALUES(?,?,?,?,?,?,?,?,?,?,?)",
            (order_id, message.from_user.id, branch_id, branch_name, loyalty["coffee_qty"], loyalty["free_qty"], loyalty["discount"], original_total, final_total, json.dumps(data, ensure_ascii=False), now()),
        )
        conn.commit()

    lines = []
    for item in items:
        qty = to_int(item.get("qty"))
        if qty:
            name = item.get("name_lang") or item.get("name_ru") or item.get("name") or item.get("id") or "—"
            lines.append(f"• {esc(name)} × <b>{qty}</b> — {money(to_int(item.get('price')) * qty)} сум")

    admin_text = (
        f"📩 <b>НОВЫЙ ЗАКАЗ — {BRAND}</b>\n\n"
        f"🧾 Заказ: <b>{esc(order_id)}</b>\n🏪 Филиал: <b>{esc(branch_name)}</b>\n"
        f"👤 Клиент: {user_link(message.from_user)}\n📞 Телефон: <b>{esc(phone or '—')}</b>\n"
        f"🚚 Получение: <b>{esc(data.get('fulfillment') or '—')}</b>\n"
        f"💳 Оплата: <b>{esc(data.get('payment_label') or data.get('payment_method') or '—')}</b>\n"
        f"📍 Адрес: <b>{esc(data.get('address') or '—')}</b>\n\n"
        "☕ <b>Состав заказа:</b>\n" + ("\n".join(lines) or "• —") +
        f"\n\nКофе в заказе: <b>{loyalty['coffee_qty']}</b>"
        f"\nПодарочных кофе: <b>{loyalty['free_qty']}</b>"
        f"\nСкидка: <b>{money(loyalty['discount'])}</b> сум"
        f"\n💰 К оплате: <b>{money(final_total)}</b> сум"
    )
    for admin_id in BRANCH_ADMINS.get(branch_id, ADMIN_IDS):
        try:
            await bot.send_message(admin_id, admin_text)
        except Exception:
            logger.exception("Не удалось отправить заказ администратору %s", admin_id)

    gift = f"\n🎁 Бесплатных кофе в заказе: <b>{loyalty['free_qty']}</b>." if loyalty["free_qty"] else ""
    next_line = "🎉 Следующий кофе будет бесплатным!" if loyalty["left"] == 1 else f"До следующего бесплатного кофе осталось: <b>{loyalty['left']}</b>."
    await message.answer(
        f"✅ <b>Заказ принят!</b>\n🏪 {esc(branch_name)}\n💰 К оплате: <b>{money(final_total)}</b> сум{gift}\n\n{next_line}",
        reply_markup=keyboard(),
    )


@dp.message()
async def fallback(message: types.Message):
    await message.answer("Выберите нужное действие 👇", reply_markup=keyboard())


async def main():
    init_db()
    logger.info("Americano bot started")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
