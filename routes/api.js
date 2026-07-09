/* ===========================
   api.js — Rutas del API
   =========================== */

const express = require('express');
const router  = express.Router();
const cache   = require('../services/cacheService');

/* ---- GET /api/scoreboard ---- */
router.get('/scoreboard', (req, res) => {
  const matches = cache.getMatches();
  res.json({
    success: true,
    count: matches.length,
    lastSync: cache.getLastSync(),
    data: matches,
  });
});

/* ---- GET /api/standings ---- */
router.get('/standings', (req, res) => {
  const standings = cache.getStandings();
  res.json({
    success: true,
    count: standings.length,
    lastSync: cache.getLastSync(),
    data: standings,
  });
});

/* ---- GET /api/news ---- */
router.get('/news', (req, res) => {
  const news = cache.getNews();
  res.json({
    success: true,
    count: news.length,
    lastSync: cache.getLastSync(),
    data: news,
  });
});

/* ---- GET /api/teams — estadísticas completas por equipo ---- */
router.get('/teams', (req, res) => {
  res.json({ success: true, lastSync: cache.getLastSync(), data: cache.getTeamStats() });
});

/* ---- GET /api/scorers — tabla de goleadores global ---- */
router.get('/scorers', (req, res) => {
  res.json({ success: true, lastSync: cache.getLastSync(), data: cache.getTopScorers() });
});

/* ---- GET /api/ranking — clasificación general por puntos ---- */
router.get('/ranking', (req, res) => {
  res.json({ success: true, lastSync: cache.getLastSync(), data: cache.getOverallRanking() });
});

/* ---- GET /api/all — todo en una sola petición ---- */
router.get('/all', (req, res) => {
  res.json({
    success: true,
    lastSync:        cache.getLastSync(),
    matches:         cache.getMatches(),
    standings:       cache.getStandings(),
    news:            cache.getNews(),
    teamStats:       cache.getTeamStats(),
    topScorers:      cache.getTopScorers(),
    overallRanking:  cache.getOverallRanking(),
  });
});

/* ---- GET /api/status — para monitoreo y para el cron de keep-alive ---- */
router.get('/status', (req, res) => {
  res.json({ success: true, ...cache.getStatus() });
});

/* ---- POST /api/refresh — fuerza un sync manual (útil para debug) ---- */
router.post('/refresh', async (req, res) => {
  await cache.syncAll();
  res.json({ success: true, lastSync: cache.getLastSync() });
});

module.exports = router;
