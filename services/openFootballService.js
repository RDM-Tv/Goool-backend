/* ===========================
   openFootballService.js — Fuente secundaria de resultados
   Dataset público (CC0) mantenido por openfootball en GitHub.
   Se usa como respaldo/verificación cruzada de ESPN.
   Formato real: { name, matches: [{ round, date, time, team1, team2, score: { ft: [h,a] } }] }
   =========================== */

const fetch = require('node-fetch');

const URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';

async function getMatches() {
  try {
    const res = await fetch(URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Goool Backend)' },
      timeout: 8000,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data?.matches || [];
  } catch (e) {
    console.warn('[OpenFootball] fallo:', e.message);
    return [];
  }
}

module.exports = { getMatches };
