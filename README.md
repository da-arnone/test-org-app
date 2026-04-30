# org-app

Organisation and contract management — one of four components in the DDQ
ecosystem. This repository contains org-app on its own; assembly with the
other components (provider-app, subscription-app, auth-app) is the concern of
the platform repository.

The component is structured to be both **runnable on its own** and
**installable into a host Django project** without code changes.

## Repository layout

```
backend/
├── pyproject.toml          ← makes org_app pip-installable
├── manage.py               ← standalone dev server entry point
├── dev_project/            ← settings + urls used only when running solo
└── org_app/
    ├── models.py
    ├── serializers.py
    ├── services/           ← seam for cross-component HTTP clients
    ├── urls/               ← admin / api / third sub-routers
    ├── views/
    ├── migrations/
    └── fixtures/seed.json
frontend/
├── package.json
├── webpack.config.js       ← exposes org_app as a Module Federation remote
├── public/index.html
└── src/
    ├── index.js → bootstrap.jsx
    ├── App.jsx             ← exposed as `./App` to a shell
    ├── api.js
    └── pages/
docker/
├── Dockerfile
└── docker-compose.yml      ← standalone deployment
```

## URL surfaces

Per the component spec, org-app exposes three URL prefixes. Only `third/org/`
is reachable cross-boundary; the other two are for org-app's own UIs.

| Surface | Prefix       | Consumers                |
|---------|--------------|--------------------------|
| Admin   | `/admin/org/`| org-app's admin UI       |
| App     | `/api/org/`  | org-app's end-user UI    |
| Third   | `/third/org/`| Other ecosystem components |

### Admin (`/admin/org/`) — full lifecycle

- `GET/POST /admin/org/organizations/`
- `GET/PUT/PATCH/DELETE /admin/org/organizations/<id>/`
- `GET/POST /admin/org/contracts/`
- `GET/PUT/PATCH/DELETE /admin/org/contracts/<id>/`
- `POST /admin/org/contracts/<id>/attach/` — body `{"organization_id": <id>}`
- `POST /admin/org/contracts/<id>/detach/`

### App (`/api/org/`) — read + descriptive updates, scoped to current org

The current organisation is resolved by the `X-Organization-Id` header (POC
shortcut for what will eventually be carried in the auth-app JWT).

- `GET /api/org/organization/` — current organisation
- `GET /api/org/contracts/` — contracts of the current organisation
- `GET /api/org/contracts/<id>/`
- `PATCH /api/org/contracts/<id>/` — only `description` is writable
- `GET /api/org/providers/` — public providers from provider-app third surface
- `GET /api/org/providers/<id>/` — public provider details
- `GET /api/org/providers/<id>/forms/` — public provider forms (proxy of provider-app third surface)
- `GET /api/org/providers/<id>/answers/` — provider answers for selected provider (includes private answers when provider-app authorizes current org)
- `GET /api/org/subscriptions/requests/` — subscription requests for current org (proxies subscription-app third API)
- `POST /api/org/subscriptions/requests/create/` — body: `{ "provider_id": <int>, "requested_private_fields": [...], "reason": "..." }`
  - org-app maps this into the generic subscription contract:
    `{ "submitting_entity_id": <org_id>, "submitting_entity_type": "organization", "submitee_entity_id": <provider_id>, "submitee_entity_type": "provider", ... }`

Set `SUBSCRIPTION_APP_URL` (or legacy `SUSCRIPTION_APP_URL`, default `http://localhost:8003`) so org-app can reach **subscription-app**.

### Third (`/third/org/`) — cross-component

- `GET /third/org/organizations/<id>/` — WHOIS
- `GET /third/org/contracts/<ref>/`
- `POST /third/org/authorise/` — body `{"organization_id": <id>, "action": <str>}`

## Running standalone

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate     # or .venv\Scripts\activate on Windows
pip install -e .
python manage.py migrate
python manage.py loaddata seed
python manage.py runserver 8000
```

Smoke test:

```bash
curl http://localhost:8000/api/org/contracts/ -H "X-Organization-Id: 1"
curl http://localhost:8000/third/org/organizations/1/
```

### Frontend

```bash
cd frontend
npm install
npm start         # dev server on http://localhost:3001 (proxies /api, /admin, /third → :8000)
```

`npm run build` produces `dist/remoteEntry.js`, which is what an assembly
shell consumes via `ModuleFederationPlugin`.

### Docker

```bash
docker compose -f docker/docker-compose.yml up --build
```

## Assembly seam

The component publishes its assembly contract through three artefacts:

- **Backend:** `org_app` is a pip-installable Django app. A host project
  installs it (`pip install org-app`) and includes its URLs:
  ```python
  import org_app.urls
  urlpatterns = [path("", include(org_app.urls))]
  ```
- **Frontend:** webpack builds a `remoteEntry.js` that exposes `./App`. A shell
  imports it via `React.lazy(() => import("org_app/App"))` and mounts it under
  its own route (e.g. `/org/*`).
- **Cross-component calls:** other components must call `/third/org/` only.
  org-app never exposes `admin/` or `api/` cross-boundary.

## Auth integration (`third/auth`)

`org-app` now integrates with `auth-app` over `third/auth` for every
`/api/org/*` request:

- reads `Authorization: Bearer <token>`
- calls `POST /third/auth/validate`
- resolves user profile context via `POST /third/auth/whois` when
  `X-Organization-Id` is not provided
- calls `POST /third/auth/authorize` with:
  `{ "appScope": "org-app", "requiredRole": "org-app", "context": "org-<id>" }`

Set auth service base URL with:

```bash
# Windows PowerShell
$env:AUTH_APP_URL="http://localhost:3000"
```

Default is `http://localhost:3000`.

Provider consultation requires provider-app base URL:

```bash
# Windows PowerShell
$env:PROVIDER_APP_URL="http://localhost:8002"
```

Default is `http://localhost:8002`.

When org-app runs in Docker and provider-app runs on the host (or another
compose project), use:

```bash
PROVIDER_APP_URL=http://host.docker.internal:8002
```

Optional provider client debug logs:

```bash
# Windows PowerShell
$env:PROVIDER_CLIENT_DEBUG="true"
```

When enabled, org-app backend logs outbound provider-app request URLs and status codes.

### Run both services independently

1. Start auth-app (`test-auth-app`):
   - `npm run start:auth`
2. Start org-app backend:
   - `cd backend`
   - `python manage.py runserver 8000`
3. Login/token from auth-app:
   - `POST http://localhost:3000/third/auth/token`
4. Call org-app app API:
   - `GET http://localhost:8000/api/org/contracts/`
   - header: `Authorization: Bearer <token>`
   - optional header: `X-Organization-Id: 1`

## What's intentionally not here

- A real JWT validator (waiting for auth-app).
- A platform shell — that lives in the assembly repo, not in any component.
- Multi-organisation user sessions — every user is scoped to one organisation
  per the component spec.
