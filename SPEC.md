# Six Hats V2 — 协作审议系统

## Concept & Vision

六顶思考帽（De Bono）的可视化协作审议工具。用户输入话题 → 6位AI agent各戴一顶帽子同时发言 → 展示思维碰撞。

**视觉定位**：优雅克制的高端工具感，不是Geek终端风，而是接近 Linear/Notion 的精致产品感。深色主题但色彩精准克制，每顶帽子有强烈而独立的视觉身份。

---

## Design Language

### Aesthetic
- 风格：深色精密工具风（Linear / Vercel Dashboard），色彩克制但每顶帽子高饱和
- 背景：#0a0a0f（近黑）
- 卡片：#13131a（深灰）
- 边框：#1e1e2e（微弱紫灰）
- 文字主：#e2e2e8
- 文字次：#6e6e82
- 强调：#58a6ff

### Hat Colors
| 帽子 | 色值 | 强调色 |
|------|------|--------|
| 🤍 白帽 | #e8e8e8 | #ffffff |
| ❤️ 红帽 | #ff4d4d | #ff6b6b |
| 💛 黄帽 | #ffd700 | #ffe44d |
| 💚 绿帽 | #3fb950 | #56d364 |
| 💙 蓝帽 | #58a6ff | #79b8ff |
| 🖤 黑帽 | #6e7681 | #8b949e |

### Typography
- 标题: `Space Grotesk`, 600 weight
- 正文: `JetBrains Mono`, 400 weight
- 数字/标签: `JetBrains Mono`

### Motion
- 卡片入场：fade + translateY(-8px), 300ms, staggered 50ms
- 发言气泡：从底部滑入 200ms ease-out
- 设置面板：从右侧滑入 250ms cubic-bezier(0.4, 0, 0.2, 1)
- 状态变化：300ms 渐变

---

## Layout

```
┌─────────────────────────────────────────────────────────┐
│  🎩 Six Hats V2              [⚙️ 设置]                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│          ┌─────────── 话题输入 ───────────┐              │
│          │ 输入讨论话题...            [开始] │              │
│          └───────────────────────────────┘              │
│                                                         │
│     🤍 白帽        💛 黄帽         💚 绿帽                │
│   [Agent▼]    [Agent▼]     [Agent▼]                     │
│   ────────    ────────    ────────                    │
│   状态/回答    状态/回答    状态/回答                     │
│                                                         │
│     🖤 黑帽        ❤️ 红帽         💙 蓝帽               │
│   [Agent▼]    [Agent▼]     [Agent▼]                    │
│   ────────    ────────    ────────                    │
│   状态/回答    状态/回答    状态/回答                     │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  发言时间线                                                  │
│  ──────────────────────────────────────────────────────  │
│  🤍 白帽 12:01  · 发言内容...                               │
│  💛 黄帽 12:01  · 发言内容...                               │
└─────────────────────────────────────────────────────────┘
```

---

## Features

### 1. Agent 选择器（核心新功能）
- 每顶帽子右上角有下拉选择器
- 可选 agents: `claude`, `codex`, `gemini`, `pi`, `openclaw`, `kimi`, `kiro`, `kilocode`
- 默认分配：白→claude，红→codex，黄→gemini，绿→pi，蓝→openclaw，黑→kimi
- 选择后实时显示 agent 名

### 2. 话题输入 + 开始
- 居中大输入框
- 回车或点击「开始」触发所有帽子并行发言
- 开始后输入框变灰，显示话题标签

### 3. 帽子卡片
- 6张卡片，2行×3列布局
- 每张：帽子emoji+名字 / agent下拉 / 状态 / 回答内容
- 状态：idle（等待）/ speaking（思考中+动画）/ done（显示回答）/ error（红色提示）

### 4. 并行发言
- 点开始后所有6顶帽子同时 spawn
- 每张卡片实时更新状态
- 回答到达后加入时间线

### 5. 时间线
- 按时间顺序显示所有发言
- 每条带帽子颜色左边框
- 发言内容截断，超长可展开

### 6. 设置面板
- 点右上角⚙️打开侧边栏
- 显示当前6顶帽子的 agent 分配总览
- 可一键重置为默认分配

### 7. 清空 / 重置
- 清空记录：只清时间线和卡片状态，保留话题
- 新话题：清空一切，回到初始状态

---

## Technical Approach

### Frontend
- React 18 + Vite
- CSS Modules（无 Tailwind）
- Context API 状态管理
- SSE 实时推送（或 2s 轮询）

### Backend
- Express + CORS
- `/api/speak` — spawn 单个 agent
- `/api/speak-all` — 并行 spawn 所有6个
- `/api/state` — 获取当前状态
- `/api/reset` — 重置
- `/api/agents` — 获取可用 agent 列表

### Agent Spawning（acpx）
- `claude` → `acpx --timeout 60 --format text --approve-all claude exec "<prompt>"`
- `codex` → `acpx --timeout 60 --format text --approve-all codex exec "<prompt>"`
- `gemini` → `acpx --timeout 60 --format text --approve-all gemini exec "<prompt>"`（网络问题时走 MiniMax fallback）
- `pi` / `openclaw` / `kimi` / `kiro` / `kilocode` → 同理
- voice bypass: `/tmp/.acpx_no_voice` 标志
- `[thinking]` 过滤逻辑

### State
- `/tmp/six-hats-v2-state.json`
- 结构：`{ topic, agents: {[hatId]: {agentId, status, text, error}}, timeline: [] }`

---

## Component Inventory

### `<HatCard>`
- Props: hat, agent, state, onAgentChange
- States: idle / speaking / done / error
- speaking时：帽子emoji有脉冲动画

### `<AgentSelect>`
- 下拉选择当前 hat 对应的 agent
- 显示 agent 图标 + 名字

### `<Timeline>`
- 发言记录列表
- 每条带 hat 色左边框

### `<TopicInput>`
- 大输入框 + 开始按钮
- 发言中禁用

### `<SettingsPanel>`
- 右侧滑入
- 显示当前6顶帽子+agent总览

---

## Agent → Hat 默认分配

| Hat | 默认Agent | Prompt |
|-----|-----------|--------|
| 🤍 白帽 | claude | 事实与数据：陈述可验证事实，不带感情 |
| ❤️ 红帽 | codex | 直觉与感受：表达情绪，不理性分析 |
| 💛 黄帽 | gemini | 价值与收益：找出乐观可能性和收益 |
| 💚 绿帽 | pi | 创造力：新想法、创新方案、替代思考 |
| 💙 蓝帽 | openclaw | 总结与推进：总结共识、指出分歧、推进讨论 |
| 🖤 黑帽 | kimi | 谨慎与风险：指出风险、问题、潜在陷阱 |
