/**
 * PC 悬浮小窗（列表 + 小地图）。
 *
 * 交互（2026-11-08 定稿）：
 * - 主交互是「收起 / 展开」：收起后只剩一条状态条，点「展开」再回来；
 * - 主题可切明 / 暗，默认暗色，选择会记住；
 * - 「鼠标不挡点击」属于高级选项，放在工具箱「附近」页里，不占小窗按钮；
 *   打开后点击会落到游戏里，按 Ctrl+Alt+O 恢复。
 */
'use strict';

const KIND_COLOR = {
  pollution: '#7c3aed', shiny: '#f59e0b', colorful: '#ec4899',
  big: '#0ea5e9', small: '#0ea5e9', high: '#059669', low: '#059669',
};
const KIND_PRIORITY = ['pollution', 'shiny', 'colorful', 'big', 'small', 'high', 'low'];
const KIND_LABEL = {
  colorful: '炫彩', shiny: '异色', pollution: '污染',
  big: '大块头', small: '小不点', high: '婉转声', low: '粗嗓门',
};
const VIEW_METERS = 300; // 横向 300m（半径 150m），120m 圈完整可见
const THEME_KEY = 'roco.overlayTheme';
const COLLAPSED_KEY = 'roco.overlayCollapsed';

const state = {
  payload: null,
  calibration: null,
  image: null,
  theme: 'dark',
  collapsed: false,
};

const statusEl = document.getElementById('status');
const listEl = document.getElementById('list');
const emptyEl = document.getElementById('empty');
const sceneEl = document.getElementById('scene');
const updatedEl = document.getElementById('updated');
const mapHintEl = document.getElementById('map-hint');
const canvas = document.getElementById('map');
const ctx = canvas.getContext('2d');

const colorOf = (kinds) => {
  for (const kind of KIND_PRIORITY) if (kinds.includes(kind)) return KIND_COLOR[kind];
  return '#64748b';
};
const labelsOf = (kinds) => kinds.map((kind) => KIND_LABEL[kind] || kind).join('·');

function setStatus() {
  const payload = state.payload;
  if (!payload) {
    statusEl.textContent = state.collapsed ? '附近 · 等待采集' : '等待采集数据…';
    return;
  }
  const rare = payload.pets.filter((pet) => pet.rare).length;
  if (state.collapsed) {
    statusEl.innerHTML = `<b>${payload.capturing ? '采集中' : '已停止'}</b> · ${payload.pets.length} 只 · 稀有 ${rare}`;
    return;
  }
  const key = payload.hasKey ? '已接通' : '等待登录';
  statusEl.innerHTML = `<b>${payload.capturing ? '采集中' : '已停止'}</b> · ${key} · 附近 ${payload.pets.length} 只`;
}

function renderList() {
  const payload = state.payload;
  listEl.innerHTML = '';
  if (!payload || payload.pets.length === 0) {
    emptyEl.hidden = false;
    return;
  }
  emptyEl.hidden = true;
  const rows = [...payload.pets]
    .sort((a, b) => Number(b.alert) - Number(a.alert) || Number(b.rare) - Number(a.rare) || (a.distanceM ?? 1e9) - (b.distanceM ?? 1e9))
    .slice(0, 8);
  for (const pet of rows) {
    const li = document.createElement('li');
    if (pet.alert) li.className = 'alert';
    else if (pet.rare) li.className = 'rare';
    const dot = document.createElement('i');
    dot.className = 'dot';
    dot.style.background = colorOf(pet.kinds || []);
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = `${pet.name} Lv${pet.level}`;
    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = `${pet.distanceM != null ? `${Math.round(pet.distanceM)}m ` : ''}${pet.bearingLabel || ''}`;
    li.append(dot, name, meta);
    const tags = [];
    if (pet.alert) tags.push('需求');
    else if (pet.rare && labelsOf(pet.kinds || [])) tags.push(labelsOf(pet.kinds || []).split('·')[0]);
    if (tags.length) {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = tags.join('·');
      li.append(tag);
    }
    li.title = [
      `${pet.name} Lv${pet.level}`,
      pet.gender || '', pet.nature ? `性格 ${pet.nature}` : '',
      labelsOf(pet.kinds || []),
      pet.distanceM != null ? `${Math.round(pet.distanceM)}m ${pet.bearingLabel || ''}` : '',
    ].filter(Boolean).join(' · ');
    listEl.append(li);
  }
}

function worldToPixel(point) {
  const cal = state.calibration;
  return {
    px: ((point.x - cal.origin_x) / cal.side_units) * cal.declared_width,
    py: ((point.y - cal.origin_y) / cal.side_units) * cal.declared_height,
  };
}

function drawMap() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (state.collapsed) return;
  const payload = state.payload;
  const cal = state.calibration;
  if (!cal || !payload) return;
  const self = payload.self && Number.isFinite(payload.self.x) ? payload.self : null;
  const center = self || (payload.pets.find((pet) => Number.isFinite(pet.x)) || null);
  if (!center) {
    mapHintEl.textContent = '无坐标';
    return;
  }
  const metersPerPx = cal.side_units / 100 / cal.declared_width;
  const viewPx = VIEW_METERS / metersPerPx;
  const scale = canvas.width / viewPx;
  const centerPixel = worldToPixel(center);
  const toScreen = (point) => {
    const pixel = worldToPixel(point);
    return {
      x: (pixel.px - centerPixel.px) * scale + canvas.width / 2,
      y: (pixel.py - centerPixel.py) * scale + canvas.height / 2,
    };
  };

  if (state.image && state.image.complete) {
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.drawImage(
      state.image,
      centerPixel.px - viewPx / 2, centerPixel.py - viewPx / 2, viewPx, viewPx,
      0, 0, canvas.width, canvas.height,
    );
    ctx.restore();
  } else {
    ctx.fillStyle = state.theme === 'light' ? '#e2e8f0' : '#1e293b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // 120m 距离圈：深色垫底 + 白线，亮色地图上也看得清
  const ringRadius = (120 / metersPerPx) * scale;
  ctx.beginPath();
  ctx.strokeStyle = state.theme === 'light' ? 'rgba(15,23,42,0.35)' : 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 3;
  ctx.arc(canvas.width / 2, canvas.height / 2, ringRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(255,255,255,0.88)';
  ctx.lineWidth = 1.3;
  ctx.arc(canvas.width / 2, canvas.height / 2, ringRadius, 0, Math.PI * 2);
  ctx.stroke();

  for (const pet of payload.pets) {
    if (!Number.isFinite(pet.x) || !Number.isFinite(pet.y)) continue;
    const point = toScreen(pet);
    if (point.x < -8 || point.y < -8 || point.x > canvas.width + 8 || point.y > canvas.height + 8) continue;
    ctx.beginPath();
    ctx.fillStyle = colorOf(pet.kinds || []);
    ctx.arc(point.x, point.y, pet.rare ? 4 : 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    if (pet.alert) {
      ctx.beginPath();
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 1.6;
      ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  ctx.beginPath();
  ctx.fillStyle = '#0ea5e9';
  ctx.arc(canvas.width / 2, canvas.height / 2, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  mapHintEl.textContent = `≈${VIEW_METERS / 2}m`;
}

function render() {
  setStatus();
  renderList();
  drawMap();
  const payload = state.payload;
  sceneEl.textContent = payload?.scene ? `场景 ${payload.scene}` : '';
  updatedEl.textContent = payload?.updatedAt ? `更新 ${new Date(payload.updatedAt).toLocaleTimeString('zh-CN', { hour12: false })}` : '';
}

function applyTheme(theme) {
  state.theme = theme === 'light' ? 'light' : 'dark';
  document.body.dataset.theme = state.theme;
  try {
    window.localStorage.setItem(THEME_KEY, state.theme);
  } catch {
    /* 忽略 */
  }
  window.rocoOverlay?.setTheme?.(state.theme);
  drawMap();
}

function applyCollapsed(collapsed) {
  state.collapsed = Boolean(collapsed);
  document.body.classList.toggle('collapsed', state.collapsed);
  try {
    window.localStorage.setItem(COLLAPSED_KEY, state.collapsed ? '1' : '0');
  } catch {
    /* 忽略 */
  }
  window.rocoOverlay?.setCollapsed?.(state.collapsed);
  render();
}

async function boot() {
  let savedTheme = 'dark';
  let savedCollapsed = false;
  try {
    savedTheme = window.localStorage.getItem(THEME_KEY) || 'dark';
    savedCollapsed = window.localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    /* 忽略 */
  }
  applyTheme(savedTheme);
  applyCollapsed(savedCollapsed);

  try {
    const response = await fetch('/maps/maps.json');
    if (response.ok) {
      const raw = await response.json();
      state.calibration = raw.maps['10003'] || null;
    }
  } catch {
    /* 没有地图时只画列表 */
  }
  if (state.calibration) {
    state.image = new Image();
    state.image.onload = () => drawMap();
    state.image.src = `/maps/${state.calibration.image}`;
  }

  window.rocoOverlay?.onPayload((text) => {
    try {
      state.payload = text ? JSON.parse(text) : null;
    } catch {
      state.payload = null;
    }
    render();
  });
  const initial = await window.rocoOverlay?.getPayload();
  if (initial) {
    try {
      state.payload = JSON.parse(initial);
    } catch {
      state.payload = null;
    }
  }
  render();
}

document.getElementById('collapse').addEventListener('click', () => applyCollapsed(true));
document.getElementById('expand').addEventListener('click', () => applyCollapsed(false));
document.getElementById('theme').addEventListener('click', () => applyTheme(state.theme === 'light' ? 'dark' : 'light'));
document.getElementById('close').addEventListener('click', () => window.rocoOverlay?.hide());

window.rocoOverlay?.onClickThrough?.((flag) => {
  // 高级选项：打开后由主进程设置点击穿透，这里只更新标题提示
  document.body.dataset.clickThrough = flag ? '1' : '0';
  document.getElementById('status').title = flag ? '鼠标不挡点击已开启：Ctrl+Alt+O 恢复' : '';
});

boot();
