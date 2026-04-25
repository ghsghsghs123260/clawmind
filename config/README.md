# ClawMind 配置管理

## 配置文件

### config.json
用户配置文件，包含所有运行时配置。

### config.default.json
默认配置模板，首次运行时会复制为 config.json。

### config.schema.json
配置文件的 JSON Schema，用于验证配置格式。

## 配置项说明

### API 配置
- `apiKey`: AI 模型 API Key（必填）
- `model`: 使用的 AI 模型
- `apiEndpoint`: API 端点地址

### WebSocket 配置
- `websocket.port`: WebSocket 服务端口（默认 8765）
- `websocket.host`: WebSocket 服务地址（默认 localhost）

### Hermes Agent 配置
- `hermes.enabled`: 是否启用 Hermes Agent
- `hermes.pythonPath`: Python 解释器路径（留空自动检测）

### OpenClaw 配置
- `openclaw.enabled`: 是否启用 OpenClaw
- `openclaw.plugins`: 启用的插件列表

### 桌面端配置
- `desktop.autoStart`: 是否自动启动桌面端
- `desktop.theme`: 界面主题（light/dark/auto）

### 日志配置
- `logging.level`: 日志级别（debug/info/warn/error）
- `logging.file`: 日志文件路径

## 使用配置向导

```bash
# 首次配置
clawmind config

# 更新配置
clawmind config
```

配置向导会引导你完成：
1. API 配置（提供商、模型、API Key）
2. 渠道配置（Hermes、OpenClaw）
3. 路径配置（数据目录、日志路径）
4. 高级配置（端口、主题、日志级别）
