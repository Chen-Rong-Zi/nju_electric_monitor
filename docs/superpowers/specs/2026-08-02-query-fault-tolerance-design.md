# 自动监控查询容错增强设计

> **Goal:** 解决自动监控 workflow 因网络波动或教务系统短暂异常导致整小时无数据的问题，通过多层重试机制提升数据采集成功率。
>
> **Architecture:** 在 wrapper 层（run_workflow_wrapper.py）增加整体重试循环，同时在 workflow 层（nju_electric_monitor_workflow.py）对房间选择、充值按钮点击、电量提取三个关键步骤增加独立重试。
>
> **Tech Stack:** Python 3.11, Selenium WebDriver, subprocess

---

## 问题分析

2026-08-02 02:05 BJ 的 run #10 失败：
1. 房间列表加载超时（15s），`select_room()` 返回 False
2. 因房间未选择，页面状态不正确，`click_recharge_button()` 找不到按钮
3. `extract_remaining_electricity()` 无法提取电量
4. 日志写"交由上层重试"，但 wrapper 层仅调用一次，无任何重试机制

## 改动范围

两个文件，共 4 处改动：

| 文件 | 改动 |
|------|------|
| `run_workflow_wrapper.py` | 整体重试循环（最多 3 次，间隔 30s） |
| `nju_electric_monitor_workflow.py` | `select_room()` 超时延长 + 重试 |
| `nju_electric_monitor_workflow.py` | `click_recharge_button()` 重试 |
| `nju_electric_monitor_workflow.py` | `extract_remaining_electricity()` 重试 |

## 详细设计

### 1. Wrapper 层整体重试（run_workflow_wrapper.py）

**当前行为：** 调用一次 `subprocess.run([sys.executable, workflow_path])`，非零退出码即 raise。

**改为：** 外层循环包装，最多重试 3 次（共 3 次尝试），每次重试间隔 30s。保留原始退出码到日志。

```python
MAX_RETRIES = 3
RETRY_DELAY_SECONDS = 30

for attempt in range(1, MAX_RETRIES + 1):
    if attempt > 1:
        lf.write(f"\n=== 第 {attempt} 次重试（{datetime.now(BEIJING_TZ).isoformat()}）===\n")
        lf.flush()
        time.sleep(RETRY_DELAY_SECONDS)
    
    result = subprocess.run([sys.executable, workflow_path], stdout=lf, stderr=lf)
    if result.returncode == 0:
        success = True
        break
    else:
        lf.write(f"Workflow script exited with code {result.returncode}\n")
        lf.flush()
        success = False

if not success:
    lf.write(f"所有 {MAX_RETRIES} 次尝试均失败（最后退出码: {result.returncode}）\n")
    lf.flush()
    raise SystemExit(result.returncode)
```

**注意：** 每次重试会重新启动整个 workflow，包括重新打开浏览器、重新登录，相当于一个全新的监控流程。这只在网络/教务系统短暂波动时有意义。如果连续 3 次都失败，说明问题不可恢复（如教务系统页面改版、凭据过期），不再重试。

### 2. 房间列表超时延长 + 重试（select_room）

**当前行为：** 超时 15s → 返回 False → 跳过房间选择。

**改为：**
- WebDriverWait 超时从 15s 延长到 **30s**
- 调用方（`run()` 方法中）对 `select_room()` 失败时，等待 5s 后重试，最多 3 次（最后失败不 sleep）

**select_room 方法内改动（第 1424 行）：**
```python
WebDriverWait(self.driver, 30).until(
    EC.presence_of_element_located((By.CSS_SELECTOR, ".cent-list"))
)
```

**run() 方法中调用处改动（第 2097 行附近）：**
```python
# 8. 选择房间（根据配置），带重试
for room_attempt in range(1, 4):
    if self.select_room(self.room_config):
        break
    if room_attempt < 3:
        self.logger.warning(f"房间选择第 {room_attempt} 次失败，等待 5s 后重试")
        time.sleep(5)
else:
    self.logger.warning("房间选择重试耗尽，继续执行后续流程")
```

### 3. 充值按钮重试（click_recharge_button）

**当前行为：** 找不到按钮 → 返回 False。

**改为：** 内部增加重试逻辑，最多 3 次，每次重试前等待 5s（最后失败不 sleep，不 raise）。

```python
def click_recharge_button(self):
    for attempt in range(1, 4):
        try:
            # ... 现有查找逻辑 ...
            if recharge_button is not None:
                recharge_button.click()
                time.sleep(3)
                return True
            
            if attempt < 3:
                self.logger.warning(f"充值按钮第 {attempt} 次未找到，等待 5s 后重试")
                time.sleep(5)
                continue
        except Exception as e:
            if attempt < 3:
                self.logger.warning(f"充值按钮点击第 {attempt} 次失败: {e}，等待 5s 后重试")
                time.sleep(5)
                continue
            # 第 3 次失败不 raise，直接 fall through 到 return False
    
    self.logger.error("充值按钮未找到（重试耗尽）")
    return False
```

### 4. 电量提取重试（run() 方法中）

**当前行为：** `extract_remaining_electricity()` 返回 None → 记录错误 → 返回 False。

**改为：** 在 `run()` 方法中，对提取结果做重试循环，最多 3 次，每次重试前等待 5s（最后失败不 sleep）。

```python
# 10. 提取剩余电量（带重试）
remaining_electricity = None
for extract_attempt in range(1, 4):
    remaining_electricity = self.extract_remaining_electricity()
    if remaining_electricity is not None:
        break
    if extract_attempt < 3:
        self.logger.warning(f"电量提取第 {extract_attempt} 次失败，等待 5s 后重试")
        time.sleep(5)

if remaining_electricity is None:
    self.logger.error("提取剩余电量失败（重试耗尽），认为本次监控流程未成功")
    return False
```

## 重试策略总结

| 层级 | 重试对象 | 最多尝试 | 间隔 | 目的 |
|------|---------|---------|------|------|
| 1（最外层） | 整个 workflow | 3 次 | 30s | 应对网络/教务系统整体波动 |
| 2 | 房间选择 | 3 次 | 5s | 应对页面加载延迟 |
| 3 | 充值按钮点击 | 3 次 | 5s | 应对页面渲染延迟 |
| 4 | 电量提取 | 3 次 | 5s | 应对数据加载延迟 |

**总最坏耗时：** 单次 workflow 约 1-2 分钟，wrapper 重试 3 次 + 2×30s 间隔 ≈ 约 10 分钟上限。不会超过 GitHub Actions 的 6 小时超时限制。

## 不涉及

- 不修改 `config_workflow.json` 配置结构
- 不增加新的依赖库
- 不改动数据模型、前端展示、CSS 选择器
- 不涉及前端 `fetch()` 的容错（用户另提需求）