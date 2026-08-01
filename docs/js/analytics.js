var Analytics = {
  // === Helper: Convert UTC Date to Beijing time ===
  // Raw timestamps are Beijing time, stored as UTC by JS Date parsing.
  // Extract UTC components and create a local Date so getHours() etc. return the correct Beijing values.
  _toBeijingTime: function (date) {
    return new Date(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds()
    );
  },

  // === Helper: Get start of today (Beijing time, based on last data point) ===
  _getTodayStart: function (lastBj) {
    var start = new Date(lastBj);
    start.setHours(0, 0, 0, 0);
    return start;
  },

  // === Helper: Get start of this week Monday 00:00 Beijing time ===
  _getWeekStart: function (lastBj) {
    var dayOfWeek = lastBj.getDay();
    var daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    var start = new Date(lastBj);
    start.setDate(start.getDate() - daysSinceMonday);
    start.setHours(0, 0, 0, 0);
    return start;
  },

  // === Statistics ===
  // Input: data array (from DataService.processData), diffs array (from DataService.calcDiffs)
  // Returns: { current: number, today: number, week: number, daily: number, totalConsumption: number, days: number, max: number, min: number, range: number }
  computeStats: function (data, diffs) {
    if (!data || data.length === 0) {
      return { current: 0, today: 0, week: 0, daily: 0, totalConsumption: 0, days: 0, max: 0, min: 0, range: 0 };
    }
    var last = data[data.length - 1];
    var current = last.num;
    var lastBj = last.bj;
    var todayStart = this._getTodayStart(lastBj);
    var weekStart = this._getWeekStart(lastBj);

    var todaySum = 0;
    var weekSum = 0;
    var totalConsumption = 0;
    for (var i = 0; i < diffs.length; i++) {
      var d = diffs[i];
      if (d.isRecharge) continue;
      totalConsumption += d.consumption;
      var bjEnd = this._toBeijingTime(d.endTime);
      if (bjEnd >= todayStart) todaySum += d.consumption;
      if (bjEnd >= weekStart) weekSum += d.consumption;
    }

    // Count unique days from data
    var daySet = {};
    for (var i = 0; i < data.length; i++) {
      var bj = data[i].bj;
      var key = bj.getFullYear() + '-' + (bj.getMonth() + 1) + '-' + bj.getDate();
      daySet[key] = true;
    }
    var days = Object.keys(daySet).length;
    var daily = days > 0 ? totalConsumption / days : 0;

    var nums = data.map(function (d) { return d.num; });
    var max = Math.max.apply(null, nums);
    var min = Math.min.apply(null, nums);
    var range = max - min;

    return {
      current: current,
      today: todaySum,
      week: weekSum,
      daily: daily,
      totalConsumption: totalConsumption,
      days: days,
      max: max,
      min: min,
      range: range
    };
  },

  // === Prediction ===
  // Returns: { dateStr: string, dayStr: string, timeStr: string, remainingDays: number, dailyAvg: number } or null
  computePrediction: function (data, diffs) {
    if (!data || data.length === 0 || !diffs || diffs.length === 0) return null;
    var last = data[data.length - 1];
    var current = last.num;
    var lastBj = last.bj;

    // Get last 7 days of non-recharge diffs
    var sevenDaysAgo = new Date(lastBj.getTime() - 7 * 86400000);
    var dailyMap = {};
    for (var i = 0; i < diffs.length; i++) {
      var d = diffs[i];
      if (d.isRecharge) continue;
      var bjEnd = this._toBeijingTime(d.endTime);
      if (bjEnd >= sevenDaysAgo && bjEnd <= lastBj) {
        var key = bjEnd.getFullYear() + '-' + (bjEnd.getMonth() + 1) + '-' + bjEnd.getDate();
        if (!dailyMap[key]) dailyMap[key] = 0;
        dailyMap[key] += d.consumption;
      }
    }

    var dailyTotals = [];
    for (var k in dailyMap) {
      if (dailyMap.hasOwnProperty(k)) dailyTotals.push(dailyMap[k]);
    }
    if (dailyTotals.length === 0) return null;

    var sum = 0;
    for (var i = 0; i < dailyTotals.length; i++) sum += dailyTotals[i];
    var dailyAvg = sum / dailyTotals.length;

    if (dailyAvg <= 0) return null;

    var remainingDays = current / dailyAvg;
    var predictedEnd = new Date(lastBj.getTime() + remainingDays * 86400000);

    var dateStr = predictedEnd.getFullYear() + '年' + (predictedEnd.getMonth() + 1) + '月' + predictedEnd.getDate() + '日';
    var dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    var dayStr = dayNames[predictedEnd.getDay()];
    var timeStr = String(predictedEnd.getHours()).padStart(2, '0') + ':' + String(predictedEnd.getMinutes()).padStart(2, '0');

    return {
      dateStr: dateStr,
      dayStr: dayStr,
      timeStr: timeStr,
      remainingDays: remainingDays,
      dailyAvg: dailyAvg
    };
  },

  // === Peak Analysis ===
  // Returns: { hourlyAvg: [{hour: number, avg: number}], peakHour: {hour, avg}, weeklyAvg: [{day: number, name: string, avg: number}], peakDay: {day, name, avg} }
  computePeak: function (diffs) {
    if (!diffs || diffs.length === 0) {
      return { hourlyAvg: [], peakHour: null, weeklyAvg: [], peakDay: null };
    }

    var hourlyMap = {};
    var hourlyCount = {};
    var weeklyMap = {};
    var weeklyCount = {};
    var dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

    for (var i = 0; i < diffs.length; i++) {
      var d = diffs[i];
      if (d.isRecharge) continue;
      var bjEnd = this._toBeijingTime(d.endTime);
      var hour = bjEnd.getHours();
      var day = bjEnd.getDay();

      if (!hourlyMap[hour]) { hourlyMap[hour] = 0; hourlyCount[hour] = 0; }
      hourlyMap[hour] += d.consumption;
      hourlyCount[hour]++;

      if (!weeklyMap[day]) { weeklyMap[day] = 0; weeklyCount[day] = 0; }
      weeklyMap[day] += d.consumption;
      weeklyCount[day]++;
    }

    var hourlyAvg = [];
    for (var h = 0; h < 24; h++) {
      if (hourlyMap[h] !== undefined) {
        hourlyAvg.push({ hour: h, avg: hourlyMap[h] / hourlyCount[h] });
      }
    }
    hourlyAvg.sort(function (a, b) { return a.hour - b.hour; });

    var peakHour = null;
    if (hourlyAvg.length > 0) {
      peakHour = hourlyAvg.reduce(function (max, curr) { return curr.avg > max.avg ? curr : max; });
    }

    var weeklyAvg = [];
    for (var day = 0; day < 7; day++) {
      if (weeklyMap[day] !== undefined) {
        weeklyAvg.push({ day: day, name: dayNames[day], avg: weeklyMap[day] / weeklyCount[day] });
      }
    }
    weeklyAvg.sort(function (a, b) { return a.day - b.day; });

    var peakDay = null;
    if (weeklyAvg.length > 0) {
      peakDay = weeklyAvg.reduce(function (max, curr) { return curr.avg > max.avg ? curr : max; });
    }

    return { hourlyAvg: hourlyAvg, peakHour: peakHour, weeklyAvg: weeklyAvg, peakDay: peakDay };
  },

  // === Hourly Timeline ===
  // Input: hourly data from DataService.toHourly()
  // Returns: [{dateHour: string, hour: number, date: string, consumption: number}] sorted by time, filtered by range
  getHourlyTimeline: function (hourlyData, range) {
    if (!hourlyData || hourlyData.length === 0) return [];
    var data = hourlyData.slice().sort(function (a, b) { return a.dateHour.localeCompare(b.dateHour); });
    if (range === 'all' || range === undefined || range === null) return data;

    // Handle hours-based ranges like '24h', '48h'
    if (typeof range === 'string' && /^\d+h$/.test(range)) {
      var hours = parseInt(range, 10);
      var cutoff = new Date(Date.now() - hours * 3600000);
      var cutoffStr = cutoff.getFullYear() + '-' + String(cutoff.getMonth() + 1).padStart(2, '0') + '-' + String(cutoff.getDate()).padStart(2, '0');
      return data.filter(function (d) { return d.date >= cutoffStr; });
    }

    // Days-based ranges (numeric string or number)
    var days = typeof range === 'string' ? parseInt(range, 10) : range;
    var now = new Date();
    var cutoff = new Date(now.getTime() - days * 86400000);
    var cutoffStr = cutoff.getFullYear() + '-' + String(cutoff.getMonth() + 1).padStart(2, '0') + '-' + String(cutoff.getDate()).padStart(2, '0');
    return data.filter(function (d) { return d.date >= cutoffStr; });
  },

  // === Anomaly Detection ===
  // Input: hourly data array, returns same array with isAnomaly flags set
  // Uses 30-day sliding window, marks if value > mean + 2*stddev
  detectAnomalies: function (hourlyData) {
    if (!hourlyData || hourlyData.length === 0) return [];

    // Group by hour of day (0-23)
    var hourGroups = {};
    for (var i = 0; i < hourlyData.length; i++) {
      var h = hourlyData[i].hour;
      if (!hourGroups[h]) hourGroups[h] = [];
      hourGroups[h].push(hourlyData[i]);
    }

    // For each data point, compute baseline from last 30 days of same hour
    var now = new Date();
    var thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

    return hourlyData.map(function (item) {
      var sameHour = hourGroups[item.hour] || [];
      var recent = sameHour.filter(function (x) {
        var parts = x.dateHour.split('-');
        var d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return d >= thirtyDaysAgo && d <= now;
      });

      if (recent.length < 3) {
        return { hour: item.hour, date: item.date, consumption: item.consumption, dateHour: item.dateHour, isAnomaly: false };
      }

      var values = recent.map(function (x) { return x.consumption; });
      var sum = 0;
      for (var i = 0; i < values.length; i++) sum += values[i];
      var mean = sum / values.length;
      var variance = 0;
      for (var i = 0; i < values.length; i++) variance += (values[i] - mean) * (values[i] - mean);
      variance /= values.length;
      var std = Math.sqrt(variance);

      var isAnomaly = item.consumption > mean + 2 * std;
      return { hour: item.hour, date: item.date, consumption: item.consumption, dateHour: item.dateHour, isAnomaly: isAnomaly };
    });
  },

  // === Mode Recognition (高峰/平峰/低谷) ===
  // Input: hourlyAvg array from computePeak
  // Returns: { peak: {hours: string, avg: number}, mid: {hours: string, avg: number}, low: {hours: string, avg: number} }
  // top 25% = peak, bottom 25% = low, rest = mid
  recognizeMode: function (hourlyAvg) {
    if (!hourlyAvg || hourlyAvg.length === 0) {
      return { peak: { hours: '', avg: 0 }, mid: { hours: '', avg: 0 }, low: { hours: '', avg: 0 } };
    }

    var sorted = hourlyAvg.slice().sort(function (a, b) { return b.avg - a.avg; });
    var len = sorted.length;
    var peakCount = Math.max(1, Math.round(len * 0.25));
    var lowCount = Math.max(1, Math.round(len * 0.25));

    var peakItems = sorted.slice(0, peakCount);
    var lowItems = sorted.slice(len - lowCount);
    var midItems = sorted.slice(peakCount, len - lowCount);

    function mergeHours(items) {
      if (items.length === 0) return { hours: '', avg: 0 };
      var hours = items.map(function (x) { return x.hour; }).sort(function (a, b) { return a - b; });
      var ranges = [];
      var start = hours[0];
      var end = hours[0];
      for (var i = 1; i < hours.length; i++) {
        if (hours[i] === end + 1) {
          end = hours[i];
        } else {
          ranges.push(start === end ? String(start) + '时' : String(start) + '-' + String(end) + '时');
          start = hours[i];
          end = hours[i];
        }
      }
      ranges.push(start === end ? String(start) + '时' : String(start) + '-' + String(end) + '时');
      var total = 0;
      for (var i = 0; i < items.length; i++) total += items[i].avg;
      var avg = total / items.length;
      return { hours: ranges.join(', '), avg: avg };
    }

    return {
      peak: mergeHours(peakItems),
      mid: mergeHours(midItems),
      low: mergeHours(lowItems)
    };
  },

  // === Consumption Speed ===
  // Returns: { currentSpeed: number, historicalSpeed: number, trend: 'up'|'down'|'flat' }
  // currentSpeed = last 24h consumption / hours elapsed
  // historicalSpeed = same weekday 7 days ago consumption / hours
  computeSpeed: function (diffs, data) {
    if (!diffs || diffs.length === 0 || !data || data.length === 0) {
      return { currentSpeed: 0, historicalSpeed: 0, trend: 'flat' };
    }

    var lastBj = data[data.length - 1].bj;

    // Last 24h consumption
    var twentyFourHoursAgo = new Date(lastBj.getTime() - 24 * 3600000);
    var last24hConsumption = 0;
    for (var i = 0; i < diffs.length; i++) {
      var d = diffs[i];
      if (d.isRecharge) continue;
      var bjEnd = this._toBeijingTime(d.endTime);
      if (bjEnd >= twentyFourHoursAgo && bjEnd <= lastBj) {
        last24hConsumption += d.consumption;
      }
    }
    var currentSpeed = last24hConsumption / 24;

    // Same weekday 7 days ago
    var sevenDaysAgo = new Date(lastBj.getTime() - 7 * 86400000);
    var sevenDaysAgoEnd = new Date(sevenDaysAgo.getTime() + 24 * 3600000);
    var historicalConsumption = 0;
    for (var i = 0; i < diffs.length; i++) {
      var d = diffs[i];
      if (d.isRecharge) continue;
      var bjEnd = this._toBeijingTime(d.endTime);
      if (bjEnd >= sevenDaysAgo && bjEnd < sevenDaysAgoEnd) {
        historicalConsumption += d.consumption;
      }
    }
    var historicalSpeed = historicalConsumption / 24;

    var trend = 'flat';
    if (currentSpeed > historicalSpeed * 1.05) trend = 'up';
    else if (currentSpeed < historicalSpeed * 0.95) trend = 'down';

    return { currentSpeed: currentSpeed, historicalSpeed: historicalSpeed, trend: trend };
  },

  // === Weekday vs Weekend ===
  // Returns: { weekday: [24 entries of {hour, avg}], weekend: [24 entries of {hour, avg}] }
  // Group hourlyData by weekday (Mon-Fri) vs weekend (Sat-Sun), compute avg per hour
  compareWeekdayWeekend: function (hourlyData) {
    if (!hourlyData || hourlyData.length === 0) {
      return { weekday: [], weekend: [] };
    }

    var weekdayMap = {};
    var weekdayCount = {};
    var weekendMap = {};
    var weekendCount = {};

    for (var i = 0; i < hourlyData.length; i++) {
      var item = hourlyData[i];
      var hour = item.hour;
      var parts = item.date.split('-');
      var d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      var day = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

      var isWeekday = day >= 1 && day <= 5;
      var map = isWeekday ? weekdayMap : weekendMap;
      var count = isWeekday ? weekdayCount : weekendCount;

      if (!map[hour]) { map[hour] = 0; count[hour] = 0; }
      map[hour] += item.consumption;
      count[hour]++;
    }

    var weekday = [];
    var weekend = [];
    for (var h = 0; h < 24; h++) {
      weekday.push({ hour: h, avg: weekdayMap[h] !== undefined ? weekdayMap[h] / weekdayCount[h] : 0 });
      weekend.push({ hour: h, avg: weekendMap[h] !== undefined ? weekendMap[h] / weekendCount[h] : 0 });
    }

    return { weekday: weekday, weekend: weekend };
  },

  // === Time Period Distribution ===
  // Returns: [{label: string, hours: string, value: number, percentage: number}]
  // Periods: 凌晨(0-6), 上午(6-12), 下午(12-18), 晚间(18-24)
  periodDistribution: function (hourlyData) {
    if (!hourlyData || hourlyData.length === 0) return [];

    var periods = [
      { label: '凌晨', hours: '0-6时', range: [0, 6], value: 0 },
      { label: '上午', hours: '6-12时', range: [6, 12], value: 0 },
      { label: '下午', hours: '12-18时', range: [12, 18], value: 0 },
      { label: '晚间', hours: '18-24时', range: [18, 24], value: 0 }
    ];

    var total = 0;
    for (var i = 0; i < hourlyData.length; i++) {
      var item = hourlyData[i];
      var hour = item.hour;
      for (var j = 0; j < periods.length; j++) {
        if (hour >= periods[j].range[0] && hour < periods[j].range[1]) {
          periods[j].value += item.consumption;
          break;
        }
      }
      total += item.consumption;
    }

    return periods.map(function (p) {
      return {
        label: p.label,
        hours: p.hours,
        value: p.value,
        percentage: total > 0 ? p.value / total * 100 : 0
      };
    });
  },

  // === Trend Acceleration ===
  // Returns: { slope: number, isAccelerating: boolean, data: [{date: string, avg: number}] }
  // Uses individual consumption records with a sliding window for trend detection
  trendAcceleration: function (diffs) {
    if (!diffs || diffs.length === 0) {
      return { slope: 0, isAccelerating: false, data: [] };
    }

    // Filter out recharges and sort by time
    var valid = [];
    for (var i = 0; i < diffs.length; i++) {
      if (!diffs[i].isRecharge) {
        valid.push(diffs[i]);
      }
    }
    valid.sort(function (a, b) { return a.endTime - b.endTime; });

    if (valid.length < 3) {
      return { slope: 0, isAccelerating: false, data: [] };
    }

    // Use consumption values directly, compute sliding average
    var windowSize = Math.min(3, valid.length);
    var slidingAvg = [];
    for (var i = windowSize - 1; i < valid.length; i++) {
      var sum = 0;
      for (var j = i - windowSize + 1; j <= i; j++) {
        sum += valid[j].consumption;
      }
      var bj = this._toBeijingTime(valid[i].endTime);
      var dateStr = bj.getFullYear() + '-' + String(bj.getMonth() + 1).padStart(2, '0') + '-' + String(bj.getDate()).padStart(2, '0');
      var timeStr = String(bj.getHours()).padStart(2, '0') + ':' + String(bj.getMinutes()).padStart(2, '0');
      slidingAvg.push({ date: dateStr + ' ' + timeStr, avg: sum / windowSize });
    }

    if (slidingAvg.length < 2) {
      return { slope: 0, isAccelerating: false, data: slidingAvg };
    }

    // Compute slope of all points using linear regression
    var n = slidingAvg.length;
    var xSum = 0, ySum = 0, xySum = 0, x2Sum = 0;
    for (var i = 0; i < n; i++) {
      xSum += i;
      ySum += slidingAvg[i].avg;
      xySum += i * slidingAvg[i].avg;
      x2Sum += i * i;
    }
    var slope = (n * xySum - xSum * ySum) / (n * x2Sum - xSum * xSum);

    return { slope: slope, isAccelerating: slope > 0, data: slidingAvg };
  },

  // === Period Comparison (环比) ===
  // Returns: { todayVsYesterday: [{hour: number, today: number, yesterday: number}], thisWeekVsLastWeek: {thisWeek: number, lastWeek: number, change: number} }
  periodComparison: function (diffs, data) {
    if (!diffs || diffs.length === 0 || !data || data.length === 0) {
      return {
        todayVsYesterday: [],
        thisWeekVsLastWeek: { thisWeek: 0, lastWeek: 0, change: 0 }
      };
    }

    var lastBj = data[data.length - 1].bj;

    // Today and yesterday boundaries
    var todayStart = this._getTodayStart(lastBj);
    var yesterdayStart = new Date(todayStart.getTime() - 86400000);
    var yesterdayEnd = new Date(todayStart);

    var todayHourly = {};
    var yesterdayHourly = {};
    for (var i = 0; i < diffs.length; i++) {
      var d = diffs[i];
      if (d.isRecharge) continue;
      var bjEnd = this._toBeijingTime(d.endTime);
      var hour = bjEnd.getHours();

      if (bjEnd >= todayStart) {
        if (!todayHourly[hour]) todayHourly[hour] = 0;
        todayHourly[hour] += d.consumption;
      } else if (bjEnd >= yesterdayStart && bjEnd < yesterdayEnd) {
        if (!yesterdayHourly[hour]) yesterdayHourly[hour] = 0;
        yesterdayHourly[hour] += d.consumption;
      }
    }

    var todayVsYesterday = [];
    for (var h = 0; h < 24; h++) {
      todayVsYesterday.push({
        hour: h,
        today: todayHourly[h] || 0,
        yesterday: yesterdayHourly[h] || 0
      });
    }

    // This week vs last week
    var dayOfWeek = lastBj.getDay();
    var daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    var thisWeekStart = new Date(lastBj);
    thisWeekStart.setDate(thisWeekStart.getDate() - daysSinceMonday);
    thisWeekStart.setHours(0, 0, 0, 0);
    var lastWeekStart = new Date(thisWeekStart.getTime() - 7 * 86400000);
    var lastWeekEnd = new Date(thisWeekStart);

    var thisWeekSum = 0;
    var lastWeekSum = 0;
    for (var i = 0; i < diffs.length; i++) {
      var d = diffs[i];
      if (d.isRecharge) continue;
      var bjEnd = this._toBeijingTime(d.endTime);

      if (bjEnd >= thisWeekStart) {
        thisWeekSum += d.consumption;
      } else if (bjEnd >= lastWeekStart && bjEnd < lastWeekEnd) {
        lastWeekSum += d.consumption;
      }
    }

    var change = lastWeekSum > 0 ? (thisWeekSum - lastWeekSum) / lastWeekSum * 100 : 0;

    return {
      todayVsYesterday: todayVsYesterday,
      thisWeekVsLastWeek: { thisWeek: thisWeekSum, lastWeek: lastWeekSum, change: change }
    };
  },

  // === Warning Level ===
  // Returns: 'normal'|'caution'|'warning'|'emergency'
  // > 50 → normal; >= 20 → caution; >= 10 → warning; else → emergency
  getWarningLevel: function (currentBalance) {
    if (currentBalance > 50) return 'normal';
    if (currentBalance >= 20) return 'caution';
    if (currentBalance >= 10) return 'warning';
    return 'emergency';
  },

  // === Energy Analogies ===
  ENERGY_ANALOGIES: [
    { icon: '💧', factor: 10, unit: '升', label: '可烧开水', range: [0, 1], desc: '相当于用电热水壶烧开这些水' },
    { icon: '💡', factor: 100, unit: '小时', label: 'LED灯照明', range: [0.5, 3], desc: '可点亮10W LED灯持续照明' },
    { icon: '📱', factor: 67, unit: '次', label: '手机充满电', range: [1, 5], desc: '可为智能手机完整充电' },
    { icon: '💻', factor: 20, unit: '小时', label: '笔记本工作', range: [2, 8], desc: '可供笔记本电脑持续工作' },
    { icon: '❄️', factor: 1, unit: '小时', label: '空调制冷', range: [5, 15], desc: '可供1.5匹空调运行' },
    { icon: '🧺', factor: 2, unit: '次', label: '洗衣机洗衣', range: [3, 10], desc: '可用洗衣机洗衣服' },
    { icon: '🚲', factor: 50, unit: '公里', label: '电动车骑行', range: [1, 20], desc: '可骑行电动自行车行驶' },
    { icon: '🪵', factor: 0.22, unit: 'kg', label: '木材燃烧', range: [0, Infinity], desc: '相当于燃烧木材释放的能量' }
  ],

  // selectBestAnalogy(kwh): iterate in order, return first match (kwh >= range[0] && kwh < range[1])
  // Returns: { icon, factor, unit, label, desc, value: kwh * factor, range }
  selectBestAnalogy: function (kwh) {
    for (var i = 0; i < this.ENERGY_ANALOGIES.length; i++) {
      var a = this.ENERGY_ANALOGIES[i];
      if (kwh >= a.range[0] && kwh < a.range[1]) {
        return {
          icon: a.icon,
          factor: a.factor,
          unit: a.unit,
          label: a.label,
          desc: a.desc,
          value: kwh * a.factor,
          range: a.range
        };
      }
    }
    // Fallback to last analogy (木材燃烧)
    var last = this.ENERGY_ANALOGIES[this.ENERGY_ANALOGIES.length - 1];
    return {
      icon: last.icon,
      factor: last.factor,
      unit: last.unit,
      label: last.label,
      desc: last.desc,
      value: kwh * last.factor,
      range: last.range
    };
  },

  // generateAnalogyText(kwh): returns string like "💡 250.0 小时 · LED灯照明"
  generateAnalogyText: function (kwh) {
    var analogy = this.selectBestAnalogy(kwh);
    var value = (analogy.value % 1 === 0) ? analogy.value : analogy.value.toFixed(1);
    return analogy.icon + ' ' + value + ' ' + analogy.unit + ' · ' + analogy.label;
  },

  // === Recharge suggestions ===
  // Returns: [{amount: 30, days: number}, {amount: 50, days: number}, {amount: 100, days: number}, {amount: 200, days: number}]
  // days = Math.floor(amount / avgDaily)
  getRechargeOptions: function (avgDaily) {
    if (avgDaily <= 0) avgDaily = 1;
    var amounts = [30, 50, 100, 200];
    return amounts.map(function (amount) {
      return { amount: amount, days: Math.floor(amount / avgDaily) };
    });
  }
};