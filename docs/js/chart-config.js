var ChartConfig = {
  _instances: {},

  // Destroy a chart instance by id
  destroy: function(id) {
    if (this._instances[id]) {
      this._instances[id].destroy();
      delete this._instances[id];
    }
  },

  // Destroy all chart instances
  destroyAll: function() {
    for (var key in this._instances) {
      if (this._instances.hasOwnProperty(key)) {
        this._instances[key].destroy();
      }
    }
    this._instances = {};
  },

  // === Helpers ===

  // Filter data array (with bj Date property) by range in days
  _filterByRange: function(data, range) {
    if (range === 'all' || !range) return data;
    var now = Date.now();
    var cutoff = new Date(now - range * 86400000);
    return data.filter(function(d) { return d.bj >= cutoff; });
  },

  // Filter hourly data (with date string property "YYYY-MM-DD") by range in days
  _filterHourlyByRange: function(data, range) {
    if (range === 'all' || !range) return data;
    var now = new Date();
    var cutoff = new Date(now.getTime() - range * 86400000);
    var y = cutoff.getFullYear();
    var m = String(cutoff.getMonth() + 1).padStart(2, '0');
    var d = String(cutoff.getDate()).padStart(2, '0');
    var cutoffStr = y + '-' + m + '-' + d;
    return data.filter(function(item) { return item.date >= cutoffStr; });
  },

  // Aggregate diffs by date, returns { labels: [date strings], values: [numbers] }
  _aggregateDailyUsage: function(diffs) {
    var daily = {};
    for (var i = 0; i < diffs.length; i++) {
      var d = diffs[i];
      if (d.isRecharge) continue;
      var ts = new Date(d.endTime);
      var key = ts.getFullYear() + '-' +
        String(ts.getMonth() + 1).padStart(2, '0') + '-' +
        String(ts.getDate()).padStart(2, '0');
      if (!daily[key]) daily[key] = 0;
      daily[key] += d.consumption;
    }
    var dates = Object.keys(daily).sort();
    return {
      labels: dates,
      values: dates.map(function(k) { return Math.round(daily[k] * 100) / 100; })
    };
  },

  // Filter daily aggregate by date string range
  _filterDailyByRange: function(labels, values, range) {
    if (range === 'all' || !range) return { labels: labels, values: values };
    var now = new Date();
    var cutoff = new Date(now.getTime() - range * 86400000);
    var y = cutoff.getFullYear();
    var m = String(cutoff.getMonth() + 1).padStart(2, '0');
    var d = String(cutoff.getDate()).padStart(2, '0');
    var cutoffStr = y + '-' + m + '-' + d;
    var outLabels = [];
    var outValues = [];
    for (var i = 0; i < labels.length; i++) {
      if (labels[i] >= cutoffStr) {
        outLabels.push(labels[i]);
        outValues.push(values[i]);
      }
    }
    return { labels: outLabels, values: outValues };
  },

  // Parse mode hours string like "8-11时, 14-17时" into array of hour numbers
  _parseModeHours: function(hoursStr) {
    if (!hoursStr) return [];
    var result = [];
    var parts = hoursStr.split(', ');
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i].replace('时', '');
      var dashIdx = part.indexOf('-');
      if (dashIdx !== -1) {
        var start = parseInt(part.substring(0, dashIdx), 10);
        var end = parseInt(part.substring(dashIdx + 1), 10);
        for (var h = start; h <= end; h++) {
          result.push(h);
        }
      } else {
        result.push(parseInt(part, 10));
      }
    }
    return result;
  },

  // Common line chart options
  _lineChartOptions: function() {
    return {
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
    };
  },

  // Common bar chart options
  _barChartOptions: function() {
    return {
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
    };
  },

  // === Balance Trend Line Chart ===
  // canvasId: 'chart-balance', data: array of {bj: Date, num: number}, range: '7'|'30'|'all'
  renderBalanceChart: function(canvasId, data, range) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    this.destroy(canvasId);
    if (!data || data.length < 2) return;

    var filtered = this._filterByRange(data, range);
    if (filtered.length < 2) return;

    var labels = filtered.map(function(d) {
      var month = String(d.bj.getMonth() + 1).padStart(2, '0');
      var day = String(d.bj.getDate()).padStart(2, '0');
      var hours = String(d.bj.getHours()).padStart(2, '0');
      var mins = String(d.bj.getMinutes()).padStart(2, '0');
      return month + '-' + day + ' ' + hours + ':' + mins;
    });
    var values = filtered.map(function(d) { return d.num; });

    var ctx = canvas.getContext('2d');
    this._instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: '剩余电量',
          data: values,
          borderColor: 'oklch(55% 0.15 160)',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 6
        }]
      },
      options: this._lineChartOptions()
    });
  },

  // === Daily Usage Bar Chart ===
  // data: array of diffs with {endTime, consumption, isRecharge}
  renderUsageChart: function(canvasId, diffs, range) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    this.destroy(canvasId);
    if (!diffs || diffs.length === 0) return;

    var daily = this._aggregateDailyUsage(diffs);
    var filtered = this._filterDailyByRange(daily.labels, daily.values, range);
    if (filtered.labels.length === 0) return;

    var ctx = canvas.getContext('2d');
    this._instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: filtered.labels,
        datasets: [{
          label: '用电量',
          data: filtered.values,
          backgroundColor: 'oklch(55% 0.15 160)',
          borderRadius: 4
        }]
      },
      options: this._barChartOptions()
    });
  },

  // === Hourly Timeline Line Chart ===
  // hourlyData: array of {dateHour, hour, date, consumption, isAnomaly}
  renderHourlyChart: function(canvasId, hourlyData, range) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    this.destroy(canvasId);
    if (!hourlyData || hourlyData.length === 0) return;

    var filtered = this._filterHourlyByRange(hourlyData, range);
    if (filtered.length === 0) return;

    var labels = filtered.map(function(d) {
      var parts = d.date.split('-');
      var month = parts[1];
      var day = parts[2];
      var hour = String(d.hour).padStart(2, '0');
      return month + '-' + day + ' ' + hour + ':00';
    });
    var values = filtered.map(function(d) { return d.consumption; });
    var anomalyValues = filtered.map(function(d) {
      return d.isAnomaly ? d.consumption : null;
    });

    var ctx = canvas.getContext('2d');
    this._instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: '用电量',
            data: values,
            borderColor: 'oklch(55% 0.15 160)',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 6
          },
          {
            label: '异常',
            data: anomalyValues,
            borderColor: 'transparent',
            backgroundColor: '#ef4444',
            pointRadius: 5,
            pointBackgroundColor: '#ef4444',
            pointHoverRadius: 7,
            showLine: false
          }
        ]
      },
      options: this._lineChartOptions()
    });
  },

  // === 24h Distribution Bar Chart ===
  // hourlyAvg: [{hour, avg}], modeInfo: { peak: {hours, avg}, mid: {hours, avg}, low: {hours, avg} }
  renderDistributionChart: function(canvasId, hourlyAvg, modeInfo) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    this.destroy(canvasId);
    if (!hourlyAvg || hourlyAvg.length === 0) return;

    var labels = hourlyAvg.map(function(d) { return String(d.hour) + ':00'; });
    var values = hourlyAvg.map(function(d) { return d.avg; });

    // Determine bar colors based on modeInfo
    var peakHours = [];
    var lowHours = [];
    if (modeInfo) {
      peakHours = this._parseModeHours(modeInfo.peak ? modeInfo.peak.hours : '');
      lowHours = this._parseModeHours(modeInfo.low ? modeInfo.low.hours : '');
    }

    var backgroundColor = hourlyAvg.map(function(d) {
      if (peakHours.indexOf(d.hour) !== -1) {
        return '#ef4444'; // peak = red
      }
      if (lowHours.indexOf(d.hour) !== -1) {
        return '#10b981'; // low = green
      }
      return '#f59e0b'; // mid = yellow
    });

    var ctx = canvas.getContext('2d');
    this._instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: '平均用电量',
          data: values,
          backgroundColor: backgroundColor,
          borderRadius: 4
        }]
      },
      options: this._barChartOptions()
    });
  },

  // === Weekday vs Weekend Line Chart ===
  // weekday: [{hour, avg}], weekend: [{hour, avg}]  (both 24 entries)
  renderWeekdayWeekendChart: function(canvasId, weekdayData, weekendData) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    this.destroy(canvasId);
    if (!weekdayData || !weekendData || weekdayData.length === 0) return;

    var labels = weekdayData.map(function(d) { return String(d.hour) + ':00'; });
    var weekdayValues = weekdayData.map(function(d) { return d.avg; });
    var weekendValues = weekendData.map(function(d) { return d.avg; });

    var ctx = canvas.getContext('2d');
    this._instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: '工作日',
            data: weekdayValues,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 6
          },
          {
            label: '周末',
            data: weekendValues,
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              font: { family: 'system-ui', size: 12 },
              usePointStyle: true,
              padding: 16
            }
          },
          tooltip: {
            backgroundColor: '#1a1a1a',
            titleFont: { family: 'system-ui', size: 14, weight: '600' },
            bodyFont: { family: 'monospace', size: 13 },
            padding: 16,
            displayColors: true
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { family: 'monospace', size: 11 } } },
          y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { family: 'monospace', size: 11 } } }
        }
      }
    });
  },

  // === Period Distribution Doughnut Chart ===
  // periodData: [{label, hours, value, percentage}]
  renderPeriodChart: function(canvasId, periodData) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    this.destroy(canvasId);
    if (!periodData || periodData.length === 0) return;

    var labels = periodData.map(function(d) { return d.label; });
    var values = periodData.map(function(d) { return d.value; });

    var ctx = canvas.getContext('2d');
    this._instances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: ['#3b82f6', '#f59e0b', '#10b981', '#ef4444'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              font: { family: 'system-ui', size: 12 },
              padding: 12
            }
          }
        },
        cutout: '65%'
      }
    });
  },

  // === Trend Acceleration Line Chart ===
  // accelData: [{date, avg7}], isAccelerating: boolean
  renderAccelerationChart: function(canvasId, accelData, isAccelerating) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    this.destroy(canvasId);
    if (!accelData || accelData.length < 2) return;

    var labels = accelData.map(function(d) { return d.date; });
    var values = accelData.map(function(d) { return d.avg7; });

    var lineColor = isAccelerating ? '#ef4444' : '#10b981';
    var fillColor = isAccelerating ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)';

    var ctx = canvas.getContext('2d');
    this._instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: '7日平均用电量',
          data: values,
          borderColor: lineColor,
          backgroundColor: fillColor,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 6
        }]
      },
      options: this._lineChartOptions()
    });
  },

  // === Period Comparison (环比) Bar Chart ===
  // comparisonData: { todayVsYesterday: [{hour, today, yesterday}], thisWeekVsLastWeek: {thisWeek, lastWeek, change} }
  renderComparisonChart: function(canvasId, comparisonData) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    this.destroy(canvasId);
    if (!comparisonData || !comparisonData.todayVsYesterday || comparisonData.todayVsYesterday.length === 0) return;

    var hourlyData = comparisonData.todayVsYesterday;
    var labels = hourlyData.map(function(d) { return String(d.hour) + ':00'; });
    var todayValues = hourlyData.map(function(d) { return d.today; });
    var yesterdayValues = hourlyData.map(function(d) { return d.yesterday; });

    var ctx = canvas.getContext('2d');
    this._instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: '今日',
            data: todayValues,
            backgroundColor: '#3b82f6',
            borderRadius: 4
          },
          {
            label: '昨日',
            data: yesterdayValues,
            backgroundColor: 'rgba(59, 130, 246, 0.4)',
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              font: { family: 'system-ui', size: 12 },
              usePointStyle: true,
              padding: 16
            }
          },
          tooltip: {
            backgroundColor: '#1a1a1a',
            titleFont: { family: 'system-ui', size: 14, weight: '600' },
            bodyFont: { family: 'monospace', size: 13 },
            padding: 16,
            displayColors: true
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { family: 'monospace', size: 11 } } },
          y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { family: 'monospace', size: 11 } } }
        }
      }
    });
  }
};
