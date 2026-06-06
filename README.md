# 🚀 Linkboard — a Liftoff demo app

A deliberately small **URL shortener with click analytics**, built to **showcase
[Liftoff](https://github.com/Liftoff-Launchpad/liftoff)** — a Deploy-as-a-Service
platform that provisions infrastructure into *your own* DigitalOcean account.

The code in each component is tiny on purpose. The point isn't the app — it's that
this one repo lights up the Liftoff canvas with **many nodes** (5 services + 3
resources) and exercises **most of the platform's features** at once.

> This repo is a *sample you deploy with Liftoff*. It is not the Liftoff product.

---

## What it looks like on the canvas

```
        web (service) ───── API_URL (service link) ─────▶ api (service, ×2)
        dashboard  /app                                    /  ·  /api/*  ·  /:code
                                                            │
                              ┌───────── DATABASE_URL ──────┤
                              │          REDIS_URL ─────────┤
                              │          SPACES_* ──────────┤
                              ▼                             ▼              ▼
                       ┌────────────┐              ┌────────────┐  ┌────────────┐
                       │ Postgres   │              │   Redis    │  │  Spaces    │
                       │ (resource) │              │ (resource) │  │  (bucket)  │
                       └─────┬──────┘              └─────┬──────┘  └────────────┘
              DATABASE_URL ──┤                           │ REDIS_URL
                             ▼                           ▼
                       cron (job, 03:00)           worker (worker)
                       prune old links             drain click queue

                       docs (static_site)  /docs
```

**8 nodes, 7 connections.** Every box is a node on the Liftoff canvas; every arrow is a connection edge.

---

## Liftoff features this demo exercises

| Feature | Where |
|---|---|
| **All 4 service kinds** | `service` (api, web), `worker` (worker), `job`/cron (cron), `static_site` (docs) |
| **All 3 resource kinds** | Postgres, Redis, Spaces bucket |
| **Both connection kinds** | resource→service **bindings** + web→api **service link** |
| **Auto-injected env vars** | `DATABASE_URL`, `REDIS_URL`, `SPACES_*`, `API_URL` — no manual connection strings |
| **Both build strategies** | Dockerfile (api, web, cron, docs) **and** Nixpacks (worker has *no* Dockerfile) |
| **Secrets vault** | `SESSION_SECRET`, `SPACES_KEY`, `SPACES_SECRET` (declared in `liftoff.yml` → set in the UI) |
| **Healthchecks** | `/health` on api & web |
| **Scaling / replicas** | api runs **2 replicas** |
| **Config as code** | the whole topology in [`liftoff.yml`](./liftoff.yml) |
| **Multi-service env** | 5 components, one environment, one atomic deploy |

---

## Deploying with Liftoff

### 1. Connect the repo
In Liftoff: create a project, connect this GitHub repo, and create an environment.
Liftoff reads [`liftoff.yml`](./liftoff.yml) and creates the five service nodes, the
**Postgres** node and the **Spaces** node.

### 2. Add the Redis node and draw the connections (the fun part)
Redis and the wiring live on the **interactive canvas** (this is Liftoff's headline
feature). On the canvas:

1. **Add a Redis resource** node from the palette.
2. **Draw these edges** (Liftoff injects the env var automatically — shown in brackets):

   | From | To | Injects |
   |---|---|---|
   | Postgres | api | `DATABASE_URL` |
   | Redis | api | `REDIS_URL` |
   | Spaces | api | `SPACES_BUCKET`, `SPACES_ENDPOINT`, `SPACES_REGION` |
   | Postgres | worker | `DATABASE_URL` |
   | Redis | worker | `REDIS_URL` |
   | Postgres | cron | `DATABASE_URL` |
   | web → api (service link) | | `API_URL` ← **name this var `API_URL`** |

3. **Set the secret vault values** for `SESSION_SECRET`, and (for the Spaces export)
   `SPACES_KEY` + `SPACES_SECRET` (a Spaces access key pair from your DO account).
4. **Apply / deploy.**

### 3. Choose how much to actually run (free-tier aware)
Liftoff builds **one container-registry repository per service**, and the **free
DigitalOcean registry ("Starter") allows 1 repository / 500 MB**. So:

- **💸 Free-tier demo:** deploy just **api**, and leave Postgres/Redis/Spaces as
  **draft** nodes on the canvas (they still render — a rich, multi-node picture at
  ~no cost). Great for a screenshot / walkthrough.
- **🟢 Full demo:** enable the **Basic registry** (`$5/mo`, 5 repos — covered by DO/GitHub
  Student credit) so all five services can build, then provision the managed
  resources. Everything runs live.

Each component is a tiny Alpine image (~80–100 MB) on the smallest **512 MB** instance,
so it stays inside the limits either way.

---

## Run it locally (no Liftoff needed)

Everything runs with Docker — `postgres` ≈ Managed Postgres, `redis` ≈ Managed Redis,
`minio` ≈ Spaces:

```bash
docker compose up --build
```

- Dashboard → <http://localhost:3001/>
- API → <http://localhost:3000/>  (`/health`, `POST /api/links`, `GET /:code`)
- MinIO console → <http://localhost:9001/>  (user/pass `minioadmin`)

Try it:
```bash
curl -X POST localhost:3000/api/links -H 'content-type: application/json' \
     -d '{"url":"https://digitalocean.com"}'
# -> { "code":"ab12cd", "short":"/ab12cd" }
curl -i localhost:3000/ab12cd          # 302 redirect, click queued
curl localhost:3000/api/export         # writes a CSV to the Spaces/MinIO bucket
```

The local env vars are the same names Liftoff injects — see [`.env.example`](./.env.example).

---

## Repository layout

```
linkboard/
├── liftoff.yml              # the topology (services + Postgres + Spaces)
├── docker-compose.yml       # run the whole thing locally
├── .env.example             # the env vars Liftoff injects (documented)
└── services/
    ├── api/      Express + pg + ioredis + S3   (Dockerfile)
    ├── web/      server-rendered dashboard      (Dockerfile, service-links to api)
    ├── worker/   Redis queue consumer           (NO Dockerfile → Nixpacks)
    ├── cron/     nightly prune job              (Dockerfile, cron schedule)
    └── docs/     static site                    (nginx, static_site)
```

---

*Linkboard is a demo for the Liftoff Final Year Project. Built with Node.js, Docker,
PostgreSQL, Redis and DigitalOcean Spaces.*
