import asyncio
import hashlib
import hmac
import html
import json
import logging
import os
from datetime import datetime
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from aiohttp import web
from aiogram import Bot, Dispatcher, F, types
from aiogram.client.default import DefaultBotProperties
from aiogram.filters import Command, CommandStart
from aiogram.types import KeyboardButton, ReplyKeyboardMarkup, WebAppInfo

import database
import loyalty

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("americano")

BOT_TOKEN = os.getenv("BOT_TOKEN")
if not BOT_TOKEN:
    raise RuntimeError("BOT_TOKEN не найден в переменных окружения")

WEBAPP_URL = os.getenv("WEBAPP_URL", "https://tahirovdd-lang.github.io/Cafe-Americano/?v=6")
PUBLIC_API_URL = os.getenv("PUBLIC_API_URL", "").rstrip("/")
PORT = int(os.getenv("PORT", "3000"))
BRAND = "AMERICANO"
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


def esc(value) -> str:
    return html.escape(str(value or ""))


def money(value) -> str:
    return f"{loyalty.to_int(value):,}".replace(",", " ")


def remember_user(user: types.User, phone: str = "") -> None:
    database.upsert_user(user.id, user.username or "", user.first_name or "", phone)


def webapp_url(user_id: int) -> str:
    p = loyalty.profile(user_id)
    parts = urlsplit(WEBAPP_URL)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query.update({
        "progress": str(p["progress"]),
        "left": str(p["left"]),
        "coffee_total": str(p["coffee_total"]),
        "free_total": str(p["free_total"]),
    })
    if PUBLIC_API_URL:
        query["api"] = PUBLIC_API_URL
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def keyboard(user_id: int) -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text=MENU_BTN, web_app=WebAppInfo(url=webapp_url(user_id)))],
            [KeyboardButton(text=CARD_BTN)],
        ],
        resize_keyboard=True,
    )


def card_text(user_id: int) -> str:
    p = loyalty.profile(user_id)
    marks = " ".join("☕" if i < p["progress"] else "🎁" if i == p["step"] - 1 else "○" for i in range(p["step"]))
    next_line = "🎉 <b>Следующий кофе бесплатно!</b>" if p["left"] == 1 else f"До бесплатного кофе осталось: <b>{p['left']}</b>"
    return (
        f"☕ <b>{BRAND}</b>\n<i>Просто. Вкусно. С душой.</i>\n\n"
        f"{marks}\nПрогресс: <b>{p['progress']}/{p['step']}</b>\n{next_line}\n\n"
        f"Всего учтено кофе: <b>{p['coffee_total']}</b>\n"
        f"Получено подарков: <b>{p['free_total']}</b>\n\n"
        "Карта действует во всех трёх филиалах Americano.\n"
        f"📞 {PHONE}\n📸 @{INSTAGRAM}"
    )


def history_text(user_id: int) -> str:
    rows = database.get_orders(user_id)
    if not rows:
        return "🧾 <b>История заказов</b>\n\nУ вас пока нет оформленных заказов."
    text = "🧾 <b>Последние заказы</b>"
    for row in rows:
        date = str(row["created_at"]).replace("T", " ")[:16]
        text += (
            f"\n\n<b>{esc(row['order_id'])}</b> · {date}\n🏪 {esc(row['branch_name'])}\n"
            f"☕ Кофе: <b>{row['coffee_qty']}</b> · Подарков: <b>{row['free_qty']}</b>\n"
            f"💰 К оплате: <b>{money(row['final_total'])}</b> сум"
        )
    return text


@dp.message(CommandStart())
async def start(message: types.Message):
    remember_user(message.from_user)
    await message.answer(
        f"☕ <b>Добро пожаловать в сеть кофеен {BRAND}!</b>\n"
        "<i>Просто. Вкусно. С душой.</i>\n\n"
        "Бот автоматически считает кофе во всех трёх филиалах. Каждый шестой кофе — бесплатно.\n\n"
        f"📞 {PHONE}\n📸 @{INSTAGRAM}",
        reply_markup=keyboard(message.from_user.id),
    )


@dp.message(Command("menu"))
@dp.message(F.text == MENU_BTN)
async def menu(message: types.Message):
    remember_user(message.from_user)
    await message.answer("Откройте приложение кнопкой ниже 👇", reply_markup=keyboard(message.from_user.id))


@dp.message(Command("card"))
@dp.message(F.text == CARD_BTN)
async def card(message: types.Message):
    remember_user(message.from_user)
    await message.answer(card_text(message.from_user.id), reply_markup=keyboard(message.from_user.id))


@dp.message(Command("history"))
async def history(message: types.Message):
    remember_user(message.from_user)
    await message.answer(history_text(message.from_user.id), reply_markup=keyboard(message.from_user.id))


@dp.message(Command("stats"))
async def stats(message: types.Message):
    if message.from_user.id not in ADMIN_IDS:
        return
    s = database.stats()
    text = f"📊 <b>Статистика {BRAND}</b>\n\nКлиентов: <b>{s['users']}</b>\nЗаказов: <b>{s['orders']}</b>\nКофе: <b>{s['coffee']}</b>\nПодарков: <b>{s['gifts']}</b>"
    for row in s["branches"]:
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

    remember_user(message.from_user, str(data.get("phone") or ""))
    action = str(data.get("action") or "order")
    if action == "card":
        await message.answer(card_text(message.from_user.id), reply_markup=keyboard(message.from_user.id))
        return
    if action == "history":
        await message.answer(history_text(message.from_user.id), reply_markup=keyboard(message.from_user.id))
        return

    items = data.get("items") if isinstance(data.get("items"), list) else []
    branch_id = str(data.get("branch_id") or "")
    branch_name = str(data.get("branch_name") or branch_id or "Филиал")
    order_id = str(data.get("order_id") or f"AM-{message.from_user.id}-{int(datetime.now().timestamp())}")
    original_total = loyalty.to_int(data.get("total_num", data.get("total")))
    phone = str(data.get("phone") or "")

    if not branch_id:
        await message.answer("Выберите филиал и повторите заказ.")
        return
    if database.order_exists(order_id):
        await message.answer("Этот заказ уже был обработан.", reply_markup=keyboard(message.from_user.id))
        return

    result = loyalty.apply(message.from_user.id, loyalty.coffee_prices(items))
    final_total = max(0, original_total - result["discount"])
    database.save_order(
        order_id=order_id, user_id=message.from_user.id, branch_id=branch_id,
        branch_name=branch_name, coffee_qty=result["coffee_qty"], free_qty=result["free_qty"],
        discount=result["discount"], original_total=original_total, final_total=final_total, payload=data,
    )

    lines = []
    for item in items:
        qty = loyalty.to_int(item.get("qty"))
        if qty:
            name = item.get("name_lang") or item.get("name_ru") or item.get("name") or item.get("id") or "—"
            lines.append(f"• {esc(name)} × <b>{qty}</b> — {money(loyalty.to_int(item.get('price')) * qty)} сум")

    admin_text = (
        f"📩 <b>НОВЫЙ ЗАКАЗ — {BRAND}</b>\n\n🧾 Заказ: <b>{esc(order_id)}</b>\n"
        f"🏪 Филиал: <b>{esc(branch_name)}</b>\n👤 Клиент: <a href=\"tg://user?id={message.from_user.id}\">{esc(message.from_user.first_name or 'Клиент')}</a>\n"
        f"📞 Телефон: <b>{esc(phone or '—')}</b>\n🚚 Получение: <b>{esc(data.get('fulfillment') or '—')}</b>\n"
        f"💳 Оплата: <b>{esc(data.get('payment_label') or data.get('payment_method') or '—')}</b>\n📍 Адрес: <b>{esc(data.get('address') or '—')}</b>\n\n"
        "☕ <b>Состав заказа:</b>\n" + ("\n".join(lines) or "• —") +
        f"\n\nКофе в заказе: <b>{result['coffee_qty']}</b>\nПодарочных кофе: <b>{result['free_qty']}</b>"
        f"\nСкидка: <b>{money(result['discount'])}</b> сум\n💰 К оплате: <b>{money(final_total)}</b> сум"
    )
    for admin_id in BRANCH_ADMINS.get(branch_id, ADMIN_IDS):
        try:
            await bot.send_message(admin_id, admin_text)
        except Exception:
            logger.exception("Не удалось отправить заказ администратору %s", admin_id)

    gift = f"\n🎁 Бесплатных кофе в заказе: <b>{result['free_qty']}</b>." if result["free_qty"] else ""
    next_line = "🎉 Следующий кофе будет бесплатным!" if result["left"] == 1 else f"До следующего бесплатного кофе осталось: <b>{result['left']}</b>."
    await message.answer(
        f"✅ <b>Заказ принят!</b>\n🏪 {esc(branch_name)}\n💰 К оплате: <b>{money(final_total)}</b> сум{gift}\n\n{next_line}",
        reply_markup=keyboard(message.from_user.id),
    )


@dp.message()
async def fallback(message: types.Message):
    remember_user(message.from_user)
    await message.answer("Выберите нужное действие 👇", reply_markup=keyboard(message.from_user.id))


def validate_init_data(init_data: str) -> dict | None:
    try:
        values = dict(parse_qsl(init_data, keep_blank_values=True))
        received_hash = values.pop("hash")
        check_string = "\n".join(f"{key}={values[key]}" for key in sorted(values))
        secret = hmac.new(b"WebAppData", BOT_TOKEN.encode(), hashlib.sha256).digest()
        expected = hmac.new(secret, check_string.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, received_hash):
            return None
        return json.loads(values.get("user", "{}"))
    except Exception:
        return None


@web.middleware
async def cors(request: web.Request, handler):
    if request.method == "OPTIONS":
        response = web.Response(status=204)
    else:
        response = await handler(request)
    response.headers["Access-Control-Allow-Origin"] = "https://tahirovdd-lang.github.io"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "POST,GET,OPTIONS"
    return response


async def health(_: web.Request) -> web.Response:
    return web.json_response({"ok": True, "service": "americano"})


async def api_profile(request: web.Request) -> web.Response:
    payload = await request.json()
    user = validate_init_data(str(payload.get("init_data") or ""))
    if not user or not user.get("id"):
        raise web.HTTPUnauthorized(text="Invalid Telegram data")
    database.upsert_user(int(user["id"]), str(user.get("username") or ""), str(user.get("first_name") or ""))
    return web.json_response(loyalty.profile(int(user["id"])))


async def api_orders(request: web.Request) -> web.Response:
    payload = await request.json()
    user = validate_init_data(str(payload.get("init_data") or ""))
    if not user or not user.get("id"):
        raise web.HTTPUnauthorized(text="Invalid Telegram data")
    return web.json_response(database.get_orders(int(user["id"])))


async def start_http_server() -> web.AppRunner:
    app = web.Application(middlewares=[cors])
    app.router.add_get("/", health)
    app.router.add_get("/api/health", health)
    app.router.add_post("/api/profile", api_profile)
    app.router.add_post("/api/orders", api_orders)
    app.router.add_options("/{tail:.*}", health)
    runner = web.AppRunner(app)
    await runner.setup()
    await web.TCPSite(runner, "0.0.0.0", PORT).start()
    logger.info("Americano API started on port %s", PORT)
    return runner


async def main():
    database.init_db()
    runner = await start_http_server()
    logger.info("Americano bot started")
    try:
        await dp.start_polling(bot)
    finally:
        await runner.cleanup()
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
