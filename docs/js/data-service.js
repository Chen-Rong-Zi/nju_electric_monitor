const DATA_URL = 'data/electricity_data.json';

const DataService = {
  _cache: null,
  _cacheKey: null,

  // Fetch and parse JSONL data
  // Returns array of { time: Date, bj: Date, num: number, unit: string }
  async fetchData() {
    var cacheKey = DATA_URL + '_v1';
    var cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        var parsed = JSON.parse(cached, function (key, value) {
          if (key === 'time' || key === 'bj') return new Date(value);
          return value;
        });
        this._cache = parsed;
        this._cacheKey = cacheKey;
        return parsed;
      } catch (e) {
        // cache parse failed, continue to fetch
      }
    }

    var response = await fetch(DATA_URL);
    var text = await response.text();
    var lines = text.split('\n').filter(function (line) { return line.trim() !== ''; });
    var raw = lines.map(function (line) { return JSON.parse(line); });
    var data = this.processData(raw);

    try {
      sessionStorage.setItem(cacheKey, JSON.stringify(data));
    } catch (e) {
      // sessionStorage full or unavailable, ignore
    }
    this._cache = data;
    this._cacheKey = cacheKey;
    return data;
  },

  // Process raw lines: parse JSON, convert timezone, sort
  // Returns array of { time: Date, bj: Date, num: number, unit: string }
  processData: function (raw) {
    return raw
      .map(function (d) {
        // Parse timestamp as Beijing time via Date.UTC() for consistent behavior across browser timezones
        // "2026-08-01T22:39:44.028312" → getUTCHours() = 22 (Beijing hour) in ALL browsers
        var match = d.timestamp.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
        var time;
        if (match) {
          time = new Date(Date.UTC(
            parseInt(match[1], 10),
            parseInt(match[2], 10) - 1,
            parseInt(match[3], 10),
            parseInt(match[4], 10),
            parseInt(match[5], 10),
            parseInt(match[6], 10)
          ));
        } else {
          time = new Date(d.timestamp);
        }
        if (isNaN(time.getTime())) return null;
        return {
          time: time,
          bj: DataService.toBeijingTime(time),
          num: parseFloat(d.remaining_electricity),
          unit: d.unit || '度'
        };
      })
      .filter(function (d) { return d !== null && !isNaN(d.num); })
      .sort(function (a, b) { return a.time - b.time; });
  },

  // Compute diffs between consecutive records
  // Returns array of { startTime, endTime, consumption, startNum, endNum, isRecharge }
  calcDiffs: function (data) {
    var diffs = [];
    for (var i = 1; i < data.length; i++) {
      var consumption = data[i - 1].num - data[i].num;
      diffs.push({
        startTime: data[i - 1].time,
        endTime: data[i].time,
        consumption: consumption,
        startNum: data[i - 1].num,
        endNum: data[i].num,
        isRecharge: consumption < 0
      });
    }
    return diffs;
  },

  // Assign each diff to its end time's hour
  // Returns array of { hour, date, consumption, dateHour: string (YYYY-MM-DD-HH), isAnomaly: boolean }
  toHourly: function (diffs, data) {
    var hourlyMap = {};

    for (var i = 0; i < diffs.length; i++) {
      var diff = diffs[i];
      var bj = DataService.toBeijingTime(diff.endTime);
      var year = bj.getFullYear();
      var month = String(bj.getMonth() + 1).padStart(2, '0');
      var day = String(bj.getDate()).padStart(2, '0');
      var hour = bj.getHours();
      var dateStr = year + '-' + month + '-' + day;
      var dateHour = dateStr + '-' + String(hour).padStart(2, '0');

      if (!hourlyMap[dateHour]) {
        hourlyMap[dateHour] = {
          hour: hour,
          date: dateStr,
          consumption: 0,
          dateHour: dateHour,
          isAnomaly: false
        };
      }
      hourlyMap[dateHour].consumption += diff.consumption;
    }

    return Object.keys(hourlyMap).sort().map(function (key) { return hourlyMap[key]; });
  },

  // Filter data by range in days
  filterByRange: function (data, range) {
    if (range === 'all') return data;
    var now = Date.now();
    var cutoff = new Date(now - range * 86400000);
    return data.filter(function (d) { return d.bj >= cutoff; });
  },

  // Convert UTC Date to Beijing time
  // Raw timestamps are Beijing time, stored as UTC by JS Date parsing.
  // Extract UTC components and create a local Date so getHours() returns the correct Beijing hour.
  toBeijingTime: function (date) {
    return new Date(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds()
    );
  }
};