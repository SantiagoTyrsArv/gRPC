# TypeRace

Carreras de tipeo multijugador en tiempo real. Creas una sala, compartes el código y hasta
cinco personas escriben el mismo texto a la vez mientras una **torre de tiempos** muestra quién
va adelante en cada momento. Toda la comunicación entre el navegador y el servidor usa
**gRPC** (vía [Connect RPC](https://connectrpc.com)), incluido el streaming en vivo de la sala.

**Pruébalo:** <https://type-race-eta.vercel.app>

> El backend corre en el plan gratuito de Render: si nadie lo usó en los últimos 15 minutos,
> la primera conexión tarda cerca de un minuto en despertarlo.

| Portada                                                    | Carrera en vivo                                          |
| ---------------------------------------------------------- | -------------------------------------------------------- |
| ![Portada con la carrera de muestra](docs/img/portada.png) | ![Carrera con la torre de tiempos](docs/img/carrera.png) |

## Cómo se juega

1. Escribe un apodo (sin registro) y **crea una sala**. Recibes un código de 6 letras y un
   enlace de invitación.
2. Tus amigos entran con el código o el enlace y marcan **Estoy listo**.
3. El anfitrión da la salida: un semáforo de 3 segundos y el texto se desbloquea.
4. Escribe el texto; un error se corrige con la tecla de borrar antes de seguir. La torre se
   reordena con cada adelantamiento.
5. Al terminar se muestra la clasificación final, los mejores resultados entran al **ranking
   global** y se puede pedir la revancha en la misma sala.

Reglas: hasta 5 jugadores por sala, carreras de 2 minutos como máximo y velocidad en
palabras por minuto (ppm = letras correctas ÷ 5 ÷ minutos).

## Arquitectura

```mermaid
flowchart LR
  B[Navegador<br/>React + connect-web] -- "Connect / gRPC-Web<br/>HTTPS" --> S[Servidor Node.js<br/>Fastify + Connect RPC]
  C[Cliente gRPC nativo] -- "gRPC sobre HTTP/2<br/>(GRPC_PORT, local)" --> S
  S -- Drizzle ORM --> P[(PostgreSQL)]
  S -. "estado de las salas<br/>en memoria" .- S
```

| Pieza                   | Tecnología                                               | Producción      |
| ----------------------- | -------------------------------------------------------- | --------------- |
| Contratos               | Protocol Buffers + [Buf](https://buf.build) (`proto/`)   | —               |
| Backend (`apps/server`) | Node.js 24, Fastify, Connect RPC, Drizzle ORM, Zod, Pino | Render (Docker) |
| Base de datos           | PostgreSQL                                               | Neon            |
| Frontend (`apps/web`)   | React 19, Vite, Tailwind CSS 4, React Router, Zustand    | Vercel          |
| Código generado         | `@bufbuild/protoc-gen-es` (`packages/proto-gen`)         | —               |

### Un contrato, tres protocolos

El servidor expone los mismos servicios en **gRPC**, **gRPC-Web** y el **protocolo Connect**
sobre las mismas rutas. El navegador usa Connect/gRPC-Web, que funcionan sobre HTTP/1.1 y
pasan por cualquier proxy; un cliente gRPC nativo puede conectarse por HTTP/2 al puerto
opcional `GRPC_PORT`. Los tipos de TypeScript de cliente y servidor salen de los mismos
`.proto`, así que un cambio de contrato rompe la compilación en lugar de fallar en producción.

### Servicios (`proto/typerace/v1`)

| Servicio             | RPC              | Tipo                   | Para qué                                          |
| -------------------- | ---------------- | ---------------------- | ------------------------------------------------- |
| `RoomService`        | `CreateRoom`     | unaria                 | Crea una sala y devuelve la sesión del anfitrión. |
|                      | `JoinRoom`       | unaria                 | Entra a una sala con su código.                   |
|                      | `Reconnect`      | unaria                 | Recupera la sesión tras recargar la página.       |
|                      | `SetReady`       | unaria                 | Marca o desmarca al jugador como listo.           |
|                      | `LeaveRoom`      | unaria                 | Abandona la sala.                                 |
|                      | `WatchRoom`      | **streaming servidor** | Todos los eventos de la sala en vivo.             |
| `RaceService`        | `StartRace`      | unaria                 | El anfitrión da la salida.                        |
|                      | `SubmitProgress` | unaria                 | Reporta el avance (~5 veces por segundo).         |
| `LeaderboardService` | `GetLeaderboard` | unaria                 | Mejores velocidades registradas.                  |

### Tiempo real

- `WatchRoom` es un stream del servidor: el primer mensaje es una foto completa de la sala y
  luego llegan eventos (jugador unido, listo, cuenta regresiva, progreso, llegada, fin).
- Cada mensaje lleva la hora del servidor; el cliente sincroniza su reloj con ella para que la
  cuenta regresiva y el cronómetro coincidan en todas las pantallas.
- Un **heartbeat** cada 15 s evita que los proxies corten el stream por inactividad, y el
  cliente **reconecta con backoff** si se corta.

### El servidor es la autoridad

- **Anti-trampas:** cada reporte de progreso se valida en el servidor: no puede llegar antes de
  la salida, retroceder, superar el texto ni implicar más de 250 ppm.
- **Sesiones:** cada jugador recibe un token que viaja en la cabecera `x-player-token`; las RPC
  de la sala lo exigen.
- **Límites de uso:** _token bucket_ por IP para crear o unirse a salas y por jugador para el
  resto de acciones; los streams no consumen fichas.
- **CORS** con lista de orígenes permitidos y errores que no filtran detalles internos.
- **Configuración validada** con Zod al arrancar: en producción no inicia sin `DATABASE_URL` ni
  `CORS_ORIGIN`.

El backend sigue una arquitectura por capas: `domain` (sala como máquina de estados,
estadísticas, anti-trampas, sin dependencias), `application` (casos de uso y puertos),
`infrastructure` (Postgres con Drizzle o memoria) y `transport` (Connect, interceptores, CORS).

## Estructura

```
.
├── proto/typerace/v1/      Contratos gRPC (fuente de verdad)
├── packages/proto-gen/     Código TypeScript generado con buf (no se versiona)
├── apps/
│   ├── server/             Backend: domain, application, infrastructure, transport
│   └── web/                Frontend React (páginas, features, componentes)
├── docs/                   Guía y checklist de despliegue
├── render.yaml             Blueprint del backend en Render
└── docker-compose.yml      PostgreSQL para desarrollo
```

## Desarrollo local

Requisitos: **Node.js 24**, **pnpm 11** (`corepack enable` lo instala con la versión fijada en
`package.json`) y **Docker** para la base de datos.

```bash
pnpm install                                   # instala y genera el código de los .proto
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env.local
pnpm db:up                                     # PostgreSQL en localhost:5433
pnpm --filter @typerace/server db:migrate      # tablas y 25 textos de carrera
pnpm dev                                       # servidor :8080 y web :5173
```

Abre <http://localhost:5173>. Para competir contigo mismo, abre la sala en dos pestañas: la
sesión se guarda por pestaña. Sin `DATABASE_URL` el servidor arranca con almacenamiento en
memoria.

### Scripts

| Comando                                              | Qué hace                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------- |
| `pnpm dev`                                           | Servidor y web en modo desarrollo                             |
| `pnpm build`                                         | Genera el código de los `.proto` y compila todos los paquetes |
| `pnpm test`                                          | Tests de servidor y web (Vitest)                              |
| `pnpm lint` / `pnpm typecheck` / `pnpm format:check` | Calidad de código                                             |
| `pnpm generate`                                      | Regenera solo el código de los `.proto`                       |
| `pnpm buf:lint` / `pnpm buf:breaking`                | Revisa los contratos y que no rompan compatibilidad           |
| `pnpm db:up` / `pnpm db:down`                        | Levanta o detiene PostgreSQL en Docker                        |

### Tests

```bash
pnpm test
```

Los tests de integración con PostgreSQL se ejecutan si existe `TEST_DATABASE_URL` (por
ejemplo `postgres://typerace:typerace@localhost:5433/typerace_test`, que `pnpm db:up` crea
automáticamente); si no, se omiten. El CI de GitHub Actions corre buf lint, formato, lint,
typecheck, tests con PostgreSQL, build y la imagen Docker del servidor en cada push (y
`buf breaking` en los pull requests).

## Despliegue

| Pieza    | Plataforma | Configuración                                |
| -------- | ---------- | -------------------------------------------- |
| Frontend | Vercel     | `apps/web/vercel.json`                       |
| Backend  | Render     | `render.yaml` + `apps/server/Dockerfile`     |
| Base     | Neon       | Cadena de conexión directa en `DATABASE_URL` |

Las decisiones y limitaciones están en [`docs/deployment.md`](docs/deployment.md) y el paso a
paso en [`docs/checklist-despliegue.md`](docs/checklist-despliegue.md).

## Convenciones

- Commits con [Conventional Commits](https://www.conventionalcommits.org/es/), validados por
  commitlint (cada línea del mensaje, máximo 100 caracteres).
- `lint-staged` aplica ESLint y Prettier a los archivos del commit.
- La interfaz está en español, con modo claro y oscuro, navegable con teclado y respetando
  `prefers-reduced-motion`.

![Ranking global en modo oscuro](docs/img/ranking-oscuro.png)

---

Proyecto académico de programación web.
