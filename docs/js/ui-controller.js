(function() {
  'use strict';

  // State
  let _data = [];
  let _diffs = [];
  let _hourly = [];
  let _currentTab = 'overview';
  let _tabRendered = { overview: false, analysis: false, data: false };

  // === Initialization ===
  async function init() {
    try {
      showLoading();
      _data = await DataService.fetchData();
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

  // === Render all sections ===
  function renderAll() {
    renderHero();
    renderStats();
    renderSpeedDashboard();
    renderPrediction();
    renderAnalogy();
    renderRecharge();
    // Initially render overview tab charts
    renderOverviewCharts();
    _tabRendered.overview = true;
  }

  // === Individual renderers ===

  // renderHero: Show current balance, warning badge, last update time
  function renderHero() {
    const latest = _data[_data.length - 1];
    document.getElementById('current-balance').innerHTML = latest.num.toFixed(2) + ' <span class="hero-unit">度</span>';
    const level = Analytics.getWarningLevel(latest.num);
    const badge = document.getElementById('warning-badge');
    badge.style.display = 'inline-flex';
    badge.className = 'warning-badge badge-' + level;
    const labels = { normal: '正常', caution: '注意', warning: '警告', emergency: '紧急' };
    document.getElementById('warning-level').textContent = labels[level];
    const bj = DataService.toBeijingTime(latest.time);
    const timeStr = bj.getFullYear() + '-' + String(bj.getMonth()+1).padStart(2,'0') + '-' + String(bj.getDate()).padStart(2,'0') + ' ' + String(bj.getHours()).padStart(2,'0') + ':' + String(bj.getMinutes()).padStart(2,'0');
    document.getElementById('last-update').textContent = '最后更新: ' + timeStr;
  }

  // renderStats: 4 stats cards
  function renderStats() {
    const stats = Analytics.computeStats(_data, _diffs);
    document.getElementById('stat-current').textContent = stats.current.toFixed(2) + ' 度';
    document.getElementById('stat-today').textContent = stats.today >= 0 ? stats.today.toFixed(2) + ' 度' : '--';
    document.getElementById('stat-week').textContent = stats.week >= 0 ? stats.week.toFixed(2) + ' 度' : '--';
    document.getElementById('stat-daily').textContent = stats.daily.toFixed(2) + ' 度';
  }

  // renderSpeedDashboard: Speed value, trend, historical comparison
  function renderSpeedDashboard() {
    const speed = Analytics.computeSpeed(_diffs, _data);
    document.getElementById('speed-value').textContent = speed.currentSpeed.toFixed(3) + ' 度/小时';
    const trendEl = document.getElementById('speed-trend');
    trendEl.textContent = speed.trend === 'up' ? '↑ 加速' : speed.trend === 'down' ? '↓ 减速' : '→ 持平';
    trendEl.className = 'speed-trend ' + speed.trend;
    document.getElementById('speed-historical').textContent = '历史同时段: ' + speed.historicalSpeed.toFixed(3) + ' 度/小时';
  }

  // renderPrediction: Prediction card
  function renderPrediction() {
    const pred = Analytics.computePrediction(_data, _diffs);
    if (!pred) {
      document.getElementById('prediction-text').textContent = '数据不足，暂无法预测';
      return;
    }
    document.getElementById('prediction-text').innerHTML = '预计 <span class="prediction-highlight">' + pred.dateStr + ' (' + pred.dayStr + ') ' + pred.timeStr + '</span> 左右用完';
    document.getElementById('prediction-meta').textContent = '可维持 ' + pred.remainingDays + ' 天 · 日均用电 ' + pred.dailyAvg + ' 度';
  }

  // renderAnalogy: Analogy card
  function renderAnalogy() {
    const stats = Analytics.computeStats(_data, _diffs);
    const todayConsumption = stats.today || 0.01;
    const analogy = Analytics.selectBestAnalogy(todayConsumption);
    document.getElementById('analogy-icon').textContent = analogy.icon;
    document.getElementById('analogy-value').textContent = (todayConsumption * analogy.factor).toFixed(1) + ' ' + analogy.unit;
    document.getElementById('analogy-label').textContent = analogy.label;
    document.getElementById('analogy-desc').textContent = '今日耗电 ' + todayConsumption.toFixed(2) + ' 度 · ' + analogy.desc;
  }

  // renderRecharge: Recharge suggestions
  function renderRecharge() {
    const stats = Analytics.computeStats(_data, _diffs);
    const avgDaily = stats.daily || 1;
    const options = Analytics.getRechargeOptions(avgDaily);
    const grid = document.getElementById('recharge-grid');
    grid.innerHTML = options.map(function(o) {
      return '<div class="recharge-option" data-amount="' + o.amount + '"><div class="recharge-amount">' + o.amount + '度</div><div class="recharge-days">约用 ' + o.days + ' 天</div></div>';
    }).join('');
    grid.querySelectorAll('.recharge-option').forEach(function(el) {
      el.addEventListener('click', function() {
        grid.querySelectorAll('.recharge-option').forEach(function(e) { e.classList.remove('selected'); });
        this.classList.add('selected');
      });
    });
  }

  // === Overview tab charts ===
  function renderOverviewCharts() {
    // Balance chart (7 days default)
    const filtered = DataService.filterByRange(_data, 7);
    ChartConfig.renderBalanceChart('chart-balance', filtered, '7');
    // Usage chart (7 days default)
    ChartConfig.renderUsageChart('chart-usage', _diffs, '7');
  }

  // === Analysis tab charts ===
  function renderAnalysisCharts() {
    ChartConfig.destroyAll();
    // Balance chart
    const filtered = DataService.filterByRange(_data, 7);
    ChartConfig.renderBalanceChart('chart-balance', filtered, '7');
    // Usage chart
    ChartConfig.renderUsageChart('chart-usage', _diffs, '7');
    // Hourly chart
    const timeline = Analytics.getHourlyTimeline(_hourly, '24h');
    const withAnomalies = Analytics.detectAnomalies(timeline);
    ChartConfig.renderHourlyChart('chart-hourly', withAnomalies, '24h');
    // Distribution chart
    const peak = Analytics.computePeak(_diffs);
    const mode = Analytics.recognizeMode(peak.hourlyAvg);
    ChartConfig.renderDistributionChart('chart-distribution', peak.hourlyAvg, mode);
    // Mode info
    const modeInfo = document.getElementById('mode-info');
    modeInfo.innerHTML = '<span class="mode-item peak">🟥 高峰 ' + mode.peak.hours + ' (' + mode.peak.avg.toFixed(3) + '度/h)</span><span class="mode-item mid">🟨 平峰 ' + mode.mid.hours + ' (' + mode.mid.avg.toFixed(3) + '度/h)</span><span class="mode-item low">🟩 低谷 ' + mode.low.hours + ' (' + mode.low.avg.toFixed(3) + '度/h)</span>';
    // Weekday vs Weekend
    const wd = Analytics.compareWeekdayWeekend(_hourly);
    ChartConfig.renderWeekdayWeekendChart('chart-weekday', wd.weekday, wd.weekend);
    // Period distribution
    const periods = Analytics.periodDistribution(_hourly);
    ChartConfig.renderPeriodChart('chart-period', periods);
    // Acceleration
    const accel = Analytics.trendAcceleration(_diffs);
    ChartConfig.renderAccelerationChart('chart-acceleration', accel.data, accel.isAccelerating);
    // Comparison
    const comp = Analytics.periodComparison(_diffs, _data);
    ChartConfig.renderComparisonChart('chart-comparison', comp);
  }

  // === Data tab ===
  function renderDataTab() {
    renderSummary();
    renderTable();
  }

  // renderSummary: Stats summary in data tab
  function renderSummary() {
    const stats = Analytics.computeStats(_data, _diffs);
    document.getElementById('summary-max').textContent = stats.max.toFixed(2) + ' 度';
    document.getElementById('summary-min').textContent = stats.min.toFixed(2) + ' 度';
    document.getElementById('summary-range').textContent = stats.range.toFixed(2) + ' 度';
    document.getElementById('summary-count').textContent = _data.length + ' 条';
  }

  // renderTable: Data table with toggle
  function renderTable() {
    const sorted = _data.slice().sort(function(a, b) { return b.bj - a.bj; });
    const rows = [];
    for (var i = 0; i < sorted.length; i++) {
      var diff = i < sorted.length - 1 ? Math.round((sorted[i].num - sorted[i+1].num) * 100) / 100 : null;
      var bj = DataService.toBeijingTime(sorted[i].time);
      var dateStr = bj.getFullYear() + '-' + String(bj.getMonth()+1).padStart(2,'0') + '-' + String(bj.getDate()).padStart(2,'0');
      var timeStr = String(bj.getHours()).padStart(2,'0') + ':' + String(bj.getMinutes()).padStart(2,'0');
      // Check if this is a recharge (next record has higher num)
      var isRecharge = diff !== null && diff < 0;
      var note = isRecharge ? '<span class="recharge-label">🟢 充值</span>' : '';
      rows.push({ dateStr: dateStr, timeStr: timeStr, num: sorted[i].num.toFixed(2), diff: isRecharge ? null : (diff !== null ? Math.abs(diff).toFixed(2) : 'N/A'), note: note, isRecharge: isRecharge });
    }
    var visible = rows.slice(0, 20);
    var hidden = rows.slice(20);
    var html = '';
    visible.forEach(function(r) {
      var cls = r.isRecharge ? ' class="recharge-row"' : '';
      html += '<tr' + cls + '><td>' + r.dateStr + '</td><td>' + r.timeStr + '</td><td>' + r.num + '</td><td>' + (r.diff !== 'N/A' ? r.diff : 'N/A') + '</td><td>' + r.note + '</td></tr>';
    });
    hidden.forEach(function(r) {
      var cls = r.isRecharge ? ' recharge-row' : '';
      html += '<tr class="hidden-rows' + cls + '"><td>' + r.dateStr + '</td><td>' + r.timeStr + '</td><td>' + r.num + '</td><td>' + (r.diff !== 'N/A' ? r.diff : 'N/A') + '</td><td>' + r.note + '</td></tr>';
    });
    document.getElementById('table-body').innerHTML = html;
    var toggleBtn = document.getElementById('toggle-btn');
    toggleBtn.style.display = hidden.length > 0 ? 'inline-block' : 'none';
  }

  // toggleRows: Show/hide extra rows
  window.toggleRows = function() {
    var rows = document.querySelectorAll('.hidden-rows');
    rows.forEach(function(r) { r.style.display = r.style.display === 'table-row' ? 'none' : 'table-row'; });
    var btn = document.getElementById('toggle-btn');
    btn.textContent = btn.textContent === '展开全部' ? '折叠' : '展开全部';
  };

  // === Tab switching ===
  function switchTab(tabId) {
    if (tabId === _currentTab) return;
    document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
    document.querySelectorAll('.tab-content').forEach(function(c) { c.classList.remove('active'); });
    document.querySelector('.tab-btn[data-tab="' + tabId + '"]').classList.add('active');
    document.getElementById('tab-' + tabId).classList.add('active');
    _currentTab = tabId;
    ChartConfig.destroyAll();
    if (tabId === 'overview') {
      renderOverviewCharts();
    } else if (tabId === 'analysis') {
      renderAnalysisCharts();
    } else if (tabId === 'data') {
      renderDataTab();
    }
  }

  // === Event listeners ===
  function setupEventListeners() {
    // Tab clicks
    document.querySelectorAll('.tab-btn').forEach(function(btn) {
      btn.addEventListener('click', function() { switchTab(this.dataset.tab); });
    });
    // Chart range controls
    document.querySelectorAll('.chart-controls').forEach(function(group) {
      group.querySelectorAll('.btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          group.querySelectorAll('.btn').forEach(function(b) { b.classList.remove('active'); });
          this.classList.add('active');
          var range = this.dataset.range;
          var id = group.id;
          if (id === 'controls-balance') {
            var filtered = DataService.filterByRange(_data, range);
            ChartConfig.renderBalanceChart('chart-balance', filtered, range);
          } else if (id === 'controls-usage') {
            ChartConfig.renderUsageChart('chart-usage', _diffs, range);
          } else if (id === 'controls-hourly') {
            var timeline = Analytics.getHourlyTimeline(_hourly, range);
            var withAnomalies = Analytics.detectAnomalies(timeline);
            ChartConfig.renderHourlyChart('chart-hourly', withAnomalies, range);
          }
        });
      });
    });
  }

  // === Utility ===
  function showLoading() {
    document.getElementById('loading-overlay').classList.remove('hidden');
  }

  function hideLoading() {
    var overlay = document.getElementById('loading-overlay');
    overlay.classList.add('hidden');
    setTimeout(function() { overlay.style.display = 'none'; }, 300);
  }

  function showError(msg) {
    document.getElementById('loading-overlay').style.display = 'none';
    var err = document.getElementById('error-msg');
    err.style.display = 'block';
    err.innerHTML = '❌ ' + msg + '<br><br><button class="btn" onclick="location.reload()">重试</button>';
  }

  // Start
  document.addEventListener('DOMContentLoaded', init);
})();