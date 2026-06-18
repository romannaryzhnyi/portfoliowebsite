/* ═══════════════════════════════════════════════
   main.js — КиберРезультаты / sweader portfolio
   ═══════════════════════════════════════════════ */

/* ── TETR.IO API ── */
const TETR_BASE  = 'https://corsproxy.io/?url=https://ch.tetr.io/api';
const SESSION_ID = (typeof crypto !== 'undefined' && crypto.randomUUID)
  ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });

function apiFetch(path) {
  return fetch(TETR_BASE + path, {
    headers: { 'X-Session-ID': SESSION_ID }
  }).then(r => r.json());
}

/* ── Форматирование ── */
function fmtTime(ms) {
  if (ms == null) return '—';
  const s = ms / 1000;
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(3);
  return m > 0 ? `${m}:${sec.padStart(6, '0')}` : `${sec}s`;
}

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

function rankColor(rank) {
  if (!rank) return '#9b9b9b';
  return RANK_COLORS[rank.toLowerCase()] ?? '#9b9b9b';
}

/* ── Подстатистика с цветной полосой ── */
function subStat(label, value, color) {
  return `<div class="flex items-center gap-2 text-[12px] text-gray-600">
    <span class="w-5 h-[3px] rounded flex-shrink-0" style="background:${color}"></span>
    <span class="text-gray-400">${label}</span>
    <span class="font-semibold text-gray-800">${value}</span>
  </div>`;
}

/* ── Нормализация 0–100 ── */
function norm(val, min, max) {
  if (val == null) return 0;
  return Math.min(100, Math.max(0, ((val - min) / (max - min)) * 100));
}

/* ── Радар-чарты ── */
const _charts = {};

function buildRadar(id, labels, data, color = '#5b7db1', dark = false, rawData = null) {
  if (_charts[id]) _charts[id].destroy();
  const canvas = document.getElementById(id);
  if (!canvas) return;

  _charts[id] = new Chart(canvas, {
    type: 'radar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: color + '28',
        borderColor:     color,
        pointBackgroundColor: color,
        pointBorderColor:     '#fff',
        pointBorderWidth: 1.5,
        pointRadius: 3,
        pointHoverRadius: 5,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(255,255,255,0.95)',
          titleColor: '#374151',
          bodyColor:  '#374151',
          borderColor: '#e5e7eb',
          borderWidth: 1,
          callbacks: {
            label(ctx) {
              const raw = rawData ? rawData[ctx.dataIndex] : null;
              if (raw == null) return ` ${ctx.parsed.r.toFixed(1)}%`;
              const fmt = typeof raw === 'string' ? raw
                : Number.isInteger(raw)
                  ? raw.toLocaleString('ru-RU')
                  : parseFloat(raw.toFixed(4)).toLocaleString('ru-RU', { maximumFractionDigits: 4 });
              return ` ${fmt}`;
            }
          }
        }
      },
      scales: {
        r: {
          min: 0, max: 100,
          ticks: { display: false, stepSize: 25 },
          grid:       { color: 'rgba(0,0,0,0.07)' },
          angleLines: { color: 'rgba(0,0,0,0.09)' },
          pointLabels: { font: { size: 10, weight: '600' }, color: '#6b7280' }
        }
      },
      elements: { line: { borderWidth: 2 } }
    }
  });
}

/* ══════════════════════════════════════
   ВАЛИДАЦИЯ НИКНЕЙМА
   3–16 символов, латиница, цифры, тире, нижнее подчёркивание
   ══════════════════════════════════════ */
const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{3,16}$/;

/**
 * Проверить никнейм и показать/скрыть сообщение об ошибке под полем.
 * @param {string} value
 * @returns {boolean} true если значение валидно
 */
function validateUsername(value) {
  const errorEl = document.getElementById('username-validation-error');
  const inputEl = document.getElementById('username-input');

  if (!value) {
    if (errorEl) errorEl.classList.add('hidden');
    if (inputEl) inputEl.classList.remove('border-red-400');
    return false;
  }

  const isValid = USERNAME_PATTERN.test(value);

  if (!isValid) {
    let message;
    if (value.length < 3) {
      message = 'Никнейм должен содержать минимум 3 символа.';
    } else if (value.length > 16) {
      message = 'Никнейм не должен превышать 16 символов.';
    } else {
      message = 'Разрешены только латинские буквы, цифры, "-" и "_".';
    }
    if (errorEl) { errorEl.textContent = message; errorEl.classList.remove('hidden'); }
    if (inputEl) inputEl.classList.add('border-red-400');
  } else {
    if (errorEl) errorEl.classList.add('hidden');
    if (inputEl) inputEl.classList.remove('border-red-400');
  }

  return isValid;
}

/* ══════════════════════════════════════
   ЗАГРУЗКА СТАТИСТИКИ
   ══════════════════════════════════════ */
async function loadStats() {
  const input = document.getElementById('username-input');
  if (!input) return;

  const username = input.value.trim();
  if (!validateUsername(username)) return;

  const usernameLower = username.toLowerCase();

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
    const [userResp, summResp] = await Promise.all([
      apiFetch(`/users/${usernameLower}`),
      apiFetch(`/users/${usernameLower}/summaries`)
    ]);

    if (!userResp.success) throw new Error(userResp.error?.msg || 'Пользователь не найден');

    const user = userResp.data;
    const summ = summResp.data;

    /* ── Профиль ── */
    const avatarUrl = user.avatar_revision
      ? `https://tetr.io/user-content/avatars/${user._id}.jpg?rv=${user.avatar_revision}`
      : 'https://tetr.io/res/avatar.png';

    document.getElementById('stat-avatar').src           = avatarUrl;
    document.getElementById('stat-username').textContent = user.username.toUpperCase();
    document.getElementById('stat-country').textContent  = user.country ? `🌍 ${user.country}` : '';
    document.getElementById('stat-xp').textContent       = `XP: ${fmtNum(Math.floor(user.xp))}`;

    /* ── Tetra League ── */
    const tl      = summ.league;
    const tlBadge = document.getElementById('tl-rank-badge');
    tlBadge.textContent      = (tl.rank || 'Z').toUpperCase();
    tlBadge.style.background = rankColor(tl.rank);

    document.getElementById('tl-tr').textContent =
      tl.tr > 0 ? `${fmtNum(tl.tr, 2)} TR` : 'Не ранкован';
    document.getElementById('tl-meta').textContent =
      `${tl.gamesplayed} игр · ${tl.gameswon} побед · Winrate ${
        tl.gamesplayed > 0 ? ((tl.gameswon / tl.gamesplayed) * 100).toFixed(1) : 0}%`;
    document.getElementById('tl-sub').innerHTML = [
      tl.apm != null ? subStat('APM', fmtNum(tl.apm, 1), '#3ecf6a') : '',
      tl.pps != null ? subStat('PPS', fmtNum(tl.pps, 2), '#c0392b') : '',
      tl.vs  != null ? subStat('VS',  fmtNum(tl.vs,  1), '#7b61ff') : ''
    ].join('');

    /* ── Sprint ── */
    const sprint     = summ['40l'];
    const sprintTime = sprint?.record?.results?.stats?.finaltime;
    const spStats    = sprint?.record?.results?.stats || {};

    document.getElementById('sprint-time').textContent = fmtTime(sprintTime);
    document.getElementById('sprint-rank').textContent =
      sprint?.rank > 0 ? `Глобальный рейтинг: #${sprint.rank}` : 'Нет рейтинговой записи';
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
      document.getElementById('cache-info').textContent =
        `Кэш до: ${new Date(cachedUntil).toLocaleTimeString('ru-RU')} · TETR.IO API`;
    }

    /* ── Производные метрики ── */
    const apm = tl.apm || 0, pps = tl.pps || 0, vs = tl.vs || 0;
    const app    = apm / (Math.max(pps, 0.0001) * 60);
    const dss    = (vs / 100) - (apm / 60);
    const dsp    = dss / Math.max(pps, 0.0001);
    const appDsp = app + dsp;
    const vsApm  = vs / Math.max(apm, 0.0001);
    const cheese = (dsp * 150) + ((vsApm - 2) * 50) + ((0.6 - app) * 125);
    const GbE    = ((app * dss) / Math.max(pps, 0.0001)) * 2;

    /* ── Radar 1: Tetra League ── */
    buildRadar('radar1',
      ['APM','PPS','VS','APP','DS/S','DS/P','APP+DSP','VS/APM','Cheese','GbE'],
      [
        norm(apm,    0.5,  300), norm(pps,    0.2,  5),
        norm(vs,     1.5,  500), norm(app,    0.1,  1.2),
        norm(dss,    0.15, 0.8), norm(dsp,    0.06, 0.5),
        norm(appDsp, 0.6,  1.4), norm(vsApm,  1.6,  3),
        norm(cheese, -30,  100), norm(GbE,    0.07, 0.7)
      ],
      '#5b7db1', false,
      [apm, pps, vs, app, dss, dsp, appDsp, vsApm, cheese, GbE]
    );

    /* ── Radar 2: стиль игры ── */
    const srarea   = pps * 135 + app * 290 + dsp * 700;
    const statrank = 11.2 * Math.atan((srarea - 93) / 130) + 1;
    const nmapm    = ((apm / srarea) / ((0.069 * Math.pow(1.0017, Math.pow(statrank,5)/4700)) + statrank/360)) - 1;
    const nmpps    = ((pps / srarea) / (0.0084264 * Math.pow(2.14, -2*(statrank/2.7+1.03)) - statrank/5750 + 0.0067)) - 1;
    const nmapp    = (app / (0.1368803292 * Math.pow(1.0024, Math.pow(statrank,5)/2800) + statrank/54)) - 1;
    const nmdsp    = (dsp / (0.02136327583 * Math.pow(14, (statrank-14.75)/3.9) + statrank/152 + 0.022)) - 1;
    const nmgbe    = (GbE / (statrank/350 + 0.005948424455 * Math.pow(3.8, (statrank-6.1)/4) + 0.006)) - 1;
    const nmvsapm  = (vsApm / (-Math.pow((statrank-16)/36, 2) + 2.133)) - 1;
    const opener   = ((nmapm + nmpps*0.75 + nmvsapm*-10 + nmapp*0.75 + nmdsp*-0.25) / 3.5) + 0.5;
    const plonk    = ((nmgbe + nmapp + nmdsp*0.75 + nmpps*-1) / 2.73) + 0.5;
    const stride   = ((nmapm*-0.25 + nmpps + nmapp*-2 + nmdsp*-0.5) * 0.79) + 0.5;
    const infds    = ((nmdsp + nmapp*-0.75 + nmapm*0.5 + nmvsapm*1.5 + nmpps*0.5) * 0.9) + 0.5;

    buildRadar('radar2',
      ['Opener','Stride','Inf-DS','Plonk'],
      [norm(opener,-1.2,1.3), norm(stride,-1.2,3), norm(infds,-1.2,1.6), norm(plonk,-0.7,2)],
      '#e5984d', false,
      [opener, stride, infds, plonk]
    );

    loadingEl.classList.add('hidden');
    contentEl.classList.remove('hidden');
    contentEl.classList.add('fade-in');
    statusEl.textContent = '✓ Данные загружены';

  } catch (err) {
    loadingEl.classList.add('hidden');
    errorEl.textContent = `Ошибка: ${err.message}`;
    errorEl.classList.remove('hidden');
    statusEl.textContent = '';
  }
}

/* ══════════════════════════════════════
   ФИЛЬТРЫ ТУРНИРОВ
   ══════════════════════════════════════ */
function initTournaments() {
  const fromSlider = document.getElementById('year-from');
  const toSlider   = document.getElementById('year-to');
  const yearValue  = document.getElementById('year-value');
  const rangeTrack = document.getElementById('range-track');
  if (!fromSlider) return;

  const MIN_YEAR = 2024, MAX_YEAR = 2026;
  let activeType = 'all';

  function updateTrack() {
    const from = parseInt(fromSlider.value), to = parseInt(toSlider.value);
    const total = MAX_YEAR - MIN_YEAR;
    rangeTrack.style.left  = ((from - MIN_YEAR) / total * 100) + '%';
    rangeTrack.style.width = ((to - from) / total * 100) + '%';
    yearValue.textContent  = from === to ? `${from}` : `${from} — ${to}`;
  }

  /* Определяем по координате клика какая ручка ближе, и поднимаем её
     z-index ДО того как браузер захватит элемент для перетаскивания.
     Критично: слушатель ставится с capture:true на родительском контейнере,
     чтобы сработать раньше, чем браузер начнёт drag на перекрытом input —
     иначе при совпадении значений "нижняя" ручка остаётся недоступной
     независимо от направления повторного клика. */
  const sliderTrack = fromSlider.parentElement; // .relative-контейнер со слайдерами

  function raiseClosestThumb(clientX) {
    const rect = sliderTrack.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const pointerYear = MIN_YEAR + ratio * (MAX_YEAR - MIN_YEAR);

    const distFrom = Math.abs(pointerYear - parseInt(fromSlider.value));
    const distTo   = Math.abs(pointerYear - parseInt(toSlider.value));

    if (distFrom <= distTo) {
      fromSlider.style.zIndex = 3; toSlider.style.zIndex = 2;
    } else {
      toSlider.style.zIndex = 3; fromSlider.style.zIndex = 2;
    }
  }

  // capture: true — перехватываем событие на пути ВНИЗ к input, раньше,
  // чем сам input успеет обработать pointerdown и начать drag.
  sliderTrack.addEventListener('pointerdown', e => raiseClosestThumb(e.clientX), { capture: true });
  sliderTrack.addEventListener('mousedown',   e => raiseClosestThumb(e.clientX), { capture: true });
  sliderTrack.addEventListener('touchstart',  e => raiseClosestThumb(e.touches[0].clientX), { capture: true, passive: true });

  fromSlider.addEventListener('input', () => {
    if (parseInt(fromSlider.value) > parseInt(toSlider.value)) fromSlider.value = toSlider.value;
    updateTrack(); applyFilters();
  });
  toSlider.addEventListener('input', () => {
    if (parseInt(toSlider.value) < parseInt(fromSlider.value)) toSlider.value = fromSlider.value;
    updateTrack(); applyFilters();
  });

  document.querySelectorAll('.filter-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-type-btn').forEach(b => b.classList.remove('active-filter'));
      btn.classList.add('active-filter');
      activeType = btn.dataset.type;
      applyFilters();
    });
  });

  function applyFilters() {
    const from = parseInt(fromSlider.value), to = parseInt(toSlider.value);
    const entries = document.querySelectorAll('.tournament-entry');
    let visible = 0;
    entries.forEach(entry => {
      const show = parseInt(entry.dataset.year) >= from &&
                   parseInt(entry.dataset.year) <= to &&
                   (activeType === 'all' || entry.dataset.type === activeType);
      if (show) {
        entry.style.display = '';
        requestAnimationFrame(() => entry.classList.remove('hiding'));
        visible++;
      } else {
        entry.classList.add('hiding');
        setTimeout(() => { if (entry.classList.contains('hiding')) entry.style.display = 'none'; }, 250);
      }
    });
    document.getElementById('filter-count').textContent = `Показано: ${visible} из ${entries.length}`;
    document.getElementById('no-results').classList.toggle('hidden', visible > 0);
  }

  updateTrack();
  applyFilters();
}

/* ══════════════════════════════════════
   ИНИЦИАЛИЗАЦИЯ
   ══════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  const loadBtn = document.getElementById('load-btn');
  const input   = document.getElementById('username-input');

  if (loadBtn) {
    loadBtn.addEventListener('click', () => {
      loadBtn.classList.add('btn-loading');
      loadStats().finally(() => loadBtn.classList.remove('btn-loading'));
    });
  }
  if (input) {
    input.addEventListener('keydown', e => { if (e.key === 'Enter') loadStats(); });
    input.addEventListener('input', () => validateUsername(input.value.trim()));
    loadStats();
  }

  initTournaments();
});
