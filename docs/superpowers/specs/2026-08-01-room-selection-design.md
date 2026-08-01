# 房间选择功能设计

## 概述

在登录成功后的房间列表页面，当前默认选中最后一个房间。新增功能：通过配置文件指定要选中的房间，再点击"去充值"。

## 页面结构

登录后页面 URL：`https://epay.nju.edu.cn/epay/h5/nju/electric/index`

房间列表使用 Vue.js 渲染，每个房间的 HTML 结构如下：

```html
<div class="cent-list listtwo">
  <input id="floor0" type="radio" name="tags" class="magic-radio">
  <label for="floor0"></label>
  <span>仙林校区 4幢 4A211</span>  <!-- 文本格式: "{campus} {buildName} {roomName}" -->
</div>
```

Vue 数据：

```javascript
// 每个房间对象
{
  "id": 53470,          // 唯一ID，用于跳转 charge?id=
  "sysName": "仙林校区", // 校区名
  "buildName": "4幢",    // 楼栋名
  "buildId": "xl04",     // 楼栋系统ID
  "roomName": "4A211",   // 房间名
  "roomId": "A211"       // 房间系统ID
}
```

默认选中逻辑：`v.checked = i == list.length - 1`（最后一个）。

点击"去充值"按钮（`div.footer`）触发 Vue 的 `next()` 方法：

```javascript
next() {
  let check = this.list[this.index]
  window.location.href = '/epay/h5/nju/electric/charge?id=' + check.id
}
```

## 配置

在 `config_workflow.json` 中新增字段 `room`：

```json
{
  "room": "4幢/4A211"
}
```

格式：`{buildName}/{roomName}`。空字符串时保持原有行为（默认选中最后一个房间）。

## 实现方案

### 新增方法 `select_room()`

位置：在 `NJUElectricMonitor` 类中新增，位于 `click_recharge_button()` 之前调用。

流程：

```
select_room(room_config):
  1. 如果 room_config 为空 → 直接返回（保持默认行为）
  2. 等待房间列表加载完成（等待 .cent-list 元素出现）
  3. 获取所有 .cent-list 元素
  4. 遍历，对每个元素：
     a. 获取 <span> 的文本，格式如 "仙林校区 4幢 4A211"
     b. 按空格分割，取最后两部分作为 buildName 和 roomName
     c. 拼接为 "{buildName}/{roomName}" 与配置比较
     d. 匹配成功 → 记录当前索引 i
  5. 如果找到匹配的房间：
     a. 点击对应的 radio button（input[type="radio"]）
     b. 执行 JavaScript 同步 Vue 的内部状态：
        document.querySelector('#app').__vue__.check(matchedIndex)
     c. 记录日志 "已选择房间: 4幢/4A211"
  6. 如果未找到匹配 → 记录警告日志，保持默认选中
```

### 修改 `run()` 流程

```python
# 原流程
wait_for_login_success()
click_recharge_button()

# 新流程
wait_for_login_success()
select_room(self.room_config)    # 新增
click_recharge_button()
```

### 配置读取

在 `__init__()` 中新增：

```python
self.room_config = self.config.get("room", "")
```

### 涉及文件

- 修改：`src/nju_electric_monitor_workflow.py`（新增 `select_room()` 方法，修改 `run()` 和 `__init__()`）
- 修改：`config_workflow.json`（新增 `room` 字段，默认为空）
- 不改：`src/nju_electric_monitor_auto.py`（本地 auto 脚本，随配置更新）

### 错误处理

- 配置为空 → 不做房间选择，保持原有行为
- 房间列表未加载 → 超时等待，记录警告，继续原有流程
- 配置的房间未找到匹配 → 记录警告日志，不做选择，保持默认
- 房间列表加载后无元素 → 记录警告，跳过选择

## 不涉及的部分

- 不改动 `click_recharge_button()` 方法
- 不改动 `extract_remaining_electricity()` 方法
- 不改动前端 `docs/index.html`
- 不改动 `.github/workflows/`
- 不改动 `src/nju_electric_monitor_auto.py`