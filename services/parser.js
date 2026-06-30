/* ===========================
   parser.js — Normaliza datos ESPN
   =========================== */

const FLAG_MAP = {
  'ecuador': '🇪🇨', 'argentina': '🇦🇷', 'brazil': '🇧🇷', 'brasil': '🇧🇷',
  'france': '🇫🇷', 'germany': '🇩🇪', 'spain': '🇪🇸', 'england': '🏴',
  'portugal': '🇵🇹', 'netherlands': '🇳🇱', 'belgium': '🇧🇪', 'croatia': '🇭🇷',
  'morocco': '🇲🇦', 'japan': '🇯🇵', 'south korea': '🇰🇷', 'usa': '🇺🇸',
  'united states': '🇺🇸', 'canada': '🇨🇦', 'mexico': '🇲🇽', 'colombia': '🇨🇴',
  'uruguay': '🇺🇾', 'chile': '🇨🇱', 'peru': '🇵🇪', 'paraguay': '🇵🇾',
  'venezuela': '🇻🇪', 'bolivia': '🇧🇴', 'senegal': '🇸🇳', 'nigeria': '🇳🇬',
  'cameroon': '🇨🇲', 'ghana': '🇬🇭', 'ivory coast': '🇨🇮', "côte d'ivoire": '🇨🇮',
  'cote d ivoire': '🇨🇮', 'saudi arabia': '🇸🇦', 'iran': '🇮🇷', 'australia': '🇦🇺',
  'poland': '🇵🇱', 'sweden': '🇸🇪', 'denmark': '🇩🇰', 'switzerland': '🇨🇭',
  'austria': '🇦🇹', 'serbia': '🇷🇸', 'turkey': '🇹🇷', 'czechia': '🇨🇿',
  'ukraine': '🇺🇦', 'hungary': '🇭🇺', 'scotland': '🏴', 'wales': '🏴',
  'slovakia': '🇸🇰', 'albania': '🇦🇱', 'slovenia': '🇸🇮', 'georgia': '🇬🇪',
  'romania': '🇷🇴', 'south africa': '🇿🇦', 'norway': '🇳🇴', 'vietnam': '🇻🇳',
  'cuba': '🇨🇺', 'jamaica': '🇯🇲', 'algeria': '🇩🇿', 'egypt': '🇪🇬',
  'cape verde': '🇨🇻', 'dr congo': '🇨🇩', 'congo dr': '🇨🇩', 'bosnia': '🇧🇦',
  'bosnia and herzegovina': '🇧🇦', 'tunisia': '🇹🇳', 'new zealand': '🇳🇿',
  'panama': '🇵🇦', 'haiti': '🇭🇹', 'costa rica': '🇨🇷', 'curacao': '🇨🇼',
  'curaçao': '🇨🇼', 'qatar': '🇶🇦', 'uzbekistan': '🇺🇿', 'jordan': '🇯🇴',
};

function countryFlag(name = '') {
  const n = name.toLowerCase();
  for (const [k, v] of Object.entries(FLAG_MAP)) {
    if (n.includes(k)) return v;
  }
  return '🏳️';
}

function timeAgo(date) {
  const diff = (Date.now() - date) / 1000;
  if (diff < 60) return 'Ahora';
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)}h`;
  return `Hace ${Math.floor(diff / 86400)}d`;
}

function statValue(entry, abbr) {
  const s = entry.stats?.find(x => x.abbreviation === abbr || x.name === abbr);
  return parseInt(s?.value ?? 0);
}

/* ---- Normaliza el status de ESPN (STATUS_SCHEDULED, STATUS_IN_PROGRESS,
   STATUS_FINAL, etc.) al formato simple que usa el frontend: pre/in/post ---- */
function normalizeStatus(rawName = '') {
  const n = rawName.toUpperCase();
  if (n.includes('IN_PROGRESS') || n.includes('HALFTIME') || n === 'STATUS_IN') return 'in';
  if (
    n.includes('FINAL') ||
    n.includes('FULL_TIME') ||
    n.includes('FULLTIME') ||
    n.includes('POSTPONED') ||
    n.includes('CANCELED') ||
    n.includes('CANCELLED') ||
    n.includes('ABANDONED') ||
    n.includes('SUSPENDED')
  ) return 'post';
  return 'pre'; // SCHEDULED y cualquier otro caso futuro
}

/* ---- Traduce el slug de fase/grupo de ESPN a español ---- */
const ROUND_NAMES = {
  'group-stage':  'Fase de Grupos',
  'round-of-32': 'Ronda de 32',
  'round-of-16': 'Octavos de Final',
  'quarterfinal': 'Cuartos de Final',
  'semifinal':    'Semifinal',
  'final':        'Final',
  'third-place':  'Tercer Puesto',
};

function translateGroup(slug = '') {
  if (ROUND_NAMES[slug]) return ROUND_NAMES[slug];
  if (/^group-([a-l])$/i.test(slug)) {
    const letter = slug.split('-')[1].toUpperCase();
    return `Grupo ${letter}`;
  }
  return slug || '';
}

/* ---- Partidos ---- */
function parseMatches(data) {
  if (!data?.events) return [];
  return data.events.map(ev => {
    const comp   = ev.competitions?.[0];
    const home   = comp?.competitors?.find(c => c.homeAway === 'home');
    const away   = comp?.competitors?.find(c => c.homeAway === 'away');
    const status = ev.status?.type;

    return {
      id:          ev.id,
      name:        ev.name,
      date:        ev.date,
      status:      normalizeStatus(status?.name),
      statusShort: status?.shortDetail || '',
      clock:       ev.status?.displayClock || '',
      period:      ev.status?.period || 0,
      venue:       comp?.venue?.fullName || '',
      city:        comp?.venue?.address?.city || '',
      group:       translateGroup(ev.season?.slug || ''),
      home: {
        id:     home?.id,
        name:   home?.team?.shortDisplayName || home?.team?.displayName || '',
        flag:   countryFlag(home?.team?.displayName),
        score:  home?.score ?? null,
        winner: home?.winner || false,
      },
      away: {
        id:     away?.id,
        name:   away?.team?.shortDisplayName || away?.team?.displayName || '',
        flag:   countryFlag(away?.team?.displayName),
        score:  away?.score ?? null,
        winner: away?.winner || false,
      },
    };
  });
}

/* ---- Tabla de posiciones ---- */
function parseStandings(data) {
  if (!data?.standings) return [];
  return data.standings.map(g => ({
    name: g.name || g.displayName || 'Grupo',
    teams: (g.entries || []).map((e, idx) => ({
      pos:  idx + 1,
      name: e.team?.shortDisplayName || e.team?.displayName || '',
      flag: countryFlag(e.team?.displayName),
      pj:   statValue(e, 'GP'),
      g:    statValue(e, 'W'),
      em:   statValue(e, 'T'),
      p:    statValue(e, 'L'),
      gf:   statValue(e, 'GF'),
      gc:   statValue(e, 'GA'),
      gd:   statValue(e, 'GD'),
      pts:  statValue(e, 'PTS'),
    })),
  }));
}

/* ---- Noticias ---- */
function parseNews(data) {
  if (!data?.articles) return [];
  return data.articles.slice(0, 10).map(a => ({
    id:     a.id,
    title:  a.headline || a.title || '',
    source: a.source || 'ESPN',
    link:   a.links?.web?.href || '#',
    time:   a.published ? timeAgo(new Date(a.published)) : '',
    published: a.published || null,
  }));
}

/* ---- Parsea el formato de openfootball (fuente secundaria/respaldo) ----
   Entrada: [{ round, date, time, team1, team2, score: { ft: [h,a] } }]
   Se usa solo cuando ESPN no trae nada, como red de seguridad. */
function parseOpenFootballMatches(rawMatches) {
  if (!Array.isArray(rawMatches)) return [];

  const now = new Date();

  return rawMatches.map((m, idx) => {
    const hasScore = Array.isArray(m.score?.ft);
    const hasPenalties = Array.isArray(m.score?.p);

    // El campo "time" viene como "16:30 UTC-4" — extraemos solo HH:MM
    const timeOnly = (m.time || '').match(/^(\d{1,2}:\d{2})/)?.[1];
    const dateTimeStr = timeOnly ? `${m.date}T${timeOnly}:00` : `${m.date}T00:00:00`;
    let matchDate = new Date(dateTimeStr);
    if (isNaN(matchDate.getTime())) matchDate = new Date(`${m.date}T00:00:00`);

    // Sin un feed de "en vivo" real, inferimos estado por fecha + si tiene marcador
    let status = 'pre';
    if (hasScore) {
      status = 'post';
    } else if (!isNaN(matchDate.getTime()) && matchDate < now) {
      const hoursSince = (now - matchDate) / 3600000;
      status = hoursSince < 3 ? 'in' : 'pre'; // margen de 3h para partido típico
    }

    const home = (m.team1 || '').replace(/\s*\([A-Z]{3}\)$/, '');
    const away = (m.team2 || '').replace(/\s*\([A-Z]{3}\)$/, '');

    // Si hubo penales, el "ganador real" y el marcador a mostrar usan la definición por penales
    const homeFt = hasScore ? m.score.ft[0] : null;
    const awayFt = hasScore ? m.score.ft[1] : null;
    let homeWinner = hasScore ? homeFt > awayFt : false;
    let awayWinner = hasScore ? awayFt > homeFt : false;
    let statusShort = hasScore ? 'FT' : (timeOnly || '');

    if (hasPenalties) {
      homeWinner = m.score.p[0] > m.score.p[1];
      awayWinner = m.score.p[1] > m.score.p[0];
      statusShort = `FT (${m.score.p[0]}-${m.score.p[1]} pen)`;
    }

    // Slug de grupo/fase: solo traducimos si reconocemos el patrón;
    // en fase de grupos, ESPN/frontend no necesitan el "matchday", se omite.
    const roundSlug = (m.round || '').toLowerCase().replace(/\s+/g, '-');
    const groupLabel = /round-of|quarter|semi|final|third-place/.test(roundSlug)
      ? translateGroup(roundSlug)
      : (m.group ? `Grupo ${m.group.replace(/^Group\s*/i, '')}` : '');

    return {
      id:          `of-${idx}-${m.date}`,
      name:        `${home} vs ${away}`,
      date:        isNaN(matchDate.getTime()) ? new Date().toISOString() : matchDate.toISOString(),
      status,
      statusShort,
      clock:       '',
      period:      0,
      venue:       m.ground || '',
      city:        m.ground || '',
      group:       groupLabel,
      home: {
        id: null, name: home, flag: countryFlag(home),
        score: homeFt, winner: homeWinner,
      },
      away: {
        id: null, name: away, flag: countryFlag(away),
        score: awayFt, winner: awayWinner,
      },
    };
  });
}

module.exports = { parseMatches, parseStandings, parseNews, parseOpenFootballMatches, countryFlag };
