#  Terra Natura

A web-based system for logging and managing environmental samples — water, soil, and air — built for ecological monitoring companies.

---

## What It Does

Field employees collect environmental samples and log them into the system. Each record contains the date and time, location, sample type, responsible employee, test results, and processing status. The system provides a clean dashboard for viewing, filtering, and exporting this data.

**Key capabilities:**
- Add, edit, view, and delete sample records
- Filter by type, status, date range, and location name
- Dashboard statistics showing sample counts by category
- Export the current filtered view to a formatted Excel file
- Simple login system to restrict access to authorized users

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express |
| Database | SQLite via `better-sqlite3` |
| Frontend | HTML + CSS + Vanilla JavaScript |
| Auth | `express-session` + `bcryptjs` |
| Export | ExcelJS |

No frontend frameworks are used — the UI is built with plain HTML, CSS custom properties, and fetch-based JavaScript.

---

## Project Structure

```
terra-natura/
├── server.js        # Express server — all API routes
├── database.js      # SQLite setup, table definitions, admin seeding
├── package.json
├── terra.db         # Auto-created on first run
└── public/
    ├── index.html   # Main dashboard
    ├── form.html    # Add / edit form
    ├── sample.html  # Sample detail view
    ├── login.html   # Login page
    ├── style.css    # All styles (CSS variables, responsive)
    └── app.js       # All frontend logic
```

---

## Getting Started

```bash
# Install dependencies
npm install

# Start the server
npm start
```

Open **http://localhost:3000** in your browser.

Default credentials: `admin` / `admin123`

The database file `terra.db` is created automatically on first run. The default admin account is also seeded automatically.

---

## API Overview

The backend exposes a REST API under `/api/`:

- `GET /api/samples` — fetch all samples, supports query filters (`type`, `status`, `from`, `to`, `location`)
- `POST /api/samples` — create a new sample
- `PUT /api/samples/:id` — update an existing sample
- `DELETE /api/samples/:id` — delete a sample
- `GET /api/stats` — return aggregate counts by type and status
- `GET /api/export` — download filtered results as `.xlsx`
- `POST /api/login` / `POST /api/logout` — session auth

All routes except login require an active session.

---

## Database

Two tables are used:

**`samples`** — the main data table with fields: `id`, `datetime`, `location`, `type` (water/soil/air), `employee`, `results`, `status` (ready/processed), `created_at`.

**`users`** — stores hashed credentials for login. Passwords are hashed with bcrypt (cost factor 10).

---

## Deployment (Render)

1. Push the project to a GitHub repository
2. Create a new **Web Service** on [render.com](https://render.com)
3. Set build command: `npm install`, start command: `npm start`
4. Add environment variable `SESSION_SECRET` with a long random string

> **Note:** Render's free tier has an ephemeral filesystem, so `terra.db` will reset on each redeploy. For a demo or academic project this is fine. For persistent data, attach a disk or migrate to a hosted database.

---

## Notes

- All API filtering is done in SQL using parameterized queries (safe from injection)
- Location search is case-insensitive partial match via `LIKE ? COLLATE NOCASE`
- The Excel export respects all active filters — what you see in the table is what gets exported
- Session lifetime is 8 hours
