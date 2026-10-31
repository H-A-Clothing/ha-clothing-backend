# ha-clothing-backend

Node.js + Express REST API with PostgreSQL (Neon), for the H&A Clothing e-commerce project.

## Setup

```powershell
npm install
Copy-Item .env.example .env   # then paste the Neon connection string (shared privately)
npm run db:check              # should print "Database connection OK"
npm run migrate:latest        # create/update all tables
npm run dev                   # API on http://localhost:3000/api/v1
```

Health check: `GET /api/v1/health`

## Database migrations (Knex)

All schema changes go through migrations. Nobody edits tables by hand on the shared database.

| Command | What it does |
|---|---|
| `npm run migrate:make -- create_products` | Create a new migration file in `src/db/migrations/` |
| `npm run migrate:latest` | Run all migrations that haven't run yet |
| `npm run migrate:rollback` | Undo the last batch of migrations |
| `npm run migrate:status` | List completed and pending migrations |
| `npm run seed:make -- 01_users` | Create a seed file in `src/db/seeds/` |
| `npm run seed:run` | Load the shared sample data |

### Rules
- **One small PR per migration**, and announce it to the team. Backend PRs merge before frontend PRs.
- **Never edit or delete a migration after it is merged** into `develop`; write a new migration instead.
- Always write `down()` so a migration can be rolled back.
- Pull `develop` and run `npm run migrate:latest` before starting new work.
- Knex is used for migrations and seeds only. Repositories use plain SQL through `src/config/database.js`.
- Wrap multi-table changes (checkout, stock reservation, payment callbacks) in `withTransaction()`.

Migration files are named with a timestamp (e.g. `20261024090232_create_products.js`), so two members creating migrations on the same day never clash.
