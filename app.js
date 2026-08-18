/* Groundwater Explorer Thailand — app.js
 * Data source: กรมทรัพยากรน้ำบาดาล พสุธารา Open API (FindWellAll), fetched and
 * split into data/provinces.json (index) + data/wells/<province>.json (per-province
 * well arrays) so the browser never has to load all ~117k wells at once.
 */

const map = L.map('map', { preferCanvas: true }).setView([13.5, 101.0], 6);
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_matter/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  subdomains: 'abcd',
  maxZoom: 19,
}).addTo(map);

let provinceIndex = [];
let overviewLayer = null;
let currentWells = [];       // full well array for the selected province
let filteredWells = [];      // after amphoe/welltype/depth/yield filters
let clusterGroup = null;
let markersById = {};

const els = {
  province: document.getElementById('filter-province'),
  amphoe: document.getElementById('filter-amphoe'),
  welltype: document.getElementById('filter-welltype'),
  depthMin: document.getElementById('filter-depth-min'),
  depthMax: document.getElementById('filter-depth-max'),
  yieldMin: document.getElementById('filter-yield-min'),
  yieldMax: document.getElementById('filter-yield-max'),
  reset: document.getElementById('btn-reset'),
  layerNote: document.getElementById('layer-note'),
  statCount: document.getElementById('stat-count'),
  statDepth: document.getElementById('stat-depth'),
  statYield: document.getElementById('stat-yield'),
  statStatic: document.getElementById('stat-static'),
  histDepth: document.getElementById('hist-depth'),
  histYield: document.getElementById('hist-yield'),
  wellPanel: document.getElementById('well-panel'),
};

function fmt(n, digits = 1) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Number(n).toLocaleString('th-TH', { maximumFractionDigits: digits });
}

/* ---- overview layer: one circle per province, sized/colored by well count ---- */
function renderOverview() {
  if (overviewLayer) map.removeLayer(overviewLayer);
  const maxCount = Math.max(...provinceIndex.map(p => p.count));
  overviewLayer = L.layerGroup(provinceIndex.map(p => {
    const r = 4 + 16 * Math.sqrt(p.count / maxCount);
    const hue = 200 - 200 * (p.count / maxCount); // blue (low) -> red (high)
    const marker = L.circleMarker([p.center[0], p.center[1]], {
      radius: r,
      color: `hsl(${hue},80%,55%)`,
      weight: 1,
      fillColor: `hsl(${hue},80%,55%)`,
      fillOpacity: 0.55,
    });
    marker.bindTooltip(`${p.name}: ${p.count.toLocaleString('th-TH')} บ่อ`, { direction: 'top' });
    marker.on('click', () => {
      els.province.value = p.name;
      loadProvince(p);
    });
    return marker;
  })).addTo(map);
}

/* ---- load a province's well data on demand ---- */
async function loadProvince(p) {
  els.layerNote.textContent = `กำลังโหลดข้อมูล ${p.name}...`;
  const res = await fetch(p.file);
  currentWells = await res.json();
  els.layerNote.textContent = `โหลดแล้ว ${currentWells.length.toLocaleString('th-TH')} บ่อ ในจังหวัด${p.name}`;

  if (overviewLayer) { map.removeLayer(overviewLayer); overviewLayer = null; }

  // populate amphoe filter
  const amphoes = [...new Set(currentWells.map(w => w.amphoe).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'th'));
  els.amphoe.innerHTML = '<option value="">ทั้งหมด</option>' + amphoes.map(a => `<option value="${a}">${a}</option>`).join('');

  [els.amphoe, els.welltype, els.depthMin, els.depthMax, els.yieldMin, els.yieldMax, els.reset].forEach(el => el.disabled = false);
  els.amphoe.value = '';
  els.welltype.value = '';
  els.depthMin.value = ''; els.depthMax.value = '';
  els.yieldMin.value = ''; els.yieldMax.value = '';

  const lats = currentWells.map(w => w.lat), lons = currentWells.map(w => w.lon);
  if (lats.length) {
    map.fitBounds([[Math.min(...lats), Math.min(...lons)], [Math.max(...lats), Math.max(...lons)]], { padding: [30, 30] });
  }

  applyFilters();
}

/* ---- filtering + rendering ---- */
function applyFilters() {
  const amphoe = els.amphoe.value;
  const wtid = els.welltype.value;
  const dMin = parseFloat(els.depthMin.value), dMax = parseFloat(els.depthMax.value);
  const yMin = parseFloat(els.yieldMin.value), yMax = parseFloat(els.yieldMax.value);

  filteredWells = currentWells.filter(w => {
    if (amphoe && w.amphoe !== amphoe) return false;
    if (wtid && w.wtid !== wtid) return false;
    if (!isNaN(dMin) && (w.drill === null || w.drill < dMin)) return false;
    if (!isNaN(dMax) && (w.drill === null || w.drill > dMax)) return false;
    if (!isNaN(yMin) && (w.yield === null || w.yield < yMin)) return false;
    if (!isNaN(yMax) && (w.yield === null || w.yield > yMax)) return false;
    return true;
  });

  renderMarkers();
  renderAnalytics();
}

function renderMarkers() {
  if (clusterGroup) map.removeLayer(clusterGroup);
  markersById = {};
  clusterGroup = L.markerClusterGroup({ maxClusterRadius: 45, disableClusteringAtZoom: 14 });
  const icon = L.divIcon({ className: 'well-marker-pin', iconSize: [10, 10] });
  filteredWells.forEach(w => {
    const m = L.marker([w.lat, w.lon], { icon });
    m.on('click', () => showWellPanel(w));
    markersById[w.id] = m;
    clusterGroup.addLayer(m);
  });
  map.addLayer(clusterGroup);
}

function mean(arr) {
  const vals = arr.filter(v => v !== null && v !== undefined && !isNaN(v));
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function renderHistogram(el, values, binCount = 10) {
  const vals = values.filter(v => v !== null && v !== undefined && !isNaN(v));
  el.innerHTML = '';
  if (!vals.length) return;
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const bins = new Array(binCount).fill(0);
  vals.forEach(v => {
    let idx = Math.floor(((v - min) / range) * binCount);
    if (idx >= binCount) idx = binCount - 1;
    if (idx < 0) idx = 0;
    bins[idx]++;
  });
  const maxBin = Math.max(...bins);
  bins.forEach(b => {
    const bar = document.createElement('div');
    bar.className = 'hist-bar';
    bar.style.height = (2 + 32 * (b / maxBin)) + 'px';
    bar.title = `${b} บ่อ`;
    el.appendChild(bar);
  });
}

function renderAnalytics() {
  els.statCount.textContent = filteredWells.length.toLocaleString('th-TH');
  els.statDepth.textContent = filteredWells.length ? fmt(mean(filteredWells.map(w => w.drill))) + ' m' : '—';
  els.statYield.textContent = filteredWells.length ? fmt(mean(filteredWells.map(w => w.yield))) + ' m³/hr' : '—';
  els.statStatic.textContent = filteredWells.length ? fmt(mean(filteredWells.map(w => w.static))) + ' m' : '—';
  renderHistogram(els.histDepth, filteredWells.map(w => w.drill));
  renderHistogram(els.histYield, filteredWells.map(w => w.yield));
}

/* ---- well detail panel with a simple illustrative depth profile ---- */
function showWellPanel(w) {
  const drill = w.drill || 0;
  const staticPct = drill ? Math.min(100, (w.static || 0) / drill * 100) : 0;
  els.wellPanel.innerHTML = `
    <div class="well-card">
      <h3>${w.loc || 'บ่อน้ำบาดาล'}</h3>
      <div class="wid">รหัสบ่อ: ${w.id}</div>
      <div class="well-row"><span class="k">ตำบล/อำเภอ</span><span class="v">${w.tumbol || '-'} / ${w.amphoe || '-'}</span></div>
      <div class="well-row"><span class="k">หมู่บ้าน</span><span class="v">${w.muban || '-'}</span></div>
      <div class="well-row"><span class="k">ประเภทบ่อ</span><span class="v">${w.wtype || '-'}</span></div>
      <div class="well-row"><span class="k">ประเภทน้ำ</span><span class="v">${w.watertype || '-'}</span></div>
      <div class="well-row"><span class="k">ความลึกเจาะ</span><span class="v">${fmt(w.drill)} m</span></div>
      <div class="well-row"><span class="k">ความลึกพัฒนา</span><span class="v">${fmt(w.dev)} m</span></div>
      <div class="well-row"><span class="k">ปริมาณน้ำ (Yield)</span><span class="v">${fmt(w.yield)} m³/hr</span></div>
      <div class="well-row"><span class="k">ระดับน้ำสถิต</span><span class="v">${fmt(w.static)} m</span></div>
      <div class="well-row"><span class="k">พิกัด</span><span class="v">${fmt(w.lat, 5)}, ${fmt(w.lon, 5)}</span></div>

      <div class="well-profile">
        <div class="well-profile-title">แผนภาพประกอบความลึกบ่อ (ไม่ใช่ข้อมูลชั้นดินจริง)</div>
        <div class="profile-bar">
          <div class="profile-marker" style="top:${staticPct}%">
            <span class="lbl">ระดับน้ำสถิต ${fmt(w.static)} m</span>
          </div>
          <div class="profile-marker" style="top:98%">
            <span class="lbl">ก้นบ่อ ${fmt(w.drill)} m</span>
          </div>
        </div>
        <div class="profile-legend"><span>ผิวดิน 0 m</span><span>ความลึกเจาะ ${fmt(w.drill)} m</span></div>
      </div>
    </div>
  `;
}

/* ---- wire up UI ---- */
els.province.addEventListener('change', () => {
  const p = provinceIndex.find(x => x.name === els.province.value);
  if (p) loadProvince(p);
});
[els.amphoe, els.welltype, els.depthMin, els.depthMax, els.yieldMin, els.yieldMax].forEach(el => {
  el.addEventListener('change', applyFilters);
  el.addEventListener('keyup', applyFilters);
});
els.reset.addEventListener('click', () => {
  els.amphoe.value = ''; els.welltype.value = '';
  els.depthMin.value = ''; els.depthMax.value = '';
  els.yieldMin.value = ''; els.yieldMax.value = '';
  applyFilters();
});

/* ---- boot ---- */
(async function init() {
  const res = await fetch('data/provinces.json');
  provinceIndex = await res.json();
  provinceIndex.sort((a, b) => a.name.localeCompare(b.name, 'th'));
  els.province.innerHTML = '<option value="">— เลือกจังหวัด —</option>' +
    provinceIndex.map(p => `<option value="${p.name}">${p.name} (${p.count.toLocaleString('th-TH')})</option>`).join('');
  renderOverview();
})();
