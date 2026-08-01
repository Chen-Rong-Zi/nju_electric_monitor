# Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the nju_electric_monitor frontend with Apple-style design, Chart.js, and 8 advanced hour-level analysis features.

**Architecture:** Single HTML page (`docs/index.html`) with 4 JS modules (`docs/js/`). Data flows from JSONL → data-service.js (fetch/parse/cache) → analytics.js (compute) → chart-config.js (Chart.js) / ui-controller.js (DOM). Tab-based navigation: 概览 / 分析 / 数据明细.

**Tech Stack:** Chart.js 4.4.0 (CDN), vanilla JS modules, sessionStorage cache, CSS variables (OKLCH), GitHub Pages deployment.

**Data source:** `docs/data/electricity_data.json` — JSONL format, each line: `{"timestamp": "2026-08-01T19:32:29.812823", "remaining_electricity": 28.66, "unit": "度"}`

---

### Task 1: Create data-service.js

**Files:**
- Create: `docs/js/data-service.js`

**Data structures this module produces:**

```javascript
// Raw record after parsing
// { time: Date, bj: Date, num: number, unit: string }

// Diff record (consumption between consecutive records)
// { startTime: Date, endTime: Date, consumption: number, startNum: number, endNum: number, isRecharge: boolean }
// consumption = data[i-1].num - data[i].num; positive = normal usage, negative = recharge
// isRecharge = consumption <= 0 (or very small negative due to floating point)

// Hourly record (consumption assigned to a specific hour)
// { hour: number (0-23), date: string (YYYY-MM-DD), consumption: number, isAnomaly: boolean }
```

- [ ] **Step 1: Create `docs/js/data-service.js` with the following exports:**

```javascript
const DATA_URL = 'data/electricity_data.json';

const DataService = {
  _cache: null,
  _cacheKey: null,

  // Fetch and parse JSONL data
  // Returns array of { time: Date, bj: Date, num: number, unit: string }
  async fetchData() { /* ... */ },

  // Process raw lines: parse JSON, convert timezone, sort
  processData(raw) { /* ... */ },

  // Compute diffs between consecutive records
  // Returns array of { startTime, endTime, consumption, startNum, endNum, isRecharge }
  calcDiffs(data) { /* ... */ },

  // Assign each diff to its end time's hour
  // Returns array of { hour, date, consumption, dateHour: string (YYYY-MM-DD-HH) }
  toHourly(diffs, data) { /* ... */ },

  // Filter data by range in days
  filterByRange(data, range) { /* ... */ },

  // Convert UTC Date to Beijing time (UTC+8)
  toBeijingTime(date) { /* ... */ }
};
```

**Key implementation details:**
- `fetchData()`: `fetch(DATA_URL)`, read text, split by `\n`, filter empty, JSON.parse each line
- `processData()`: map each raw object to `{ time: new Date(d.timestamp), bj: toBeijingTime(new Date(d.timestamp)), num: parseFloat(d.remaining_electricity), unit: d.unit || '度' }`, filter NaN, sort by time ascending
- `calcDiffs()`: for i from 1 to data.length-1, compute `data[i-1].num - data[i].num`, mark `isRecharge: consumption < 0`
- `toBeijingTime()`: `new Date(date.getTime() + 8 * 3600000)`
- `toHourly()`: for each diff, assign consumption to the hour of `diff.endTime.getHours()`, keyed by date string + hour
- `filterByRange()`: if range === 'all' return all; else `data.filter(d => d.bj >= new Date(now - range * 86400000))`

- [ ] **Step 2: Verify the file parses correctly**

Run: `node -c docs/js/data-service.js`
Expected: no errors (or run in browser)

- [ ] **Step 3: Commit**

```bash
git add docs/js/data-service.js
git commit -m "feat: add data-service.js for data loading and parsing"
```

---

### Task 2: Create analytics.js

**Files:**
- Create: `docs/js/analytics.js`

**Depends on:** DataService (data-service.js) — uses the data structures from Task 1

- [ ] **Step 1: Create `docs/js/analytics.js` with all computation functions:**

```javascript
const Analytics = {
  // === Statistics ===
  // Input: data array, diffs array
  // Returns: { current, today, week, daily, totalConsumption, days, max, min, range }
  computeStats(data, diffs) { },
  
  // === Prediction ===
  // Returns: { dateStr, dayStr, timeStr, remainingDays, dailyAvg } or null
  computePrediction(data, diffs) { },
  
  // === Peak Analysis ===
  // Returns: { hourlyAvg: [{hour, avg}], peakHour, weeklyAvg: [{day, name, avg}], peakDay }
  computePeak(diffs) { },
  
  // === Hourly Timeline ===
  // Input: hourly data from DataService.toHourly()
  // Returns: [{dateHour, hour, date, consumption}] sorted by time
  getHourlyTimeline(hourlyData, range) { },
  
  // === Anomaly Detection ===
  // Input: hourly data, returns hourly data with isAnomaly flags
  // Uses 30-day sliding window, marks if value > mean + 2*stddev
  detectAnomalies(hourlyData) { },
  
  // === Mode Recognition (高峰/平峰/低谷) ===
  // Returns: { peak: {hours, avg}, mid: {hours, avg}, low: {hours, avg} }
  // top 25% = peak, bottom 25% = low, rest = mid
  recognizeMode(hourlyAvg) { },
  
  // === Consumption Speed ===
  // Returns: { currentSpeed, historicalSpeed, trend: 'up'|'down'|'flat' }
  computeSpeed(diffs, data) { },
  
  // === Weekday vs Weekend ===
  // Returns: { weekday: [24 entries], weekend: [24 entries] }
  compareWeekdayWeekend(hourlyData) { },
  
  // === Time Period Distribution ===
  // Returns: [{label, hours, value, percentage}]
  // Periods: 凌晨(0-6), 上午(6-12), 下午(12-18), 晚间(18-24)
  periodDistribution(hourlyData) { },
  
  // === Trend Acceleration ===
  // Returns: { slope, isAccelerating, data: [{date, avg7}] }
  // 7-day sliding average, compare two 7-day windows
  trendAcceleration(diffs) { },
  
  // === Period Comparison (环比) ===
  // Returns: { todayVsYesterday: [...], thisWeekVsLastWeek: {...} }
  periodComparison(diffs, data) { },
  
  // === Warning Level ===
  // Returns: 'normal'|'caution'|'warning'|'emergency'
  getWarningLevel(currentBalance) { },
  
  // === Analogy ===
  // Returns: { icon, factor, unit, label, desc, value, range }
  selectBestAnalogy(kwh) { },
  
  // === Analogy text ===
  generateAnalogyText(kwh) { },
  
  // === Recharge suggestions ===
  // Returns: [{amount, days}]
  getRechargeOptions(avgDaily) { }
};
```

**Key implementation details:**

- `computeStats()`: current = last data point num; todayDiff = diffs filtered by today (bj >= todayStart); weekDiff = diffs filtered by this week; dailyAvg = totalConsumption / days; max/min = Math.max/min of data nums
- `computePrediction()`: use last 7 days of diffs, compute daily avg, `remainingDays = current / dailyAvg`, compute predicted end date
- `computePeak()`: group diffs by endTime hour → hourly avg; group by day of week → weekly avg
- `detectAnomalies()`: for each hour, compute mean & std of all consumptions for that hour in last 30 days; if current > mean + 2*std, mark anomaly
- `recognizeMode()`: sort hourlyAvg by avg desc; top 25% = peak, bottom 25% = low, rest = mid; merge consecutive hours
- `computeSpeed()`: last 24h consumption / hours elapsed; compare with same weekday 7 days ago
- `compareWeekdayWeekend()`: group hourlyData by weekday (Mon-Fri) vs weekend (Sat-Sun), compute avg per hour
- `periodDistribution()`: group hourlyData by period (0-6, 6-12, 12-18, 18-24), sum consumption, compute percentage
- `trendAcceleration()`: compute 7-day sliding avg of daily consumption; compare slope of last 7 days vs previous 7 days
- `periodComparison()`: today vs yesterday: group hourly consumption by hour; this week vs last week: daily averages
- `getWarningLevel()`: if > 50 → normal; >= 20 → caution; >= 10 → warning; else → emergency
- `selectBestAnalogy()`: ENERGY_ANALOGIES array (from spec section 7), iterate in order, return first match (kwh >= range[0] && kwh < range[1]), fallback to 木材燃烧
- `getRechargeOptions()`: amounts [30, 50, 100, 200], days = Math.floor(amount / avgDaily)

- [ ] **Step 2: Verify the file parses correctly**

Run: `node -c docs/js/analytics.js`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add docs/js/analytics.js
git commit -m "feat: add analytics.js with all computation functions"
```

---

### Task 3: Create chart-config.js

**Files:**
- Create: `docs/js/chart-config.js`

**Depends on:** Chart.js (loaded via CDN in index.html), Analytics (analytics.js)

- [ ] **Step 1: Create `docs/js/chart-config.js`**

```javascript
const ChartConfig = {
  _instances: {},  // { chartId: Chart instance }

  // Destroy a chart instance
  destroy(id) { /* chart.destroy() */ },

  // Destroy all chart instances
  destroyAll() { /* Object.values(this._instances).forEach(c => c.destroy()) */ },

  // === Balance Trend Line Chart ===
  // canvasId: 'chart-balance', data: filtered data array, range: '7'|'30'|'all'
  renderBalanceChart(canvasId, data, range) { },

  // === Daily Usage Bar Chart ===
  renderUsageChart(canvasId, diffs, range) { },

  // === Hourly Timeline Line Chart ===
  // anomalyPoints: array of {dateHour, consumption} with anomaly markers
  renderHourlyChart(canvasId, hourlyData, range) { },

  // === 24h Distribution Bar Chart ===
  // modeInfo: { peak: {hours}, mid: {hours}, low: {hours} }
  renderDistributionChart(canvasId, hourlyAvg, modeInfo) { },

  // === Weekday vs Weekend Line Chart ===
  renderWeekdayWeekendChart(canvasId, weekdayData, weekendData) { },

  // === Period Distribution Doughnut Chart ===
  renderPeriodChart(canvasId, periodData) { },

  // === Trend Acceleration Line Chart ===
  renderAccelerationChart(canvasId, accelData, isAccelerating) { },

  // === Period Comparison Bar Chart ===
  renderComparisonChart(canvasId, comparisonData) { }
};
```

**Key Chart.js configuration patterns:**

```javascript
// Line chart pattern (balance, hourly, weekday/weekend, acceleration)
new Chart(ctx, {
  type: 'line',
  data: {
    labels: data.map(d => formattedLabel),
    datasets: [{
      label: '...',
      data: data.map(d => d.value),
      borderColor: 'oklch(55% 0.15 160)',
      backgroundColor: 'rgba(...)',
      fill: true,
      tension: 0.4,
      pointRadius: 0,
      pointHoverRadius: 6
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1a1a1a',
        titleFont: { family: 'system-ui', size: 14, weight: '600' },
        bodyFont: { family: 'monospace', size: 13 },
        padding: 16,
        displayColors: false
      }
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { family: 'monospace', size: 11 } } },
      y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { family: 'monospace', size: 11 } } }
    }
  }
});

// Bar chart pattern (usage, distribution, comparison)
new Chart(ctx, {
  type: 'bar',
  data: {
    labels: data.map(d => d.label),
    datasets: [{
      label: '...',
      data: data.map(d => d.value),
      backgroundColor: data.map(d => d.color || 'oklch(55% 0.15 160)'),
      borderRadius: 4
    }]
  },
  options: { /* similar to line chart options */ }
});

// Doughnut chart pattern (period distribution)
new Chart(ctx, {
  type: 'doughnut',
  data: {
    labels: periodData.map(d => d.label),
    datasets: [{
      data: periodData.map(d => d.value),
      backgroundColor: ['#3b82f6', '#f59e0b', '#10b981', '#ef4444'],
      borderWidth: 0
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { font: { family: 'system-ui', size: 12 } } }
    },
    cutout: '65%'
  }
});
```

- [ ] **Step 2: Verify the file parses correctly**

Run: `node -c docs/js/chart-config.js`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add docs/js/chart-config.js
git commit -m "feat: add chart-config.js for Chart.js rendering"
```

---

### Task 4: Rewrite index.html (CSS + HTML structure)

**Files:**
- Modify: `docs/index.html`

- [ ] **Step 1: Write the complete `docs/index.html`**

This is the main file. It must include:
1. HTML5 doctype, lang="zh-CN", viewport meta
2. Chart.js CDN: `<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>`
3. CSS variables (same as current project, OKLCH color scheme)
4. Sticky topnav with Apple-style glassmorphism: logo + nav links (首页, GitHub, njupower.top)
5. Hero section: current balance (large), warning badge, last update time, "每小时监控" badge
6. Tab navigation: [概览] [分析] [数据明细] — clicking switches content sections
7. 概览 section: stats grid (4 cards), speed dashboard, prediction card, analogy card, recharge suggestions
8. 分析 section: 8 chart sections, each with a canvas and time range controls
9. 数据明细 section: stats summary row, data table with toggle
10. Footer
11. Loading overlay with spinner
12. Script tags loading: data-service.js, analytics.js, chart-config.js, ui-controller.js (in order)

**CSS structure:**
- Use the same CSS variables as current index.html (OKLCH)
- Navigation: `.topnav` (sticky, backdrop-filter blur)
- Tabs: `.tabs` container with `.tab-btn` buttons, `.tab-content` sections
- Responsive breakpoints: 900px / 600px / 500px
- Card styles: `.card` (white bg, border, radius, shadow, hover effect)
- Stats grid: 4 columns, responsive
- Chart sections: `.chart-section` (card-like), `.chart-container` (height: 300px)
- Loading overlay: fixed, full screen, centered spinner
- All animations: smooth transitions

**HTML structure skeleton:**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>电费监控 · 南京大学</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>
    /* All CSS here */
  </style>
</head>
<body>
  <nav class="topnav">...</nav>
  
  <!-- Loading overlay -->
  <div id="loading-overlay">...</div>

  <main class="main">
    <!-- Hero -->
    <section class="hero">...</section>
    
    <!-- Tab nav -->
    <div class="tabs">
      <button class="tab-btn active" data-tab="overview">概览</button>
      <button class="tab-btn" data-tab="analysis">分析</button>
      <button class="tab-btn" data-tab="data">数据明细</button>
    </div>

    <!-- Overview tab -->
    <div class="tab-content active" id="tab-overview">
      <!-- Stats grid -->
      <!-- Speed dashboard -->
      <!-- Prediction card -->
      <!-- Analogy card -->
      <!-- Recharge suggestions -->
    </div>

    <!-- Analysis tab -->
    <div class="tab-content" id="tab-analysis">
      <!-- Balance chart -->
      <!-- Usage chart -->
      <!-- Hourly chart -->
      <!-- Distribution chart -->
      <!-- Weekday/weekend chart -->
      <!-- Period chart -->
      <!-- Acceleration chart -->
      <!-- Comparison chart -->
    </div>

    <!-- Data tab -->
    <div class="tab-content" id="tab-data">
      <!-- Stats summary -->
      <!-- Data table -->
    </div>
  </main>

  <footer>...</footer>

  <script src="js/data-service.js"></script>
  <script src="js/analytics.js"></script>
  <script src="js/chart-config.js"></script>
  <script src="js/ui-controller.js"></script>
</body>
</html>
```

**Important CSS classes to include:**
- `.topnav`, `.topnav-inner`, `.logo`, `.nav-links` — navigation
- `.hero`, `.hero-badge`, `.hero-value`, `.hero-unit`, `.hero-meta` — hero section
- `.tabs`, `.tab-btn`, `.tab-btn.active` — tab navigation
- `.tab-content` (display:none), `.tab-content.active` (display:block) — tab content
- `.stats-grid`, `.stat-card`, `.stat-label`, `.stat-value` — stat cards
- `.card`, `.chart-section`, `.chart-container` — chart areas
- `.speed-dashboard` — speed display area
- `.prediction-card` — prediction card
- `.analogy-card`, `.analogy-main` — analogy display
- `.recharge-grid`, `.recharge-option` — recharge suggestions
- `.table-section`, `.data-table` — data table
- `.loading-overlay`, `.loading-spinner`, `.loading-text` — loading
- `.badge-normal`, `.badge-caution`, `.badge-warning`, `.badge-emergency` — warning level badges

- [ ] **Step 2: Commit**

```bash
git add docs/index.html
git commit -m "feat: rewrite index.html with Apple-style design and tab layout"
```

---

### Task 5: Create ui-controller.js

**Files:**
- Create: `docs/js/ui-controller.js`

**Depends on:** DataService, Analytics, ChartConfig (all loaded before this script)

- [ ] **Step 1: Create `docs/js/ui-controller.js`**

This module wires everything together. It:
1. Loads data on DOMContentLoaded
2. Renders all UI elements
3. Handles tab switching
4. Handles chart range button clicks
5. Updates chart on range change

**Architecture:**

```javascript
(function() {
  'use strict';

  // State
  let _data = [];       // processed data from DataService
  let _diffs = [];      // computed diffs
  let _hourly = [];     // hourly breakdown
  let _currentTab = 'overview';

  // === Initialization ===
  async function init() {
    try {
      showLoading();
      const raw = await DataService.fetchData();
      _data = DataService.processData(raw);
      if (_data.length === 0) throw new Error('暂无数据');
      _diffs = DataService.calcDiffs(_data);
      _hourly = DataService.toHourly(_diffs, _data);
      renderAll();
      setupEventListeners();
      hideLoading();
    } catch (err) {
      showError(err.message);
    }
  }

  // === Render everything ===
  function renderAll() {
    renderHero();
    renderStats();
    renderSpeedDashboard();
    renderPrediction();
    renderAnalogy();
    renderRecharge();
    renderSummary();
    renderTable();
    // Charts are rendered when tab becomes visible (lazy render)
    renderCurrentTabCharts();
  }

  // === Section renderers ===
  function renderHero() { /* current balance, warning badge, update time */ }
  function renderStats() { /* 4 stat cards */ }
  function renderSpeedDashboard() { /* speed + trend */ }
  function renderPrediction() { /* prediction card */ }
  function renderAnalogy() { /* main analogy card */ }
  function renderRecharge() { /* recharge options */ }
  function renderSummary() { /* stats summary in data tab */ }
  function renderTable() { /* data table with toggle */ }

  // === Chart renderers ===
  function renderBalanceChart(range) { /* ChartConfig.renderBalanceChart */ }
  function renderUsageChart(range) { /* ChartConfig.renderUsageChart */ }
  function renderHourlyChart(range) { /* ChartConfig.renderHourlyChart */ }
  function renderDistributionChart() { /* ChartConfig.renderDistributionChart */ }
  function renderWeekdayWeekendChart() { /* ChartConfig.renderWeekdayWeekendChart */ }
  function renderPeriodChart() { /* ChartConfig.renderPeriodChart */ }
  function renderAccelerationChart() { /* ChartConfig.renderAccelerationChart */ }
  function renderComparisonChart() { /* ChartConfig.renderComparisonChart */ }
  function renderCurrentTabCharts() { /* switch(_currentTab) and render appropriate charts */ }

  // === Tab switching ===
  function switchTab(tabId) { /* update active tab, switch content, render charts */ }

  // === Event listeners ===
  function setupEventListeners() {
    // Tab clicks
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    // Chart range controls
    document.querySelectorAll('.chart-controls .btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const group = this.closest('.chart-controls');
        group.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        // Re-render the specific chart
      });
    });
    // Table toggle
    document.getElementById('toggle-btn')?.addEventListener('click', toggleTableRows);
  }

  // === Utility ===
  function toggleTableRows() { /* show/hide extra rows */ }
  function showLoading() { /* show loading overlay */ }
  function hideLoading() { /* hide loading overlay with fade */ }
  function showError(msg) { /* show error message */ }

  // Start
  document.addEventListener('DOMContentLoaded', init);
})();
```

**Detailed rendering specs:**

**renderHero():**
- `document.getElementById('current-balance').textContent = latest.num + ' 度'`
- Warning badge: set class based on Analytics.getWarningLevel(latest.num)
- `document.getElementById('last-update').textContent = '最后更新: ' + formattedTime`

**renderSpeedDashboard():**
- Call `Analytics.computeSpeed(_diffs, _data)`
- Show `currentSpeed + ' 度/小时'`
- Show trend arrow: ↑ 加速 / ↓ 减速 / → 持平
- Show historical comparison

**renderPrediction():**
- Call `Analytics.computePrediction(_data, _diffs)`
- Show "预计 X月X日(周X) XX:XX 左右用完"
- Show "可维持 N 天 · 日均用电 M 度"

**renderAnalogy():**
- Get today's consumption from stats
- Call `Analytics.selectBestAnalogy(todayConsumption)`
- Show icon, value, label, description

**renderRecharge():**
- Call `Analytics.getRechargeOptions(avgDaily)`
- Generate clickable options

**renderTable():**
- Sort data by bj descending
- Columns: 日期, 时刻, 剩余电量, 用电量, 备注
- Show first 20 rows, rest hidden with toggle
- Mark recharge rows with green badge

**renderBalanceChart(range):**
- `const filtered = DataService.filterByRange(_data, range)`
- `ChartConfig.renderBalanceChart('chart-balance', filtered, range)`

**renderHourlyChart(range):**
- `const timeline = Analytics.getHourlyTimeline(_hourly, range)`
- `const withAnomalies = Analytics.detectAnomalies(timeline)`
- `ChartConfig.renderHourlyChart('chart-hourly', withAnomalies, range)`

**renderDistributionChart():**
- `const hourlyAvg = Analytics.computePeak(_diffs).hourlyAvg`
- `const mode = Analytics.recognizeMode(hourlyAvg)`
- `ChartConfig.renderDistributionChart('chart-distribution', hourlyAvg, mode)`

**renderWeekdayWeekendChart():**
- `const { weekday, weekend } = Analytics.compareWeekdayWeekend(_hourly)`
- `ChartConfig.renderWeekdayWeekendChart('chart-weekday', weekday, weekend)`

**renderPeriodChart():**
- `const periods = Analytics.periodDistribution(_hourly)`
- `ChartConfig.renderPeriodChart('chart-period', periods)`

**renderAccelerationChart():**
- `const accel = Analytics.trendAcceleration(_diffs)`
- `ChartConfig.renderAccelerationChart('chart-acceleration', accel.data, accel.isAccelerating)`

**renderComparisonChart():**
- `const comp = Analytics.periodComparison(_diffs, _data)`
- `ChartConfig.renderComparisonChart('chart-comparison', comp)`

**Tab switching:**
- Remove active class from all tabs and contents
- Add active class to selected tab and its content
- Call chart renderers for the current tab (lazy: only render charts when tab is first shown)
- `ChartConfig.destroyAll()` before switching to clean up

- [ ] **Step 2: Verify the file parses correctly**

Run: `node -c docs/js/ui-controller.js`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add docs/js/ui-controller.js
git commit -m "feat: add ui-controller.js to wire everything together"
```

---

## Self-Review Checklist

1. **Spec coverage:** Does every spec section map to a task?
   - Section 1-2 (Architecture) → Task 1, 4 (file structure, HTML)
   - Section 3 (File structure) → All tasks create the exact files
   - Section 4.1 (Overview tab) → Task 5: renderHero, renderStats, renderSpeedDashboard, renderPrediction, renderAnalogy, renderRecharge
   - Section 4.2 (Analysis tab) → Task 5: 8 chart renderers
   - Section 4.3 (Data tab) → Task 5: renderSummary, renderTable
   - Section 5 (Data flow) → Task 1: data-service.js
   - Section 6-7 (Algorithms, Analogy) → Task 2: analytics.js
   - Section 8 (Visual) → Task 4: index.html CSS

2. **Placeholder check:** All steps have complete code specifications. No TBD/TODO.

3. **Type consistency:** Function names are consistent across tasks. DataService methods used in Task 5 match Task 1 exports. Analytics methods match Task 2 exports. ChartConfig methods match Task 3 exports.