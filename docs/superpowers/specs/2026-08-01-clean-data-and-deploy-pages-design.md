# 数据清理与 GitHub Pages 静态面板部署设计

## 概述

本文档描述了对 fork 仓库 `nju_electric_monitor` 进行两项改造的设计：
1. 清除原仓库所有者的历史数据（电费数据、日志、图片）
2. 将现有 Flask 动态面板转换为纯静态 HTML 页面，通过 GitHub Pages 部署

## 1. 数据清理

### 清理范围

| 文件/目录 | 操作 | 说明 |
|-----------|------|------|
| `data/electricity_data.csv` | 清空内容，保留表头 `time,num,unit` | 含 874 行原所有者数据 |
| `data/electricity_data.json` | 清空内容，保留空数组 `[]` | 含 879 行原所有者数据，且有合并冲突标记 |
| `data/electricity_trend.png` | 删除 | 基于旧数据生成的图表 |
| `data/recent_20_changes.png` | 删除 | 基于旧数据生成的图表 |
| `data/captcha_debug.png` | 删除 | 旧验证码截图 |
| `data/slider_temp_canvas.png` | 删除 | 旧滑块截图 |
| `logs/` 目录（1523 个文件） | 全部删除 | 原所有者运行日志 |

### 不修改的文件

- 源代码文件（`src/` 目录）
- 配置文件（`config_workflow.json`）
- GitHub Actions 工作流（`.github/workflows/`）
- 文档（`README.md`, `GUIDE.md`）

## 2. 静态网页面板

### 架构

单个 `docs/index.html` 文件，零服务器依赖，通过 CDN 加载 Plotly.js。

```
docs/index.html
├── HTML 结构（标题、图表容器、表格容器）
├── CSS（科技感深色主题，适配桌面与移动端）
└── JavaScript
    ├── Plotly.js（CDN: https://cdn.plot.ly/plotly-2.32.0.min.js）
    ├── fetchData() → 从 raw.githubusercontent.com 读取 JSON
    ├── renderChart() → 绘制 Plotly 曲线图（完整历史 + 最近 20 次）
    └── renderTable() → 渲染数据表格（含展开/折叠）
```

### 数据流

```
GitHub Actions 采集数据
        ↓
  更新 data/electricity_data.json（提交到 main 分支）
        ↓
  用户访问 GitHub Pages 站点
        ↓
  index.html 的 JS 通过 fetch() 从 raw.githubusercontent.com 读取 JSON
        ↓
  Plotly.js 渲染曲线 + 表格渲染
```

### 数据源 URL

```
https://raw.githubusercontent.com/Chen-Rong-Zi/nju_electric_monitor/main/data/electricity_data.json
```

### 功能

- 完整历史电量变化曲线图（Plotly 交互式，可缩放/拖动/悬停）
- 最近 20 次电量变化曲线图
- 数据明细表格（时间、剩余电量、用电量）
- 表格默认显示最近 20 条，支持展开/折叠全部
- 电量突降行高亮（橙红色背景）
- "刷新"按钮重新加载数据
- 响应式设计，适配移动端

### 与当前 Flask 版的核心区别

- **渲染方式**：Python Flask 服务端渲染 → 纯前端 JS 渲染
- **数据读取**：Pandas 读取 CSV → JS 直接 fetch JSON
- **部署方式**：本地 `python src/web_panel.py` → GitHub Pages 公网访问
- **依赖**：Flask/Pandas/Plotly(Python) → 零依赖，仅需浏览器

## 3. GitHub Pages 部署

### 配置步骤

1. 在 GitHub 仓库 Settings → Pages 中设置：
   - Source: **Deploy from a branch**
   - Branch: `main`
   - Directory: `/docs`

2. 将 `docs/index.html` 提交到 `main` 分支

### 站点 URL

```
https://chen-rong-zi.github.io/nju_electric_monitor/
```

### 更新机制

- 数据更新时，GitHub Actions 自动将新数据提交到 `data/electricity_data.json`
- 用户访问 Pages 站点时，JS 在浏览器中实时从 `raw.githubusercontent.com` 拉取最新 JSON
- 无需额外构建步骤或部署工作流

## 4. 不涉及的部分

- 保留现有的 GitHub Actions 自动监控工作流（`auto_monitor_schedule.yml`）
- 保留现有的本地运行能力（`run_auto_monitor.bat`, `run_web_panel.bat` 等）
- 保留 `src/web_panel.py` 文件（本地 Flask 版仍可独立使用）
- 不修改源代码逻辑