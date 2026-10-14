# Checklist de despliegue de TypeRace (paso a paso)

Lista personal para dejar TypeRace en producción con **Neon** (base de datos), **Render**
(backend) y **Vercel** (frontend). Ve marcando cada casilla `[ ]` → `[x]`.
El porqué de cada ajuste está en [`deployment.md`](./deployment.md).

**Datos que ya conocemos**

| Dato                         | Valor                                                                         |
| ---------------------------- | ----------------------------------------------------------------------------- |
| Repositorio GitHub           | `SantiagoTyrsArv/gRPC` (rama `main`)                                          |
| Proyecto Vercel (ya existe)  | `type-race` en el equipo _santiagoartyrs' projects_                           |
| Dominio de producción Vercel | `https://type-race-santiagoartyrs-projects.vercel.app`                        |
| Cadena de conexión de Neon   | Se obtiene en la Parte 1 (**secreta**: no la pegues en el chat ni en el repo) |
| URL del backend en Render    | Se obtiene en la Parte 2 → anótala aquí: `________________`                   |

**Tiempo estimado:** 30 minutos. **Costo:** los tres servicios en plan gratuito, sin tarjeta.

> **Regla de oro:** las variables `VITE_*` se "hornean" dentro del frontend al
> construirlo. Cada vez que cambies `VITE_API_URL` en Vercel tienes que hacer **Redeploy**.
> En Render, en cambio, al guardar una variable el servicio se redespliega solo.

---

## Parte 0 — Subir los cambios de Render + Neon

- [ ] En la terminal, desde la raíz del repo, haz el commit con el mensaje que te pasé en el
      chat y súbelo con `git push origin main`.
- [ ] Comprueba que el commit existe **antes** del push: `git log --oneline -3`.
  - Si el commit no aparece, el hook `commit-msg` (commitlint) lo rechazó: cada línea del
    mensaje debe tener **como máximo 100 caracteres**.
- [ ] En GitHub → pestaña **Actions**, espera a que el workflow **CI** quede en verde
      (_Lint, typecheck, test y build_ e _Imagen Docker del servidor_).
- [ ] El deploy que se lanza en Vercel **va a fallar** con `Falta VITE_API_URL`. Es lo
      esperado; lo resolvemos en la Parte 3.

---

## Parte 1 — Neon: base de datos PostgreSQL

1. - [ ] Entra a <https://console.neon.tech> y regístrate (**Continue with GitHub** es lo más
         rápido).
2. - [x] Proyecto creado: `shy-mode-35061035`, Postgres 18, región **AWS US East 2 (Ohio)**.
   - `render.yaml` usa la región `ohio` de Render, la misma que la base: así cada consulta no
     cruza el continente.
   - Opcional: renómbralo a `typerace` en **Settings → General**.
3. - [ ] En el panel del proyecto pulsa **Connect** (arriba a la derecha).
4. - [ ] En la ventana que se abre:
   - **Branch:** `production` · **Database:** `neondb` · **Role:** `neondb_owner` (los de defecto).
   - **Connection pooling:** **desactivado**. El host **no** debe contener `-pooler`.
   - Formato: **Connection string**.
   - Pulsa **Show password** y luego **Copy snippet**.
5. - [ ] Guarda la cadena en un lugar seguro (un gestor de contraseñas o un bloc de notas local).
         Se ve así:

   ```
   postgresql://neondb_owner:XXXXXXXX@ep-crimson-heart-b4arj8dg.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
   ```

   - Pégala **tal cual**, con `?sslmode=require&channel_binding=require`. El servidor quita
     `channel_binding` automáticamente (el driver no lo soporta) y mantiene el TLS.
   - **No** necesitas crear tablas: el backend aplica las migraciones y carga los 25 textos
     al arrancar.

---

## Parte 2 — Render: backend

### 2.1 Crear el servicio desde el Blueprint

El archivo `render.yaml` del repo ya define todo el servicio (Docker, health check,
1 instancia, variables). Solo hay que conectarlo.

1. - [ ] Entra a <https://dashboard.render.com> y regístrate con **GitHub**.
2. - [ ] Arriba a la derecha: **+ New** → **Blueprint**.
3. - [ ] **Connect a repository:** si no aparece `SantiagoTyrsArv/gRPC`, pulsa
         **Configure account** (o _Connect GitHub_) → da acceso al repo `gRPC` → **Save** →
         vuelve a Render y elígelo → **Connect**.
4. - [ ] **Blueprint Name:** `typerace`. **Branch:** `main`.
5. - [ ] Render lee `render.yaml` y muestra el servicio **typerace-server** (Web Service,
         Docker, plan **Free**, región **Ohio**).
6. - [ ] Te pedirá el valor de **`DATABASE_URL`**: pega la cadena de Neon de la Parte 1.
   - Las demás variables (`NODE_ENV`, `LOG_LEVEL`, `CORS_ORIGIN`) ya vienen en el archivo.
   - **No** agregues `PORT`: Render la define (10000) y el servidor la usa.
7. - [ ] Pulsa **Deploy Blueprint** (o **Apply**).

### 2.2 Verificar el despliegue

1. - [ ] **Dashboard → typerace-server → Events / Logs.** El primer build tarda 3–6 minutos
         (el plan gratuito es lento). En el log de build se ve el Dockerfile
         (`FROM node:24-alpine`, `pnpm install`, `pnpm --filter @typerace/server build`).
2. - [ ] Al arrancar, el log debe mostrar, en orden:

   ```json
   {"insertedTexts":25,"msg":"Migraciones y seed aplicados"}
   {"msg":"Server listening at http://...:10000"}
   ```

   (en arranques posteriores verás `"insertedTexts":0`: es normal).

3. - [ ] El estado del servicio pasa a **Live** (verde).
4. - [ ] Copia la URL que aparece arriba, debajo del nombre del servicio (algo como
         `https://typerace-server.onrender.com`; puede llevar un sufijo si el nombre ya
         estaba tomado). Anótala en la tabla de **Datos**.
5. - [ ] Ábrela en el navegador agregando `/health`. Debe responder:

   ```json
   { "status": "ok", "database": "ok" }
   ```

6. - [ ] **Pásame la URL de Render en el chat** (la URL, **no** la cadena de Neon). Desde aquí
         compruebo `/health` y el CORS.

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
- [ ] **Ignored Build Step:** en **Automatic** (o vacío).
- [ ] **Node.js Version:** `24.x` (ya está así).

### 3.2 Variable de entorno

**Settings → Environment Variables → Add New**:

- [ ] **Key:** `VITE_API_URL`
- [ ] **Value:** la URL de Render, p. ej. `https://typerace-server.onrender.com`
      (**sin barra final**, con `https://`, sin `/health`).
- [ ] **Environments:** marca **Production** y **Preview**.
- [ ] **Sensitive:** desactivado (no es secreta; termina visible en el JS del navegador).
- [ ] **Save**.

### 3.3 Redeploy

- [ ] **Deployments** → elige el deploy **más reciente de `main`**. Comprueba que el commit
      sea el de la Parte 0 o uno más nuevo.
  - Ojo: si haces Redeploy de un deploy viejo, Vercel reconstruye **ese commit viejo**.
- [ ] Menú `⋯` → **Redeploy** → desmarca **Use existing Build Cache** → **Redeploy**.
- [ ] Espera el estado **Ready** (≈1 min). En el log debe verse `proto-gen build: Done` y
      luego `✓ built`.

### 3.4 Deployment Protection

El proyecto tiene activada la protección de Vercel (_Standard Protection_).

- [ ] Abre `https://type-race-santiagoartyrs-projects.vercel.app` en una **ventana
      privada / incógnito**.
- [ ] **Si carga la app:** perfecto, no toques nada.
- [ ] **Si te pide iniciar sesión en Vercel:** nadie más podrá verla. Ve a
      **Settings → Deployment Protection → Vercel Authentication** y desactívala (o
      cámbiala a _Only Preview Deployments_) → **Save**.

---

## Parte 4 — Prueba de punta a punta en producción

> Si el backend llevaba más de 15 minutos sin uso, está dormido. Abre primero
> `https://<tu-url-de-render>/health` y espera a que responda (~1 minuto).

1. - [ ] Abre el dominio de Vercel. Debe cargar la página de inicio en español y el botón
         de modo claro/oscuro debe funcionar.
2. - [ ] **F12 → Console**: no debe haber errores rojos de CORS.
3. - [ ] Escribe un apodo → **crear sala** → copia el enlace de invitación.
4. - [ ] Ábrelo en **otra pestaña** (o en el celular con datos móviles) → únete con otro apodo.
5. - [ ] Inicia la carrera y escribe en ambas. El progreso del rival debe moverse en tiempo real.
6. - [ ] Al terminar, ve a **Ranking**: deben aparecer los resultados (guardados en Neon).
7. - [ ] Deja una sala abierta 2–3 minutos sin hacer nada: no debe desconectarse.

---

## Parte 5 — Opcional

- [ ] **Previews de Vercel con CORS:** en Render → **typerace-server → Environment** → edita
      `CORS_ORIGIN`:

  ```
  https://type-race-santiagoartyrs-projects.vercel.app,https://type-race-*-santiagoartyrs-projects.vercel.app
  ```

  Para que el cambio sea permanente, cámbialo también en `render.yaml` y súbelo.

- [ ] **Proteger `main` en GitHub:** **Settings → Branches → Add branch ruleset** → rama
      `main` → **Require status checks to pass** → elige los dos jobs del CI.

---

## Si algo falla

| Síntoma                                                   | Causa probable                                              | Qué hacer                                                                                      |
| --------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Render: el Blueprint no encuentra `render.yaml`           | El commit de la Parte 0 no está en `main`                   | `git log origin/main --oneline -3` debe mostrarlo; si no, haz el push.                         |
| Render: build falla en `COPY proto proto`                 | Se cambió el contexto de Docker                             | En `render.yaml` debe ser `dockerContext: .` (raíz del repo).                                  |
| Render: `Variables de entorno inválidas ... DATABASE_URL` | Falta la variable o no empieza por `postgres`               | **Environment** → revisa `DATABASE_URL` (debe empezar con `postgresql://`).                    |
| Render: `password authentication failed`                  | Contraseña mal copiada                                      | En Neon → **Connect** → **Show password** → copia de nuevo.                                    |
| Render: `Fallo al migrar` con `ECONNREFUSED`/`timeout`    | Cadena _pooled_ o host mal copiado                          | Usa la cadena **sin** `-pooler` en el host.                                                    |
| Render: health check falla y no llega a **Live**          | El servidor no arrancó                                      | Mira el log de arranque: la primera línea de error dice qué falta.                             |
| `/health` responde `503` con `"database":"error"`         | El servidor no llega a Neon                                 | Revisa `DATABASE_URL`; en Neon comprueba que el proyecto no esté suspendido por límite de uso. |
| La URL de Render tarda ~1 min en responder                | El plan gratuito durmió el servicio                         | Normal tras 15 min sin tráfico. Espera y recarga.                                              |
| Vercel: `Falta VITE_API_URL`                              | La variable no existe para ese entorno                      | Defínela para **Production** y **Preview** y haz **Redeploy**.                                 |
| Vercel: `Cannot find module '@typerace/proto-gen'`        | Redeploy de un commit viejo, o _Override_ del Build Command | Redeploy desde el deploy más reciente de `main` y apaga el **Override**.                       |
| Navegador: error de **CORS** en la consola                | `CORS_ORIGIN` no coincide con el dominio exacto             | Debe ser idéntico al de la barra de direcciones, con `https://` y sin barra final.             |
| Navegador: `Failed to fetch`                              | Backend dormido o `VITE_API_URL` mal escrita                | Abre `/health` de Render; si responde, corrige `VITE_API_URL` y haz **Redeploy**.              |
| Pantalla solo con el fondo de color                       | El frontend se construyó sin `VITE_API_URL`                 | **F12 → Console** lo confirma. Define la variable y haz **Redeploy**.                          |
| Las salas desaparecen                                     | Redespliegue o el servicio se durmió                        | Es normal: el estado de las salas vive en memoria.                                             |

**Dónde mirar:**

- Backend: Render → **typerace-server → Logs** (JSON estructurado; cada RPC rechazada incluye
  `rpc` y `code`).
- Base de datos: Neon → **Monitoring** y **Tables** (deben existir las tablas y 25 textos).
- Frontend: Vercel → **Deployments** → deploy → **Build Logs**.
- Navegador: **F12 → Console** y **Network** (filtra por `typerace.v1`).

---

## Al terminar, envíame

1. La URL de Render (nunca la cadena de Neon).
2. Confirmación de que `/health` responde `ok`.
3. Si la prueba de la Parte 4 funcionó (o el error exacto si no).
