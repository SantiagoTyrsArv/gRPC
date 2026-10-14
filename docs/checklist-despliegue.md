# Checklist de despliegue de TypeRace (paso a paso)

Lista personal para dejar TypeRace en producción. Ve marcando cada casilla `[ ]` → `[x]`.
La referencia técnica (el porqué de cada ajuste) está en [`deployment.md`](./deployment.md).

**Datos que ya conocemos**

| Dato                         | Valor                                                      |
| ---------------------------- | ---------------------------------------------------------- |
| Repositorio GitHub           | `SantiagoTyrsArv/gRPC` (rama `main`)                       |
| Proyecto Vercel (ya existe)  | `type-race` en el equipo _santiagoartyrs' projects_        |
| Dominio de producción Vercel | `https://type-race-santiagoartyrs-projects.vercel.app`     |
| Proyecto Railway             | **Aún no existe** (lo creas en la Parte 2)                 |
| Dominio de Railway           | Se genera en la Parte 2 → anótalo aquí: `________________` |

**Tiempo estimado:** 30–45 minutos. **Costo:** Railway cobra por uso (el plan Hobby
incluye un crédito mensual); Vercel Hobby es gratis.

> **Regla de oro:** las variables `VITE_*` se "hornean" dentro del frontend al
> construirlo. Cada vez que cambies `VITE_API_URL` en Vercel tienes que hacer **Redeploy**.
> En cambio, en Railway basta con guardar la variable: redespliega solo.

---

## Parte 0 — Subir la corrección del build de Vercel

Vercel fallaba porque restauraba `node_modules` desde caché y no generaba el código de
`proto-gen`. Ya está corregido en `apps/web/vercel.json`; solo falta subirlo.

- [ ] En la terminal, desde la raíz del repo:

  ```powershell
  git add apps/web/vercel.json docs/deployment.md docs/checklist-despliegue.md
  git status
  git commit -m "fix(web): construir proto-gen antes del frontend en vercel" -m "Vercel restaura node_modules desde caché y el install no ejecuta prepare." -m "Faltaba el código generado de proto-gen."
  git push origin main
  ```

  > Cada línea del mensaje debe tener como máximo 100 caracteres: el hook `commit-msg`
  > (commitlint) rechaza el commit si no, y entonces `git push` no sube nada
  > (`Everything up-to-date`). Comprueba con `git log --oneline -3` antes del push.

- [ ] En GitHub → pestaña **Actions**, espera a que el workflow **CI** quede en verde
      (dos jobs: _Lint, typecheck, test y build_ e _Imagen Docker del servidor_).
- [ ] Ignora por ahora el deploy que se lanza en Vercel: **va a fallar** con
      `Falta VITE_API_URL`. Es lo esperado; lo resolvemos en la Parte 3.

---

## Parte 1 — Railway: base de datos PostgreSQL

1. - [ ] Entra a <https://railway.com> e inicia sesión (la misma cuenta del proyecto FAKESNEWS).
2. - [ ] Arriba a la derecha: **New** (o **+ New Project**) → **Empty Project**.
3. - [ ] Ponle nombre al proyecto: arriba a la izquierda, clic en el nombre aleatorio →
         renómbralo a `typerace`.
4. - [ ] Dentro del proyecto (el lienzo vacío): botón **Create** (o clic derecho en el lienzo)
         → **Database** → **Add PostgreSQL**.
5. - [ ] Espera a que el servicio **Postgres** quede con el punto verde (≈30 s).
6. - [ ] Comprobación: clic en **Postgres** → pestaña **Variables** → debe existir
         `DATABASE_URL`. **No la copies a mano**; la referenciaremos en la Parte 2.

---

## Parte 2 — Railway: servicio del backend

### 2.1 Crear el servicio desde GitHub

1. - [ ] En el lienzo del proyecto: **Create** → **GitHub Repo**.
2. - [ ] Si es la primera vez, Railway pide instalar su app de GitHub:
         **Configure GitHub App** → elige tu cuenta → da acceso al repo `gRPC`
         (o a todos) → **Save**. Vuelve a Railway.
3. - [ ] Elige `SantiagoTyrsArv/gRPC`.
4. - [ ] Railway crea el servicio y **lanza un primer build de inmediato**. Probablemente
         falle (aún no tiene variables ni la ruta del Dockerfile). **No pasa nada**; sigue.
5. - [ ] Renombra el servicio: clic en el servicio → **Settings** → arriba, campo del
         nombre → `server`.

### 2.2 Settings del servicio

Clic en el servicio `server` → pestaña **Settings**. Ve sección por sección:

**Source**

- [ ] **Root Directory:** déjalo **vacío**. (El Dockerfile necesita `proto/` y
      `packages/`, que están fuera de `apps/server`.)
- [ ] **Branch connected to production:** `main`.
- [ ] **Wait for CI:** actívalo si aparece. Así Railway no despliega un commit con el CI en rojo.

**Build**

- [ ] **Builder:** elige **Dockerfile** (no Railpack/Nixpacks).
- [ ] **Dockerfile Path:** `apps/server/Dockerfile`
  - Si no ves este campo, lo resolvemos con una variable en el paso 2.3.
- [ ] **Watch Paths** (una por línea). Hacen que solo se redespliegue cuando cambia
      algo del backend:

  ```
  /apps/server/**
  /packages/**
  /proto/**
  /pnpm-lock.yaml
  ```

**Deploy**

- [ ] **Pre-deploy Command:** `node dist/scripts/migrate.js`
      (aplica las migraciones y carga los 25 textos de la carrera antes de cada despliegue).
- [ ] **Healthcheck Path:** `/health`
- [ ] **Healthcheck Timeout:** `100`
- [ ] **Restart Policy:** **On Failure**, máximo de reintentos `5`.
- [ ] **Replicas / Regions:** deja **1 réplica**. Las salas viven en memoria; con 2 réplicas
      cada jugador podría caer en una instancia distinta y no se verían entre sí.
- [ ] **Serverless / App Sleeping:** déjalo **desactivado**. Si el servicio "duerme", se
      cortan las carreras en curso.

### 2.3 Variables del servicio

Clic en `server` → pestaña **Variables** → **+ New Variable** (o **Raw Editor** para pegar
todo junto).

- [ ] `DATABASE_URL` → escribe exactamente `${{Postgres.DATABASE_URL}}`
  - Al escribir `${{` Railway autocompleta; elige **Postgres → DATABASE_URL**.
  - Si renombraste el servicio de base de datos, cambia `Postgres` por ese nombre.
- [ ] `NODE_ENV` → `production`
- [ ] `LOG_LEVEL` → `info`
- [ ] `CORS_ORIGIN` → `https://type-race-santiagoartyrs-projects.vercel.app`
  - Sin barra final. (Como ya conocemos el dominio de Vercel, lo dejamos bien desde ya.)
- [ ] **Solo si en 2.2 no apareció _Dockerfile Path_:**
      `RAILWAY_DOCKERFILE_PATH` → `apps/server/Dockerfile`
- [ ] **NO** crees `PORT` ni `HOST`: Railway inyecta `PORT` y el servidor ya escucha en `0.0.0.0`.

Si usas el **Raw Editor**, pega esto:

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
NODE_ENV=production
LOG_LEVEL=info
CORS_ORIGIN=https://type-race-santiagoartyrs-projects.vercel.app
```

- [ ] Pulsa **Deploy** / **Apply changes** (Railway muestra un banner con los cambios
      pendientes arriba del lienzo).

### 2.4 Dominio público

1. - [ ] `server` → **Settings** → sección **Networking** → **Public Networking** →
         **Generate Domain**.
2. - [ ] Si pregunta el puerto, escribe `8080`.
3. - [ ] Copia la URL generada (algo como `https://server-production-xxxx.up.railway.app`)
         y anótala arriba en la tabla de **Datos**.

### 2.5 Verificar el despliegue

1. - [ ] `server` → pestaña **Deployments** → abre el despliegue más reciente.
2. - [ ] En los logs de build debe verse el Dockerfile ejecutándose
         (`FROM node:24-alpine`, `pnpm install`, `pnpm --filter @typerace/server build`).
         El primer build tarda 2–4 min.
3. - [ ] Luego la fase **Pre-deploy** debe mostrar una línea JSON con
         `"msg":"Migraciones y seed aplicados"`.
4. - [ ] Luego **Healthcheck** en verde y el estado del despliegue en **Active / Success**.
5. - [ ] En el navegador abre `https://<tu-dominio-railway>/health`. Debe responder:

   ```json
   { "status": "ok", "database": "ok" }
   ```

6. - [ ] **Pásame la URL de Railway en el chat.** Con la CLI puedo revisar los logs y
         probar el CORS desde aquí.

---

## Parte 3 — Vercel: frontend

### 3.1 Revisar la configuración del proyecto

Entra a <https://vercel.com> → equipo **santiagoartyrs' projects** → proyecto **type-race**
→ **Settings**.

**Build and Deployment**

- [ ] **Root Directory:** `apps/web`
- [ ] **Include files outside the root directory in the Build Step:** **Enabled**
      (necesita `proto/` y `packages/`).
- [ ] **Framework Preset / Build Command / Output Directory / Install Command:**
      sin _Override_ activado. Vercel los toma de `apps/web/vercel.json`.
  - Si alguno tiene el interruptor **Override** encendido, apágalo.
- [ ] **Ignored Build Step:** en **Automatic** (o vacío). Si alguna vez pusiste `exit 0`
      para pausar los deploys, quítalo.
- [ ] **Node.js Version:** `24.x` (ya está así).

### 3.2 Variable de entorno

**Settings → Environment Variables → Add New**:

- [ ] **Key:** `VITE_API_URL`
- [ ] **Value:** `https://<tu-dominio-railway>`, **sin barra final** y con `https://`.
- [ ] **Environments:** marca **Production** y **Preview** (Development opcional).
- [ ] **Sensitive:** déjalo desactivado (no es un secreto; termina visible en el JS del navegador).
- [ ] **Save**.

### 3.3 Redeploy

- [ ] **Deployments** → el deploy más reciente (el que falló en la Parte 0) → menú `⋯` →
      **Redeploy**.
- [ ] Desmarca **Use existing Build Cache**. Así confirmamos que la corrección funciona
      incluso sin caché.
- [ ] Espera el estado **Ready** (≈1 min). En los logs debe verse primero
      `packages/proto-gen build` y luego `apps/web build` con `✓ built`.

### 3.4 Deployment Protection (importante)

El proyecto tiene activada la protección de Vercel (_Standard Protection_).

- [ ] Abre `https://type-race-santiagoartyrs-projects.vercel.app` en una **ventana
      privada / incógnito** (sin tu sesión de Vercel).
- [ ] **Si carga la app:** perfecto, no toques nada.
- [ ] **Si te pide iniciar sesión en Vercel:** nadie más podrá verla. Ve a
      **Settings → Deployment Protection → Vercel Authentication** y desactívala (o
      cámbiala a _Only Preview Deployments_) → **Save**.

---

## Parte 4 — Prueba de punta a punta en producción

1. - [ ] Abre el dominio de Vercel. Debe cargar la página de inicio en español y el botón
         de modo claro/oscuro debe funcionar.
2. - [ ] Abre las herramientas de desarrollador (**F12**) → pestaña **Console**. No debe haber
         errores rojos de CORS.
3. - [ ] Escribe un apodo → **crear sala** → copia el enlace de invitación.
4. - [ ] Abre el enlace en **otra pestaña** (o en el celular, usando datos móviles para
         probar desde otra red) → únete con otro apodo.
5. - [ ] Inicia la carrera y escribe el texto en ambas. El progreso del rival debe moverse
         en tiempo real.
6. - [ ] Al terminar, ve a **Ranking**: deben aparecer los resultados (se guardan en PostgreSQL).
7. - [ ] **Prueba de resistencia:** deja una sala abierta 2–3 minutos sin hacer nada. No debe
         desconectarse (el servidor manda un _heartbeat_ cada 15 s).

---

## Parte 5 — Opcional, pero recomendado

- [ ] **Proteger `main` en GitHub:** repo → **Settings → Branches → Add branch ruleset**
      (o _Add rule_) → rama `main` → **Require status checks to pass** → elige los dos jobs
      del CI.
- [ ] **Previews de Vercel con CORS:** si quieres que los _preview deployments_ hablen con el
      backend, cambia en Railway:

  ```
  CORS_ORIGIN=https://type-race-santiagoartyrs-projects.vercel.app,https://type-race-*-santiagoartyrs-projects.vercel.app
  ```

  (El `*` cubre un segmento con letras, números y guiones.)

- [ ] **Alerta de gasto en Railway:** **Workspace Settings → Usage** → define un límite
      (_usage limit_) para no llevarte sorpresas.

---

## Si algo falla

| Síntoma                                                                      | Causa probable                                                  | Qué hacer                                                                                                                     |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Railway: build falla con `Dockerfile not found` o usa Railpack               | No tomó la ruta del Dockerfile                                  | Revisa **Builder = Dockerfile** y **Dockerfile Path**, o define `RAILWAY_DOCKERFILE_PATH=apps/server/Dockerfile`.             |
| Railway: build falla en `COPY proto proto` / no encuentra `packages`         | **Root Directory** no está vacío                                | Déjalo vacío (raíz del repo).                                                                                                 |
| Railway: pre-deploy falla con `DATABASE_URL ... Obligatoria`                 | Falta la variable o la referencia está mal escrita              | Debe ser `${{Postgres.DATABASE_URL}}` y el servicio de base de datos debe llamarse `Postgres`.                                |
| Railway: pre-deploy falla con `ECONNREFUSED` / `getaddrinfo`                 | La base de datos no estaba lista o está en otro proyecto        | Comprueba que Postgres esté en verde **dentro del mismo proyecto** y redespliega (`⋯ → Redeploy`).                            |
| Railway: el servidor se cae al arrancar con `Variables de entorno inválidas` | Falta `CORS_ORIGIN` o `DATABASE_URL`, o un valor está mal       | El log dice exactamente qué variable falla. Corrígela y guarda.                                                               |
| Railway: healthcheck falla (timeout)                                         | Se definió `PORT` a mano o el dominio apunta a otro puerto      | Borra la variable `PORT` si la creaste; en **Networking** el dominio debe apuntar a `8080`.                                   |
| `/health` responde `503` con `"database":"error"`                            | El servidor no llega a Postgres                                 | Revisa `DATABASE_URL` y que Postgres esté activo.                                                                             |
| Vercel: `Falta VITE_API_URL`                                                 | La variable no existe para ese entorno                          | Defínela para **Production** y **Preview** y haz **Redeploy**.                                                                |
| Vercel: `Cannot find module '@typerace/proto-gen'`                           | No se subió la corrección o hay un _Override_ del Build Command | Confirma que el commit de la Parte 0 está en `main` y apaga el **Override** del Build Command.                                |
| Navegador: error de **CORS** en la consola                                   | `CORS_ORIGIN` no coincide con el dominio exacto                 | Debe ser idéntico al de la barra de direcciones: con `https://`, sin barra final. Guarda en Railway y espera el redespliegue. |
| Navegador: `Failed to fetch` / `ERR_NAME_NOT_RESOLVED`                       | `VITE_API_URL` mal escrita                                      | Corrígela en Vercel y haz **Redeploy** (cambiar la variable sola no basta).                                                   |
| Navegador: _mixed content_                                                   | `VITE_API_URL` empieza con `http://`                            | Usa `https://`.                                                                                                               |
| Las salas se cierran solas tras un push                                      | Es normal: un redespliegue reinicia el proceso                  | Los clientes reconectan y ofrecen volver a unirse. Evita desplegar en medio de una demo.                                      |

**Dónde mirar:**

- Logs del backend: Railway → `server` → **Deployments** → despliegue → **Deploy Logs**
  (JSON estructurado; cada RPC rechazada incluye `rpc` y `code`).
- Logs del frontend: Vercel → **Deployments** → deploy → **Build Logs**.
- Errores del navegador: **F12 → Console** y **Network** (filtra por `typerace.v1`).

---

## Al terminar, envíame

1. La URL de Railway.
2. Confirmación de que `/health` responde `ok`.
3. Si la prueba de la Parte 4 funcionó (o el error exacto si no).
