# OpenClaw 执行能力模块

## 已实现功能

### 1. 文件操作 (file-operations.js)
- ✅ `file.read` - 读取文件
- ✅ `file.write` - 写入文件（支持追加模式）
- ✅ `file.delete` - 删除文件或目录
- ✅ `file.list` - 列出目录内容（支持递归）
- ✅ `file.search` - 搜索文件（文件名或内容）
- ✅ `file.copy` - 复制文件或目录
- ✅ `file.move` - 移动/重命名文件
- ✅ `file.info` - 获取文件信息

### 2. 终端命令 (terminal-operations.js)
- ✅ `terminal.exec` - 执行命令（同步等待结果）
- ✅ `terminal.exec_script` - 执行脚本文件
- ✅ `terminal.get_cwd` - 获取当前工作目录
- ✅ `terminal.set_cwd` - 改变工作目录
- ✅ `terminal.get_env` - 获取环境变量
- ✅ `terminal.set_env` - 设置环境变量

### 3. 浏览器自动化 (browser-operations.js)
基于 Puppeteer
- ✅ `browser.launch` - 启动浏览器
- ✅ `browser.close` - 关闭浏览器
- ✅ `browser.open` - 打开新页面
- ✅ `browser.click` - 点击元素
- ✅ `browser.input` - 输入文本
- ✅ `browser.extract` - 提取内容
- ✅ `browser.screenshot` - 截图
- ✅ `browser.wait_for` - 等待元素
- ✅ `browser.evaluate` - 执行 JavaScript
- ✅ `browser.navigate` - 导航到 URL

### 4. 剪贴板操作 (clipboard-operations.js)
基于 clipboardy
- ✅ `clipboard.read` - 读取剪贴板
- ✅ `clipboard.write` - 写入剪贴板
- ✅ `clipboard.clear` - 清空剪贴板

### 5. 桌面控制 (desktop_operations.py)
基于 PyAutoGUI（在 Hermes 端实现）
- ✅ `desktop.screenshot` - 截图
- ✅ `desktop.mouse_move` - 移动鼠标
- ✅ `desktop.mouse_click` - 鼠标点击
- ✅ `desktop.mouse_drag` - 鼠标拖拽
- ✅ `desktop.mouse_scroll` - 鼠标滚动
- ✅ `desktop.get_mouse_position` - 获取鼠标位置
- ✅ `desktop.keyboard_type` - 键盘输入
- ✅ `desktop.keyboard_press` - 按键
- ✅ `desktop.keyboard_hotkey` - 组合键
- ✅ `desktop.find_image` - 查找图像
- ✅ `desktop.get_screen_size` - 获取屏幕尺寸
- ✅ `desktop.alert` - 显示警告框

## 使用示例

### 文件操作
```javascript
// 读取文件
{
  type: 'command',
  action: 'file.read',
  params: { path: 'C:/test.txt' }
}

// 写入文件
{
  type: 'command',
  action: 'file.write',
  params: { path: 'C:/test.txt', content: 'Hello World' }
}

// 搜索文件
{
  type: 'command',
  action: 'file.search',
  params: { path: 'C:/projects', pattern: '*.js', content: true }
}
```

### 终端命令
```javascript
// 执行命令
{
  type: 'command',
  action: 'terminal.exec',
  params: { command: 'dir', cwd: 'C:/' }
}

// 获取环境变量
{
  type: 'command',
  action: 'terminal.get_env',
  params: { key: 'PATH' }
}
```

### 浏览器自动化
```javascript
// 打开网页
{
  type: 'command',
  action: 'browser.open',
  params: { url: 'https://example.com' }
}

// 点击元素
{
  type: 'command',
  action: 'browser.click',
  params: { selector: '#submit-button' }
}

// 提取内容
{
  type: 'command',
  action: 'browser.extract',
  params: { selector: 'h1', attribute: 'textContent' }
}
```

### 剪贴板
```javascript
// 读取剪贴板
{
  type: 'command',
  action: 'clipboard.read',
  params: {}
}

// 写入剪贴板
{
  type: 'command',
  action: 'clipboard.write',
  params: { content: 'Hello Clipboard' }
}
```

## 安装依赖

```bash
# OpenClaw (Node.js)
cd openclaw
npm install

# Hermes (Python)
cd ../hermes
pip install -r requirements.txt
```

## 注意事项

1. **浏览器自动化**：首次运行会自动下载 Chromium（约 150MB）
2. **桌面控制**：需要 GUI 环境，无头服务器无法使用
3. **权限**：某些操作可能需要管理员权限
4. **安全**：文件操作和终端命令有潜在风险，建议在沙箱环境测试
