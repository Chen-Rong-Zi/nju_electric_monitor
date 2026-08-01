# 房间选择功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add room selection to the electric monitor workflow so users can configure which room to select before clicking "去充值".

**Architecture:** Add a single `select_room()` method to `NJUElectricMonitor` in `nju_electric_monitor_workflow.py`. The method reads the room config (`buildName/roomName`), finds the matching room in the page's `.cent-list` elements, clicks its radio button, and syncs Vue's internal state via `execute_script`. The `run()` method calls it between `wait_for_login_success()` and `click_recharge_button()`.

**Tech Stack:** Selenium, Python, Vue 2 (page uses `__vue__` internal API)

---

### Task 1: 更新配置文件 config_workflow.json

**Files:**
- Modify: `config_workflow.json`

- [ ] **Step 1: 添加 room 字段**

在 `config_workflow.json` 中添加 `"room": ""` 字段（空字符串表示使用默认行为）：

```json
{
    "username": "",
    "password": "",
    "auto_login": true,
    "headless_mode": true,
    "captcha_retry_count": 4,
    "save_captcha_images": true,
    "log_level": "INFO",
    "test_mode": false,
    "enable_email_alert": true,
    "alert_threshold_warn": 15,
    "alert_threshold_high": 10,
    "alert_threshold_critical": 5,
    "room": ""
}
```

- [ ] **Step 2: 提交**

```bash
git add config_workflow.json
git commit -m "chore: 添加 room 配置字段"
```

---

### Task 2: 更新 `__init__()` 和 `load_config()` 默认配置

**Files:**
- Modify: `src/nju_electric_monitor_workflow.py`（`__init__()` 方法，`load_config()` 方法）

- [ ] **Step 1: 在 `__init__()` 中新增 `self.room_config`**

在 `__init__()` 方法中，找到 `self.alert_threshold_critical` 之后的位置（约第 89 行），添加：

```python
self.room_config = self.config.get("room", "")
```

- [ ] **Step 2: 在 `load_config()` 默认配置字典中添加 `"room": ""`**

在 `load_config()` 方法中，找到默认配置字典（约第 226-239 行），添加 `"room": ""`：

```python
default_config = {
    "username": "",
    "password": "",
    "auto_login": True,
    "headless_mode": True,
    "captcha_retry_count": 10,
    "save_captcha_images": True,
    "log_level": "INFO",
    "test_mode": False,
    "enable_email_alert": True,
    "alert_threshold_warn": 200,
    "alert_threshold_high": 10,
    "alert_threshold_critical": 5,
    "room": ""
}
```

- [ ] **Step 3: 提交**

```bash
git add src/nju_electric_monitor_workflow.py
git commit -m "feat: 添加 room_config 配置读取"
```

---

### Task 3: 实现 `select_room()` 方法

**Files:**
- Modify: `src/nju_electric_monitor_workflow.py`（新增方法，放在 `click_recharge_button()` 之前）

- [ ] **Step 1: 新增 `select_room()` 方法**

在 `click_recharge_button()` 方法之前（约第 1403 行之前），添加以下方法：

```python
def select_room(self, room_config: str):
    """
    根据配置选择对应的宿舍房间。
    在房间列表页面中查找匹配 buildName/roomName 的项，选中其 radio button，
    并通过 Vue 的 check() 方法同步内部状态。

    room_config 格式: "buildName/roomName"，例如 "4幢/4A211"
    空字符串时不做任何操作，保持默认行为（选中最后一个房间）。
    """
    if not room_config:
        self.logger.info("room_config 为空，跳过房间选择（使用默认选中）")
        return True

    self.logger.info(f"尝试选择房间: {room_config}")

    # 1. 等待房间列表加载
    try:
        WebDriverWait(self.driver, 15).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, ".cent-list"))
        )
        self.logger.info("房间列表已加载")
    except TimeoutException:
        self.logger.warning("房间列表加载超时（15s），跳过房间选择")
        return False

    # 2. 获取所有房间元素
    room_divs = self.driver.find_elements(By.CSS_SELECTOR, ".cent-list")
    if not room_divs:
        self.logger.warning("未找到任何房间元素，跳过房间选择")
        return False

    self.logger.info(f"共找到 {len(room_divs)} 个房间")

    # 3. 遍历匹配配置的房间
    matched_index = -1
    for i, div in enumerate(room_divs):
        try:
            span = div.find_element(By.CSS_SELECTOR, "span")
            text = span.text.strip()
            # 文本格式: "仙林校区 4幢 4A211" → split() 取后两部分
            parts = text.split()
            if len(parts) < 2:
                self.logger.debug(f"房间 {i} 文本格式异常: {text!r}")
                continue
            build_name = parts[-2]
            room_name = parts[-1]
            combined = f"{build_name}/{room_name}"
            self.logger.debug(f"房间 {i}: text={text!r}, combined={combined!r}")
            if combined == room_config:
                matched_index = i
                self.logger.info(f"找到匹配房间: {text} (索引 {i})")
                break
        except Exception as e:
            self.logger.debug(f"解析房间 {i} 时出错: {e}")
            continue

    if matched_index == -1:
        self.logger.warning(f"未找到匹配配置的房间: {room_config}")
        return False

    # 4. 选中匹配的房间
    try:
        target_div = room_divs[matched_index]

        # 4a. 点击 radio button
        try:
            radio = target_div.find_element(By.CSS_SELECTOR, "input[type='radio']")
            radio.click()
            self.logger.info(f"已点击房间 {matched_index} 的 radio button")
        except Exception as e:
            self.logger.warning(f"点击 radio button 失败: {e}")

        # 4b. 通过 JavaScript 同步 Vue 内部状态
        try:
            self.driver.execute_script(
                "document.querySelector('#app').__vue__.check(arguments[0])",
                matched_index
            )
            self.logger.info(f"已通过 Vue check({matched_index}) 同步房间选择状态")
        except Exception as e:
            self.logger.warning(f"Vue check() 调用失败，降级为仅点击 radio: {e}")

        self.logger.info(f"房间选择完成: {room_config}")
        return True

    except Exception as e:
        self.logger.error(f"选择房间时出错: {e}")
        return False
```

- [ ] **Step 2: 提交**

```bash
git add src/nju_electric_monitor_workflow.py
git commit -m "feat: 实现 select_room() 方法"
```

---

### Task 4: 在 `run()` 中调用 `select_room()`

**Files:**
- Modify: `src/nju_electric_monitor_workflow.py`（`run()` 方法）

- [ ] **Step 1: 在 `wait_for_login_success()` 和 `click_recharge_button()` 之间插入调用**

在 `run()` 方法中，找到 `wait_for_login_success()` 调用之后、`click_recharge_button()` 调用之前的位置（约第 1997-2004 行之间），插入：

```python
# 8. 选择房间（根据配置）
self.select_room(self.room_config)

# 9. 点击充值按钮
if not self.click_recharge_button():
```

注意：原有的 `# 8. 点击充值按钮` 注释需要改为 `# 9. 点击充值按钮`，后续步骤编号也依次调整。

完整修改后的 `run()` 方法片段（约第 1997-2014 行）：

```python
            # 7. 等待登录成功
            if not self.wait_for_login_success():
                self.logger.error("登录失败")
                return False
            # 测试模式：已通过统一认证并进入电费页面
            self.save_page_snapshot("06_login_success_electric_page")

            # 8. 选择房间（根据配置）
            self.select_room(self.room_config)

            # 9. 点击充值按钮
            if not self.click_recharge_button():
                self.logger.warning("点击充值按钮失败，尝试直接提取数据")

            # 10. 提取剩余电量
            remaining_electricity = self.extract_remaining_electricity()
            ...
            # 11. 保存数据
            self.save_data(remaining_electricity)
            ...
            # 12. 根据电量阈值发送邮件提醒（如已配置）
            self.send_email_alert_if_needed(remaining_electricity)
```

- [ ] **Step 2: 提交**

```bash
git add src/nju_electric_monitor_workflow.py
git commit -m "feat: 在 run() 中调用 select_room()"
```

---

### Task 5: 最终验证

- [ ] **Step 1: 检查代码完整性**

验证以下内容：
- `config_workflow.json` 包含 `"room": ""` 字段
- `__init__()` 中有 `self.room_config = self.config.get("room", "")`
- `load_config()` 默认字典包含 `"room": ""`
- `select_room()` 方法存在且逻辑完整
- `run()` 方法中在 `wait_for_login_success()` 之后调用了 `select_room()`
- 方法注释和日志清晰

- [ ] **Step 2: 语法检查**

```bash
python -m py_compile src/nju_electric_monitor_workflow.py
```

Expected: No output (success).

- [ ] **Step 3: 提交所有变更**

```bash
git add -A
git commit -m "feat: 完成房间选择功能

- 新增 select_room() 方法，通过配置匹配并选中房间
- 在 run() 中登录成功后调用 select_room()
- 支持防御性降级：Vue check() 失败时仅点击 radio button
- 配置文件新增 room 字段"
```