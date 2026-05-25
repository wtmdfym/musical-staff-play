# 五线谱读谱练习器（Web版）

一个基于 Web 技术构建的五线谱读谱练习工具，通过 MIDI/键盘输入，以类音游玩法提供实时判定与反馈，帮助演奏者高效提升视奏能力。

## 项目目标

- 实现接近原生应用的 **低延迟 输入 → 判定 → 视觉反馈** 链路
- 以 **垂直滚动五线谱卷轴** 的方式呈现乐谱，营造音游式的即时演奏体验
- 完整支持标准 MIDI 键盘输入及键盘映射，对演奏准确度进行实时评分与统计
- 纯浏览器运行，零安装，跨平台

## 技术栈

| 领域      | 选型                                                                         |
| --------- | ---------------------------------------------------------------------------- |
| 开发语言  | TypeScript（严格模式）                                                       |
| 构建工具  | Vite 8（已配置 COOP/COEP 头）                                               |
| UI 框架   | React 19+                                                                    |
| 乐谱渲染  | Verovio WASM 渲染引擎（MusicXML/MEI → SVG）                                  |
| 乐谱解析  | MusicXML 解析（原生 DOMParser，零依赖），`.mxl` 用 JSZip 解压               |
| 计时引擎  | TempoClock（节拍↔时间纯算术转换） + GameLoop（双时钟：逻辑 tick + 渲染 tick） |
| 判定引擎  | JudgmentEngine（音高-时间比较，支持和弦输入）                                |
| 输入      | 键盘映射（A-K → MIDI 60-72，含黑键） + Web MIDI API                        |
| 状态管理  | React Context + useReducer，localStorage 持久化                             |

## 已实现功能

### 核心判定引擎
- **GameLoop** — 游戏循环核心：setInterval 逻辑时钟（可配置 FPS）+ RAF 渲染时钟（可配置节流），统一调度判定、高亮、滚动、翻页
- **TempoClock** — 节拍↔时间纯算术转换，支持 Tempo Map 及 BPM 倍率覆盖
- **JudgmentEngine** — 实时音高-时间比较：Perfect (≤40ms) / Great (≤80ms) / Good (≤120ms) / Miss (>200ms 自动标记)
- **键盘输入** — A-K 键映射到 C4-C5 半音阶（含黑键 W,E,T,Y,U），仅在滚动模式播放时生效
- **MIDI 输入** — Web MIDI API 接入真实 MIDI 键盘，支持设备选择、热插拔、状态管理
- **实时统计** — Combo 计数、准确率、每小节错误追踪

### 乐谱渲染（Verovio SVG）
- Verovio WASM 原生渲染，支持 MusicXML / MEI 文件
- 自动解析调号、谱号、临时记号、连线、力度、发音记号
- 大谱表（Grand Staff）支持
- 布局参数可调：页面宽高、行间距、音符间距
- 音符 SVG 元素携带 `pname/oct/staff/voice` 元数据，供判定反馈使用

### 双模式五线谱显示
- **分页模式** — 单页静态展示，← → 翻页，播放时自动翻页
- **滚动模式** — 垂直连续卷轴，红色定位线固定在屏幕 configurable 位置，乐谱向上滚动

### 交互控制
- 文件打开（.musicxml / .mxl / .xml）
- 播放/暂停/停止/重头开始
- 缩放滑块（25%~300%）
- 起止小节范围设定
- 设置面板：排版参数、高亮参数、FPS 配置、MIDI 设备选择、声部颜色

### 反馈组件
- 底部时间轴（进度条 + 小节刻度 + 点击跳转）
- 音符高亮（即将演奏音符全亮 + 后续音符半亮，CSS class 控制）
- 实时统计面板（等级 S/A/B/C/D / Combo / Perfect·Great·Good·Miss）
- 判定反馈（SVG `<note>` 元素 `data-judgment` 属性，CSS 控制颜色）
- 练习后热力图弹窗

## 系统架构

```
┌──────────────────────────────────────────────────────────────┐
│                      表现层 (UI)                               │
│  ┌─────────┐ ┌──────────┐ ┌────────────┐ ┌──────────────┐   │
│  │ TopBar  │ │ControlBar│ │ ScoreView  │ │ StatsPanel   │   │
│  │         │ │+Transport│ │ (SVG)      │ │ TimelineBar  │   │
│  │Mode Tog │ │+FileOpen │ │ Page/Scroll│ │ HeatmapView  │   │
│  └─────────┘ │+Display  │ │            │ │ SettingsPanel│   │
│              └──────────┘ └─────┬──────┘ └──────────────┘   │
├─────────────────────────────────┼────────────────────────────┤
│                     核心层 (Core)                             │
│  ┌──────────────────────────────┴──────────────────────┐     │
│  │                    GameLoop                          │     │
│  │  逻辑时钟 (setInterval)   渲染时钟 (RAF)             │     │
│  │  → 判定检查               → 高亮更新                  │     │
│  │  → 滚动/翻页调度           → 卷轴变换                  │     │
│  └──┬──────────────────────┬───────────────────────────┘     │
├─────┼──────────────────────┼─────────────────────────────────┤
│     │      渲染 (Renderer)  │   判定&输入 (Playback)          │
│  ┌──┴─────────────────┐ ┌──┴──────────────────────────┐     │
│  │  VerovioRenderer    │ │  TempoClock    JudgmentEngine│     │
│  │  (Verovio WASM)    │ │  (节拍↔时间)   (音高-时间)    │     │
│  │  - 加载乐谱         │ │                              │     │
│  │  - 排版布局         │ │  MidiInputManager             │     │
│  │  - SVG 渲染         │ │  (Web MIDI)                   │     │
│  │  - 音符元数据       │ │                              │     │
│  │  - Event ID 映射    │ │  JudgmentDisplay              │     │
│  └────────────────────┘ │  (SVG data-judgment)          │     │
│                          └──────────────────────────────┘     │
├──────────────────────────────────────────────────────────────┤
│                      数据层 (Model)                            │
│  ┌───────────────┐ ┌──────────────────┐                       │
│  │  ScoreTypes    │ │ MusicxmlParser   │                       │
│  │  (类型定义)     │ │ (XML → ScoreData)│                       │
│  └───────────────┘ └──────────────────┘                       │
└──────────────────────────────────────────────────────────────┘
```

### 状态管理

全局状态 `PracticeState` 通过 React Context + `useReducer` 管理，提供独立 `PracticeStateContext` 和 `PracticeDispatchContext`：

- 显示模式（分页/滚动）、缩放比例
- 播放状态（停止/播放/暂停）
- 当前页面索引 / 滚动偏移
- 乐谱数据、文件名、原始 XML 文档
- 起止小节范围
- 实时统计数据（Perfect/Great/Good/Miss/Combo/MaxCombo）
- 每小节错误计数（热力图数据）
- Verovio 排版参数（页面宽高、行间距、音符间距）
- 高亮参数（前置节拍数、高亮范围）
- 逻辑/渲染 FPS 配置
- MIDI 开关与设备 ID
- 持久化键在 `practiceStore.tsx` 中 `PERSISTED_KEYS` 定义

### 目录结构

```
src/
├── App.tsx                  # 顶层布局
├── App.css                  # 全局样式
├── index.css                # CSS 变量 + 重置
├── main.tsx                 # 入口（预初始化 Verovio WASM）
├── verovio.d.ts             # Verovio 类型声明
├── core/
│   ├── GameLoop.ts          # 游戏循环核心（逻辑/渲染双时钟）
│   ├── PlaybackDriver.ts    # 播放状态 + 耗时计算
│   ├── PlaybackEvents.ts    # 事件类型定义
│   ├── InputRouter.ts       # 键盘/MIDI 输入路由
│   ├── EventRegistry.ts     # 事件索引 + 列分组 + SVG ID 映射
│   └── ViewportPositioner.ts# 卷轴变换 + 翻页检测
├── score/
│   ├── ScoreTypes.ts        # 全部类型定义（ScoreEvent/PracticeState/JudgmentResult 等）
│   ├── MusicxmlParser.ts    # MusicXML 解析器（原生 DOMParser）
│   └── ScoreEventIndex.ts   # 事件展平/排序
├── data/
│   └── mockScore.ts         # 默认 Mock 数据
├── context/
│   ├── practiceContext.ts   # 双 Context 定义（state/dispatch 分离）
│   ├── practiceStore.tsx    # Reducer + Provider + localStorage 持久化
│   └── usePractice.ts       # 访问 Hook
├── renderer/
│   ├── VerovioEngine.ts     # Verovio 渲染器（加载/排版/SVG渲染/音符元数据）
│   └── ScoreToSvgMapper.ts  # 内部事件 → SVG note ID 映射
├── playback/
│   ├── TempoClock.ts        # 节拍↔时间转换（支持 Tempo Map + BPM 倍率）
│   ├── JudgmentEngine.ts    # 判定引擎（音高+时间，支持和弦，自动 miss）
│   ├── MidiInputManager.ts  # Web MIDI 设备管理（单例）
│   ├── useMidi.ts           # MIDI React Hook
│   └── useFpsMonitor.ts     # FPS 监控 Hook
├── feedback/
│   ├── JudgmentDisplay.ts   # 判定反馈（设置 SVG data-judgment 属性）
│   ├── HighlightRenderer.ts # DOM class 高亮渲染器
│   └── BoxHighlightRenderer.ts # 包围盒高亮渲染器
└── components/
    ├── TopBar.tsx            # 标题
    ├── ControlBar.tsx        # 控制工具栏（显示设置 + 位置控制已合并至此）
    ├── ScoreFileSelector.tsx # 文件选择（.musicxml/.mxl/.xml）
    ├── TransportControls.tsx # 播放控制（含 MIDI 连接）
    ├── PositionControls.tsx  # 小节范围
    ├── ScoreView.tsx         # SVG 容器（整合 Verovio/GameLoop）
    ├── StatsPanel.tsx        # 实时统计面板
    ├── TimelineBar.tsx       # 时间轴进度条
    ├── SettingsPanel.tsx     # 设置面板弹窗
    └── HeatmapView.tsx       # 热力图弹窗
```

## UI 布局

```
┌──────────────────────────────────────────────┐
│ TopBar: ♪ 五线谱读谱练习器         [📄] [📜]  │
├──────────────────────────────────────────────┤
│ 📁 Open │ ⏮▶⏹ │ Zoom ──●── │ ⚙ Settings  │
├──────────────────────────────────────────────┤
│                     ┌─────────────┐          │
│   ScoreView (SVG)   │ StatsPanel  │          │
│                     │ Grade/Combo │          │
│   - Verovio 渲染    │ P/G/Gd/Miss │          │
│   - 音符高亮         │ Accuracy    │          │
│   - 判定着色         └─────────────┘          │
├──────────────────────────────────────────────┤
│ ████████░░░░░░░░░ |  |  |  |  |  M. 1 / 5   │
├──────────────────────────────────────────────┤
│ ← → page nav · A-K keyboard input · Play    │
└──────────────────────────────────────────────┘
```

## 开发命令

```bash
pnpm run dev      # 启动开发服务器 (Vite, port 5173)
pnpm run build    # 构建 (tsc -b && vite build)
pnpm run lint     # ESLint 检查
pnpm run preview  # 预览构建结果
```

## 浏览器要求

- **Chromium 内核**（Chrome / Edge / Opera）≥ 90
- Web MIDI API（需要安全上下文：localhost 或 HTTPS）
- SharedArrayBuffer 需要 COOP/COEP 头（`vite.config.ts` 已配置）

## 开发注意事项

- Verovio WASM 模块惰性加载（~2MB），首屏 `main.tsx` 中预初始化
- `GameLoop` 为模块级单例（`getGameLoop()`），跨组件共享，热更新时不销毁
- 逻辑时钟使用 `setInterval`（可配置 0/15/30/60/120 FPS），渲染时钟使用 `requestAnimationFrame`（可选节流）
- `VerovioRenderer.applyLayout()` 会清除 SVG 缓存和时间映射缓存，需重建事件 ID 映射
- MusicXML 解析使用原生 `DOMParser`，`.mxl` 文件通过 JSZip 解压提取 XML
- `PERSISTED_KEYS` 数组与 `useEffect` 依赖数组需同步更新，新增持久化设置时两处都要改
- ESLint：`argsIgnorePattern: "^_"` 允许下划线前缀未使用参数；ref 赋值应在 useEffect 中，不在 render
- 调试日志使用 `[DEBUG-diagnose]` 和 `[DEBUG-judge]` 前缀，请勿删除
