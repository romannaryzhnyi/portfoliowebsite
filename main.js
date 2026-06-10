/* ═══════════════════════════════════════════════
   main.js — общий скрипт для всех страниц сайта
   КиберРезультаты / sweader portfolio
   ═══════════════════════════════════════════════ */

/* ── TETR.IO API ── */
// Укажите адрес вашего CORS-прокси на VPS.
// После установки proxy.js замените на: 'http://ВАШ_IP:3000/api'
// Если настроили Nginx + SSL:          'https://proxy.ваш-домен.ru/api'
const TETR_BASE = 'https://94-241-174-25.sslip.io/api';
const SESSION_ID = crypto.randomUUID(); // X-Session-ID для кэш-консистентности

/**
 * Выполнить запрос к TETR.IO API через свой CORS-прокси.
 * @param {string} path  Путь, например /users/sweader
 * @returns {Promise<object>}
 */
function apiFetch(path) {
  return fetch(TETR_BASE + path, {
    headers: { 'X-Session-ID': SESSION_ID }
  }).then(r => r.json());
}

/* ── Форматирование ── */

/**
 * Форматировать время в миллисекундах → m:ss.hhh или ss.hhhs
 * @param {number|null} ms
 */
function fmtTime(ms) {
  if (ms == null) return '—';
  const s = ms / 1000;
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(3);
  return m > 0 ? `${m}:${sec.padStart(6, '0')}` : `${sec}s`;
}

/**
 * Форматировать число с разделителями.
 * @param {number|null} n
 * @param {number} dec  Знаков после запятой
 */
function fmtNum(n, dec = 0) {
  if (n == null || n < 0) return '—';
  return Number(n).toLocaleString('ru-RU', { maximumFractionDigits: dec });
}

/* ── Цвета рангов TETR.IO ── */
const RANK_COLORS = {
  d: '#907591', dp: '#724e60',
  c: '#ce6c51', cp: '#b54c33',
  b: '#84954a', bp: '#698231',
  a: '#5eae59', ap: '#43933e',
  s: '#5fb9d1', sp: '#3e9eb6',
  ss: '#ca9b54',
  u: '#c37eff',
  x: '#ff3680', 'x+': '#ff0090',
  z: '#9b9b9b'
};

/**
 * Вернуть hex-цвет для ранга.
 * @param {string|null} rank
 */
function rankColor(rank) {
  if (!rank) return '#9b9b9b';
  return RANK_COLORS[rank.toLowerCase()] ?? '#9b9b9b';
}

/* ── HTML-фрагмент одной подстатистики с цветной полосой ── */
/**
 * @param {string} label  Название (APM, PPS…)
 * @param {string} value  Форматированное значение
 * @param {string} color  Hex-цвет полоски
 */
function subStat(label, value, color) {
  return `<div class="flex items-center gap-2 text-[13px] text-gray-600">
    <span class="w-6 h-[3px] rounded" style="background:${color}"></span>
    ${label}&nbsp;&nbsp;${value}
  </div>`;
}

/* ── Нормализация значения в диапазон 0–100 для радар-чарта ── */
/**
 * @param {number|null} val
 * @param {number} min
 * @param {number} max
 */
function norm(val, min, max) {
  if (val == null || val < 0) return 0;
  return Math.min(100, Math.max(0, ((val - min) / (max - min)) * 100));
}

/* ── Радар-чарты (Chart.js) ── */
const _charts = {};

/**
 * Построить или пересоздать радар-чарт.
 * @param {string}   id       id элемента <canvas>
 * @param {string[]} labels   Подписи осей
 * @param {number[]} data     Нормализованные значения 0–100 (для формы графика)
 * @param {string}   color    Hex-цвет
 * @param {boolean}  dark     Тёмная тема
 * @param {Array}    rawData  Сырые значения для тултипа (по одному на ось).
 *                            Если не передан — показываются нормализованные %.
 */
function buildRadar(id, labels, data, color = '#7b61ff', dark = false, rawData = null) {
  if (_charts[id]) _charts[id].destroy();

  const canvas = document.getElementById(id);

  /* Плагин тёмного фона */
  const bgPlugin = dark ? [{
    id: 'darkBg',
    beforeDraw(chart) {
      const { ctx } = chart;
      ctx.save();
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, chart.width, chart.height);
      ctx.restore();
    }
  }] : [];

  _charts[id] = new Chart(canvas, {
    type: 'radar',
    plugins: bgPlugin,
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor:      dark ? 'rgba(0,245,196,0.18)' : color + '40',
        borderColor:          dark ? '#00f5c4'               : color,
        pointBackgroundColor: dark ? '#00f5c4'               : color,
        pointBorderColor:     dark ? '#00f5c4'               : color,
        pointRadius: 4,
        pointHoverRadius: 6,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            /* Показываем сырое значение вместо нормализованного процента */
            label(ctx) {
              const idx = ctx.dataIndex;
              const raw = rawData ? rawData[idx] : null;
              if (raw == null) return ` ${ctx.parsed.r.toFixed(1)}%`;
              /* Форматируем: целые без дробей, дробные до 4 знаков */
              const formatted = Number.isInteger(raw)
                ? raw.toLocaleString('ru-RU')
                : parseFloat(raw.toFixed(4)).toLocaleString('ru-RU', { maximumFractionDigits: 4 });
              return ` ${formatted}`;
            }
          }
        }
      },
      scales: {
        r: {
          min: 0, max: 100,
          ticks: { display: false, stepSize: 25 },
          grid:       { color: dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'  },
          angleLines: { color: dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.13)' },
          pointLabels: {
            font:  { size: 11, weight: '600' },
            color: dark ? '#cccccc' : '#444444'
          }
        }
      },
      elements: { line: { borderWidth: 2 } }
    }
  });
}

/* ── Загрузка и отображение статистики ── */
async function loadStats() {
  const input = document.getElementById('username-input');
  if (!input) return;

  const username  = input.value.trim().toLowerCase();
  if (!username) return;

  const statusEl  = document.getElementById('api-status');
  const loadingEl = document.getElementById('stats-loading');
  const errorEl   = document.getElementById('stats-error');
  const contentEl = document.getElementById('stats-content');

  statusEl.textContent = '';
  errorEl.classList.add('hidden');
  errorEl.textContent  = '';
  contentEl.classList.add('hidden');
  loadingEl.classList.remove('hidden');

  try {
    /* Параллельные запросы: User Info + все summaries */
    const [userResp, summResp] = await Promise.all([
      apiFetch(`/users/${username}`),
      apiFetch(`/users/${username}/summaries`)
    ]);

    if (!userResp.success) throw new Error(userResp.error?.msg || 'Пользователь не найден');

    const user = userResp.data;
    const summ = summResp.data;

    /* ── Профиль ── */
    const avatarUrl = user.avatar_revision
      ? `https://tetr.io/user-content/avatars/${user._id}.jpg?rv=${user.avatar_revision}`
      : 'https://tetr.io/res/avatar.png';

    document.getElementById('stat-avatar').src               = avatarUrl;
    document.getElementById('stat-username').textContent     = user.username.toUpperCase();
    document.getElementById('stat-country').textContent      = user.country ? `🌍 ${user.country}` : '';
    document.getElementById('stat-xp').textContent           = `XP: ${fmtNum(Math.floor(user.xp))}`;

    /* ── Tetra League ── */
    const tl      = summ.league;
    const tlBadge = document.getElementById('tl-rank-badge');
    tlBadge.textContent       = (tl.rank || 'Z').toUpperCase();
    tlBadge.style.background  = rankColor(tl.rank);

    document.getElementById('tl-tr').textContent =
      tl.tr > 0 ? `${fmtNum(tl.tr, 2)} TR` : 'Не ранкован';

    document.getElementById('tl-meta').textContent =
      `Игр: ${tl.gamesplayed} · Побед: ${tl.gameswon} · ` +
      `Winrate: ${tl.gamesplayed > 0 ? ((tl.gameswon / tl.gamesplayed) * 100).toFixed(1) : 0}%`;

    document.getElementById('tl-sub').innerHTML = [
      tl.apm != null ? subStat('APM', fmtNum(tl.apm, 1), '#3ecf6a') : '',
      tl.pps != null ? subStat('PPS', fmtNum(tl.pps, 2), '#c0392b') : '',
      tl.vs  != null ? subStat('VS',  fmtNum(tl.vs,  1), '#7b61ff') : ''
    ].join('');

    /* ── 40L Sprint ── */
    const sprint     = summ['40l'];
    const sprintTime = sprint?.record?.results?.stats?.finaltime;

    document.getElementById('sprint-time').textContent = fmtTime(sprintTime);
    document.getElementById('sprint-rank').textContent =
      sprint?.rank > 0 ? `Глобальный рейтинг: #${sprint.rank}` : 'Нет рейтинговой записи';

    const spStats = sprint?.record?.results?.stats || {};
    document.getElementById('sprint-sub').innerHTML = [
      spStats.pps    != null ? subStat('PPS',    fmtNum(spStats.pps,    2), '#c0392b') : '',
      spStats.kpp    != null ? subStat('KPP',    fmtNum(spStats.kpp,    2), '#3ecf6a') : '',
      spStats.kps    != null ? subStat('KPS',    fmtNum(spStats.kps,    2), '#7b61ff') : '',
      spStats.pieces != null ? subStat('Pieces', fmtNum(spStats.pieces),    '#5b7db1') : ''
    ].join('');

    /* ── Blitz ── */
    const blitz      = summ.blitz;
    const blitzScore = blitz?.record?.results?.stats?.score;

    document.getElementById('blitz-score').textContent = blitzScore ? fmtNum(blitzScore) : '—';
    document.getElementById('blitz-rank').textContent  =
      blitz?.rank > 0 ? `Глобальный рейтинг: #${blitz.rank}` : 'Нет рейтинговой записи';

    /* ── Кэш ── */
    const cachedUntil = userResp.cache?.cached_until;
    if (cachedUntil) {
      const d = new Date(cachedUntil);
      document.getElementById('cache-info').textContent =
        `Кэш до: ${d.toLocaleTimeString('ru-RU')} · TETR.IO API`;
    }

    /* ── Radar 1: Tetra League — точные формулы ── */
    const apm = tl.apm || 0, pps = tl.pps || 0, vs = tl.vs || 0;

    // APP  = APM / (PPS * 60)
    const app     = apm / (Math.max(pps, 0.0001) * 60);

    // DS/S  = (VS/100) - (APM/60)
    const dss     = (vs / 100) - (apm / 60);

    // DS/P  = DS/S / PPS
    const dsp     = dss / Math.max(pps, 0.0001);

    // APP+DSP = APP + DS/P
    const appDsp  = app + dsp;

    // VS/APM = VS / APM
    const vsApm   = vs / Math.max(apm, 0.0001);

    // Cheese = (DS/P * 150) + ((VS/APM - 2) * 50) + (0.6 - APP) * 125
    const cheese  = (dsp * 150) + ((vsApm - 2) * 50) + ((0.6 - app) * 125);
console.log(cheese);
    // wAPP = APP - 5 * tan((cheese / -30) + 1)
    const GbE    = ((app * dss) / pps) * 2
    buildRadar('radar1',
      ['APM', 'PPS', 'VS', 'APP', 'DS/S', 'DS/P', 'APP+DSP', 'VS/APM', 'Cheese', 'GbE'],
      [
        norm(apm,    0.5,   300),
        norm(pps,    0.2,   5),
        norm(vs,     1.5,   500),
        norm(app,    0.1,   1.2),
        norm(dss,    0.15,   0.8),
        norm(dsp,    0.06,   0.5),
        norm(appDsp, 0.6 ,   1.4),
        norm(vsApm,  1.6,   3),
        norm(cheese, -30, 100),
        norm(GbE,   0.07, 0.7)
      ],
      '#5b7db1', 
      false,
      [apm, pps, vs, app, dss, dsp, appDsp, vsApm, cheese, GbE] 
    );

    /* ── Radar 2: стиль игры ── */
    const srarea = (apm * 0) + (pps * 135) + (vs * 0) + (app * 290) + (dss * 0) + (dsp * 700) + (GbE * 0);
    const statrank = 11.2 * Math.atan((srarea - 93) / 130) + 1;
    const nmapm = ((apm / srarea) / ((0.069 * Math.pow(1.0017, (Math.pow(statrank, 5) / 4700))) + statrank / 360)) - 1;
    const nmpps = ((pps / srarea) / (0.0084264 * Math.pow(2.14, (-2 * (statrank / 2.7 + 1.03))) - statrank / 5750 + 0.0067)) - 1;
    const nmapp = (app / (0.1368803292 * Math.pow(1.0024, (Math.pow(statrank, 5) / 2800)) + statrank / 54)) - 1;
    const nmdsp = (dsp / (0.02136327583 * Math.pow(14, ((statrank - 14.75) / 3.9)) + statrank / 152 + 0.022)) - 1;
    const nmgbe = (GbE / (statrank / 350 + 0.005948424455 * Math.pow(3.8, ((statrank - 6.1) / 4)) + 0.006)) - 1;
    const nmvsapm = (vsApm / (-Math.pow(((statrank - 16) / 36), 2) + 2.133)) - 1;
    const opener = ((nmapm + nmpps * 0.75 + nmvsapm * -10 + nmapp * 0.75 + nmdsp * -0.25) / 3.5) + 0.5;
    const plonk = ((nmgbe + nmapp + nmdsp * 0.75 + nmpps * -1) / 2.73) + 0.5;
    const stride = ((nmapm * -0.25 + nmpps + nmapp * -2 + nmdsp * -0.5) * 0.79) + 0.5;
    const infds = ((nmdsp + nmapp * -0.75 + nmapm * 0.5 + nmvsapm * 1.5 + nmpps * 0.5) * 0.9) + 0.5;

    buildRadar('radar2',
      ['Opener', 'Stride', 'Inf-DS', 'Plonk'],
      [
        norm(opener, -1.2, 1.3), 
        norm(stride, -1.2, 3),
        norm(infds, -1.2, 1.6),
        norm(plonk, -0.7, 2)
        
      ],
      '#5b7db1',
      false,
      [opener, stride, infds, plonk]
    );

    
    buildRadar('radar3',
      ['Атака', 'Скорость', 'Защита', 'Эффективность'],
      [
         norm(apm,    0.5,   300),
         norm(pps,    0.2,   5),
         norm(dss,    0.15,   0.8),
         norm(app,    0.1,   1.2)
      ],
      '#3ecf6a',
      false,
      [apm, pps, dss, app]
    );

    loadingEl.classList.add('hidden');
    contentEl.classList.remove('hidden');
    statusEl.textContent = 'Данные загружены';

  } catch (err) {
    loadingEl.classList.add('hidden');
    errorEl.textContent = `Ошибка: ${err.message}`;
    errorEl.classList.remove('hidden');
    statusEl.textContent = '';
  }
}

/* ── Инициализация на странице stats.html ── */
document.addEventListener('DOMContentLoaded', () => {
  const loadBtn = document.getElementById('load-btn');
  const input   = document.getElementById('username-input');

  if (loadBtn) {
    /* Кнопка «Загрузить» */
    loadBtn.addEventListener('click', loadStats);
  }

  if (input) {
    /* Enter в поле ввода */
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') loadStats();
    });

    /* Автозагрузка sweader при открытии страницы */
    loadStats();
  }
});