# Deploying SalesRx with Docker — Step by Step

This guide takes you from a fresh machine to a running, persistent SalesRx deployment. The image uses Next.js standalone output, so the final container is small (~150 MB) and runs as a non-root user.

Think of the setup as three boxes: the **image** (a frozen snapshot of the app), the **container** (the running copy), and the **volume** (the container's long-term memory — brief cache and watchlist survive restarts because they live there, not inside the container).

---

## Prerequisites

1. **Docker Engine 24+** (includes Compose). Install: https://docs.docker.com/get-docker/ — verify with:
   ```bash
   docker --version && docker compose version
   ```
2. **An Anthropic API key** from https://console.anthropic.com
3. The repo:
   ```bash
   git clone https://github.com/sensware/salesrx.git
   cd salesrx
   ```

## Step 1 — Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Optional: `THEIRSTACK_API_KEY` (verified hiring/technographic signals), `SALESRX_MODEL`, `SALESRX_MAX_WEB_SEARCHES`, `SALESRX_CACHE_TTL_HOURS`.

The `.env` file is read at **runtime**, never baked into the image — `.dockerignore` excludes it, so the image is safe to share or push to a registry.

## Step 2 — Build the image

```bash
docker build -t salesrx:latest .
```

What happens: stage 1 installs exact dependencies from `package-lock.json`, stage 2 compiles the Next.js app, stage 3 copies only the standalone server + static assets into a clean Alpine image with a non-root `salesrx` user.

## Step 3 — Run the container

```bash
docker run -d \
  --name salesrx \
  --env-file .env \
  -p 3000:3000 \
  -v salesrx-data:/app/data \
  --restart unless-stopped \
  salesrx:latest
```

Flag by flag: `-d` detached; `--env-file .env` injects your keys; `-p 3000:3000` exposes the app; `-v salesrx-data:/app/data` is the named volume that persists the brief cache and watchlist; `--restart unless-stopped` survives reboots.

## Step 4 — Verify

```bash
docker ps                      # STATUS should be "Up"
docker logs -f salesrx         # look for "Ready in ..."
curl -I http://localhost:3000  # HTTP/1.1 200 OK
```

Open http://localhost:3000, set up a rep profile, and run one prospect research end-to-end (expect 30–90 s — it does live web research).

## Step 5 (recommended) — Compose instead of raw `docker run`

The repo ships a `docker-compose.yml` that runs the app **plus** a tiny cron sidecar that refreshes the watchlist nightly at 03:00 UTC (so signal alerts arrive without you clicking anything):

```bash
docker compose up -d --build
```

Everything from steps 2–3 happens automatically. Check both services:

```bash
docker compose ps
docker compose logs -f salesrx
```

Don't want the cron sidecar? `docker compose up -d salesrx`.

## Step 6 — Updating to a new version

```bash
git pull
docker compose up -d --build     # rebuilds and swaps the container
```

The volume is untouched — cache and watchlist carry over. (Raw-Docker equivalent: `docker build -t salesrx:latest . && docker rm -f salesrx` then re-run step 3.)

## Operations cheat-sheet

| Task | Command |
|---|---|
| Stop / start | `docker compose stop` / `docker compose start` |
| Tail logs | `docker compose logs -f salesrx` |
| Shell into container | `docker exec -it salesrx sh` |
| Inspect watchlist data | `docker exec salesrx cat /app/data/watchlist.json` |
| Clear brief cache | `docker exec salesrx rm -rf /app/data/cache` |
| Manual watchlist refresh | `curl -X POST http://localhost:3000/api/watchlist/refresh` |
| Full reset (incl. data!) | `docker compose down -v` |

## Deploying to a server / cloud

The same image runs anywhere Docker does:

- **Any VPS** (Hetzner, DigitalOcean, EC2): install Docker, clone, `docker compose up -d --build`. Put a reverse proxy (Caddy or nginx) in front for HTTPS and a domain.
- **Registry flow**: `docker tag salesrx:latest <registry>/salesrx:0.2.0 && docker push ...`, then pull on the server — no build tools needed there.
- **Managed containers** (Cloud Run, ECS/Fargate, Fly.io): works, with one caveat — the file-based cache/watchlist needs a persistent volume. Fly.io volumes work as-is; on Cloud Run (ephemeral filesystem) treat the cache as disposable or wait for the v1.2 database migration.

## Troubleshooting

- **`ANTHROPIC_API_KEY is not set` in logs** → the `.env` file wasn't passed; re-run with `--env-file .env` (or check it's next to `docker-compose.yml`).
- **Port already in use** → change the left side of the mapping: `-p 8080:3000`, then browse to :8080.
- **Research requests time out behind a proxy** → raise the proxy's read timeout to ≥120 s; live research legitimately takes that long.
- **Watchlist empty after container replacement** → you ran without the volume; always mount `salesrx-data:/app/data`.
