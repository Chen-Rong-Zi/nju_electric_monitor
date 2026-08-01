# 数据清理与 GitHub Pages 部署 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 清除原所有者的历史数据，将现有 Flask 面板转换为纯静态 HTML 页面并通过 GitHub Pages 部署

**Architecture:**
- 数据清理：清空 `data/` 下的 CSV/JSON 数据和 PNG 图片，删除 `logs/` 目录所有日志文件
- 静态页面：创建 `docs/index.html` 单文件，通过 Plotly.js CDN 渲染图表，JavaScript 从 `raw.githubusercontent.com` 实时拉取 JSON 数据
- 保持 `src/web_panel.py` 不变，本地 Flask 版仍可独立使用

**Tech Stack:** HTML5, CSS3, JavaScript (ES6+), Plotly.js (CDN)

---

### Task 1: 清理历史数据文件

**Files:**
- Modify: `data/electricity_data.csv`
- Modify: `data/electricity_data.json`
- Delete: `data/electricity_trend.png`
- Delete: `data/recent_20_changes.png`
- Delete: `data/captcha_debug.png`
- Delete: `data/slider_temp_canvas.png`

- [ ] **Step 1: 清空 CSV 文件，保留表头**

```bash
# 覆盖 CSV 文件，只保留表头
echo "time,num,unit" > data/electricity_data.csv
```

- [ ] **Step 2: 清空 JSON 文件，写入空数组**

```bash
# 覆盖 JSON 文件，写入空数组
echo "[]" > data/electricity_data.json
```

- [ ] **Step 3: 删除所有 PNG 图片文件**

```bash
rm -f data/electricity_trend.png data/recent_20_changes.png data/captcha_debug.png data/slider_temp_canvas.png
```

- [ ] **Step 4: 验证清理结果**

```bash
# 验证 CSV 内容
echo "CSV 内容:"
cat data/electricity_data.csv
# 应输出: time,num,unit

echo ""
echo "JSON 内容:"
cat data/electricity_data.json
# 应输出: []

echo ""
echo "PNG 文件列表:"
ls data/*.png 2>&1 || echo "无 PNG 文件"
# 应输出: 无 PNG 文件
```

- [ ] **Step 5: 提交数据清理**

```bash
git add -A data/
git commit -m "chore: 清除原所有者的历史电费数据
- 清空 electricity_data.csv（保留表头）
- 清空 electricity_data.json（空数组）
- 删除所有历史 PNG 图表

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: 清理日志目录

**Files:**
- Delete: `logs/` 目录下的所有文件（1523 个日志文件）

- [ ] **Step 1: 删除日志目录中的所有文件**

```bash
# 删除 logs 目录下所有文件，但保留目录本身
rm -f logs/*
```

- [ ] **Step 2: 验证日志清理**

```bash
echo "日志文件数量:"
ls logs/ | wc -l
# 应输出: 0
```

- [ ] **Step 3: 提交日志清理**

```bash
# 先删除 logs 目录，让 git 记录删除
rm -rf logs/
mkdir logs
# 创建一个 .gitkeep 以保留空目录
touch logs/.gitkeep

git add -A logs/
git commit -m "chore: 清除原所有者的历史运行日志（1523 个文件）

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: 创建静态 GitHub Pages 网页面板

**Files:**
- Create: `docs/index.html`

**文件职责：** 单文件静态页面，包含所有 HTML/CSS/JS，通过 Plotly.js CDN 渲染电费数据图表

- [ ] **Step 1: 创建 `docs/index.html`**

```html
<!DOCTYPE html>
<html lang="zh-cn">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>南京大学电费监控面板</title>
    <!-- 使用 Plotly.js CDN -->
    <script src="https://cdn.plot.ly/plotly-2.32.0.min.js"></script>
    <style>
        /* 科技感深色主题，与现有 Flask 版一致 */
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Segoe UI', 'Microsoft YaHei', '微软雅黑', Arial, sans-serif;
            background: linear-gradient(120deg, #0f2027, #2c5364 80%);
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 950px;
            margin: 0 auto;
            background: rgba(20, 30, 48, 0.95);
            border-radius: 18px;
            box-shadow: 0 6px 32px rgba(0, 255, 255, 0.2);
            padding: 38px 44px;
        }
        h1 {
            text-align: center;
            color: #00eaff;
            margin-bottom: 12px;
            letter-spacing: 2px;
            text-shadow: 0 2px 8px rgba(0, 255, 255, 0.27);
        }
        .desc {
            text-align: center;
            color: #b2e6ff;
            margin-bottom: 32px;
            font-size: 1.1em;
        }
        .chart-block {
            text-align: center;
            margin: 36px 0 10px 0;
        }
        .chart-block .plotly-chart {
            border-radius: 12px;
            box-shadow: 0 2px 18px rgba(0, 234, 255, 0.2);
            background: #fff;
        }
        .reload-btn {
            display: inline-block;
            margin: 0 0 18px 0;
            padding: 8px 22px;
            font-size: 1em;
            color: #00eaff;
            background: linear-gradient(90deg, #232526 0%, #1de9b6 100%);
            border: none;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0, 234, 255, 0.2);
            cursor: pointer;
            transition: background 0.2s, color 0.2s;
        }
        .reload-btn:hover {
            background: linear-gradient(90deg, #1de9b6 0%, #00eaff 100%);
            color: #232526;
        }
        table {
            border-collapse: collapse;
            width: 100%;
            margin: 36px 0 0 0;
            background: rgba(10, 20, 40, 0.95);
            border-radius: 10px;
            overflow: hidden;
        }
        th, td {
            border: 1px solid #1de9b6;
            padding: 12px 18px;
            text-align: center;
            color: #fff;
        }
        th {
            background: linear-gradient(90deg, #00eaff 60%, #1de9b6 100%);
            color: #fff;
            font-weight: bold;
            letter-spacing: 1px;
        }
        caption {
            font-size: 1.25em;
            margin-bottom: 12px;
            font-weight: bold;
            color: #00eaff;
        }
        tr:nth-child(even) { background: rgba(0, 234, 255, 0.07); }
        tr:nth-child(odd) { background: rgba(29, 233, 182, 0.07); }
        .highlight-row {
            font-weight: bold;
            background-color: rgba(255, 69, 0, 0.3) !important;
            border: 2px solid #ff4500;
        }
        .faint-text {
            color: rgba(255, 255, 255, 0.4);
            font-size: 0.9em;
        }
        .hidden-rows { display: none; }
        .show-more-btn {
            cursor: pointer;
            color: #00eaff;
            text-decoration: underline;
            display: inline-block;
            margin-top: 10px;
        }
        .loading {
            text-align: center;
            color: #b2e6ff;
            padding: 60px 0;
            font-size: 1.2em;
        }
        .error-msg {
            text-align: center;
            color: #ff6b6b;
            padding: 60px 0;
            font-size: 1.1em;
        }
        .last-update {
            text-align: center;
            color: #6c8a9a;
            font-size: 0.85em;
            margin-top: 8px;
        }
        @media (max-width: 800px) {
            .container { padding: 12px 10px; }
            table, th, td { font-size: 13px; padding: 8px 6px; }
            th, td { padding: 8px 6px; }
            h1 { font-size: 1.4em; }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>⚡ 南京大学电费监控面板</h1>
        <div class="desc">展示最近电费数据及变化趋势</div>

        <div style="text-align:center;">
            <button class="reload-btn" onclick="location.reload()">🔄 刷新</button>
        </div>

        <div id="chart-20" class="chart-block"></div>
        <div id="chart-all" class="chart-block"></div>

        <div id="data-table-container">
            <div class="loading" id="loading-text">⏳ 正在加载数据...</div>
        </div>

        <div class="last-update" id="last-update"></div>
    </div>

    <script>
        const DATA_URL = 'https://raw.githubusercontent.com/Chen-Rong-Zi/nju_electric_monitor/main/data/electricity_data.json';

        async function fetchData() {
            const resp = await fetch(DATA_URL);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
            const text = await resp.text();
            // 处理 JSON Lines 格式（每行一个 JSON 对象）
            const lines = text.trim().split('\n').filter(l => l.trim().startsWith('{'));
            if (lines.length === 0) return [];
            return lines.map(l => JSON.parse(l));
        }

        function processData(raw) {
            return raw.map(d => ({
                time: new Date(d.timestamp || d.time),
                num: parseFloat(d.remaining_electricity || d.num),
                unit: d.unit || '度'
            })).filter(d => !isNaN(d.num) && !isNaN(d.time.getTime()))
              .sort((a, b) => a.time - b.time);
        }

        function renderChart20(data) {
            const recent = data.slice(-20);
            if (recent.length === 0) return;

            const trace = {
                x: recent.map(d => d.time),
                y: recent.map(d => d.num),
                mode: 'lines+markers',
                marker: { color: '#ff4500', size: 9, line: { width: 2, color: '#ff6347' } },
                line: { width: 3, color: '#ff6347' },
                hovertemplate: '时间: %{x|%Y-%m-%d %H:%M:%S}<br>剩余电量: %{y} 度<extra></extra>',
                name: '最近20次电量变化'
            };

            const layout = {
                title: { text: '最近20次电量变化曲线', x: 0.5, font: { family: 'Segoe UI,微软雅黑', size: 20, color: '#ff4500' } },
                xaxis: { title: '时间', tickformat: '%Y-%m-%d %H:%M', tickangle: 30, showgrid: true, gridcolor: 'rgba(255,69,0,0.15)', griddash: 'dash', color: '#ff6347', tickfont: { color: '#ff6347' } },
                yaxis: { title: '剩余电量 (度)', showgrid: true, gridcolor: 'rgba(255,69,0,0.15)', griddash: 'dash', color: '#ff6347', tickfont: { color: '#ff6347' } },
                hovermode: 'x unified',
                plot_bgcolor: 'rgba(10,20,40,0.95)',
                paper_bgcolor: 'rgba(20,30,48,0.95)',
                margin: { l: 60, r: 30, t: 60, b: 60 },
                font: { family: 'Segoe UI,微软雅黑', size: 14, color: '#ff6347' }
            };

            Plotly.newPlot('chart-20', [trace], layout, {
                displayModeBar: true,
                scrollZoom: true,
                displaylogo: false,
                modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d', 'resetScale2d', 'toggleSpikelines']
            });
        }

        function renderChartAll(data) {
            if (data.length === 0) return;

            const trace = {
                x: data.map(d => d.time),
                y: data.map(d => d.num),
                mode: 'lines+markers',
                marker: { color: '#00eaff', size: 9, line: { width: 2, color: '#1de9b6' } },
                line: { width: 3, color: '#1de9b6' },
                hovertemplate: '时间: %{x|%Y-%m-%d %H:%M:%S}<br>剩余电量: %{y} 度<extra></extra>',
                name: '剩余电量'
            };

            const layout = {
                title: { text: '电量变化曲线', x: 0.5, font: { family: 'Segoe UI,微软雅黑', size: 20, color: '#00eaff' } },
                xaxis: { title: '时间', tickformat: '%Y-%m-%d %H:%M', tickangle: 30, showgrid: true, gridcolor: 'rgba(29,233,182,0.15)', griddash: 'dash', color: '#b2e6ff', tickfont: { color: '#b2e6ff' } },
                yaxis: { title: '剩余电量 (度)', showgrid: true, gridcolor: 'rgba(29,233,182,0.15)', griddash: 'dash', color: '#b2e6ff', tickfont: { color: '#b2e6ff' } },
                hovermode: 'x unified',
                plot_bgcolor: 'rgba(10,20,40,0.95)',
                paper_bgcolor: 'rgba(20,30,48,0.95)',
                margin: { l: 60, r: 30, t: 60, b: 60 },
                font: { family: 'Segoe UI,微软雅黑', size: 14, color: '#b2e6ff' }
            };

            Plotly.newPlot('chart-all', [trace], layout, {
                displayModeBar: true,
                scrollZoom: true,
                displaylogo: false,
                modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d', 'resetScale2d', 'toggleSpikelines']
            });
        }

        function renderTable(data) {
            const container = document.getElementById('data-table-container');
            // 按时间倒序
            const sorted = [...data].sort((a, b) => b.time - a.time);
            const rows = sorted.map((d, i) => {
                const diff = i < sorted.length - 1
                    ? (sorted[i].num - sorted[i + 1].num).toFixed(2)
                    : 'N/A';
                const dateStr = d.time.toISOString().replace('T', ' ').slice(0, 19);
                return { dateStr, num: d.num.toFixed(2), unit: d.unit, diff };
            });

            const visible = rows.slice(0, 20);
            const hidden = rows.slice(20);

            function rowHtml(r, isHidden, idx) {
                const highlight = idx % 20 === 0 ? 'highlight-row' : '';
                const faint = r.diff === 'N/A' ? 'faint-text' : '';
                const display = isHidden ? ' class="hidden-rows"' : '';
                return `<tr${display} class="${highlight}">
                    <td>${r.dateStr.slice(0, 10)}</td>
                    <td>${r.dateStr.slice(11, 19)}</td>
                    <td>${r.num}</td>
                    <td class="${faint}">${r.diff}</td>
                    <td>${r.unit}</td>
                </tr>`;
            }

            let html = `<table>
                <caption>电费数据明细</caption>
                <tr><th>日期</th><th>时刻</th><th>剩余电量</th><th>电量使用</th><th>单位</th></tr>`;
            visible.forEach((r, i) => { html += rowHtml(r, false, i); });
            hidden.forEach((r, i) => { html += rowHtml(r, true, visible.length + i); });
            html += `</table>`;

            if (hidden.length > 0) {
                html += `<div style="text-align:center;">
                    <span class="show-more-btn" onclick="toggleRows()" id="toggle-btn">展开全部</span>
                </div>`;
            }

            container.innerHTML = html;
        }

        function toggleRows() {
            const rows = document.querySelectorAll('.hidden-rows');
            rows.forEach(r => { r.style.display = r.style.display === 'table-row' ? 'none' : 'table-row'; });
            const btn = document.getElementById('toggle-btn');
            if (btn) btn.textContent = btn.textContent === '展开全部' ? '折叠' : '展开全部';
        }

        async function main() {
            try {
                const raw = await fetchData();
                const data = processData(raw);
                document.getElementById('loading-text').style.display = 'none';

                if (data.length === 0) {
                    document.getElementById('data-table-container').innerHTML =
                        '<div class="loading">暂无数据，等待下次采集...</div>';
                    return;
                }

                renderChart20(data);
                renderChartAll(data);
                renderTable(data);

                const last = data[data.length - 1];
                document.getElementById('last-update').textContent =
                    `最后更新: ${last.time.toISOString().replace('T', ' ').slice(0, 19)}`;
            } catch (err) {
                document.getElementById('loading-text').style.display = 'none';
                document.getElementById('data-table-container').innerHTML =
                    `<div class="error-msg">❌ 加载数据失败: ${err.message}<br><br>
                    <button class="reload-btn" onclick="location.reload()">重试</button></div>`;
            }
        }

        main();
    </script>
</body>
</html>
```

- [ ] **Step 2: 验证页面文件**

```bash
# 检查文件是否存在
ls -la docs/index.html
# 检查文件大小（应大于 5KB）
wc -c docs/index.html
```

- [ ] **Step 3: 提交静态页面**

```bash
git add docs/index.html
git commit -m "feat: 创建 GitHub Pages 静态网页面板
- 使用 Plotly.js CDN 渲染交互式电费曲线图
- 从 raw.githubusercontent.com 实时拉取 JSON 数据
- 科技感深色主题，适配桌面与移动端
- 完整的错误处理和空数据状态

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: 最终验证

- [ ] **Step 1: 检查文件状态**

```bash
git status
```

确认：
- `data/electricity_data.csv` — 已修改（只含表头）
- `data/electricity_data.json` — 已修改（空数组）
- `data/*.png` — 已删除
- `logs/` — 已清空
- `docs/index.html` — 新文件

- [ ] **Step 2: 确认无遗漏的旧数据引用**

```bash
# 检查是否有其他文件包含旧数据
grep -r "2025-08" data/ 2>/dev/null || echo "没有残留旧数据（2025年）"
grep -r "2025-09" data/ 2>/dev/null || echo "没有残留旧数据（2025年）"
```

- [ ] **Step 3: 推送到 GitHub**

```bash
git push origin master
```