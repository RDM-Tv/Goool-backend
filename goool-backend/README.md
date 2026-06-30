# Goool Backend

Backend proxy + cache para la app **Goool** (Mundial 2026). Resuelve el problema de CORS de la API de ESPN y cachea los datos cada 15 minutos para no saturar la API ni depender de su latencia en cada visita.

## Endpoints

| Método | Ruta              | Descripción                                  |
|--------|-------------------|-----------------------------------------------|
| GET    | `/`               | Health check + info del servicio              |
| GET    | `/health`         | Health check simple (200 OK)                  |
| GET    | `/api/all`        | Todo en una sola petición (matches+standings+news) |
| GET    | `/api/scoreboard` | Partidos (en vivo, próximos, recientes)       |
| GET    | `/api/standings`  | Tabla de posiciones por grupo                 |
| GET    | `/api/news`       | Últimas noticias del Mundial                  |
| GET    | `/api/status`     | Estado del cache (última sync, etc.)          |
| POST   | `/api/refresh`    | Fuerza una sincronización manual              |

## Deploy en Render (gratis)

### Paso 1 — Subir a GitHub
Crea un repo nuevo, por ejemplo `RDM-Tv/goool-backend`, y sube todos estos archivos.

### Paso 2 — Crear el servicio en Render
1. Ve a [render.com](https://render.com) y entra con tu cuenta de GitHub
2. Clic en **New +** → **Web Service**
3. Conecta el repo `goool-backend`
4. Configuración:
   - **Name:** `goool-backend`
   - **Region:** Oregon (US West) — la más cercana a Latinoamérica con buen free tier
   - **Branch:** `main`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free
5. Clic en **Create Web Service**

En 2-3 minutos tendrás una URL como:
`https://goool-backend.onrender.com`

### Paso 3 — Evitar que el servicio se duerma (cron-job.org)

Render free tier duerme el servicio tras 15 min sin tráfico. Para mantenerlo despierto y siempre con datos frescos:

1. Ve a [cron-job.org](https://cron-job.org) y crea una cuenta gratis
2. Clic en **Create cronjob**
3. Configuración:
   - **Title:** Goool Keep-Alive
   - **URL:** `https://goool-backend.onrender.com/health`
   - **Execution schedule:** Every 14 minutes
4. Guardar

Esto mantiene el backend siempre activo, y el propio servidor internamente refresca los datos de ESPN cada 15 minutos sin importar el tráfico externo.

### Paso 4 — Conectar el frontend
En el frontend (`Goool.html`), cambiar las URLs de la API de:
```
https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/...
```
a:
```
https://goool-backend.onrender.com/api/...
```

## Desarrollo local

```bash
npm install
npm run dev
```

Corre en `http://localhost:3000`
