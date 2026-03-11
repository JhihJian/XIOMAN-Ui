# 全国一体化智能中心 · 客户端 MVP 功能说明

> **版本**：v0.1  
> **基座**：基于 AionUi 开源项目二次开发  
> **原则**：最小改动，复用 AionUi 已有对话能力，只新增"被中心平台管起来"的部分

---

## 整体流程

```
启动应用
  │
  ├─ ① 节点注册/认证（首次注册，后续携带 Token）
  │
  ├─ ② 权限校验（是否被授权/禁用）
  │
  ├─ ③ 拉取 Agent 列表 → 与本地比对 → 下载/更新
  │
  ├─ ④ 拉取通知列表 → 展示 → 点击可直接进入关联 Agent 对话
  │
  └─ ⑤ Agent 对话运行（AionUi 原生逻辑）
```

---

## ① 节点注册与身份认证

**触发时机**：应用首次启动，或本地 Token 失效时。

**流程**：

```
首次启动 → 显示注册/登录页面
  │
  ├─ 用户输入：中心平台地址 + 节点名称 + 授权码
  │
  ├─ POST /api/nodes/register
  │   请求：{ node_name, auth_code, device_info }
  │   响应：{ node_id, token, token_expires_at }
  │
  ├─ Token 存储到本地（SQLite 或配置文件）
  │
  └─ 后续所有请求 Header 携带 Authorization: Bearer <token>
```

**需要的界面**：

- 注册/登录页：输入中心平台地址、节点名称、授权码，一个"注册"按钮
- Token 过期时自动跳转回此页面，提示"凭证已过期，请重新认证"

**本地存储**：

| 字段 | 说明 |
|---|---|
| server_url | 中心平台地址 |
| node_id | 注册后获得的节点ID |
| token | 认证凭证 |
| token_expires_at | 过期时间 |

---

## ② 权限校验

**触发时机**：每次应用启动时，在进入主界面之前。

**流程**：

```
启动 → 读取本地 Token
  │
  ├─ GET /api/nodes/auth-check
  │   响应：{ status, message }
  │     status: "active"    → 放行，进入主界面
  │     status: "disabled"  → 显示"该节点已被禁用，请联系管理员"，阻止进入
  │     status: "expired"   → 跳转注册/登录页重新认证
  │
  └─ 请求失败（网络异常）→ 使用本地缓存数据进入离线模式，顶部提示"未连接中心平台"
```

**需要的界面**：

- 启动加载页：显示"正在校验权限..."
- 禁用提示页：显示禁用原因和管理员联系方式
- 离线模式提示条：主界面顶部一行黄色横幅

---

## ③ 拉取 Agent 列表与更新

**触发时机**：权限校验通过后，进入主界面前自动执行。

**流程**：

```
GET /api/nodes/agents
  响应：[
    {
      agent_id: "data-quality-v1",
      name: "数据质量监测",
      version: "1.0.3",
      description: "帮助数据管理人员检查数据质量",
      download_url: "/api/agents/data-quality-v1/package",
      icon: "https://...",
      updated_at: "2025-07-10T10:00:00Z"
    },
    ...
  ]
    │
    ▼
  与本地已安装的 Agent 列表比对
    │
    ├─ 本地不存在 → 标记为"新 Agent"，提示下载
    ├─ 本地版本 < 远程版本 → 标记为"有更新"，提示更新
    └─ 本地版本 = 远程版本 → 无需操作
    │
    ▼
  自动下载/更新（或由用户手动确认）
    │
    ├─ GET {download_url} → 下载 Agent 定义包
    ├─ 保存到本地 Agent 目录
    └─ 加载到 AionUi 的 Agent 运行环境中
```

**Agent 定义包内容**（下载下来的是什么）：

```
agent-data-quality-v1/
├── agent.yaml        # 角色定义、能力清单、安全约束
├── knowledge/        # 知识库文件（标准文档摘要等）
│   ├── gb_standard.md
│   └── data_dict.md
└── tools.yaml        # 该 Agent 可用的工具定义
```

**需要的界面**：

- 启动时的同步进度提示："正在检查 Agent 更新... (2/3)"
- Agent 列表页（主界面的一部分）：
  - 每个 Agent 一张卡片，显示名称、描述、版本号、状态
  - 状态标签：已就绪 / 有更新（带更新按钮）/ 新可用（带下载按钮）
  - 点击卡片 → 进入该 Agent 的对话界面

---

## ④ 通知列表

**触发时机**：进入主界面后拉取，之后定时轮询（如每 5 分钟一次）。

**流程**：

```
GET /api/nodes/notifications
  响应：[
    {
      id: "notif_001",
      title: "数据质量监测技能包已更新至 v1.0.3",
      content: "本次更新优化了异常分析的准确率...",
      type: "update",           # update / task / alert / info
      related_agent_id: "data-quality-v1",   # 可为 null
      created_at: "2025-07-10T10:00:00Z",
      read: false
    },
    ...
  ]
```

**通知类型与行为**：

| type | 含义 | 点击行为 |
|---|---|---|
| update | Agent 版本更新通知 | 跳转到 Agent 列表，高亮对应 Agent |
| task | 有新任务需要处理 | 直接打开关联 Agent 的对话，预填任务内容 |
| alert | 中心平台下发的告警 | 打开关联 Agent 对话，预填告警上下文 |
| info | 一般通知公告 | 展开查看详情，无跳转 |

**"一键进入 Agent 对话"的逻辑**：

```
用户点击一条关联了 Agent 的通知
  │
  ├─ 检查该 Agent 本地是否已安装且就绪
  │     ├─ 是 → 打开该 Agent 的新对话，自动将通知内容作为上下文注入
  │     └─ 否 → 提示"该 Agent 尚未安装，是否立即下载？"
  │
  └─ 对话打开后，输入框预填建议消息
       如："中心平台通知：XX 省数据质量检查发现 3 项异常，请协助排查"
```

**需要的界面**：

- 主界面通知入口：顶部导航栏的铃铛图标 + 未读数量角标
- 通知列表面板：点击铃铛展开，按时间倒序，未读加粗显示
- 每条通知：标题 + 时间 + 类型标签 + 已读/未读状态
- 关联 Agent 的通知右侧显示"进入对话 →"快捷按钮

---

## ⑤ Agent 对话运行

**直接复用 AionUi 现有对话逻辑**，仅做以下适配：

| 适配项 | 说明 |
|---|---|
| System Prompt 来源 | 从本地 Agent 定义包的 agent.yaml 读取并组装，替代 AionUi 原有的手动配置 |
| 工具定义来源 | 从 tools.yaml 读取，注册到 AionUi 的 Function Calling 链路中 |
| 知识库注入 | 将 knowledge/ 目录下的文件内容拼接到 System Prompt 中 |
| LLM 配置 | 使用 Agent 定义包中指定的模型，或沿用 AionUi 全局配置 |
| 对话记录 | 沿用 AionUi 本地 SQLite 存储，额外增加 agent_id 字段关联 |

**不改动的部分**：

- 对话气泡 UI、流式输出、会话管理、输入框交互 → 全部复用 AionUi
- 多会话、上下文管理、Markdown 渲染 → 全部复用 AionUi
- LLM 调用链路（API Key 配置、模型切换） → 全部复用 AionUi

---

## API 汇总

客户端需要对接的中心平台接口，共 6 个：

| 方法 | 路径 | 用途 | 调用时机 |
|---|---|---|---|
| POST | /api/nodes/register | 节点注册 | 首次启动 |
| GET | /api/nodes/auth-check | 权限校验 | 每次启动 |
| GET | /api/nodes/agents | 获取 Agent 列表 | 启动时 + 手动刷新 |
| GET | /api/agents/:id/package | 下载 Agent 定义包 | 有新版本时 |
| GET | /api/nodes/notifications | 获取通知列表 | 启动时 + 定时轮询 |
| PUT | /api/nodes/notifications/:id/read | 标记通知已读 | 用户查看通知时 |

---

## 界面改动总结

相对于 AionUi 原版，需要新增的界面：

| 页面/组件 | 类型 | 说明 |
|---|---|---|
| 节点注册页 | 新页面 | 输入平台地址、节点名、授权码 |
| 启动校验页 | 新页面 | "正在校验权限..."加载态 |
| 节点禁用页 | 新页面 | 被禁用时的提示页 |
| Agent 列表页 | 新页面（或改造 AionUi 首页） | Agent 卡片列表，替代 AionUi 原有的模型选择页 |
| 通知面板 | 新组件 | 顶栏铃铛 + 下拉通知列表 |
| 离线模式提示条 | 新组件 | 顶部黄色横幅 |

**不需要改的界面**：对话页面、会话侧边栏、设置页面、文件预览 → 全部沿用 AionUi。

---

*文档版本：v0.1 | 基于 AionUi 二次开发*
