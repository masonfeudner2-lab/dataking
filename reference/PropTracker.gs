/**
 * PROP HIT-RATE TRACKER  (Google Apps Script, bound to the tracker Google Sheet)
 *
 * Data sources
 *   NBA + NFL box scores ... ESPN public JSON feeds (site.web.api.espn.com), FINAL games only
 *   NFL cross-check ........ nflverse weekly player stats (built from official NFL play-by-play)
 *   NFL snap counts ........ nflverse snap counts (used for DNP detection + limited-snaps flag)
 *
 * Rules
 *   - A stat that fails a check is left BLANK and listed under UNVERIFIED in Daily Summary.
 *   - DNP / inactive / not-in-box-score games are logged but never counted in hit rates.
 *   - Limited-minutes (NBA) / limited-snaps (NFL) games are flagged but still counted.
 *
 * Menu: Prop Tracker > ...   First time: run setup() once and approve permissions.
 */

// ---------------------------------------------------------------- constants
const TZ = 'America/Los_Angeles';
const ET = 'America/New_York';
const NBA_SEASON = { label: '2026-27', espnYear: 2027, scanFrom: '2026-10-01' };
const NFL_SEASON = { year: 2026 };
const MAX_RUN_MS = 4.5 * 60 * 1000;   // stay under Apps Script's 6-minute limit
const RETRY_DAYS = 14;                // re-check unverified games for this long

const TAB = {
  summary: 'Daily Summary', start: 'Start Here', props: 'My Props', lookup: 'Lookup',
  nbaHit: 'NBA Hit Rates', nflHit: 'NFL Hit Rates', nbaLog: 'NBA Game Logs',
  nflLog: 'NFL Game Logs', players: 'Players', settings: 'Settings'
};

const NBA_LOG_COLS = ['game_id', 'game_date', 'season', 'season_type', 'player_id', 'player', 'team',
  'opponent', 'home_away', 'team_result', 'status', 'dnp_reason', 'starter', 'minutes', 'pts', 'reb',
  'ast', 'fg3m', 'fg3a', 'fgm', 'fga', 'ftm', 'fta', 'oreb', 'dreb', 'stl', 'blk', 'tov', 'pf',
  'plus_minus', 'ejected', 'limited_minutes', 'check_status', 'check_note', 'source', 'updated_utc'];

const NFL_LOG_COLS = ['game_id', 'game_date', 'season', 'season_type', 'week', 'player_id', 'player',
  'position', 'team', 'opponent', 'home_away', 'team_result', 'status', 'dnp_reason', 'pass_cmp',
  'pass_att', 'pass_yds', 'pass_td', 'pass_int', 'carries', 'rush_yds', 'rush_td', 'receptions',
  'targets', 'rec_yds', 'rec_td', 'off_snaps', 'off_snap_pct', 'limited_snaps', 'check_status',
  'check_note', 'source', 'updated_utc'];

const HIT_COLS = ['player_key', 'sport', 'player', 'team', 'position', 'stat', 'line', 'games',
  'L5', 'L10', 'Season', 'Home', 'Away', 'avg', 'median', 'streak', 'last10_values_newest_first',
  'limited_games_L10', 'watchlist', 'L5_pct', 'L10_pct', 'season_pct', 'home_pct', 'away_pct'];

const PLAYER_COLS = ['player_key', 'sport', 'player_id', 'player', 'team', 'position', 'games_played',
  'avg_minutes_or_snap_pct', 'tracked', 'watchlist'];

const SUMMARY_COLS = ['run_time_pt', 'sport', 'section', 'item', 'detail'];

// stat code -> log column
const STAT_FIELD = {
  PTS: 'pts', REB: 'reb', AST: 'ast', '3PM': 'fg3m',
  PASS_YDS: 'pass_yds', PASS_TD: 'pass_td', REC: 'receptions', REC_YDS: 'rec_yds', RUSH_YDS: 'rush_yds'
};

const DEFAULT_LADDERS = [
  ['NBA', 'PTS', 'Points', range_(5, 40, 5), 'all'],
  ['NBA', 'AST', 'Assists', range_(2, 12, 2), 'all'],
  ['NBA', 'REB', 'Rebounds', range_(2, 14, 2), 'all'],
  ['NBA', '3PM', '3-Pointers Made', range_(1, 6, 1), 'all'],
  ['NFL', 'PASS_YDS', 'Passing Yards', range_(125, 350, 25), 'QB only'],
  ['NFL', 'PASS_TD', 'Passing TDs', range_(1, 4, 1), 'QB only'],
  ['NFL', 'REC_YDS', 'Receiving Yards', [10, 15].concat(range_(20, 150, 10)).join(','), 'receivers'],
  ['NFL', 'REC', 'Receptions', range_(2, 10, 1), 'receivers'],
  ['NFL', 'RUSH_YDS', 'Rushing Yards', [10, 15].concat(range_(20, 150, 10)).join(','), 'rushers']
];

const DEFAULT_SETTINGS = [
  ['NBA: min avg minutes to track', 5],
  ['NFL: min avg targets (receiving ladders)', 1],
  ['NFL: min avg carries (rushing ladder)', 1],
  ['NFL: QB needs a game with at least this many pass attempts', 10],
  ['Limited flag: % below player avg minutes/snap share', 35],
  ['Trend: L5 vs season gap (percentage points)', 40],
  ['Trend: min season games', 6],
  ['Streak flag: min length', 5],
  ['Daily Summary: keep this many rows', 3000]
];

// ESPN -> nflverse team codes (all others identical)
const NFL_TEAM_FIX = { WSH: 'WAS', LAR: 'LA' };
// ESPN -> basketball-reference team codes (for verification links)
const BBREF_TEAM = { BKN: 'BRK', CHA: 'CHO', GS: 'GSW', NO: 'NOP', NY: 'NYK', PHX: 'PHO', SA: 'SAS',
  UTAH: 'UTA', WSH: 'WAS' };

function range_(a, b, s) { const o = []; for (let x = a; x <= b; x += s) o.push(x); return o.join(','); }

// ---------------------------------------------------------------- menu + setup
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Prop Tracker')
    .addItem('Run NBA update now', 'runNBA')
    .addItem('Run NFL update now', 'runNFL')
    .addItem('Rebuild hit rates only', 'rebuildAll')
    .addItem('Test data sources', 'testSources')
    .addSeparator()
    .addItem('Setup / repair (tabs + schedule)', 'setup')
    .addToUi();
}

function setup() {
  const ss = SpreadsheetApp.getActive();
  ss.setSpreadsheetTimeZone(TZ);
  ensureTabs_(ss);
  installTriggers_();
  const sp = PropertiesService.getScriptProperties();
  sp.setProperty('backfill', 'on'); sp.deleteProperty('nba_backfill_done'); sp.deleteProperty('nfl_backfill_done');
  logSummary_('ALL', [['SETUP', 'Tabs checked and schedule installed',
    'NBA daily ~5am PT; NFL Tue + Wed ~10am PT. Season backfill runs every 5 min until complete.']]);
  try { SpreadsheetApp.getActive().toast('Setup done. Backfill starts within 5 minutes.', 'Prop Tracker', 8); } catch (e) {}
}

function installTriggers_() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('runNBA').timeBased().everyDays(1).atHour(5).inTimezone(TZ).create();
  ScriptApp.newTrigger('runNFL').timeBased().onWeekDay(ScriptApp.WeekDay.TUESDAY).atHour(10).inTimezone(TZ).create();
  ScriptApp.newTrigger('runNFL').timeBased().onWeekDay(ScriptApp.WeekDay.WEDNESDAY).atHour(10).inTimezone(TZ).create();
  ScriptApp.newTrigger('backfillTick').timeBased().everyMinutes(5).create();
}

function backfillTick() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('backfill') !== 'on') return removeBackfill_();
  if (props.getProperty('nba_backfill_done') !== 'yes') return runNBA();
  if (props.getProperty('nfl_backfill_done') !== 'yes') return runNFL();
  props.setProperty('backfill', 'off');
  logSummary_('ALL', [['SETUP', 'Season backfill complete', 'Daily/weekly schedule continues.']]);
  removeBackfill_();
}
function removeBackfill_() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'backfillTick')
    .forEach(t => ScriptApp.deleteTrigger(t));
}

function ensureTabs_(ss) {
  const order = [TAB.summary, TAB.start, TAB.props, TAB.lookup, TAB.nbaHit, TAB.nflHit,
    TAB.nbaLog, TAB.nflLog, TAB.players, TAB.settings];
  const headers = {};
  headers[TAB.summary] = SUMMARY_COLS; headers[TAB.nbaHit] = HIT_COLS; headers[TAB.nflHit] = HIT_COLS;
  headers[TAB.nbaLog] = NBA_LOG_COLS; headers[TAB.nflLog] = NFL_LOG_COLS; headers[TAB.players] = PLAYER_COLS;
  order.forEach((name, i) => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name, i);
    if (headers[name]) {
      const h = headers[name];
      const cur = sh.getRange(1, 1, 1, h.length).getValues()[0];
      if (cur.join('|') !== h.join('|')) sh.getRange(1, 1, 1, h.length).setValues([h]);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, h.length).setFontWeight('bold').setBackground('#1f2937').setFontColor('#ffffff');
    }
  });
  order.forEach((name, i) => { ss.setActiveSheet(ss.getSheetByName(name)); ss.moveActiveSheet(i + 1); });
  const def = ss.getSheetByName('Sheet1'); if (def && ss.getSheets().length > order.length) ss.deleteSheet(def);

  // My Props
  const mp = ss.getSheetByName(TAB.props);
  if (!mp.getRange('A1').getValue()) {
    mp.getRange(1, 1, 1, 6).setValues([['sport', 'player', 'team (optional)', 'stat (optional)', 'line (optional)', 'notes']])
      .setFontWeight('bold').setBackground('#1f2937').setFontColor('#ffffff');
    mp.setFrozenRows(1);
  }
  mp.getRange('A2:A500').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['NBA', 'NFL']).build());
  mp.getRange('D2:D500').setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(Object.keys(STAT_FIELD)).setAllowInvalid(false).build());

  // Settings
  const st = ss.getSheetByName(TAB.settings);
  if (!st.getRange('A1').getValue()) {
    st.getRange(1, 1, 1, 5).setValues([['sport', 'stat', 'label', 'lines (at or above, comma separated)', 'applies to']]);
    st.getRange('D:D').setNumberFormat('@');
    st.getRange(2, 1, DEFAULT_LADDERS.length, 5).setValues(DEFAULT_LADDERS);
    st.getRange(1, 7, 1, 2).setValues([['setting', 'value']]);
    st.getRange(2, 7, DEFAULT_SETTINGS.length, 2).setValues(DEFAULT_SETTINGS);
    st.getRange('A1:H1').setFontWeight('bold');
  }

  // Lookup (live formulas)
  const lk = ss.getSheetByName(TAB.lookup);
  lk.getRange('A1').setValue('Player:').setFontWeight('bold');
  lk.getRange('B1').setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInRange(ss.getSheetByName(TAB.players).getRange('A2:A'), true).build())
    .setBackground('#fef9c3');
  lk.getRange('C1').setValue('← pick a player (type to search). Ladder below, last 10 games to the right.');
  lk.getRange('A3').setFormula(
    '=IF(B1="","",IFERROR(CHOOSECOLS(FILTER({\'NBA Hit Rates\'!A2:X;\'NFL Hit Rates\'!A2:X},' +
    '{\'NBA Hit Rates\'!A2:A;\'NFL Hit Rates\'!A2:A}=B1),6,7,8,9,10,11,12,13,14,15,16,18),"No hit-rate rows yet"))');
  lk.getRange('A2:L2').setValues([['stat', 'line', 'games', 'L5', 'L10', 'Season', 'Home', 'Away', 'avg', 'median', 'streak', 'limited (L10)']])
    .setFontWeight('bold').setBackground('#e5e7eb');
  lk.getRange('N2').setValue('Last 10 games (newest first)').setFontWeight('bold');
  lk.getRange('N3').setFormula(
    '=IF(B1="","",IFERROR(IF(LEFT(B1,3)="NBA",' +
    'ARRAY_CONSTRAIN(SORT(CHOOSECOLS(FILTER(\'NBA Game Logs\'!A2:AJ,\'NBA Game Logs\'!E2:E=VLOOKUP(B1,Players!A:C,3,0)),2,8,9,11,14,15,16,17,18,32,33),1,FALSE),10,11),' +
    'ARRAY_CONSTRAIN(SORT(CHOOSECOLS(FILTER(\'NFL Game Logs\'!A2:AG,\'NFL Game Logs\'!F2:F=VLOOKUP(B1,Players!A:C,3,0)),2,10,11,13,17,18,21,23,25,28,29,30),1,FALSE),10,12)),"—"))');
  lk.getRange('N1').setValue('NBA cols: date, opp, H/A, status, min, pts, reb, ast, 3pm, limited, check  |  NFL cols: date, opp, H/A, status, pass yds, pass td, rush yds, rec, rec yds, snap %, limited, check');
}

// ---------------------------------------------------------------- settings
function readSettings_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(TAB.settings);
  const vals = sh.getDataRange().getValues();
  const ladders = { NBA: [], NFL: [] };
  const s = {};
  for (let i = 1; i < vals.length; i++) {
    const [sport, stat, label, lines, applies] = vals[i];
    if (sport && stat && STAT_FIELD[stat]) {
      const ls = String(lines).split(',').map(x => Number(String(x).trim())).filter(x => !isNaN(x) && x > 0);
      ladders[sport].push({ stat: String(stat), label: String(label), field: STAT_FIELD[stat], lines: ls, applies: String(applies) });
    }
    if (vals[i][6]) s[String(vals[i][6])] = Number(vals[i][7]);
  }
  const g = (k, d) => (s[k] === undefined || isNaN(s[k]) ? d : s[k]);
  return {
    ladders,
    nbaMinMinutes: g(DEFAULT_SETTINGS[0][0], 5),
    nflMinTargets: g(DEFAULT_SETTINGS[1][0], 1),
    nflMinCarries: g(DEFAULT_SETTINGS[2][0], 1),
    nflQbAtt: g(DEFAULT_SETTINGS[3][0], 10),
    limitedPct: g(DEFAULT_SETTINGS[4][0], 35) / 100,
    trendGap: g(DEFAULT_SETTINGS[5][0], 40) / 100,
    trendMinGames: g(DEFAULT_SETTINGS[6][0], 6),
    streakMin: g(DEFAULT_SETTINGS[7][0], 5),
    keepRows: g(DEFAULT_SETTINGS[8][0], 3000)
  };
}

function readWatchlist_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(TAB.props);
  const vals = sh.getDataRange().getValues().slice(1);
  return vals.filter(r => r[0] && r[1]).map(r => ({
    sport: String(r[0]).trim().toUpperCase(), player: String(r[1]).trim(), norm: normName_(r[1]),
    team: String(r[2] || '').trim().toUpperCase(), stat: String(r[3] || '').trim().toUpperCase(),
    line: r[4] === '' ? null : Number(String(r[4]).replace('+', '')), notes: r[5]
  }));
}

// ---------------------------------------------------------------- utilities
function normName_(n) {
  return String(n || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[.'’,]/g, '').replace(/-/g, ' ').split(/\s+/)
    .filter(t => t && ['jr', 'sr', 'ii', 'iii', 'iv', 'v'].indexOf(t) < 0).join(' ');
}
function num_(v) {
  if (v === null || v === undefined) return '';
  const s = String(v).trim();
  if (s === '' || s === '--' || s === '-') return '';
  const n = Number(s.replace('+', ''));
  return isNaN(n) ? '' : n;
}
function splitPair_(v, sep) {
  const p = String(v || '').split(sep);
  return p.length === 2 ? [num_(p[0]), num_(p[1])] : ['', ''];
}
function nowUtc_() { return Utilities.formatDate(new Date(), 'UTC', "yyyy-MM-dd'T'HH:mm:ss'Z'"); }
function nowPt_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'); }
function ymd_(d, tz) { return Utilities.formatDate(d, tz, 'yyyy-MM-dd'); }
function daysAgo_(dateStr) { return (Date.now() - new Date(dateStr + 'T12:00:00Z').getTime()) / 86400000; }
function median_(a) {
  if (!a.length) return '';
  const s = a.slice().sort((x, y) => x - y), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function round1_(x) { return x === '' ? '' : Math.round(x * 10) / 10; }
function frac_(h, n) { return n ? h + '/' + n + ' – ' + Math.round(100 * h / n) + '%' : '—'; }

function fetchJsonAll_(urls) {
  const out = [];
  for (let i = 0; i < urls.length; i += 12) {
    const batch = urls.slice(i, i + 12).map(u => ({ url: u, muteHttpExceptions: true }));
    const res = UrlFetchApp.fetchAll(batch);
    res.forEach((r, j) => {
      let body = null;
      if (r.getResponseCode() === 200) { try { body = JSON.parse(r.getContentText()); } catch (e) {} }
      out.push({ url: batch[j].url, ok: !!body, code: r.getResponseCode(), body: body });
    });
  }
  return out;
}

/** Box-score fetch with fallback: ESPN site.web.api summary, then ESPN cdn gamepackage. */
function fetchBoxes_(sport, ids) {
  const lg = sport === 'NBA' ? 'basketball/nba' : 'football/nfl';
  const first = fetchJsonAll_(ids.map(id => 'https://site.web.api.espn.com/apis/site/v2/sports/' + lg + '/summary?event=' + id));
  const out = first.map(r => (r.ok && r.body.boxscore && r.body.boxscore.players) ? r.body : null);
  const miss = ids.filter((id, i) => !out[i]);
  if (miss.length) {
    const second = fetchJsonAll_(miss.map(id => 'https://cdn.espn.com/core/' + sport.toLowerCase() + '/boxscore?xhr=1&gameId=' + id));
    second.forEach((r, j) => {
      const gp = r.ok && r.body.gamepackageJSON;
      if (gp && gp.boxscore && gp.boxscore.players) out[ids.indexOf(miss[j])] = gp;
    });
  }
  return out;
}

function readTable_(name) {
  const sh = SpreadsheetApp.getActive().getSheetByName(name);
  const vals = sh.getDataRange().getValues();
  const head = vals[0];
  return vals.slice(1).filter(r => r[0] !== '').map(r => {
    const o = {}; head.forEach((h, i) => { o[h] = r[i] instanceof Date ? ymd_(r[i], TZ) : r[i]; }); return o;
  });
}
const TEXT_COLS = { game_id: 1, game_date: 1, season: 1, player_id: 1, player_key: 1, line: 1, L5: 1, L10: 1,
  Season: 1, Home: 1, Away: 1, streak: 1, last10_values_newest_first: 1, team: 1, opponent: 1, plus_minus: 0 };
function writeTable_(name, cols, rows) {
  const sh = SpreadsheetApp.getActive().getSheetByName(name);
  const last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, Math.max(sh.getLastColumn(), cols.length)).clearContent();
  sh.getRange(1, 1, 1, cols.length).setValues([cols]);
  if (!rows.length) return;
  const data = rows.map(o => cols.map(c => (o[c] === undefined || o[c] === null ? '' : (TEXT_COLS[c] ? String(o[c]) : o[c]))));
  if (sh.getMaxRows() < data.length + 1) sh.insertRowsAfter(sh.getMaxRows(), data.length + 1 - sh.getMaxRows());
  cols.forEach((c, i) => sh.getRange(2, i + 1, data.length, 1).setNumberFormat(TEXT_COLS[c] ? '@' : 'General'));
  sh.getRange(2, 1, data.length, cols.length).setValues(data);
}

function logSummary_(sport, items) {
  const sh = SpreadsheetApp.getActive().getSheetByName(TAB.summary);
  if (!items.length) return;
  const t = nowPt_();
  const rows = items.map(it => [t, sport, it[0], it[1], it[2] === undefined ? '' : it[2]]);
  sh.insertRowsAfter(1, rows.length);
  sh.getRange(2, 1, rows.length, 5).setNumberFormat('@STRING@').setValues(rows.map(r => r.map(String)))
    .setFontWeight('normal').setBackground(null).setFontColor('#000000');
  let keep = 3000; try { keep = readSettings_().keepRows; } catch (e) {}
  if (sh.getLastRow() > keep + 1) sh.deleteRows(keep + 2, sh.getLastRow() - keep - 1);
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return;   // another run is in progress
  try { fn(); } finally { lock.releaseLock(); }
}

// ================================================================= NBA
function runNBA() { withLock_(() => updateNBA_()); }

function updateNBA_() {
  const t0 = Date.now();
  const props = PropertiesService.getScriptProperties();
  const cfg = readSettings_();
  const notes = [];

  const existing = readTable_(TAB.nbaLog).filter(r => r.status !== 'NOT_IN_BOX');
  const byGame = {};
  existing.forEach(r => { (byGame[r.game_id] = byGame[r.game_id] || []).push(r); });

  // 1) which dates to scan
  const today = ymd_(new Date(), ET);
  let from = props.getProperty('nba_scan_from') || NBA_SEASON.scanFrom;
  const missing = JSON.parse(props.getProperty('nba_missing') || '[]').filter(d => daysAgo_(d) <= RETRY_DAYS);
  existing.forEach(r => { if (!/^OK/.test(r.check_status) && daysAgo_(r.game_date) <= RETRY_DAYS && r.game_date < from) from = r.game_date; });
  missing.forEach(d => { if (d < from) from = d; });
  const stillMissing = [];
  const dates = [];
  for (let d = new Date(from + 'T12:00:00Z'); ymd_(d, 'UTC') <= today; d.setUTCDate(d.getUTCDate() + 1)) dates.push(ymd_(d, 'UTC'));
  const sb = fetchJsonAll_(dates.map(d => 'https://site.web.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?limit=100&dates=' + d.replace(/-/g, '')));

  // 2) collect FINAL regular/post-season games we still need
  const games = []; const sbFail = [];
  let lastFullyFinalDate = null, allFinal = true;
  sb.forEach((r, i) => {
    if (!r.ok) { allFinal = false; sbFail.push(dates[i] + ' (HTTP ' + r.code + ')'); return; }
    const evs = r.body.events || [];
    let dayFinal = true;
    evs.forEach(ev => {
      const comp = ev.competitions && ev.competitions[0];
      const st = ev.status && ev.status.type;
      const stype = (ev.season && ev.season.type) || 2;
      if (stype === 1 || stype === 4) return; // preseason / all-star
      if (!st || !st.completed || st.name !== 'STATUS_FINAL') { if (!(st && /POSTPONED|CANCELED/.test(st.name))) dayFinal = false; return; }
      const prior = byGame[ev.id];
      const needsRetry = prior && prior.some(x => !/^OK/.test(x.check_status)) && daysAgo_(prior[0].game_date) <= RETRY_DAYS;
      if (prior && !needsRetry) return;
      const c = {}; (comp.competitors || []).forEach(x => { c[x.homeAway] = { id: x.team.id, abbr: x.team.abbreviation, score: num_(x.score) }; });
      games.push({ id: ev.id, date: ymd_(new Date(ev.date), ET), stype: stype, home: c.home, away: c.away });
    });
    if (dayFinal && allFinal) lastFullyFinalDate = dates[i];
    else allFinal = false;
  });

  // 3) fetch box scores (time-boxed)
  let processed = 0, added = 0, partial = false;
  const newRows = {};
  for (let i = 0; i < games.length; i += 12) {
    if (Date.now() - t0 > MAX_RUN_MS - 60000) { partial = true; break; }
    const chunk = games.slice(i, i + 12);
    const res = fetchBoxes_('NBA', chunk.map(g => g.id));
    res.forEach((body, j) => {
      const g = chunk[j];
      const rows = body ? parseNbaBox_(body, g) : null;
      if (!rows) { stillMissing.push(g.date); notes.push(['UNVERIFIED', g.away.abbr + ' @ ' + g.home.abbr + ' ' + g.date, 'Box score not available from ESPN yet; game skipped, will retry.']); return; }
      newRows[g.id] = rows; processed++; added += rows.length;
    });
  }
  Object.keys(newRows).forEach(id => { byGame[id] = newRows[id]; });

  // advance scan window (keep 2-day overlap so late corrections are seen)
  if (!partial && lastFullyFinalDate) {
    const d = new Date(lastFullyFinalDate + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - 2);
    props.setProperty('nba_scan_from', ymd_(d, 'UTC') < NBA_SEASON.scanFrom ? NBA_SEASON.scanFrom : ymd_(d, 'UTC'));
  }
  props.setProperty('nba_missing', JSON.stringify(stillMissing));
  if (!partial && !sbFail.length) props.setProperty('nba_backfill_done', 'yes');

  // 4) rebuild
  let all = [].concat.apply([], Object.keys(byGame).map(k => byGame[k]));
  if (sbFail.length) notes.unshift(['UNVERIFIED', sbFail.length + ' of ' + dates.length + ' ESPN scoreboard days did not load',
    sbFail.slice(0, 5).join(', ') + (sbFail.length > 5 ? ', …' : '') + ' — will retry next run']);
  const summary = rebuildNBA_(all, cfg, Object.keys(newRows));
  const items = [['RUN', 'NBA update' + (partial ? ' (partial — continues next run)' : ''),
    processed + ' games processed, ' + added + ' player rows written, ' + Math.round((Date.now() - t0) / 1000) + 's']]
    .concat(summary).concat(notes);
  logSummary_('NBA', items);
}

function parseNbaBox_(body, g) {
  const box = body && body.boxscore;
  if (!box || !box.players || box.players.length !== 2) return null;
  const rows = [];
  const scoreByTeam = {}; scoreByTeam[g.home.id] = g.home.score; scoreByTeam[g.away.id] = g.away.score;
  for (const tp of box.players) {
    const team = tp.team; const isHome = team.id === g.home.id;
    const opp = isHome ? g.away : g.home; const me = isHome ? g.home : g.away;
    const grp = tp.statistics && tp.statistics[0];
    if (!grp || !grp.keys) return null;
    const k = grp.keys;
    const ix = name => k.indexOf(name);
    const need = ['minutes', 'points', 'rebounds', 'assists', 'threePointFieldGoalsMade-threePointFieldGoalsAttempted'];
    if (need.some(n => ix(n) < 0)) return null;     // format changed: refuse to guess
    const teamRows = [];
    const sums = { pts: 0, reb: 0, ast: 0, fg3m: 0 };
    for (const a of grp.athletes || []) {
      const s = a.stats || [];
      const dnp = a.didNotPlay === true || !s.length;
      const r = {
        game_id: String(g.id), game_date: g.date, season: NBA_SEASON.label,
        season_type: g.stype === 3 ? 'Postseason' : g.stype === 5 ? 'Play-In' : 'Regular',
        player_id: String(a.athlete.id), player: a.athlete.displayName, team: team.abbreviation,
        opponent: opp.abbr, home_away: isHome ? 'H' : 'A',
        team_result: me.score > opp.score ? 'W' : 'L',
        status: dnp ? 'DNP' : 'PLAYED', dnp_reason: dnp ? (a.reason || 'DNP') : '',
        starter: a.starter ? 'Y' : 'N', ejected: a.ejected ? 'Y' : '',
        source: 'ESPN', updated_utc: nowUtc_()
      };
      if (!dnp) {
        const v = n => num_(s[ix(n)]);
        const fg = splitPair_(s[ix('fieldGoalsMade-fieldGoalsAttempted')], '-');
        const f3 = splitPair_(s[ix('threePointFieldGoalsMade-threePointFieldGoalsAttempted')], '-');
        const ft = splitPair_(s[ix('freeThrowsMade-freeThrowsAttempted')], '-');
        Object.assign(r, {
          minutes: v('minutes'), pts: v('points'), reb: v('rebounds'), ast: v('assists'),
          fg3m: f3[0], fg3a: f3[1], fgm: fg[0], fga: fg[1], ftm: ft[0], fta: ft[1],
          oreb: v('offensiveRebounds'), dreb: v('defensiveRebounds'), stl: v('steals'), blk: v('blocks'),
          tov: v('turnovers'), pf: v('fouls'), plus_minus: v('plusMinus')
        });
        ['pts', 'reb', 'ast', 'fg3m'].forEach(f => { sums[f] += r[f] === '' ? NaN : r[f]; });
      }
      teamRows.push(r);
    }
    // cross-check: player sums must equal team totals / final score
    const tot = grp.totals || [];
    const teamTot = {
      pts: scoreByTeam[team.id] !== '' ? scoreByTeam[team.id] : num_(tot[ix('points')]),
      reb: num_(tot[ix('rebounds')]), ast: num_(tot[ix('assists')]),
      fg3m: splitPair_(tot[ix('threePointFieldGoalsMade-threePointFieldGoalsAttempted')], '-')[0]
    };
    const bad = Object.keys(sums).filter(f => teamTot[f] !== '' && sums[f] !== teamTot[f]);
    const bad2 = Object.keys(sums).filter(f => teamTot[f] === '');
    teamRows.forEach(r => {
      if (r.status !== 'PLAYED') { r.check_status = 'OK (DNP)'; return; }
      if (bad.length) {
        bad.forEach(f => { r[f] = ''; });
        r.check_status = 'FAILED – team total mismatch';
        r.check_note = bad.map(f => f + ': players sum ' + sums[f] + ' vs team ' + teamTot[f]).join('; ') + ' — blanked, will retry';
      } else if (bad2.length) {
        r.check_status = 'OK (partial check)'; r.check_note = 'team total missing for ' + bad2.join(',');
      } else r.check_status = 'OK – matches team totals';
    });
    rows.push.apply(rows, teamRows);
  }
  return rows;
}

function rebuildNBA_(rows, cfg, newGameIds) {
  const watch = readWatchlist_().filter(w => w.sport === 'NBA');
  // player meta
  const P = {};
  rows.forEach(r => {
    const p = P[r.player_id] = P[r.player_id] || { id: r.player_id, name: r.player, team: r.team, lastDate: '', games: [], mins: [] };
    if (r.game_date >= p.lastDate) { p.lastDate = r.game_date; p.team = r.team; p.name = r.player; }
    if (r.status === 'PLAYED') { p.games.push(r); if (r.minutes !== '') p.mins.push(Number(r.minutes)); }
  });
  Object.keys(P).forEach(id => {
    const p = P[id];
    p.avgMin = p.mins.length ? p.mins.reduce((a, b) => a + b, 0) / p.mins.length : 0;
    p.watch = watch.filter(w => w.norm === normName_(p.name) && (!w.team || w.team === p.team));
    p.tracked = p.avgMin >= cfg.nbaMinMinutes || p.watch.length > 0;
  });
  // limited-minutes flag (relative to player's season average)
  rows.forEach(r => {
    const p = P[r.player_id];
    if (r.status === 'PLAYED' && r.minutes !== '' && p.mins.length >= 3) {
      r.limited_minutes = (Number(r.minutes) < p.avgMin * (1 - cfg.limitedPct) || r.ejected === 'Y') ? 'Y' : '';
    } else r.limited_minutes = r.ejected === 'Y' ? 'Y' : '';
  });
  // inferred NOT_IN_BOX rows for tracked players (team games after their first game with that team)
  const teamGames = {};
  rows.forEach(r => { (teamGames[r.team] = teamGames[r.team] || {})[r.game_id] = r; });
  const inferred = [];
  const seen = {}; const byPlayer = {};
  rows.forEach(r => { seen[r.game_id + '|' + r.player_id] = 1; (byPlayer[r.player_id] = byPlayer[r.player_id] || []).push(r); });
  Object.keys(P).forEach(id => {
    const p = P[id]; if (!p.tracked) return;
    const stints = {}; // team -> first date
    (byPlayer[id] || []).forEach(r => { if (!stints[r.team] || r.game_date < stints[r.team].first) stints[r.team] = { first: r.game_date }; });
    const teamsByFirst = Object.keys(stints).sort((a, b) => stints[a].first < stints[b].first ? -1 : 1);
    teamsByFirst.forEach((t, i) => {
      const end = i + 1 < teamsByFirst.length ? stints[teamsByFirst[i + 1]].first : '9999';
      Object.keys(teamGames[t] || {}).forEach(gid => {
        const ref = teamGames[t][gid];
        if (ref.game_date < stints[t].first || ref.game_date >= end || seen[gid + '|' + id]) return;
        inferred.push({ game_id: gid, game_date: ref.game_date, season: ref.season, season_type: ref.season_type,
          player_id: id, player: p.name, team: t, opponent: ref.opponent, home_away: ref.home_away,
          team_result: ref.team_result, status: 'NOT_IN_BOX', dnp_reason: 'Not listed in box score (inactive / injured / away from team)',
          check_status: 'OK (not counted)', source: 'inferred', updated_utc: nowUtc_() });
      });
    });
  });
  const allRows = rows.concat(inferred).sort((a, b) => a.game_date < b.game_date ? 1 : a.game_date > b.game_date ? -1 :
    (a.game_id + a.team + a.player).localeCompare(b.game_id + b.team + b.player));
  writeTable_(TAB.nbaLog, NBA_LOG_COLS, allRows);

  // hit rates
  const hit = [];
  const players = [];
  Object.keys(P).forEach(id => {
    const p = P[id];
    const key = 'NBA – ' + p.name + ' (' + p.team + ')';
    players.push({ player_key: key, sport: 'NBA', player_id: id, player: p.name, team: p.team, position: '',
      games_played: p.games.length, avg_minutes_or_snap_pct: round1_(p.avgMin), tracked: p.tracked ? 'Y' : '', watchlist: p.watch.length ? 'Y' : '' });
    if (!p.tracked) return;
    p.key = key;
    cfg.ladders.NBA.forEach(L => hit.push.apply(hit, ladderRows_(p, key, 'NBA', '', L, 'limited_minutes')));
  });
  sortHit_(hit);
  writeTable_(TAB.nbaHit, HIT_COLS, hit);
  writePlayers_('NBA', players);
  return buildSummary_('NBA', P, hit, allRows, cfg, newGameIds, watch);
}

// ================================================================= NFL
function runNFL() { withLock_(() => updateNFL_()); }

function updateNFL_() {
  const t0 = Date.now();
  const props = PropertiesService.getScriptProperties();
  const cfg = readSettings_();
  const notes = [];
  const yr = NFL_SEASON.year;

  const existing = readTable_(TAB.nflLog).filter(r => r.source === 'ESPN');
  existing.forEach(r => { r.espn_team_check = ''; });
  const byGame = {};
  existing.forEach(r => { (byGame[r.game_id] = byGame[r.game_id] || []).push(r); });

  // second source + snaps
  const nv = loadNflverse_(yr, notes);

  // 1) weeks to scan: regular season 1..18, postseason 1..5
  const base = 'https://site.web.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?limit=100&dates=' + yr;
  const urls = []; const wk = [];
  for (let w = 1; w <= 18; w++) { urls.push(base + '&seasontype=2&week=' + w); wk.push([2, w]); }
  [1, 2, 3, 5].forEach(w => { urls.push(base + '&seasontype=3&week=' + w); wk.push([3, w]); });
  const sb = fetchJsonAll_(urls);
  const games = []; const nflFail = [];
  sb.forEach((r, i) => {
    if (!r.ok) { nflFail.push((wk[i][0] === 3 ? 'post ' : 'wk ') + wk[i][1] + ' (HTTP ' + r.code + ')'); return; }
    (r.body.events || []).forEach(ev => {
      const st = ev.status && ev.status.type;
      if (!st || !st.completed || st.name !== 'STATUS_FINAL') return;
      const prior = byGame[ev.id];
      const retry = prior && prior.some(x => !/^OK/.test(x.check_status)) && daysAgo_(prior[0].game_date) <= RETRY_DAYS;
      if (prior && !retry) return;
      const comp = ev.competitions[0]; const c = {};
      comp.competitors.forEach(x => { c[x.homeAway] = { id: x.team.id, abbr: x.team.abbreviation, score: num_(x.score) }; });
      const nvWeek = wk[i][0] === 2 ? wk[i][1] : ({ 1: 19, 2: 20, 3: 21, 5: 22 })[wk[i][1]];
      games.push({ id: ev.id, date: ymd_(new Date(ev.date), ET), stype: wk[i][0], week: nvWeek, home: c.home, away: c.away });
    });
  });

  if (nflFail.length) notes.unshift(['UNVERIFIED', nflFail.length + ' ESPN scoreboard weeks did not load', nflFail.slice(0, 6).join(', ') + ' — will retry next run']);
  let processed = 0, partial = false;
  const fresh = [];
  for (let i = 0; i < games.length; i += 12) {
    if (Date.now() - t0 > MAX_RUN_MS - 75000) { partial = true; break; }
    const chunk = games.slice(i, i + 12);
    const res = fetchBoxes_('NFL', chunk.map(g => g.id));
    res.forEach((body, j) => {
      const g = chunk[j];
      const rows = body ? parseNflBox_(body, g) : null;
      if (!rows) { notes.push(['UNVERIFIED', g.away.abbr + ' @ ' + g.home.abbr + ' ' + g.date, 'Box score not available from ESPN yet; will retry.']); return; }
      byGame[g.id] = rows; fresh.push(g.id); processed++;
    });
  }
  if (!partial && !nflFail.length) props.setProperty('nfl_backfill_done', 'yes');

  const all = [].concat.apply([], Object.keys(byGame).map(k => byGame[k]));
  const summary = rebuildNFL_(all, nv, cfg, fresh);
  logSummary_('NFL', [['RUN', 'NFL update' + (partial ? ' (partial — continues next run)' : ''),
    processed + ' games processed; nflverse stats ' + (nv.statsOk ? 'loaded' : 'NOT loaded') + ', snaps ' + (nv.snapsOk ? 'loaded' : 'NOT loaded') +
    '; ' + Math.round((Date.now() - t0) / 1000) + 's']].concat(summary).concat(notes));
}

function loadNflverse_(yr, notes) {
  const out = { stats: {}, snaps: {}, statsWeeks: {}, snapWeeks: {}, statsOk: false, snapsOk: false };
  const get = u => { try { const r = UrlFetchApp.fetch(u, { muteHttpExceptions: true, followRedirects: true }); return r.getResponseCode() === 200 ? Utilities.parseCsv(r.getContentText()) : null; } catch (e) { return null; } };
  const s = get('https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_' + yr + '.csv');
  if (s && s.length > 1) {
    const h = s[0]; const I = n => h.indexOf(n);
    const cols = ['player_id', 'player_display_name', 'position', 'week', 'team', 'completions', 'attempts', 'passing_yards', 'passing_tds',
      'carries', 'rushing_yards', 'receptions', 'targets', 'receiving_yards'];
    if (cols.every(c => I(c) >= 0)) {
      out.statsOk = true;
      for (let i = 1; i < s.length; i++) {
        const r = s[i]; const o = {}; cols.forEach(c => { o[c] = r[I(c)]; });
        const k = o.team + '|' + o.week;
        out.statsWeeks[k] = 1;
        (out.stats[k] = out.stats[k] || []).push(o);
      }
    }
  }
  if (!out.statsOk) notes.push(['UNVERIFIED', 'nflverse player stats', 'Could not load second source; NFL rows marked single-source until next run.']);
  const n = get('https://github.com/nflverse/nflverse-data/releases/download/snap_counts/snap_counts_' + yr + '.csv');
  if (n && n.length > 1) {
    const h = n[0]; const I = c => h.indexOf(c);
    if (['week', 'player', 'position', 'team', 'offense_snaps', 'offense_pct'].every(c => I(c) >= 0)) {
      out.snapsOk = true;
      for (let i = 1; i < n.length; i++) {
        const r = n[i]; const k = r[I('team')] + '|' + r[I('week')];
        out.snapWeeks[k] = 1;
        (out.snaps[k] = out.snaps[k] || []).push({ name: r[I('player')], position: r[I('position')], snaps: Number(r[I('offense_snaps')]), pct: Number(r[I('offense_pct')]) });
      }
    }
  }
  if (!out.snapsOk) notes.push(['UNVERIFIED', 'nflverse snap counts', 'Could not load snap counts; DNP detection and limited-snaps flags paused.']);
  return out;
}

function parseNflBox_(body, g) {
  const box = body && body.boxscore;
  if (!box || !box.players || box.players.length !== 2) return null;
  const rows = [];
  for (const tp of box.players) {
    const team = tp.team; const isHome = team.id === g.home.id;
    const me = isHome ? g.home : g.away; const opp = isHome ? g.away : g.home;
    const P = {};
    const get = (a) => P[a.athlete.id] = P[a.athlete.id] || {
      game_id: String(g.id), game_date: g.date, season: String(NFL_SEASON.year),
      season_type: g.stype === 3 ? 'Postseason' : 'Regular', week: g.week,
      player_id: String(a.athlete.id), player: a.athlete.displayName, position: (a.athlete.position && a.athlete.position.abbreviation) || '',
      team: team.abbreviation, opponent: opp.abbr, home_away: isHome ? 'H' : 'A',
      team_result: me.score > opp.score ? 'W' : me.score < opp.score ? 'L' : 'T', status: 'PLAYED',
      pass_cmp: 0, pass_att: 0, pass_yds: 0, pass_td: 0, pass_int: 0, carries: 0, rush_yds: 0, rush_td: 0,
      receptions: 0, targets: 0, rec_yds: 0, rec_td: 0, source: 'ESPN', updated_utc: nowUtc_()
    };
    let sumPass = 0, sumRec = 0, hasPass = false, hasRec = false;
    for (const grp of tp.statistics || []) {
      const k = grp.keys || []; const ix = n => k.indexOf(n);
      if (grp.name === 'passing') {
        if (ix('passingYards') < 0 || ix('passingTouchdowns') < 0) return null;
        hasPass = true;
        (grp.athletes || []).forEach(a => {
          const s = a.stats || []; const r = get(a); const ca = splitPair_(s[ix('completions/passingAttempts')], '/');
          r.pass_cmp = ca[0]; r.pass_att = ca[1]; r.pass_yds = num_(s[ix('passingYards')]);
          r.pass_td = num_(s[ix('passingTouchdowns')]); r.pass_int = num_(s[ix('interceptions')]);
          sumPass += Number(r.pass_yds) || 0;
        });
      } else if (grp.name === 'rushing') {
        if (ix('rushingYards') < 0) return null;
        (grp.athletes || []).forEach(a => {
          const s = a.stats || []; const r = get(a);
          r.carries = num_(s[ix('rushingAttempts')]); r.rush_yds = num_(s[ix('rushingYards')]); r.rush_td = num_(s[ix('rushingTouchdowns')]);
        });
      } else if (grp.name === 'receiving') {
        if (ix('receptions') < 0 || ix('receivingYards') < 0) return null;
        hasRec = true;
        (grp.athletes || []).forEach(a => {
          const s = a.stats || []; const r = get(a);
          r.receptions = num_(s[ix('receptions')]); r.rec_yds = num_(s[ix('receivingYards')]);
          r.rec_td = num_(s[ix('receivingTouchdowns')]); r.targets = num_(s[ix('receivingTargets')]);
          sumRec += Number(r.rec_yds) || 0;
        });
      }
    }
    const teamOk = !(hasPass && hasRec) || sumPass === sumRec;
    Object.keys(P).forEach(id => {
      const r = P[id];
      r.espn_team_check = teamOk ? '' : 'note: team passing yds (' + sumPass + ') ≠ receiving yds (' + sumRec + '), per-player check still applies';
      rows.push(r);
    });
  }
  return rows;
}

function nvMatch_(list, name) {
  if (!list) return null;
  const n = normName_(name);
  let m = list.filter(x => normName_(x.player_display_name || x.name) === n);
  if (m.length === 1) return m[0];
  const parts = n.split(' '); if (!parts[0]) return null; const last = parts[parts.length - 1], fi = parts[0][0];
  m = list.filter(x => { const q = normName_(x.player_display_name || x.name).split(' '); return q[0] && q[q.length - 1] === last && q[0][0] === fi; });
  if (m.length === 1) return m[0];
  // nickname fallback (Hollywood/Marquise Brown, Drew/Andrew Ogletree): unique last name on this team this week
  m = list.filter(x => { const q = normName_(x.player_display_name || x.name).split(' '); return q[q.length - 1] === last; });
  return m.length === 1 ? m[0] : null;
}

function rebuildNFL_(espnRows, nv, cfg, freshIds) {
  const watch = readWatchlist_().filter(w => w.sport === 'NFL');
  const VERIFY = [['pass_yds', 'passing_yards'], ['pass_td', 'passing_tds'], ['rush_yds', 'rushing_yards'],
    ['receptions', 'receptions'], ['rec_yds', 'receiving_yards'], ['carries', 'carries'], ['targets', 'targets'], ['pass_att', 'attempts']];
  const BLANK_ON_MISMATCH = { pass_yds: 1, pass_td: 1, rush_yds: 1, receptions: 1, rec_yds: 1 };
  const usedSnaps = {};

  espnRows.forEach(r => {
    const nvTeam = NFL_TEAM_FIX[r.team] || r.team; const k = nvTeam + '|' + r.week;
    r.check_note = r.espn_team_check || '';
    // --- second source
    if (!nv.statsOk || !nv.statsWeeks[k]) {
      r.check_status = 'PENDING – single source (nflverse not posted yet)';
    } else {
      const m = nvMatch_(nv.stats[k], r.player);
      if (m && m.position && !r.position) r.position = m.position;
      if (m) r.nflverse_id = m.player_id;
      const touched = ['pass_att', 'carries', 'targets', 'receptions'].some(f => Number(r[f]) > 0);
      if (!m) {
        r.check_status = touched ? 'PENDING – single source (player not matched in nflverse)' : 'OK – no offensive stats';
      } else {
        const bad = VERIFY.filter(([a, b]) => Number(r[a] || 0) !== Number(m[b] || 0));
        if (!bad.length) r.check_status = 'OK – ESPN & nflverse match';
        else {
          r.check_note = (r.check_note ? r.check_note + ' | ' : '') + bad.map(([a, b]) => a + ': ESPN ' + r[a] + ' vs nflverse ' + m[b]).join('; ');
          bad.forEach(([a]) => { if (BLANK_ON_MISMATCH[a]) r[a] = ''; });
          r.check_status = bad.some(([a]) => BLANK_ON_MISMATCH[a]) ? 'MISMATCH – blanked' : 'OK – minor mismatch (carries/targets/att only)';
        }
      }
    }
    // --- snaps
    const sl = nv.snaps[k];
    const sm = sl ? nvMatch_(sl, r.player) : null;
    if (sm) { r.off_snaps = sm.snaps; r.off_snap_pct = Math.round(sm.pct * 100); usedSnaps[k + '|' + normName_(sm.name)] = 1; if (!r.position) r.position = sm.position; }
    else { r.off_snaps = ''; r.off_snap_pct = ''; }
    delete r.espn_team_check;
  });

  // player meta from ESPN rows
  const P = {};
  espnRows.forEach(r => {
    const p = P[r.player_id] = P[r.player_id] || { id: r.player_id, name: r.player, team: r.team, pos: '', lastDate: '', maxAtt: 0 };
    if (r.game_date >= p.lastDate) { p.lastDate = r.game_date; p.team = r.team; p.name = r.player; }
    if (r.position) p.pos = r.position;
    p.maxAtt = Math.max(p.maxAtt, Number(r.pass_att) || 0);
  });

  // team-game index
  const TG = {};
  espnRows.forEach(r => { (TG[r.team] = TG[r.team] || {})[r.game_id] = r; });

  // inferred rows: snap-only appearances (played, zero stats) and DNP / pending
  const inferred = [];
  const have = {}; const byPlayerN = {};
  espnRows.forEach(r => { have[r.game_id + '|' + r.player_id] = 1; (byPlayerN[r.player_id] = byPlayerN[r.player_id] || []).push(r); });
  Object.keys(P).forEach(id => {
    const p = P[id];
    const mine = byPlayerN[id] || [];
    const stints = {};
    mine.forEach(r => { if (!stints[r.team] || r.game_date < stints[r.team]) stints[r.team] = r.game_date; });
    const order = Object.keys(stints).sort((a, b) => stints[a] < stints[b] ? -1 : 1);
    order.forEach((t, i) => {
      const end = i + 1 < order.length ? stints[order[i + 1]] : '9999';
      Object.keys(TG[t] || {}).forEach(gid => {
        const ref = TG[t][gid];
        if (have[gid + '|' + id] || ref.game_date >= end) return;
        const k = (NFL_TEAM_FIX[t] || t) + '|' + ref.week;
        const sm = nv.snaps[k] ? nvMatch_(nv.snaps[k], p.name) : null;
        const base = { game_id: gid, game_date: ref.game_date, season: ref.season, season_type: ref.season_type, week: ref.week,
          player_id: id, player: p.name, position: p.pos, team: t, opponent: ref.opponent, home_away: ref.home_away,
          team_result: ref.team_result, source: 'inferred', updated_utc: nowUtc_() };
        if (sm && sm.snaps > 0) {
          inferred.push(Object.assign(base, { status: 'PLAYED', pass_cmp: 0, pass_att: 0, pass_yds: 0, pass_td: 0, pass_int: 0,
            carries: 0, rush_yds: 0, rush_td: 0, receptions: 0, targets: 0, rec_yds: 0, rec_td: 0,
            off_snaps: sm.snaps, off_snap_pct: Math.round(sm.pct * 100),
            check_status: 'OK – played (snap count), no stats in box score' }));
        } else if (ref.game_date < stints[t]) {
          // before his first box-score appearance for this team: only log if snaps say he played (handled above)
        } else if (nv.snapWeeks[k]) {
          inferred.push(Object.assign(base, { status: 'DNP', dnp_reason: 'No offensive snaps (inactive / injured / DNP)', check_status: 'OK (not counted)' }));
        } else {
          inferred.push(Object.assign(base, { status: 'PENDING', dnp_reason: 'Not in box score; snap counts not posted yet — excluded until confirmed',
            check_status: 'PENDING – snap counts not posted' }));
        }
      });
    });
  });

  const all = espnRows.concat(inferred);
  // per-player played games, snap avg, limited flag
  Object.keys(P).forEach(id => { const p = P[id]; p.games = []; p.pcts = []; p.tg = 0; p.car = 0; });
  all.forEach(r => {
    const p = P[r.player_id]; if (!p || r.status !== 'PLAYED') return;
    p.games.push(r); if (r.off_snap_pct !== '' && r.off_snap_pct !== undefined) p.pcts.push(Number(r.off_snap_pct));
    p.tg += Number(r.targets) || 0; p.car += Number(r.carries) || 0;
  });
  Object.keys(P).forEach(id => {
    const p = P[id]; const n = p.games.length || 1;
    p.avgPct = p.pcts.length ? p.pcts.reduce((a, b) => a + b, 0) / p.pcts.length : 0;
    p.avgTgt = p.tg / n; p.avgCar = p.car / n;
    p.isQB = (p.pos === 'QB') && p.maxAtt >= cfg.nflQbAtt;
    p.watch = watch.filter(w => w.norm === normName_(p.name) && (!w.team || w.team === p.team || (NFL_TEAM_FIX[p.team] === w.team)));
    p.rec = p.avgTgt >= cfg.nflMinTargets; p.rush = p.avgCar >= cfg.nflMinCarries;
    p.offPos = p.pos ? ['QB', 'RB', 'WR', 'TE', 'FB'].indexOf(p.pos) >= 0 : true;
    p.tracked = (p.offPos && (p.isQB || p.rec || p.rush)) || p.watch.length > 0;
  });
  all.forEach(r => {
    const p = P[r.player_id];
    r.limited_snaps = (r.status === 'PLAYED' && r.off_snap_pct !== '' && r.off_snap_pct !== undefined && p.pcts.length >= 3 &&
      Number(r.off_snap_pct) < p.avgPct * (1 - cfg.limitedPct)) ? 'Y' : '';
  });
  // keep log lean: drop inferred rows for untracked players
  const out = all.filter(r => r.source === 'ESPN' || (P[r.player_id] && P[r.player_id].tracked))
    .sort((a, b) => a.game_date < b.game_date ? 1 : a.game_date > b.game_date ? -1 : (a.game_id + a.team + a.player).localeCompare(b.game_id + b.team + b.player));
  writeTable_(TAB.nflLog, NFL_LOG_COLS, out);

  const hit = []; const players = [];
  Object.keys(P).forEach(id => {
    const p = P[id];
    const key = 'NFL – ' + p.name + ' (' + p.team + ')';
    players.push({ player_key: key, sport: 'NFL', player_id: id, player: p.name, team: p.team, position: p.pos,
      games_played: p.games.length, avg_minutes_or_snap_pct: round1_(p.avgPct), tracked: p.tracked ? 'Y' : '', watchlist: p.watch.length ? 'Y' : '' });
    if (!p.tracked) return;
    p.key = key;
    cfg.ladders.NFL.forEach(L => {
      const watched = p.watch.some(w => w.stat === L.stat);
      const ok = L.applies === 'QB only' ? p.isQB : L.applies === 'receivers' ? (p.rec || watched) :
        L.applies === 'rushers' ? (p.rush || watched) : true;
      if (L.applies === 'QB only' && !p.isQB) return;
      if (ok) hit.push.apply(hit, ladderRows_(p, key, 'NFL', p.pos, L, 'limited_snaps'));
    });
  });
  sortHit_(hit);
  writeTable_(TAB.nflHit, HIT_COLS, hit);
  writePlayers_('NFL', players);
  return buildSummary_('NFL', P, hit, out, cfg, freshIds, watch);
}

// ================================================================= shared calc
function ladderRows_(p, key, sport, pos, L, limitedField) {
  const g = p.games.filter(r => r[L.field] !== '' && r[L.field] !== undefined)
    .sort((a, b) => a.game_date < b.game_date ? 1 : -1);          // newest first
  const vals = g.map(r => Number(r[L.field]));
  if (!vals.length) return [];
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const med = median_(vals);
  const last10 = vals.slice(0, 10).join(', ');
  const lim10 = g.slice(0, 10).filter(r => r[limitedField] === 'Y').length;
  const watched = p.watch.length ? 'Y' : '';
  return L.lines.map(line => {
    const hitArr = vals.map(v => v >= line);
    const cnt = (arr) => arr.filter(Boolean).length;
    const l5 = hitArr.slice(0, 5), l10 = hitArr.slice(0, 10);
    const home = g.map((r, i) => r.home_away === 'H' ? hitArr[i] : null).filter(x => x !== null);
    const away = g.map((r, i) => r.home_away === 'A' ? hitArr[i] : null).filter(x => x !== null);
    let s = 0; while (s < hitArr.length && hitArr[s] === hitArr[0]) s++;
    const pct = (a) => a.length ? Math.round(1000 * cnt(a) / a.length) / 10 : '';
    return {
      player_key: key, sport: sport, player: p.name, team: p.team, position: pos, stat: L.stat, line: line + '+',
      games: vals.length, L5: frac_(cnt(l5), l5.length), L10: frac_(cnt(l10), l10.length),
      Season: frac_(cnt(hitArr), hitArr.length), Home: frac_(cnt(home), home.length), Away: frac_(cnt(away), away.length),
      avg: round1_(avg), median: med, streak: (hitArr[0] ? 'Hit ' : 'Miss ') + s, last10_values_newest_first: last10,
      limited_games_L10: lim10, watchlist: watched,
      L5_pct: pct(l5), L10_pct: pct(l10), season_pct: pct(hitArr), home_pct: pct(home), away_pct: pct(away),
      _line: line, _hits: hitArr
    };
  });
}

function sortHit_(hit) {
  hit.sort((a, b) => (b.watchlist === 'Y') - (a.watchlist === 'Y') || a.player.localeCompare(b.player) ||
    a.stat.localeCompare(b.stat) || a._line - b._line);
}

function writePlayers_(sport, rows) {
  const other = readTable_(TAB.players).filter(r => r.sport !== sport);
  const all = other.concat(rows).sort((a, b) => (b.tracked === 'Y') - (a.tracked === 'Y') || String(a.player_key).localeCompare(String(b.player_key)));
  writeTable_(TAB.players, PLAYER_COLS, all);
}

// ================================================================= Daily Summary
function buildSummary_(sport, P, hit, logRows, cfg, freshIds, watch) {
  const items = [];
  const recentDays = sport === 'NBA' ? 3 : 8;
  const fresh = {}; (freshIds || []).forEach(id => { fresh[id] = 1; });
  const recentFresh = {};
  logRows.forEach(r => { if (fresh[r.game_id] && daysAgo_(r.game_date) <= recentDays) recentFresh[r.game_id] = 1; });
  const older = Object.keys(fresh).filter(id => !recentFresh[id]).length;
  if (older) items.push(['BACKFILL', older + ' older games loaded', 'Per-game notes below cover only the last ' + recentDays + ' days.']);
  // pick the most useful line per watched player+stat: the one he specified, else the highest line at/below his median
  const focus = (key) => {
    const rows = hit.filter(h => h.player_key === key && isWatchedRow(h));
    const byStat = {};
    rows.forEach(h => (byStat[h.stat] = byStat[h.stat] || []).push(h));
    const p = byKey[key];
    return Object.keys(byStat).map(st => {
      const w = p.watch.find(x => x.stat === st && x.line !== null);
      const list = byStat[st];
      if (w) return list.find(h => h._line === w.line) || list[0];
      const under = list.filter(h => h._line <= h.median);
      return under.length ? under[under.length - 1] : list[0];
    });
  };
  const byKey = {}; Object.keys(P).forEach(k => { if (P[k].key) byKey[P[k].key] = P[k]; });
  const isWatchedRow = (h) => {
    const p = byKey[h.player_key];
    return p && p.watch.some(w => (!w.stat || w.stat === h.stat) && (w.line === null || w.line === h._line));
  };

  // watchlist: not found
  watch.forEach(w => {
    const found = Object.keys(P).some(k => normName_(P[k].name) === w.norm);
    if (!found) items.push(['WATCHLIST', w.player, 'Not found in ' + sport + ' box scores this season — check spelling (or he has not played yet).']);
  });

  // what changed: watchlist players with a new game this run
  const newLines = logRows.filter(r => recentFresh[r.game_id] && P[r.player_id] && P[r.player_id].watch.length);
  newLines.forEach(r => {
    const p = P[r.player_id];
    let line;
    if (r.status !== 'PLAYED') line = r.status + ' — ' + (r.dnp_reason || '') + ' (not counted)';
    else if (sport === 'NBA') line = r.minutes + ' min, ' + r.pts + ' pts, ' + r.reb + ' reb, ' + r.ast + ' ast, ' + r.fg3m + ' 3PM' + (r.limited_minutes === 'Y' ? '  ⚠ limited minutes' : '');
    else line = (p.isQB ? r.pass_yds + ' pass yds, ' + r.pass_td + ' pass TD, ' : '') + r.rush_yds + ' rush yds, ' + r.receptions + ' rec, ' + r.rec_yds + ' rec yds' +
      (r.off_snap_pct !== '' ? ', ' + r.off_snap_pct + '% snaps' : '') + (r.limited_snaps === 'Y' ? '  ⚠ limited snaps' : '');
    const props = p.key ? focus(p.key).map(h => h.stat + ' ' + h.line + ': L10 ' + h.L10 + ', season ' + h.Season + ', ' + h.streak) : [];
    items.push(['CHANGED', p.name + ' vs ' + r.opponent + ' (' + r.game_date + ')', line + (props.length ? ' | ' + props.join(' · ') : '')]);
  });

  // trends (collapse ladder: biggest gap per player+stat)
  const trend = (rows) => {
    const best = {};
    rows.forEach(h => {
      if (h.games < cfg.trendMinGames || h.L5_pct === '' || h.season_pct === '') return;
      const gap = (h.L5_pct - h.season_pct) / 100;
      if (Math.abs(gap) < cfg.trendGap) return;
      const k = h.player_key + '|' + h.stat;
      if (!best[k] || Math.abs(gap) > Math.abs(best[k].gap)) best[k] = { h: h, gap: gap };
    });
    return Object.keys(best).map(k => best[k]).sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
  };
  const wRows = hit.filter(isWatchedRow);
  trend(wRows).forEach(t => items.push([t.gap > 0 ? 'TRENDING UP' : 'TRENDING DOWN', t.h.player + ' ' + t.h.stat + ' ' + t.h.line,
    'L5 ' + t.h.L5 + ' vs season ' + t.h.Season + ' (avg ' + t.h.avg + ', last: ' + t.h.last10_values_newest_first + ')']));
  // streaks, collapsed: highest line on an active hit streak, lowest line on an active miss streak
  const sk = {};
  wRows.forEach(h => {
    const n = Number(h.streak.split(' ')[1]);
    if (n < cfg.streakMin) return;
    const k = h.player_key + '|' + h.stat + '|' + h.streak.split(' ')[0];
    const isHit = h.streak[0] === 'H';
    if (!sk[k] || (isHit ? h._line > sk[k]._line : h._line < sk[k]._line)) sk[k] = h;
  });
  Object.keys(sk).forEach(k => { const h = sk[k]; items.push(['STREAK', h.player + ' ' + h.stat + ' ' + h.line, h.streak + ' straight (season ' + h.Season + ', last: ' + h.last10_values_newest_first + ')']); });
  trend(hit.filter(h => h.watchlist !== 'Y')).slice(0, 10).forEach(t => items.push(['LEAGUE TREND', t.h.player + ' (' + t.h.team + ') ' + t.h.stat + ' ' + t.h.line,
    (t.gap > 0 ? '▲ ' : '▼ ') + 'L5 ' + t.h.L5 + ' vs season ' + t.h.Season]));

  // DNP + limited (this run's games)
  const freshRows = logRows.filter(r => recentFresh[r.game_id] && P[r.player_id] && P[r.player_id].tracked);
  // only players who are newly out (played their previous game) — long-term injuries stay quiet
  const prevPlayed = (r) => {
    const prior = logRows.filter(x => x.player_id === r.player_id && x.game_date < r.game_date).sort((x, y) => x.game_date < y.game_date ? 1 : -1)[0];
    return prior && prior.status === 'PLAYED';
  };
  const dnp = freshRows.filter(r => r.status !== 'PLAYED' && r.status !== 'PENDING' && prevPlayed(r));
  if (dnp.length) items.push(['DNP / INACTIVE', dnp.length + ' newly out', dnp.slice(0, 40).map(r => r.player + ' (' + r.team + ')').join(', ') + (dnp.length > 40 ? ', …' : '') + ' — not counted in hit rates']);
  const lim = freshRows.filter(r => r.limited_minutes === 'Y' || r.limited_snaps === 'Y');
  if (lim.length) items.push(['LIMITED ' + (sport === 'NBA' ? 'MINUTES' : 'SNAPS'), lim.length + ' tracked players',
    lim.slice(0, 40).map(r => r.player + ' ' + (sport === 'NBA' ? r.minutes + ' min' : r.off_snap_pct + '% snaps') + (r.ejected === 'Y' ? ' (ejected)' : '')).join(', ') + ' — counted, but flagged']);

  // unverified: every blank/mismatch/pending row (any game)
  const unv = logRows.filter(r => !/^OK/.test(r.check_status || 'OK') && (!P[r.player_id] || P[r.player_id].tracked || r.source === 'ESPN'));
  const grouped = {};
  unv.forEach(r => { const k = r.check_status; (grouped[k] = grouped[k] || []).push(r); });
  Object.keys(grouped).forEach(k => {
    const list = grouped[k];
    const detail = list.slice(0, 25).map(r => r.player + ' ' + r.game_date + (r.check_note ? ' [' + r.check_note + ']' : '')).join('; ') + (list.length > 25 ? '; … (' + list.length + ' total — filter Game Logs by check_status)' : '');
    items.push(['UNVERIFIED', k + ' — ' + list.length + ' rows', detail]);
  });

  // verification sample for the Claude cross-check (NBA: one row per new game)
  if (sport === 'NBA') {
    const gids = Object.keys(recentFresh);
    gids.forEach(gid => {
      const rs = logRows.filter(r => r.game_id === gid && r.status === 'PLAYED');
      if (!rs.length) return;
      const home = rs.find(r => r.home_away === 'H');
      const homeTeam = home ? home.team : rs[0].opponent;
      const url = 'https://www.basketball-reference.com/boxscores/' + rs[0].game_date.replace(/-/g, '') + '0' + (BBREF_TEAM[homeTeam] || homeTeam) + '.html';
      const line = 'MIN/PTS/REB/AST/3PM — ' + rs.filter(r => Number(r.minutes) >= 10).map(r => r.player + ' ' + [r.minutes, r.pts, r.reb, r.ast, r.fg3m].join('/')).join('; ');
      items.push(['VERIFY', gid + ' ' + rs[0].game_date + ' ' + url, line]);
    });
  }
  if (!items.length) items.push(['NOTE', 'No new games', 'Nothing changed since the last run.']);
  return items;
}

function rebuildAll() {
  withLock_(() => {
    const cfg = readSettings_();
    const nba = readTable_(TAB.nbaLog).filter(r => r.status !== 'NOT_IN_BOX');
    if (nba.length) logSummary_('NBA', [['RUN', 'Hit rates rebuilt (no new data pulled)', '']].concat(rebuildNBA_(nba, cfg, [])));
    const nflRows = readTable_(TAB.nflLog).filter(r => r.source === 'ESPN');
    if (nflRows.length) {
      const notes = []; const nv = loadNflverse_(NFL_SEASON.year, notes);
      nflRows.forEach(r => { r.espn_team_check = ''; });
      logSummary_('NFL', [['RUN', 'Hit rates rebuilt (no new ESPN data pulled)', '']].concat(rebuildNFL_(nflRows, nv, cfg, [])).concat(notes));
    }
  });
}

// ================================================================= diagnostics
/** Tries each candidate data source once (one request at a time) and writes the result to Daily Summary. */
function testSources() {
  const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*' };
  const d = '20261109';
  const tests = [
    ['ESPN site.api NBA scoreboard', 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=' + d, null],
    ['ESPN site.api NBA scoreboard (browser headers)', 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=' + d, UA],
    ['ESPN site.web.api NBA scoreboard', 'https://site.web.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=' + d, null],
    ['ESPN cdn NBA scoreboard', 'https://cdn.espn.com/core/nba/scoreboard?xhr=1&dates=' + d, null],
    ['ESPN core API NBA events', 'https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/events?dates=' + d, null],
    ['ESPN site.api NBA box score', 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=401909952', null],
    ['ESPN site.web.api NBA box score', 'https://site.web.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=401909952', null],
    ['ESPN cdn NBA box score', 'https://cdn.espn.com/core/nba/boxscore?xhr=1&gameId=401909952', null],
    ['ESPN site.web.api NFL box score', 'https://site.web.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=401873037', null],
    ['NBA.com CDN schedule', 'https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json', null],
    ['NBA.com CDN schedule (browser headers)', 'https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json', UA],
    ['ESPN site.api NFL scoreboard', 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2026&seasontype=2&week=9', null],
    ['ESPN site.web.api NFL scoreboard', 'https://site.web.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2026&seasontype=2&week=9', null],
    ['nflverse player stats (GitHub)', 'https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_2026.csv', null],
    ['nflverse snap counts (GitHub)', 'https://github.com/nflverse/nflverse-data/releases/download/snap_counts/snap_counts_2026.csv', null]
  ];
  const rows = [];
  let nbaGameId = null;
  tests.forEach(([name, url, headers]) => {
    const opt = { muteHttpExceptions: true, followRedirects: true };
    if (headers) opt.headers = headers;
    let code = 'ERR', len = 0, note = '';
    try {
      const r = UrlFetchApp.fetch(url, opt); code = r.getResponseCode(); const t = r.getContentText(); len = t.length;
      if (code === 200 && /summary|boxscore/.test(url)) {
        try { const j = JSON.parse(t); const b = j.boxscore || (j.gamepackageJSON && j.gamepackageJSON.boxscore);
          note = (b && b.players) ? 'player box score present (' + b.players.length + ' teams)' : 'NO player box score in response'; } catch (e) { note = 'parse error'; }
      }
      if (code === 200 && /scheduleLeagueV2/.test(url) && !nbaGameId) {
        try {
          const j = JSON.parse(t); const dates = j.leagueSchedule.gameDates;
          for (let i = dates.length - 1; i >= 0 && !nbaGameId; i--) (dates[i].games || []).forEach(g => { if (!nbaGameId && g.gameStatus === 3) nbaGameId = g.gameId; });
        } catch (e) { note = 'parse error'; }
      }
    } catch (e) { note = String(e).slice(0, 120); }
    rows.push(['SOURCE TEST', name, 'HTTP ' + code + ', ' + len + ' chars' + (note ? ' — ' + note : '')]);
    Utilities.sleep(300);
  });
  if (nbaGameId) {
    try {
      const r = UrlFetchApp.fetch('https://cdn.nba.com/static/json/liveData/boxscore/boxscore_' + nbaGameId + '.json', { muteHttpExceptions: true });
      rows.push(['SOURCE TEST', 'NBA.com CDN box score (game ' + nbaGameId + ')', 'HTTP ' + r.getResponseCode() + ', ' + r.getContentText().length + ' chars']);
    } catch (e) { rows.push(['SOURCE TEST', 'NBA.com CDN box score', String(e).slice(0, 120)]); }
  }
  rows.forEach(r => Logger.log(r.join(' | ')));
  logSummary_('ALL', rows.reverse());
}
