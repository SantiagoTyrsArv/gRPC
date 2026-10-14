# Guía de despliegue

TypeRace se despliega en dos plataformas:

| Pieza                   | Plataforma  | Qué se publica                         |
| ----------------------- | ----------- | -------------------------------------- |
| Backend (`apps/server`) | **Railway** | Contenedor Docker + PostgreSQL         |
| Frontend (`apps/web`)   | **Vercel**  | Sitio estático (SPA) generado por Vite |

```mermaid
flowchart LR
  U[Navegador] -- HTTPS --> V[Vercel<br/>apps/web]
  U -- "Connect / gRPC-Web<br/>(HTTPS, HTTP/1.1)" --> R[Railway<br/>apps/server]
  R -- red privada --> P[(PostgreSQL<br/>Railway)]
```

> **Por qué no hay `railway.json`.** Railway retiró el formato _Config as Code_
> (`railway.json` / `railway.toml`): está deprecado y deja de leerse el
> 2026-12-01. Su reemplazo (_Infrastructure as Code_, `.railway/railway.ts`) está
> en beta y se aplica manualmente con la CLI. Por eso la configuración del
> servicio se hace en el panel siguiendo esta guía; el artefacto versionado es el
> `Dockerfile`.

## Orden recomendado

1. Railway: base de datos.
2. Railway: servicio del backend y dominio público.
3. Vercel: frontend con `VITE_API_URL` apuntando a Railway.
4. Railway: `CORS_ORIGIN` con el dominio de Vercel.
5. Verificación.

---

## 1. Railway: base de datos

1. En [railway.com](https://railway.com) crea un proyecto nuevo (**New Project → Empty Project**).
2. **Create → Database → PostgreSQL**. Railway crea el servicio `Postgres` con la
   variable `DATABASE_URL`.

## 2. Railway: servicio del backend

1. **Create → GitHub Repo** y elige este repositorio (autoriza la app de Railway en
   GitHub si te lo pide).
2. En el servicio nuevo → **Settings**:

   | Sección | Ajuste              | Valor                                                                       |
   | ------- | ------------------- | --------------------------------------------------------------------------- |
   | Source  | Root Directory      | _(vacío: la raíz del repo)_ — el Dockerfile necesita `proto/` y `packages/` |
   | Source  | Branch              | `main`                                                                      |
   | Build   | Builder             | **Dockerfile**                                                              |
   | Build   | Dockerfile Path     | `apps/server/Dockerfile`                                                    |
   | Build   | Watch Paths         | `/apps/server/**`, `/packages/**`, `/proto/**`, `/pnpm-lock.yaml`           |
   | Deploy  | Pre-deploy Command  | `node dist/scripts/migrate.js`                                              |
   | Deploy  | Healthcheck Path    | `/health`                                                                   |
   | Deploy  | Healthcheck Timeout | `100`                                                                       |
   | Deploy  | Restart Policy      | **On Failure**, máximo `5` reintentos                                       |

   Si tu panel no muestra _Dockerfile Path_, define la variable
   `RAILWAY_DOCKERFILE_PATH=apps/server/Dockerfile` (paso 3).

3. **Variables** del servicio:

   | Variable       | Valor                                                          |
   | -------------- | -------------------------------------------------------------- |
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (referencia a la base del paso 1) |
   | `NODE_ENV`     | `production`                                                   |
   | `LOG_LEVEL`    | `info`                                                         |
   | `CORS_ORIGIN`  | Provisional: `https://example.com` (se corrige en el paso 4)   |

   No definas `PORT`: Railway la inyecta y el servidor la usa automáticamente.
   El servidor exige `DATABASE_URL` y `CORS_ORIGIN` en producción y no arranca sin ellas.

4. **Settings → Networking → Generate Domain**. Si pregunta el puerto, usa `8080`.
   Obtendrás una URL del tipo `https://<algo>.up.railway.app`.
5. Espera el despliegue. En **Deployments** verás primero el _pre-deploy_
   (migraciones + seed de 25 textos) y luego el healthcheck en verde.
6. Comprueba: `https://<tu-dominio-railway>/health` debe responder
   `{"status":"ok","database":"ok"}`.

## 3. Vercel: frontend

1. En [vercel.com](https://vercel.com) → **Add New → Project** → importa el repositorio
   (o usa el proyecto que ya creaste).
2. **Settings → Build and Deployment**:

   | Ajuste                                                               | Valor                                                                                        |
   | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
   | Root Directory                                                       | `apps/web`                                                                                   |
   | Include source files outside of the Root Directory in the Build Step | **Activado** (necesita `proto/` y `packages/`)                                               |
   | Framework / Build / Output                                           | Se toman de `apps/web/vercel.json` (Vite, `pnpm --filter @typerace/web... build`, `dist`)    |
   | Ignored Build Step                                                   | Vacío (lo define `ignoreCommand` en `vercel.json`); si pusiste `exit 0` para pausar, quítalo |

3. **Settings → Environment Variables**:

   | Variable       | Valor                                            | Entornos             |
   | -------------- | ------------------------------------------------ | -------------------- |
   | `VITE_API_URL` | `https://<tu-dominio-railway>` (sin barra final) | Production y Preview |

   Sin esta variable el build **falla a propósito** con un mensaje claro.

4. **Deployments → Redeploy** (las variables de Vite se incrustan en el build, así
   que cualquier cambio de `VITE_API_URL` requiere volver a desplegar).
5. Anota tu dominio de producción, p. ej. `https://typerace.vercel.app`.

## 4. Railway: CORS

En las variables del backend, cambia `CORS_ORIGIN` al dominio de Vercel:

```
CORS_ORIGIN=https://typerace.vercel.app
```

- Varios orígenes se separan por comas.
- Admite `*` como comodín de un segmento, útil para los _preview deployments_:
  `https://typerace.vercel.app,https://typerace-*.vercel.app`
- Sin barra final. Railway redespliega solo al guardar.

## 5. Verificación

1. Abre el dominio de Vercel, crea una sala y copia el enlace de invitación.
2. Ábrelo en otra pestaña o en el móvil, únete y corre una carrera.
3. En **Ranking** debe aparecer el resultado (se guarda en PostgreSQL).
4. Si algo falla, revisa:
   - Consola del navegador: un error de CORS indica `CORS_ORIGIN` mal escrito.
   - Logs de Railway (JSON estructurado, con `rpc` y `code` por cada RPC rechazada).

---

## GitHub

- El workflow `.github/workflows/ci.yml` corre en cada push y PR: buf lint/breaking,
  generación, lint, typecheck, tests (con PostgreSQL de servicio), build y la imagen Docker.
- Recomendado: **Settings → Branches → Add rule** para `main` exigiendo que pase el CI.
- En Railway puedes activar **Settings → Deploy → Wait for CI** para no desplegar
  commits con el CI en rojo.

## Limitaciones conocidas

- **gRPC nativo por el dominio público de Railway no funciona**: el proxy HTTPS de
  Railway reenvía HTTP/1.1 al contenedor, y gRPC nativo exige HTTP/2 de extremo a
  extremo. Connect y gRPC-Web (lo que usa el navegador) sí funcionan sobre HTTP/1.1.
  Para clientes gRPC nativos (bot CLI) se usa el puerto opcional `GRPC_PORT` (h2c)
  en local; en Railway podría exponerse con un _TCP Proxy_, sin TLS gestionado.
- **Estado en memoria**: las salas viven en el proceso. Un redespliegue cierra las
  salas activas (los clientes reconectan y se les ofrece volver a unirse). Por la
  misma razón el servicio debe tener **una sola réplica**.
- **Streams largos**: el servidor envía un _heartbeat_ cada 15 s para que el proxy no
  corte el stream por inactividad, y el cliente reconecta con backoff si se corta.

## Desarrollo local con Docker

```bash
pnpm db:up                                   # Postgres en localhost:5433
docker build -f apps/server/Dockerfile -t typerace-server .
docker run --rm -e DATABASE_URL=postgres://typerace:typerace@host.docker.internal:5433/typerace \
  -e CORS_ORIGIN=http://localhost:5173 typerace-server node dist/scripts/migrate.js
docker run --rm -p 8080:8080 \
  -e DATABASE_URL=postgres://typerace:typerace@host.docker.internal:5433/typerace \
  -e CORS_ORIGIN=http://localhost:5173 typerace-server
```
