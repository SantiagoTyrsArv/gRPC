# Guía de despliegue

TypeRace se despliega en tres servicios, todos con plan gratuito:

| Pieza                   | Plataforma | Qué se publica                              |
| ----------------------- | ---------- | ------------------------------------------- |
| Backend (`apps/server`) | **Render** | Contenedor Docker (Blueprint `render.yaml`) |
| Base de datos           | **Neon**   | PostgreSQL serverless                       |
| Frontend (`apps/web`)   | **Vercel** | Sitio estático (SPA) generado por Vite      |

```mermaid
flowchart LR
  U[Navegador] -- HTTPS --> V[Vercel<br/>apps/web]
  U -- "Connect / gRPC-Web<br/>(HTTPS, HTTP/1.1)" --> R[Render<br/>apps/server]
  R -- "TLS (sslmode=require)" --> P[(PostgreSQL<br/>Neon)]
```

La lista de pasos para hacer clic en cada panel está en
[`checklist-despliegue.md`](./checklist-despliegue.md). Este documento explica las
decisiones.

## Artefactos versionados

| Archivo                  | Para qué                                                                      |
| ------------------------ | ----------------------------------------------------------------------------- |
| `apps/server/Dockerfile` | Imagen del backend. Contexto = raíz del monorepo (necesita `proto/`).         |
| `render.yaml`            | Blueprint de Render: servicio, health check, filtros de build y variables.    |
| `apps/web/vercel.json`   | Build del frontend (incluye `proto-gen`), reescrituras SPA e _ignored build_. |

## Decisiones

### Migraciones al arrancar el contenedor

El plan gratuito de Render **no permite _pre-deploy command_**. Por eso el `CMD` del
Dockerfile es:

```sh
node dist/scripts/migrate.js && exec node dist/main.js
```

- La migración es **idempotente**: si no hay migraciones nuevas no hace nada y el seed de
  textos solo inserta los que faltan (`insertedTexts: 0` en los arranques siguientes).
- Si la migración falla, el contenedor termina con error, el health check no pasa y Render
  **mantiene la versión anterior** en línea.
- `exec` deja a Node como PID 1, así recibe `SIGTERM` y cierra ordenadamente.
- Con una sola instancia no hay migraciones concurrentes; aun así, el migrador usa un
  _advisory lock_.

### Neon: conexión directa, no la _pooled_

Neon ofrece dos cadenas de conexión. Usamos la **directa** (sin `-pooler` en el host):

- El _advisory lock_ de la migración es por sesión y no funciona detrás de PgBouncer en
  modo transacción.
- Solo hay una instancia con un pool pequeño (10 conexiones), muy por debajo del límite.

La cadena de Neon trae `?sslmode=require&channel_binding=require`. `sslmode=require`
activa TLS (verificado: Postgres ve la conexión como `TLSv1.3`). El driver `postgres` no
reconoce `channel_binding` y lo enviaría como parámetro de sesión, que Postgres rechaza;
`normalizeDatabaseUrl` (`apps/server/src/infrastructure/db/client.ts`) lo quita, así que
**la cadena se puede pegar tal cual**.

Neon suspende la base tras unos minutos sin uso; la primera consulta tras la pausa tarda
algo más (la "despierta") y el driver reconecta solo.

### Variables de entorno

| Variable       | Dónde  | Valor                                                                              |
| -------------- | ------ | ---------------------------------------------------------------------------------- |
| `DATABASE_URL` | Render | Cadena directa de Neon. `sync: false`: Render la pide al crear el Blueprint.       |
| `CORS_ORIGIN`  | Render | Dominio de Vercel, en `render.yaml`. Admite comas y `*` (un segmento).             |
| `NODE_ENV`     | Render | `production` (exige `DATABASE_URL` y `CORS_ORIGIN`).                               |
| `LOG_LEVEL`    | Render | `info`                                                                             |
| `PORT`         | Render | **No se define**: Render la inyecta (10000) y el servidor la usa.                  |
| `VITE_API_URL` | Vercel | URL de Render, sin barra final. Se incrusta en el build: cambiarla exige Redeploy. |

`CORS_ORIGIN` para los _preview deployments_ de Vercel:

```
https://type-race-eta.vercel.app,https://type-race-santiagoartyrs-projects.vercel.app,https://type-race-*-santiagoartyrs-projects.vercel.app
```

### Build del frontend en Vercel

`buildCommand` es `pnpm --filter @typerace/web... build`: construye `proto-gen` (genera el
código con `buf`) y luego la web. No se puede depender del `prepare` de `proto-gen` porque
Vercel restaura `node_modules` desde caché, el install no hace nada y el código generado
(ignorado por git) no existe.

Sin `VITE_API_URL` el build **falla a propósito**: es mejor un error en el log que una
página en blanco en producción.

### Despliegue automático

- Render: `autoDeployTrigger: commit` despliega cada commit de `main`, y `buildFilter`
  ignora los cambios que no tocan el backend. No se usa `checksPass` porque también esperaría
  el estado de Vercel en GitHub, que puede fallar u omitirse sin relación con el backend. Si
  la migración o el arranque fallan, el health check no pasa y sigue en línea la versión
  anterior.
- Vercel: `ignoreCommand` omite el build si nada de la web, `packages/` ni `proto/` cambió
  desde el **último deploy exitoso** (`VERCEL_GIT_PREVIOUS_SHA`). Comparar solo con `HEAD^`
  no sirve: un commit que solo toca docs cancelaría también los Redeploy aunque producción
  siga en una versión vieja. Si no hay deploy previo o el SHA no está en el clon, construye.

## Limitaciones conocidas

- **El plan gratuito de Render duerme el servicio** tras 15 minutos sin tráfico entrante. El
  servicio tarda ~1 minuto en despertar y las peticiones del frontend durante ese tiempo
  pueden fallar (basta recargar después). Las salas que existían se pierden al dormir. Para
  una demo, abre `/health` un par de minutos antes. Render da 750 horas gratuitas al mes por workspace (suficiente para un
  servicio encendido todo el mes).
- **Estado en memoria**: las salas viven en el proceso. Un redespliegue o una suspensión
  cierran las salas activas (los clientes reconectan y se les ofrece volver a unirse). Por la
  misma razón el servicio debe tener **una sola instancia** (`numInstances: 1`).
- **gRPC nativo por el dominio público no funciona**: el proxy de Render reenvía HTTP/1.1 al
  contenedor y gRPC nativo exige HTTP/2 de extremo a extremo. Connect y gRPC-Web (lo que usa
  el navegador) sí funcionan. El puerto `GRPC_PORT` (h2c) queda para uso local.
- **Streams largos**: el servidor envía un _heartbeat_ cada 15 s para que el proxy no corte
  el stream por inactividad, y el cliente reconecta con backoff si se corta.

## Alternativa: Railway

El mismo Dockerfile sirve en Railway (Builder **Dockerfile**, Root Directory vacío,
Healthcheck `/health`, `DATABASE_URL=${{Postgres.DATABASE_URL}}`). Como las migraciones
ya corren al arrancar, no hace falta _pre-deploy command_. Railway no lee `render.yaml` y su
formato `railway.json` está deprecado (deja de leerse el 2026-12-01), así que la
configuración se hace en el panel.

## Desarrollo local con Docker

```bash
pnpm db:up                                   # Postgres en localhost:5433
docker build -f apps/server/Dockerfile -t typerace-server .
docker run --rm -p 8080:8080 \
  -e DATABASE_URL=postgres://typerace:typerace@host.docker.internal:5433/typerace \
  -e CORS_ORIGIN=http://localhost:5173 typerace-server
```

El contenedor migra y luego arranca; `curl localhost:8080/health` debe responder
`{"status":"ok","database":"ok"}`.
