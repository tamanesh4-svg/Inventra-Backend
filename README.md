# Inventra Express + MongoDB backend

This backend replaces the original FastAPI/SQLAlchemy implementation with Node.js, Express, Mongoose and MongoDB. It preserves the REST paths and response fields used by the existing React UI.

## Database isolation

The configured database name is **`inventory_mern_db`**, separate from the old PostgreSQL `inventory_db`. MongoDB Atlas creates the database/collections when the first documents are written. Use the connection URI for your existing Atlas cluster but set its database path to `/inventory_mern_db`. This code does not connect to or modify the old PostgreSQL database. If your current data is only in PostgreSQL, it will not automatically appear in this new MongoDB database.

## Setup (Windows PowerShell)

1. Install Node.js 20+ and have access to your MongoDB Atlas cluster (or a MongoDB replica set).
2. In this folder run:
   ```powershell
   Copy-Item .env.example .env
   notepad .env
   npm install
   ```
3. In `.env`, replace the URI placeholders. Keep the database name `inventory_mern_db`. URL-encode special characters in the MongoDB username/password (for example `#` as `%23`). Generate a strong JWT secret, e.g. run `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` and paste the result into `JWT_SECRET`.
4. In MongoDB Atlas, ensure your IP is allowed and the database user has read/write access to `inventory_mern_db` (or appropriate access on the cluster).
5. Run `npm run dev`. API health check: `http://localhost:5000/health`.

## Frontend

In `frontend`, copy `.env.example` to `.env` and set `VITE_API_BASE_URL=http://localhost:5000`. Then run `npm install` and `npm run dev`. Existing token storage (`localStorage.token`) and `Authorization: Bearer ...` requests are retained.

## API routes

- `POST /signup`, `POST /login`
- `GET /products`, `POST /products`, `PUT /products/:id`, `DELETE /products/:id`, `PUT /products/restore/:id`
- `POST /cart/create`, `POST /cart/add`, `GET /cart/:cartId`, `POST /cart/checkout/:cartId`
- `GET /orders`, `GET /orders/:orderId`
- `GET /inventory`, `GET /dashboard/overview`, `GET /products/demand`
- `GET /health`

All routes except signup, login and health require a valid Bearer token. Error responses include both `detail` and `message` to support the current UI.

## Authentication and security

- Passwords are hashed with bcrypt (12 rounds); the hash is never returned.
- JWTs use HS256, a required environment secret, issuer/audience validation and expiration. User existence is rechecked on each authenticated request.
- Login/signup are rate-limited. Helmet and CORS allow-list are enabled.
- All product/cart/order queries are scoped to the authenticated seller.
- Checkout uses a MongoDB transaction and conditional stock decrements. Transactions require a replica set; MongoDB Atlas clusters support this.

## Important notes

- MongoDB IDs are strings rather than the old SQL integer IDs; the React UI treats these as opaque IDs, so this is compatible.
- The new MongoDB database starts empty. Create an account using Signup and add products. There is no automatic PostgreSQL-to-MongoDB data migration.
- Never commit `.env` or share your live credentials.
