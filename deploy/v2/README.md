# V2 Turbo - J1/J2 Runbook (HA -> VPS + CDN)

This runbook is the executable path for the infra sprint:
- frontend on Cloudflare Pages
- FastAPI on VPS behind Caddy
- PostgreSQL managed (Neon/Supabase)
- one-command deploy + rollback by SHA

Note: `release.sh` builds the API image with `deploy/v2/Dockerfile.vps` (backend-only),
so frontend deployment stays fully on Cloudflare Pages.

## Target budget (monthly)

- Cloudflare Pages: free
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
- `API_DOMAIN`
- `TLS_EMAIL`
- `FRONTEND_ORIGIN` and `FRONTEND_ORIGINS` (Cloudflare Pages URL)
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
curl -fsS https://<API_DOMAIN>/health
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

## 5) Cloudflare Pages setup (frontend)

Set these project variables:
- `VITE_API_BASE_URL=https://<API_DOMAIN>`
- `VITE_CESIUM_ION_TOKEN=<restricted-token>`

Build settings:
- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Root directory: `immo-app`

## 6) J1 done criteria

- `https://<API_DOMAIN>/health` returns `status=ok`
- frontend on Cloudflare Pages calls the new API successfully
- no Home Assistant runtime dependency in public path
- deploy works with one command (`release.sh deploy`)
- rollback works with one command (`release.sh rollback`)
