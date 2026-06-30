/* ===========================
   server.js — Goool Backend
   Proxy + cache para datos del Mundial 2026
   =========================== */

require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const apiRoutes = require('./routes/api');
const cache     = require('./services/cacheService');

const app  = express();
const PORT = process.env.PORT || 3000;

/* ---- Middleware ---- */
app.use(cors({
  origin: '*', // GitHub Pages necesita acceso libre; se puede restringir luego al dominio real
  methods: ['GET', 'POST'],
}));
app.use(express.json());

/* ---- Logging simple ---- */
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

/* ---- Rutas ---- */
app.use('/api', (req, res, next) => {
  // Evita que navegadores/CDNs cacheen respuestas de la API.
  // Sin esto, GitHub Pages + algunos navegadores pueden servir
  // datos viejos aunque el backend ya tenga datos frescos.
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
}, apiRoutes);

/* ---- Health check (usado por cron-job.org para mantener despierto el servicio) ---- */
app.get('/', (req, res) => {
  res.json({
    service: 'Goool Backend',
    status: 'ok',
    lastSync: cache.getLastSync(),
    endpoints: ['/api/scoreboard', '/api/standings', '/api/news', '/api/all', '/api/status'],
  });
});

app.get('/health', (req, res) => res.status(200).send('OK'));

/* ---- 404 ---- */
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Ruta no encontrada' });
});

/* ---- Arrancar servidor + auto-refresh ---- */
app.listen(PORT, () => {
  console.log(`🟢 Goool Backend corriendo en puerto ${PORT}`);
  cache.startAutoRefresh();
});
