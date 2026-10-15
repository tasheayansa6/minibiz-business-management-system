# MiniBiz

MiniBiz is a small-business inventory and sales app. The browser shows products, sales, and a dashboard. A local API stores those records in MongoDB Atlas.

The interface runs at `http://127.0.0.1:5173`. The API runs at `http://127.0.0.1:8000`. Both processes need to stay running.

## Technologies

- **Interface:** React 19, TypeScript, and Vite 8. Layout and controls are custom CSS in `frontend/src/index.css`. The Inter typeface is loaded from the page.
- **API:** Python, FastAPI, Uvicorn, and Pydantic. PyMongo’s async client talks to the database.
- **Database:** MongoDB Atlas. Products are stored in `products` and sales in `sales`.

## Requirements

- Python 3.10 or newer
- Node.js 20.19 or newer
- A MongoDB Atlas cluster, a database user, and this computer’s public IP on the cluster’s Network Access list

## Install the API

From the `backend` directory:

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env`. This file holds the database password and should stay on the server.

```text
MONGODB_URI=mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/?retryWrites=true&w=majority
DATABASE_NAME=minibiz
```

`MONGODB_URI` must start with `mongodb://` or `mongodb+srv://`. `DATABASE_NAME` defaults to `minibiz` when it is omitted.

In Atlas, open **Network Access** and add this computer’s current public IP. The address must match exactly. Atlas closes the connection before login when the IP is missing or mistyped, and the API then answers `503` with `database: disconnected`.

Start the API from the `backend` directory:

```bash
source venv/bin/activate
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Check the connection:

```bash
curl http://127.0.0.1:8000/health
```

A working database returns:

```json
{"status":"ok","api":"running","database":"connected"}
```

Interactive API docs are at `http://127.0.0.1:8000/docs`.

## Install the interface

From the `frontend` directory:

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. If that port is already in use, Vite prints the next port it chose. The browser calls `http://127.0.0.1:8000` unless `frontend/.env` sets `VITE_API_BASE_URL`. Copy `frontend/.env.example` to `frontend/.env` to change that address. No database password belongs in the frontend.

Build a static copy with:

```bash
npm run build
```

## Project structure

```text
frontend/src/pages        Dashboard, products, sales, history, and settings
frontend/src/components   Application shell and shared controls
frontend/src/services     Typed API client
frontend/src/utils        Form checks, money display, and the low-stock rule
backend/app/routers       Product and sales endpoints
backend/app/schemas.py    Request and response validation
backend/app/models.py     Shapes of the stored MongoDB documents
backend/app/database.py   One shared MongoDB client
```

## What the app does

- **Dashboard** totals revenue, sales, products, and units from the live product and sales lists. It also shows recent sales and products with 5 units or fewer.
- **Products** searches by name, filters by category and maximum stock, and creates, edits, and deletes products.
- **Sales** records a sale for one product. The API copies that product’s current price and reduces its stock.
- **Sales History** lists sales and filters them in the browser by product name and date.
- **Settings** shows the workspace name and ETB display currency. Nothing on that page is saved.

## API

| Method | Path | Result |
| --- | --- | --- |
| `GET` | `/` | Confirms the API process is running |
| `GET` | `/health` | Reports whether MongoDB answers a ping |
| `GET` | `/products` | Lists products. Optional query: `search`, `category`, `max_stock` |
| `POST` | `/products` | Creates a product |
| `GET` | `/products/{id}` | Returns one product |
| `PUT` | `/products/{id}` | Updates the supplied fields |
| `DELETE` | `/products/{id}` | Deletes a product and returns `204` |
| `GET` | `/sales` | Lists sales, newest first |
| `POST` | `/sales` | Records a sale and returns `201` |

A sale body contains only `product_id` and `quantity`. A sale that asks for more units than are in stock returns `409`.

## Technical decisions

**Two local programs.** The React app and the FastAPI app are separate processes. The browser calls `http://127.0.0.1:8000` directly. Because those ports differ, `backend/app/main.py` allows responses to be read by pages on `localhost` or `127.0.0.1` at any port. The MongoDB address never goes to the browser.

**MongoDB Atlas, one shared client.** `backend/app/database.py` opens one async PyMongo client when the API starts and closes it on shutdown. Startup pings the database and refuses to serve if that ping fails. Later database errors on product and sales routes return `503`.

**Money stays exact.** Prices are Python `Decimal` values in the API and BSON `Decimal128` in MongoDB. JSON sends them as strings such as `"120.50"`, with at most two decimal places. The dashboard adds those strings in cents. The ETB symbol is only a display choice in `frontend/src/utils/format.ts`; the API does not store a currency.

**A sale is one database transaction.** Creating a sale decreases `stock_quantity` and inserts the sale in the same MongoDB transaction. The stored sale keeps the unit price from that moment, so a later product price change does not rewrite old sales.

**The database shape is small.** Products live in `products` and sales live in `sales`. API ids are 24-character MongoDB ObjectId strings. Dates are timezone-aware UTC values. Request models reject unknown fields. A product update may omit a field, and it rejects a field sent as `null`.

**The interface only shows API data.** Dashboard totals, low-stock badges, and history rows are calculated in the browser from `GET /products` and `GET /sales`. There is no statistics endpoint. Low stock means 5 units or fewer, and that limit lives in `frontend/src/utils/stock.ts`. Product name, category, and maximum-stock filters are applied by the API. Sales history filters are applied after the full list is loaded.

**Pages are local view state.** Navigation is a React state value in `frontend/src/App.tsx`. The app does not use a router or a component library. Settings is a placeholder and has no write action.

## Screenshots

These were taken from the local app with live Atlas data.

![Dashboard](docs/screenshots/dashboard.png)

![Products](docs/screenshots/products.png)

![Sales](docs/screenshots/sales.png)

![Sales history](docs/screenshots/history.png)

![Settings](docs/screenshots/settings.png)

## Challenges

**Atlas refused the database connection.** Product and sales requests returned `503`, and `/health` reported `database: disconnected`. The TLS handshake failed before login. Atlas Network Access had `96.189.226.65`, while this computer’s public address was `196.189.226.65`. Adding the exact address made the same API process reach the cluster again.

**The browser blocked a working API.** `curl` could read `http://127.0.0.1:8000`, but the page on port 5173 could not, because the two programs use different ports. `CORSMiddleware` in `backend/app/main.py` now allows pages on `localhost` and `127.0.0.1` to read the responses.

**The virtual environment is not in the project root.** `source venv/bin/activate` fails in the top folder. The environment is `backend/venv`, so the activate command has to run after `cd backend`.

## Assessment

**Functionality.** The dashboard calculates revenue, sale count, catalog size, and units in stock from live records. Products can be created, edited, deleted, searched by name, and filtered by category and maximum stock. A sale stores the current price and reduces stock in one database transaction. Forms reject empty names, invalid prices, and quantities the stock cannot cover, and the page shows the reason.

**Code quality.** The interface and API are separate folders. TypeScript types in `frontend/src/types` match the API models in `backend/app/schemas.py`. Form checks in `frontend/src/utils/validate.ts` follow the same limits. The database password is read from `backend/.env` and is excluded from Git. The health check lives in `backend/app/main.py`.

**UI/UX.** The shell uses a navy sidebar, a colored top edge, and separate colors for the four dashboard figures. Status uses text as well as color: out of stock, low stock, and healthy stock. Pages have loading, empty, and error states. Controls have visible labels, and the layout works on a narrow screen.

**Problem-solving.** The challenges section records the three setup failures that blocked the working app: an Atlas IP that did not match this computer, a browser that refused the API because the ports differed, and a virtual environment that exists only inside `backend`.

**Data handling.** Money is stored as `Decimal128` and sent as strings such as `"120.50"`. Dates are timezone-aware UTC values. A sale that asks for more units than are available returns `409` and does not change stock. Unknown request fields are rejected. When Atlas cannot be reached, product and sales routes return `503` instead of an empty catalog.

**Documentation.** This file covers setup, the API, data rules, and the problems above. `backend/.env.example` and `frontend/.env.example` show the settings without real secrets. FastAPI also publishes interactive docs at `http://127.0.0.1:8000/docs`.

## Deployment

The working application is the local pair of processes above. A public host was not published. The database password stays in `backend/.env`, which is not part of the source, and Atlas only accepts connections from IP addresses on its Network Access list. A hosted copy would need that host’s address added in Atlas and `MONGODB_URI` set as a server secret.
