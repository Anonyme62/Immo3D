# V2 Turbo - J1/J2 Runbook (HA -> VPS, domaine unique)

This runbook is the executable path for the infra sprint:
- frontend build embarque dans l'image backend
- FastAPI sur VPS derriere Caddy
- PostgreSQL managed (Neon/Supabase)
- one-command deploy + rollback by SHA

Goal for production:
- canonical public URL: `https://www.example.com`
- apex redirect: `https://example.com` -> `https://www.example.com`
- same-origin frontend + API on the canonical domain

## Target budget (monthly)

- Neon/Supabase starter: free tier
- Cloudflare R2: free tier (within limits)
- VPS (Hetzner CX11 or OVH small): about 5 to 7 EUR
- Total target: about 10 EUR

## 0) Pre-check

From repo root:

```bash
cd /opt/immo3d
cp deploy/v2/backend.env.example deploy/v2/backend.env
```

Edit `deploy/v2/backend.env` with your real values:
- `APP_DOMAIN`
- `ROOT_DOMAIN`
- `TLS_EMAIL`
- `FRONTEND_ORIGIN` and `FRONTEND_ORIGINS` (canonical frontend URL)
- `DATABASE_URL` (managed PostgreSQL URL)
- strong keys (`APP_SECRET_KEY`, `DATA_ENCRYPTION_KEY`, `BACKUP_ENCRYPTION_KEY`)
- R2 settings (`R2_BUCKET`, `R2_ENDPOINT_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_BASE_URL`)

For browser direct upload, set R2 CORS:
- Allowed origin: your frontend URL (for example `https://app.example.com`)
- Allowed methods: `PUT, GET, HEAD`
- Allowed headers: `Content-Type`

## 1) VPS bootstrap (one-time)

On the VPS:

```bash
sudo ./deploy/v2/bootstrap_vps.sh <REPO_URL> /opt/immo3d main
cd /opt/immo3d
```

## 2) First production deploy

On the VPS:

```bash
./deploy/v2/release.sh deploy origin/main
./deploy/v2/release.sh status
```

Health check:

```bash
curl -fsS https://<APP_DOMAIN>/health
```

## 3) Rollback in one command

Automatic rollback to previous deployed SHA:

```bash
./deploy/v2/release.sh rollback
```

Rollback to a specific SHA:

```bash
./deploy/v2/release.sh rollback <git-sha>
```

## 4) SQLite -> PostgreSQL migration

Run this from `backend/` on a machine that can reach both DBs:

```bash
cd backend
python scripts/migrate_sqlite_to_postgres.py \
  --source sqlite:///./immo3d.db \
  --target "postgresql+psycopg://<user>:<password>@<host>/<db>?sslmode=require"
```

Dry run:

```bash
python scripts/migrate_sqlite_to_postgres.py \
  --source sqlite:///./immo3d.db \
  --target "postgresql+psycopg://<user>:<password>@<host>/<db>?sslmode=require" \
  --dry-run
```

## 5) Production routing model

The VPS image now builds the Vite frontend and ships it inside the backend image.
That means:
- the SPA is served by FastAPI on the same origin as the API
- browser calls stay same-origin by default
- no public `api.example.com` is required anymore

Recommended DNS:
- `www.example.com` -> VPS / reverse proxy
- `example.com` -> same VPS / reverse proxy, with redirect to `www`

Recommended frontend runtime:
- leave `VITE_API_BASE_URL` empty for production
- prefer `CESIUM_ION_TOKEN=<restricted-token>` in `deploy/v2/backend.env`
- this token is then injected at runtime through `/runtime-config.js`
- no local `immo-app/src/*token*.txt` file is required on the VPS

## 6) J1 done criteria

- `https://<APP_DOMAIN>/health` returns `status=ok`
- `https://<ROOT_DOMAIN>` redirects to `https://<APP_DOMAIN>`
- frontend is served from the same production domain as the API
- no Home Assistant runtime dependency in public path
- deploy works with one command (`release.sh deploy`)
- rollback works with one command (`release.sh rollback`)
