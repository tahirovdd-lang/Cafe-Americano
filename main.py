import asyncio
import mimetypes
from pathlib import Path

from aiohttp import web

import bot
import database

BASE_DIR = Path(__file__).resolve().parent
STATIC_FILES = {
    "style.css",
    "mobile-fix.css",
    "header-fix.css",
    "app.js",
    "api.js",
}
IMAGES_DIR = BASE_DIR / "images"


def no_cache(response: web.StreamResponse) -> web.StreamResponse:
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response


async def index(_: web.Request) -> web.StreamResponse:
    return no_cache(web.FileResponse(BASE_DIR / "index.html"))


async def static_file(request: web.Request) -> web.StreamResponse:
    name = request.match_info["name"]
    if name not in STATIC_FILES:
        raise web.HTTPNotFound()

    path = BASE_DIR / name
    if not path.is_file():
        raise web.HTTPNotFound()

    content_type, _ = mimetypes.guess_type(path.name)
    response = web.FileResponse(path)
    if content_type:
        response.content_type = content_type
    return no_cache(response)


async def image_file(request: web.Request) -> web.StreamResponse:
    name = Path(request.match_info["name"]).name
    path = IMAGES_DIR / name
    if not path.is_file():
        raise web.HTTPNotFound()

    content_type, _ = mimetypes.guess_type(path.name)
    response = web.FileResponse(path)
    if content_type:
        response.content_type = content_type
    return no_cache(response)


async def favicon(_: web.Request) -> web.Response:
    return web.Response(status=204)


async def start_http_server() -> web.AppRunner:
    app = web.Application(middlewares=[bot.cors])

    # Mini App
    app.router.add_get("/", index)
    app.router.add_get("/favicon.ico", favicon)
    app.router.add_get("/{name:style\\.css|mobile-fix\\.css|header-fix\\.css|app\\.js|api\\.js}", static_file)
    app.router.add_get("/images/{name}", image_file)

    # API
    app.router.add_get("/api/health", bot.health)
    app.router.add_post("/api/profile", bot.api_profile)
    app.router.add_post("/api/orders", bot.api_orders)
    app.router.add_options("/{tail:.*}", bot.health)

    runner = web.AppRunner(app)
    await runner.setup()
    await web.TCPSite(runner, "0.0.0.0", bot.PORT).start()
    bot.logger.info("Americano Mini App and API started on port %s", bot.PORT)
    return runner


async def main() -> None:
    database.init_db()
    runner = await start_http_server()
    bot.logger.info("Americano bot started")
    try:
        await bot.dp.start_polling(bot.bot)
    finally:
        await runner.cleanup()
        await bot.bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())