# 五线谱读谱练习器（Web版）

一个基于 Web 技术构建的五线谱读谱练习工具，通过 MIDI/键盘输入，以类音游玩法提供实时判定与反馈，帮助演奏者高效提升视奏能力。

## 项目目标

- 实现接近原生应用的 **低延迟 输入 → 判定 → 视觉反馈** 链路
- 以 **水平滚动五线谱卷轴** 的方式呈现乐谱，营造音游式的即时演奏体验
- 完整支持标准 MIDI 键盘输入及键盘映射，对演奏准确度进行实时评分与统计
- 纯浏览器运行，零安装，跨平台

## 技术栈

| 领域      | 选型                                                                   |
| --------- | ---------------------------------------------------------------------- |
| 开发语言  | TypeScript（严格模式）                                                 |
| 构建工具  | Vite（已配置 COOP/COEP 头）                                            |
| UI 框架   | React 19+                                                              |
| 乐谱渲染  | 自研 Canvas 渲染器（LayoutEngine + ScoreRenderer + GlyphAtlas）        |
| 乐谱解析  | MusicXML 解析（原生 DOMParser，零依赖）+ MIDI 解析                      |
| 判定引擎  | PlaybackEngine + JudgmentEngine（基于 AudioContext.currentTime）        |
| 输入      | 键盘映射（A-K → MIDI 60-72）+ Web MIDI API（已实现）                    |
| 状态管理  | React Context + useReducer（轻量全局状态，支持 dispatch 独立上下文）    |

## 已实现功能

### 核心判定引擎
- **PlaybackEngine** — 基于 `AudioContext.currentTime` 的精确计时引擎，支持播放/暂停/停止
- **JudgmentEngine** — 实时音高-时间比较：Perfect (≤40ms) / Great (≤80ms) / Good (≤120ms) / Miss
- **键盘输入** — A-K 键映射到 C4-C5（MIDI 60-72）用于测试演奏
- **MIDI 输入** — 通过 Web MIDI API 接入真实 MIDI 键盘，支持设备选择、热插拔，与键盘输入共用同一判定路径
- **实时统计** — Combo 计数、准确率计算、每小节错误追踪

### 乐谱渲染（完整铺面）
- **谱表** — 高音谱号 + 低音谱号，支持大谱表（Grand Staff）双行显示
- **谱号** — 高音谱号（G 谱号）和低音谱号（F 谱号）贝塞尔曲线路径
- **调号** — 支持升号/降号调（基于 fifths 值），高音/低音谱表正确定位
- **拍号** — 叠层数字显示
- **符头** — 椭圆符头 + 符干（上下方向自动判定）
- **临时记号** — 升号（♯）、降号（♭）、还原号（♮）
- **休止符** — 全休止、二分休止、四分休止、八分休止
- **符尾** — 八分（单尾）、十六分（双尾）音符
- **附点** — 附点音符渲染
- **连音符** — 圆滑线（Slur）和延音线（Tie）贝塞尔曲线
- **力度标记** — pp/p/mp/mf/f/ff 文本标记
- **渐强/渐弱** — 楔形线（crescendo/decrescendo）
- **发音记号** — staccato（圆点）、accent（重音）、tenuto（横线）

### 双模式五线谱显示
- **分页模式** — 多行五线谱静态展示，← → 翻页，行数可调（1-4）
- **滚动模式** — 水平滚动卷轴，红色虚线定位线，音符高亮提示

### 交互控制
- 文件打开（.musicxml / .mxl / .mid）
- 播放/暂停/停止/重头开始
- 缩放滑块（50%~200%）
- 每页行数选择（1~4）
- 起止小节范围设定

### 反馈组件
- 底部时间轴（进度条 + 小节刻度 + 点击跳转）
- 演奏位置高亮（滚动模式下即将演奏的音符）
- 实时统计面板（评分 S/A/B/C/D / Combo / Perfect·Great·Good·Miss）
- 判定视觉反馈层（Perfect/Great/Good/Miss 动画）
- 练习后热力图弹窗（基于真实统计数据）

## 系统架构

```
┌──────────────────────────────────────────────────────────────┐
│                      表现层 (UI)                               │
│  ┌─────────┐ ┌──────────┐ ┌────────────┐ ┌──────────────┐   │
│  │ TopBar  │ │ControlBar│ │ ScoreView  │ │ StatsPanel   │   │
│  │         │ │+Transport│ │ (Canvas)   │ │ Feedback     │   │
│  │Mode Tog │ │+FileOpen │ │ Page/Scroll│ │ Timeline     │   │
│  └─────────┘ │+Display  │ └────────────┘ │ Heatmap      │   │
│              └──────────┘               └──────────────┘   │
├──────────────────────────────────────────────────────────────┤
│                      渲染层 (Renderer)                         │
│  ┌───────────────┐ ┌───────────────┐ ┌──────────────────┐   │
│  │ ScoreRenderer │ │ PageRenderer  │ │ ScrollRenderer   │   │
│  │  (基类)        │ │  (分页)       │ │  (滚动)          │   │
│  │ +drawStaff()  │ │ +page turning │ │ +playhead       │   │
│  │ +clef/keysig  │ └───────────────┘ │ +hit indicator  │   │
│  │ +accidental   │                   └──────────────────┘   │
│  │ +slur/dyn/art │                                           │
│  └───────┬───────┘                                           │
│          ├── LayoutEngine (排版计算：大谱表、多行)              │
│          └── GlyphAtlas (符号 Path2D 缓存)                    │
├──────────────────────────────────────────────────────────────┤
│                     判定 & 时序 (Playback)                     │
│  ┌────────────────┐ ┌────────────────┐ ┌──────────────────┐   │
│  │ PlaybackEngine │ │ JudgmentEngine │ │ MidiInputManager │   │
│  │ (AudioContext  │ │ (音高-时间判定)  │ │ (Web MIDI 设备  │   │
│  │  精确计时引擎)  │ │ (Perfect/Great │ │  接入 & 消息处理) │   │
│  │ play/pause/stop│ │  /Good/Miss)   │ │                  │   │
│  └────────────────┘ └────────────────┘ └──────────────────┘   │
├──────────────────────────────────────────────────────────────┤
│                      数据层 (Model)                            │
│  ┌───────────────┐ ┌──────────────────┐ ┌──────────────┐    │
│  │  ScoreTypes    │ │ MusicxmlParser   │ │ MidiParser   │    │
│  │  (类型定义)     │ │ (XML → ScoreData)│ │ (.mid→数据)  │    │
│  └───────────────┘ └──────────────────┘ └──────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

### 状态管理

全局状态 `PracticeState` 通过 React Context + `useReducer` 管理，提供独立 `PracticeStateContext` 和 `PracticeDispatchContext`：

- 显示模式（分页/滚动）、缩放比例、行数
- 播放状态（停止/播放/暂停）
- 当前页面索引 / 滚动偏移
- 乐谱数据、文件名
- 起止小节范围
- 实时统计数据（Perfect/Great/Good/Miss/Combo/准确率）
- 每小节错误计数（热力图数据）
- 热力图显示开关

### 目录结构

```
src/
├── App.tsx                 # 顶层布局
├── App.css                 # 全局样式
├── index.css               # CSS 变量 + 重置
├── main.tsx                # 入口
├── score/                  # 乐谱数据层
│   ├── ScoreTypes.ts       # 全部类型定义（含 Slur/Dynamics/Articulation）
│   ├── MusicxmlParser.ts   # MusicXML 解析器（含连音符/力度/发音解析）
│   └── MidiParser.ts       # MIDI (.mid) 文件解析
├── data/
│   └── mockScore.ts        # 默认 Mock 数据
├── context/
│   ├── practiceContext.ts  # 双 Context 定义（state/dispatch 分离）
│   ├── practiceStore.tsx   # Reducer + Provider
│   └── usePractice.ts      # 访问 Hook（含 usePracticeDispatch）
├── renderer/               # Canvas 渲染层
│   ├── ScoreRenderer.ts    # 基类（谱线/谱号/调号/临时记号/符头/休止符/符尾/连音符/力度/发音）
│   ├── PageRenderer.ts     # 分页渲染（支持大谱表）
│   ├── ScrollRenderer.ts   # 滚动渲染（支持大谱表、布局缓存）
│   ├── LayoutEngine.ts     # 排版计算（大谱表、布局缓存）
│   └── GlyphAtlas.ts       # 符号 Path2D 缓存（含低音谱号/升降号/休止符）
├── playback/               # 判定 & 时序引擎
│   ├── PlaybackEngine.ts   # AudioContext.currentTime 高精度计时
│   ├── JudgmentEngine.ts   # 音高-时间比较判定
│   └── MidiInputManager.ts # Web MIDI 设备接入与管理
├── components/             # React UI 组件
│   ├── TopBar.tsx          # 标题 + 模式切换
│   ├── ControlBar.tsx      # 控制工具栏
│   ├── ScoreFileSelector   # 文件选择
│   ├── TransportControls   # 播放控制
│   ├── DisplaySettings     # 缩放/行数
│   ├── PositionControls    # 起止范围
│   ├── ScoreView.tsx       # Canvas 容器（整合 Playback/Judgment/Keyboard）
│   ├── TimelineBar.tsx     # 时间轴进度条
│   ├── StatsPanel.tsx      # 实时统计
│   ├── FeedbackLayer.tsx   # 视觉反馈（含 Perfect/Great/Good/Miss）
│   └── HeatmapView.tsx     # 练习热力图（基于真实统计）
└── feedback/
    └── emitFeedback.ts     # 反馈事件系统（支持判定类型）
```

## UI 布局

```
┌──────────────────────────────────────────────┐
│ TopBar: ♪ Musical Staff Play      [📄] [📜]  │
├──────────────────────────────────────────────┤
│ 📁 Open │ ⏮▶⏹ │ Zoom: ──●── │ Lines: [3▾] │
│ From:[0]─[4] │ ○ C Major Scale               │
├──────────────────────────────────────────────┤
│                     ┌─────────────┐          │
│                     │ StatsPanel  │          │
│   ScoreView         │ S  · 0x     │          │
│   (Canvas)          │ ★0 ●0 ●0 ✗0│          │
│   - 高音+低音谱号     │ 100%        │          │
│   - 调号/临时记号    └─────────────┘          │
│   - 连音符/力度标记                              │
│   - 符尾/附点/发音                              │
├──────────────────────────────────────────────┤
│ ████████░░░░░░░░░ |  |  |  |  |  M. 1 / 5   │
├──────────────────────────────────────────────┤
│ ← → turn pages · Keyboard (A-K) input · Play │
└──────────────────────────────────────────────┘
```

## 开发阶段

- **阶段一 ✅** — 基础框架、五线谱显示、分页/滚动模式
- **阶段二 ✅** — 交互控制、文件加载、MusicXML/MIDI 解析
- **阶段三 ✅** — 反馈组件、时间轴、统计面板、热力图
- **阶段四 ✅** — 判定引擎、PlaybackEngine、键盘输入、大谱表完整渲染、性能优化
- **阶段五 📋** — Web MIDI 设备接入 ✅、Web Audio 音频输出 📋、练习模式

## 开发命令

```bash
pnpm run dev      # 启动开发服务器
pnpm run build    # 构建 (tsc + vite build)
pnpm run lint     # ESLint 检查
pnpm run preview  # 预览构建结果
```

## 浏览器要求

- **Chromium 内核**（Chrome / Edge / Opera）≥ 90
- Web MIDI API、AudioContext、SharedArrayBuffer
- 本地开发已配置 COOP/COEP 头（`vite.config.ts`）

## 开发注意事项

- `SharedArrayBuffer` 需要 COOP/COEP 安全头（已配置）
- Web MIDI 仅 Chromium 浏览器支持（阶段五）
- `AudioContext` 必须在用户手势下启动
- 渲染时钟使用 `AudioContext.currentTime`，避免 `Date.now()` 或 `performance.now()`
- 布局计算结果已缓存，避免每帧重算
- RAF 循环仅在滚动模式播放时运行
