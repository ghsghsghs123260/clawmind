# ClawMind 高级功能模块

## 第六阶段：高级功能

### 1. 记忆系统 (Memory System)

持久化存储和检索系统，用于保存对话历史、用户偏好、任务记录等。

#### 功能特性
- **对话历史管理**
  - `memory.save_conversation` - 保存对话
  - `memory.load_conversation` - 加载对话
  - `memory.list_conversations` - 列出所有对话
  - `memory.delete_conversation` - 删除对话

- **用户偏好管理**
  - `memory.save_preference` - 保存偏好设置
  - `memory.get_preference` - 获取偏好设置
  - `memory.get_all_preferences` - 获取所有偏好

- **任务记录管理**
  - `memory.save_task` - 保存任务记录
  - `memory.load_task` - 加载任务记录
  - `memory.list_tasks` - 列出任务（支持过滤）

- **知识库管理**
  - `memory.save_knowledge` - 保存知识条目
  - `memory.get_knowledge` - 获取知识条目
  - `memory.search_knowledge` - 搜索知识库

#### 数据结构
```
data/memory/
├── conversations/    # 对话历史
│   ├── conv_001.json
│   └── conv_002.json
├── preferences/      # 用户偏好
│   └── preferences.json
├── tasks/           # 任务记录
│   ├── task_001.json
│   └── task_002.json
└── knowledge/       # 知识库
    ├── category1/
    └── category2/
```

### 2. 技能系统 (Skill System)

可复用的技能模板和工作流管理系统。

#### 功能特性
- **技能管理**
  - `skill.get` - 获取技能详情
  - `skill.list` - 列出所有技能
  - `skill.create` - 创建自定义技能
  - `skill.update` - 更新技能
  - `skill.delete` - 删除技能
  - `skill.search` - 搜索技能

- **技能执行**
  - `skill.execute` - 执行技能（支持参数替换）

#### 内置技能
1. **web_scraping** - 网页数据抓取
   - 启动浏览器 → 打开网页 → 等待加载 → 提取内容 → 关闭浏览器

2. **file_backup** - 文件备份
   - 检查源文件 → 复制文件 → 验证备份

3. **screenshot_and_save** - 截图并保存
   - 截取屏幕 → 验证文件

#### 技能定义格式
```json
{
  "id": "skill_id",
  "name": "技能名称",
  "description": "技能描述",
  "category": "分类",
  "steps": [
    {
      "name": "步骤名称",
      "action": "指令动作",
      "params": {
        "param1": "{{ variable }}"
      }
    }
  ]
}
```

#### 参数替换
技能支持参数占位符 `{{ variable }}`，执行时会自动替换为实际值。

### 3. 通知系统 (Notification System)

桌面通知和任务提醒系统。

#### 功能特性
- **通知发送**
  - `notification.send` - 发送自定义通知
  - `notification.task_complete` - 任务完成通知
  - `notification.error` - 错误通知
  - `notification.info` - 信息通知
  - `notification.warning` - 警告通知

- **通知管理**
  - `notification.enable` - 启用通知
  - `notification.disable` - 禁用通知
  - `notification.get_status` - 获取通知状态
  - `notification.get_history` - 获取通知历史
  - `notification.clear_history` - 清空历史

#### 通知类型
- **info** - 信息通知（无声音）
- **success** - 成功通知（有声音）
- **warning** - 警告通知（有声音）
- **error** - 错误通知（有声音）

## 使用示例

### 记忆系统
```javascript
// 保存对话
{
  type: 'command',
  action: 'memory.save_conversation',
  params: {
    conversationId: 'conv_001',
    messages: [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi!' }
    ]
  }
}

// 保存用户偏好
{
  type: 'command',
  action: 'memory.save_preference',
  params: {
    key: 'theme',
    value: 'dark'
  }
}
```

### 技能系统
```javascript
// 执行网页抓取技能
{
  type: 'command',
  action: 'skill.execute',
  params: {
    skillId: 'web_scraping',
    params: {
      url: 'https://example.com',
      selector: 'h1'
    }
  }
}

// 创建自定义技能
{
  type: 'command',
  action: 'skill.create',
  params: {
    skillData: {
      id: 'my_skill',
      name: '我的技能',
      description: '自定义技能',
      category: 'custom',
      steps: [...]
    }
  }
}
```

### 通知系统
```javascript
// 发送任务完成通知
{
  type: 'command',
  action: 'notification.task_complete',
  params: {
    taskName: '数据处理',
    success: true
  }
}

// 发送自定义通知
{
  type: 'command',
  action: 'notification.send',
  params: {
    title: 'ClawMind',
    message: '操作完成',
    type: 'success',
    sound: true
  }
}
```

## 安装依赖

```bash
# 通知系统
cd notifications
npm install

# 其他模块无需额外依赖
```

## 集成到 OpenClaw

高级功能已集成到 OpenClaw Client，可以通过 WebSocket 指令直接调用。

## 总计功能

- **记忆系统**：13 个 API
- **技能系统**：7 个 API + 3 个内置技能
- **通知系统**：10 个 API

**第六阶段总计：30 个新功能**
