# AMERICANO — Telegram WebApp и программа лояльности

Проект для сети из трёх кофеен. Каждый шестой кофе автоматически становится бесплатным, а баланс клиента общий для всех филиалов.

## Архитектура

- `index.html` — структура интерфейса.
- `style.css` — адаптивный дизайн.
- `app.js` — меню, корзина, экраны и отображение карты гостя.
- `api.js` — получение актуального прогресса и истории заказов.
- `bot.py` — Telegram-бот и HTTP API.
- `database.py` — SQLite и запросы к базе.
- `loyalty.py` — определение кофе, подарков, скидки и остатка.

## Синхронизация карты

Бот передаёт в WebApp:

- `progress` — сколько кофе уже учтено в текущем цикле;
- `left` — сколько осталось до бесплатного кофе;
- `coffee_total` — сколько кофе учтено всего;
- `free_total` — сколько подарочных кофе уже получено.

Данные передаются в URL кнопки WebApp при каждом сообщении бота. Если настроен `PUBLIC_API_URL`, приложение также запрашивает свежие данные напрямую из SQLite через защищённый Telegram `initData`.

## Лояльность

- Учитываются позиции с `is_coffee: true`.
- Кассиру не требуется ничего подтверждать или считать.
- Подарок определяется автоматически.
- В заказе с несколькими подарками бесплатно списываются самые дешёвые кофейные напитки.
- После шестого кофе новый цикл начинается автоматически.

## Переменные Bothost

```env
BOT_TOKEN=ВАШ_ТОКЕН
ADMIN_IDS=6013591658
BRANCH_1_ADMIN_IDS=6013591658
BRANCH_2_ADMIN_IDS=6013591658
BRANCH_3_ADMIN_IDS=6013591658
WEBAPP_URL=https://tahirovdd-lang.github.io/Cafe-Americano/?v=6
DB_PATH=/app/data/americano.db
PORT=3000
```

Для прямой синхронизации через API добавьте публичный HTTPS-адрес контейнера Bothost:

```env
PUBLIC_API_URL=https://ВАШ-ПУБЛИЧНЫЙ-ДОМЕН-BOTHOST
```

Не указывайте текст-заглушку `YOUR-BOTHOST-PUBLIC-DOMAIN`. Пока публичный адрес не добавлен, приложение использует данные, которые бот передаёт в URL, и локально обновляет карту после оформления заказа.

## GitHub Pages

Включите:

`Settings → Pages → Deploy from a branch → main → /root`

WebApp:

`https://tahirovdd-lang.github.io/Cafe-Americano/`

## Запуск

```bash
pip install -r requirements.txt
python bot.py
```

API проверки:

- `GET /api/health`
- `POST /api/profile`
- `POST /api/orders`

Запросы профиля и заказов принимаются только с корректным Telegram WebApp `initData`.
