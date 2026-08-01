# 自动监控查询容错增强 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为自动监控 workflow 增加 4 层重试机制，解决网络波动导致整小时无数据的问题。

**Architecture:** 两个文件，4 处改动。wrapper 层重试整个 workflow 子进程（最多 3 次，30s 间隔），workflow 层对房间选择、充值按钮点击、电量提取三个关键步骤各增加独立重试（最多 3 次，5s 间隔）。

**Tech Stack:** Python 3.11, Selenium WebDriver, subprocess

---

### Task 1: Wrapper 层重试循环（run_workflow_wrapper.py）

**Files:**
- Modify: `src/run_workflow_wrapper.py:165-180`

**当前代码（第 165-180 行）：**
```python
        # 通过子进程直接运行 nju_electric_monitor_workflow.py，避免导入路径问题
        try:
            import subprocess
            workflow_path = os.path.join(os.path.dirname(__file__), 'nju_electric_monitor_workflow.py')
            lf.write(f"Running workflow script: {workflow_path}\n")
            lf.flush()

            result = subprocess.run(
                [sys.executable, workflow_path],
                stdout=lf,
                stderr=lf,
            )

            if result.returncode != 0:
                lf.write(f"Workflow script exited with code {result.returncode}\n")
                lf.flush()
                raise SystemExit(result.returncode)

        except Exception:
            # 记录任何在运行 workflow 脚本时发生的异常
            lf.write('Error while running workflow script via subprocess:\n')
            traceback.print_exc(file=lf)
            lf.flush()
            try:
                faulthandler.dump_traceback(file=lf)
            except Exception:
                lf.write('faulthandler.dump_traceback failed\n')
            raise
```

- [ ] **Step 1: 将 subprocess.run 调用包装到重试循环中**

  将第 165-180 行的 `try/except` 块替换为带重试循环的版本。保留 `import subprocess` 和 `workflow_path` 拼装。

  ```python
        # 通过子进程直接运行 nju_electric_monitor_workflow.py，避免导入路径问题
        try:
            import subprocess
            workflow_path = os.path.join(os.path.dirname(__file__), 'nju_electric_monitor_workflow.py')
            lf.write(f"Running workflow script: {workflow_path}\n")
            lf.flush()

            MAX_RETRIES = 3
            RETRY_DELAY_SECONDS = 30
            success = False
            exit_code = 1

            for attempt in range(1, MAX_RETRIES + 1):
                if attempt > 1:
                    lf.write(f"\n=== 第 {attempt} 次重试（{datetime.now(BEIJING_TZ).isoformat()}）===\n")
                    lf.flush()
                    time.sleep(RETRY_DELAY_SECONDS)

                try:
                    result = subprocess.run(
                        [sys.executable, workflow_path],
                        stdout=lf,
                        stderr=lf,
                    )
                    exit_code = result.returncode
                    if result.returncode == 0:
                        success = True
                        break
                    else:
                        lf.write(f"Workflow script exited with code {result.returncode}\n")
                        lf.flush()
                except Exception as e:
                    lf.write(f"Workflow script raised exception: {e}\n")
                    traceback.print_exc(file=lf)
                    lf.flush()

            if not success:
                lf.write(f"所有 {MAX_RETRIES} 次尝试均失败（最后退出码: {exit_code}）\n")
                lf.flush()
                raise SystemExit(exit_code)

        except Exception:
            # 记录任何在运行 workflow 脚本时发生的异常
            lf.write('Error while running workflow script via subprocess:\n')
            traceback.print_exc(file=lf)
            lf.flush()
            try:
                faulthandler.dump_traceback(file=lf)
            except Exception:
                lf.write('faulthandler.dump_traceback failed\n')
            raise
  ```

  **注意：** 保留外层 `except Exception` 不变（第 182-191 行），它只捕获 `raise SystemExit` 以外的异常。

- [ ] **Step 2: 验证语法正确**

  ```bash
  python3 -m py_compile src/run_workflow_wrapper.py
  ```
  预期：无输出，退出码 0。

- [ ] **Step 3: 提交**

  ```bash
  git add src/run_workflow_wrapper.py
  git commit -m "feat: add retry loop to workflow wrapper (3 attempts, 30s interval)"
  ```

---

### Task 2: Workflow 层三步重试 + 超时延长（nju_electric_monitor_workflow.py）

**Files:**
- Modify: `src/nju_electric_monitor_workflow.py:1424`（select_room 超时）
- Modify: `src/nju_electric_monitor_workflow.py:2096-2097`（select_room 调用处）
- Modify: `src/nju_electric_monitor_workflow.py:1496-1537`（click_recharge_button）
- Modify: `src/nju_electric_monitor_workflow.py:2103-2109`（extract_remaining_electricity 调用处）

#### 2a. select_room 超时延长

- [ ] **Step 1: select_room 超时从 15s 改为 30s**

  **改动位置：** 第 1424 行，`WebDriverWait(self.driver, 15)` → `WebDriverWait(self.driver, 30)`

  ```python
  # 改前（第 1424 行）：
  WebDriverWait(self.driver, 15).until(
  # 改后：
  WebDriverWait(self.driver, 30).until(
  ```

#### 2b. select_room 调用处加重试

- [ ] **Step 2: 在 run() 方法中为 select_room 调用增加重试循环**

  **改动位置：** 第 2096-2097 行

  ```python
  # 改前：
  # 8. 选择房间（根据配置）
  self.select_room(self.room_config)

  # 改后：
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

#### 2c. click_recharge_button 加内部重试

- [ ] **Step 3: 重写 click_recharge_button 方法，增加内部重试**

  **改动位置：** 第 1496-1537 行

  ```python
  def click_recharge_button(self):
      """点击'去充值'按钮（带重试，最多 3 次）"""
      for attempt in range(1, 4):
          try:
              self.logger.info(f"查找'去充值'按钮（第 {attempt} 次）...")
              recharge_button = None

              # 1) 优先按文本内容查找包含“去充值”的可点击元素
              try:
                  candidates = self.driver.find_elements(By.XPATH, "//*[contains(text(),'去充值')]")
                  visible = [el for el in candidates if el.is_displayed() and el.is_enabled()]
                  if visible:
                      recharge_button = visible[0]
                      self.logger.info("通过文本包含 '去充值' 找到充值按钮")
              except Exception as e:
                  self.logger.warning(f"通过文本查找'去充值'按钮出错: {e}")

              # 2) 若未找到，则回退到原先的 CSS 选择器 div.footer
              if recharge_button is None:
                  try:
                      btn = self.driver.find_element(By.CSS_SELECTOR, "div.footer")
                      if btn.is_displayed() and btn.is_enabled():
                          recharge_button = btn
                          self.logger.info("通过 CSS 选择器 div.footer 找到充值按钮")
                  except NoSuchElementException:
                      self.logger.warning("通过 CSS 选择器未找到'去充值'按钮 div.footer")

              if recharge_button is not None:
                  recharge_button.click()
                  self.logger.info("已点击充值按钮")
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
              # 第 3 次失败不 raise，fall through 到 return False

          self.logger.error("未找到可点击的'去充值'按钮（重试耗尽）")
          return False
  ```

#### 2d. extract_remaining_electricity 调用处加重试

- [ ] **Step 4: 在 run() 方法中为 extract_remaining_electricity 增加重试循环**

  **改动位置：** 第 2103-2109 行

  ```python
  # 改前：
  # 10. 提取剩余电量
  remaining_electricity = self.extract_remaining_electricity()

  # 如果未能成功提取电量，视为本次流程失败
  if remaining_electricity is None:
      self.logger.error("提取剩余电量失败，认为本次监控流程未成功，将交由上层重试")
      return False

  # 改后：
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

- [ ] **Step 5: 验证语法正确**

  ```bash
  python3 -m py_compile src/nju_electric_monitor_workflow.py
  ```
  预期：无输出，退出码 0。

- [ ] **Step 6: 提交**

  ```bash
  git add src/nju_electric_monitor_workflow.py
  git commit -m "feat: add retry loops to room selection, recharge button, and electricity extraction"
  ```

---

## 验证方法

**静态验证：**
```bash
python3 -m py_compile src/run_workflow_wrapper.py
python3 -m py_compile src/nju_electric_monitor_workflow.py
```

**逻辑验证：** 阅读最终代码确认：
1. Wrapper 重试循环：3 次尝试，失败后 30s 间隔，最后失败保留退出码
2. select_room 超时：30s 而非 15s
3. select_room 调用处：3 次尝试，失败后 5s 间隔，最后不 sleep
4. click_recharge_button：3 次尝试，失败后 5s 间隔，最后不 raise
5. extract_remaining_electricity 调用处：3 次尝试，失败后 5s 间隔，最后不 sleep