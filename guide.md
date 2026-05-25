# 项目开发指南

## 项目概述

一个基于 React + Verovio 的浏览器端五线谱读谱练习工具。用户打开 MusicXML 乐谱文件，通过键盘或 MIDI 输入演奏，系统实时判定音高和节奏准确度，用不同颜色标记乐谱上的音符，并提供等级评分和错误热力图。

**核心链路**: 打开 MusicXML → Verovio 渲染 SVG → GameLoop 控制播放 → 键盘/MIDI 输入 → JudgmentEngine 判定 → 乐谱音符着色 → 统计更新

---

## 文件功能索引

### 入口与配置

| 文件 | 作用 |
|------|------|
| `index.html` | HTML 入口，预加载 Leland 字体，挂载 `#root` |
| `src/main.tsx` | JS 入口，预初始化 `VerovioRenderer`（启动 WASM 下载），渲染 `<App/>` |
| `src/verovio.d.ts` | Verovio WASM 模块的类型声明（`verovio/wasm`, `verovio/esm`） |
| `vite.config.ts` | Vite 配置，设置 COOP/COEP 响应头以支持 SharedArrayBuffer |
| `eslint.config.js` | ESLint Flat Config |
| `tsconfig.json` | 根 tsconfig（project references 模式） |
| `tsconfig.app.json` | 源码 tsconfig（target: es2023, jsx: react-jsx, noUnusedLocals/Parameters） |
| `tsconfig.node.json` | Vite 配置文件的 tsconfig |

### 类型定义 — `src/score/`

| 文件 | 导出 | 说明 |
|------|------|------|
| `ScoreTypes.ts` | `ScoreEvent`, `StaffData`, `MeasureEvent`, `TempoPoint`, `ScoreData`, `HighlightColumn`, `DisplayMode`, `PlayState`, `PracticeState`, `ScoreStats`, `JudgmentGrade`, `JudgmentResult`, `PracticeAction` | 项目全部类型定义。**核心接口**：`ScoreEvent`（pitch/time/duration/measureIndex/isRest/voice/staffIndex）、`PracticeState`（全局状态，33 个字段）、`PracticeAction`（41 种 action 的联合类型） |
| `MusicxmlParser.ts` | `parseFromXml(xmlText: string): ScoreData` | 解析 MusicXML 字符串为 `ScoreData`。内部函数：`pitchToMidi()` 将音名+八度+升降转为 MIDI 数字，`extractTitle()` 从 XML 提取标题。支持 `<backup>`/`<forward>` 元素，处理和弦 `<chord>`（同一声部多个音符同一时刻），支持复声部（voice）和多谱表（staff） |

### 数据层 — `src/data/`

| 文件 | 导出 | 说明 |
|------|------|------|
| `mockScore.ts` | `getMockScore(): ScoreData` | 默认的 C 大调音阶 Mock 数据（5 小节，四分音符上下行） |

### 状态管理 — `src/context/`

| 文件 | 导出 | 说明 |
|------|------|------|
| `practiceContext.ts` | `PracticeStateContext`, `PracticeDispatchContext` | 两个独立的 React Context：state（只读）和 dispatch（操作），避免不相关的订阅重渲染 |
| `practiceStore.tsx` | `PracticeProvider`, 常量 `PERSISTED_KEYS` | Reducer + localStorage 持久化 Provider。Reducer 处理 41 种 action。PERSISTED_KEYS 数组（20 个键）控制哪些字段存入 `musicalStaffPlay_settings`。**关键规则**：新增持久化字段时，需同时加入 PERSISTED_KEYS 数组和 useEffect 依赖数组（行 ~202） |
| `usePractice.ts` | `usePractice()`, `usePracticeDispatch()` | 访问 state + dispatch 的 Hook。内部校验 Provider 存在性 |

### 游戏循环 — `src/core/`

| 文件 | 导出 | 说明 |
|------|------|------|
| `GameLoop.ts` | `GameLoop` (class), `getGameLoop(): GameLoop`, `GameLoopConfig`, `GameLoopDomRefs` | **项目核心**，模块级单例。统一管理播放、渲染、判定、高亮的生命周期 |

#### GameLoop 关键方法

| 方法 | 说明 |
|------|------|
| `init(dispatch, domRefs)` | 绑定 dispatch 和 DOM refs，通过 `InputRouter` 注册键盘事件监听和 MIDI note-on 回调。键盘映射：scroll+playing 时 A-K → MIDI 60-72（含黑键），page+not playing 时 Arrow 键翻页。启动 RAF 渲染循环 |
| `destroy()` | 停止播放，移除事件监听，取消 RAF |
| `loadScore(score, rawDocument)` | 设置 TempoClock、通过 `EventRegistry.build()` 展平事件并建列分组、设置 `JudgmentEngine.setRegistry()`、计算空拍节、加载 Verovio |
| `applyLayout(opts)` | 调用 `VerovioRenderer.applyLayout()`，更新总页数 |
| `setConfig(partial)` | 更新配置。响应 BPM 变化重配 TempoClock；响应 FPS 变化重启逻辑时钟；响应 MIDI 变化重连设备；响应 emptyMeasures 变化重算空拍节 |
| `play()` / `pause()` / `stop()` | 播放状态切换。stop 时输出 `[DEBUG-diagnose]` 日志 |
| `seekToBeat(beat)` | 跳转到指定节拍位置 |
| `reapplyJudgments()` | 页面模式下重新施加已判定的 CSS data-judgment（用于切换页面后恢复颜色） |
| `renderSvg(pageNo)` / `renderAllSvgs()` / `hasVerovioDoc()` / `pageCount` / `vrvPageCount` | 代理 Verovio 渲染方法 |

#### GameLoop 内部机制

**双时钟系统**:
- **逻辑时钟** (`_logicTick`, setInterval, 可配置 FPS): 计算当前节拍、驱动 scrollOffset 更新（dispatch SET_SCROLL_OFFSET）、调用 `checkMissed()`、检测播放结束
- **渲染时钟** (`_renderTick`, RAF, 可配置节流): 更新 SVG transform（滚动）、playhead 位置、音符高亮、自动翻页

**节拍时间线**:
- `_emptyBeats` = emptyMeasures × 首小节拍号分子 → 播放前预留的空小节对应的节拍数
- `_totalWithEmpty` = totalBeats + _emptyBeats → 含空小节的节拍总数
- `_getElapsed()` → `performance.now() / 1000 - _startTime + _pauseElapsed`
- `displayBeat` = timeToBeat(elapsed) - _emptyBeats → 实际乐谱节拍

**判定键格式**: `"${measureIndex}:${staffIndex}:${noteIndex}"` — 在 `EventRegistry` 中统一使用

**高亮逻辑** (`_updateHighlights`):
1. 通过 `EventRegistry.getUpcomingColumns()` 扫描 `displayBeat` 之后未判定的音符列
2. 按时间分组为 columns（时间差 < 0.001s 视为同一 column）
3. 取前 `highlightRange` 个 columns：第 0 列 `highlight-active`（亮色），其余 `highlight-preview`（暗淡）

**SVG 事件映射** (`_buildFlatEventSvgIds`):
1. 由 `VerovioScoreToSvgMapper.build()` 按 `qstamp`+pitch+staff:voice 匹配内部事件到 SVG note 元素
2. 映射结果通过 `EventRegistry.applySvgIds()` 写回

### 渲染引擎 — `src/renderer/`

| 文件 | 导出 | 说明 |
|------|------|------|
| `VerovioEngine.ts` | `VerovioRenderer` (class), `getVerovioRenderer(): VerovioRenderer`, `VerovioLayoutOptions`, `TimemapElement`, `TimemapEntry` | Verovio WASM 渲染器封装 |

#### VerovioRenderer 方法

| 方法 | 说明 |
|------|------|
| `init(): Promise<void>` | 惰性加载 Verovio WASM 模块（~2MB），创建 `VerovioToolkit` 实例。幂等，重复调用返回同一个 Promise |
| `loadScore(data: string): boolean` | 加载 XML/MEI 数据，调用 `resetXmlIdSeed(0)` 保证 ID 稳定，设置 `svgAdditionalAttribute` 使 SVG note 元素携带 pname/oct/staff/voice 属性 |
| `applyLayout(opts: VerovioLayoutOptions): void` | 设置 scale=`40*zoom`、pageWidth、pageHeight、spacingStaff、spacingLinear，重布局。**清空全部缓存**（SVG/timemap/eventIdMap） |
| `renderSVG(pageNo: number): string` | 渲染单页 SVG（1-indexed），有缓存 |
| `renderAllSVGs(): string[]` | 渲染全部页面 SVG |
| `getTimemap(): TimemapEntry[]` | 获取音符时间映射（`qstamp` / `tstamp` / `on` / `off`），有缓存 |
| `buildNoteQstampMap(): Map<string, number>` | 从 timemap 构建 `noteId → qstamp` 映射，用于事件对齐 |
| `getElementAttr(xmlId: string): Record<string, string>` | 获取 SVG 元素属性（pname, oct）。`staff`/`voice` 在 Verovio 6.1.0 中可能缺失，mapper 会回退到 DOM 推断 |
| `findNoteIdAtTime(timeMs, pitch)` | 在指定时间点查找匹配音高的 note ID |
| `ScoreToSvgMapper.build(flatEvents, vrv)` | 批量匹配内部事件到 SVG note ID，按 `qstamp` + 音高 + staff:voice 分组配对 |
| `destroy()` | 销毁 toolkit 实例，重置所有状态 |

**辅助函数**: `midiFromPnameOct(pname, oct)` 将 Verovio 音名+八度转为 MIDI 数字；`midiToPnameOct(pitch)` 反向转换

### 播放与判定 — `src/playback/`

| 文件 | 导出 | 说明 |
|------|------|------|
| `TempoClock.ts` | `TempoClock` (class) | 节拍↔时间算术转换。支持 Tempo Map（BPM 变化）和 BPM 倍率覆盖 |
| `JudgmentEngine.ts` | `JudgmentEngine` (class) | 音高+时间判定引擎，支持和弦输入、自动 miss 检查 |
| `MidiInputManager.ts` | `MidiInputManager` (class), `getMidiInputManager()`, `MidiDeviceInfo`, `MidiStatus` | Web MIDI API 封装，模块级单例 |
| `useMidi.ts` | `useMidi(): { status, inputName, devices, isAccessGranted, connect, close }` | MIDI React Hook，返回状态和设备列表 |

#### TempoClock 方法

| 方法 | 说明 |
|------|------|
| `configure(rawMap, bpmOverrideEnabled, bpmOverride, speedRatio)` | 设置原始 Tempo Map、BPM 覆盖开关、固定 BPM 值、速度倍率。四个参数共同决定有效 Tempo Map |
| `beatToTime(beat): number` | 节拍→秒 |
| `timeToBeat(timeSec): number` | 秒→节拍 |
| `beatToTimeOriginal(beat): number` | 使用原始 Tempo Map（不受 BPM 倍率影响） |
| `getBpmAt(beat): number` | 获取指定节拍处的 BPM |

#### JudgmentEngine 方法

| 方法 | 说明 |
|------|------|
| `setClock(clock)` | 设置 TempoClock，重建索引 |
| `buildIndex()` | 遍历所有 Measure→Staff→Event，将每个非休止符事件转为 `IndexedEvent`（含 timeSec = beatToTime），按时间排序 |
| `onInputColumn(pitches[], currentTime): JudgmentResult[]` | **和弦判定**（当前使用），对每个输入音高在窗口内找最佳匹配事件 |
| `checkMissed(currentTime)` | 自动标记超过 `timeSec + MISS_WINDOW` 的未判定事件为 miss |
| `reset()` | 清空 judged 集合 |
| `setRegistry(registry)` | 绑定 EventRegistry 引用（替代旧版 `setClock`/`buildIndex`） |
| `computeGrade(played, expected, delta): JudgmentGrade` | 判定等级：pitch 不匹配→miss，delta≤40ms→perfect，≤80ms→great，≤120ms→good，>120ms→miss |

**判定窗口常量**: PERFECT=0.04s, GREAT=0.08s, GOOD=0.12s, MISS_WINDOW=0.2s

#### MidiInputManager 方法

| 方法 | 说明 |
|------|------|
| `requestAccess(): Promise<boolean>` | 请求 MIDI 访问权限（需用户手势） |
| `open(deviceId?)` | 打开指定设备或自动选择第一个可用设备，注册 midimessage 处理器 |
| `close()` | 关闭当前 MIDI 输入 |
| `destroy()` | 完全销毁（关闭输入 + 清除 access 引用） |

**状态机**: disconnected → connecting → connected/denied/unavailable

**属性**: `status`, `devices`, `inputName`, `isAccessGranted`
**回调**: `onStatusChange`, `onNoteOn(pitch, velocity)`, `onDevicesChange`

### 反馈系统 — `src/feedback/`

| 文件 | 导出 | 说明 |
|------|------|------|
| `JudgmentDisplay.ts` | `JudgmentDisplay` (class) | 在 SVG `<g class="note">` 元素上设置 `data-judgment="perfect\|great\|good\|miss"` 属性 |

#### JudgmentDisplay 方法

| 方法 | 说明 |
|------|------|
| `show(svgId, grade)` | 设置指定 note 元素的 data-judgment 属性（CSS 据此着色：绿/蓝/黄/红） |
| `applyToPage()` | 重新施加所有已判定元素的属性（页面切换后使用） |
| `reset()` | 清空已判定记录 |

### UI 组件 — `src/components/`

| 组件 | 说明 |
|------|------|
| `TopBar.tsx` | 顶部栏：标题 + 当前乐谱名 + 页面/滚动模式切换按钮 |
| `ControlBar.tsx` | 控制栏：文件打开 + 传输控制 + 显示设置（缩放/BPM/高亮参数，原 `DisplaySettings.tsx` 已合并）+ 位置控制 + MIDI 按钮 + 设置齿轮。显示当前播放状态指示灯 |
| `ScoreFileSelector.tsx` | 文件选择器：支持 `.musicxml`/`.mxl`/`.xml`。`.mxl` 通过 JSZip 解压提取 XML。接受 `.mei` 拓展名但 format 标签仍为 musicxml |
| `TransportControls.tsx` | 播放控制：重头开始(⏮) / 播放(▶) / 暂停(⏸) / 停止(⏹)。播放时自动尝试 MIDI 连接 |
| `PositionControls.tsx` | 位置控制：起止小节范围输入、页面模式下显示当前页/总页和翻页按钮 |
| `ScoreView.tsx` | **核心容器组件**：持有 3 个 ref（container/svgWrap/playhead），通过 `useEffect` 桥接 React 状态到 `GameLoop`。使用 `memo` 优化的 `SvgRenderer` 通过 `dangerouslySetInnerHTML` 渲染 Verovio SVG。包含 MutationObserver 调试日志 |
| `TimelineBar.tsx` | 底部时间轴：进度条 + 小节刻度标记 + 当前位置标签。点击跳转：page 模式跳页，scroll 模式 seek 到对应节拍 |
| `StatsPanel.tsx` | 右侧统计面板：等级（S≥95%/A≥85%/B≥70%/C≥50%/D）、Combo 计数（带闪烁动画）、各等级计数、准确率、逻辑/渲染 FPS 实时显示、Review 按钮 |
| `HeatmapView.tsx` | 热力图弹窗：每个小节的错误率（错误数/事件数），颜色从绿（低）到红（高），显示总分和最大 Combo |
| `SettingsPanel.tsx` | 设置弹窗（⚙）：显示参数（Zoom/BPM/判断线/窗口/Lead/高亮/FPS）、排版参数（页面宽高/行间距/音符间距）、MIDI 设置（开关/设备选择/连接按钮）、声部颜色（8 个颜色选择器）、Reset Defaults 按钮 |

### 样式 — `src/`

| 文件 | 说明 |
|------|------|
| `index.css` | CSS 变量定义（light/dark 主题）、全局重置、Leland 字体声明 |
| `App.css` | 全部组件样式，包括布局、按钮、面板、动画、Verovio note 高亮和判定着色规则 |

**CSS 变量**: `--text`, `--text-h`, `--bg`, `--bg-alt`, `--border`, `--accent`, `--success`, `--warning`, `--danger` 等，支持 `prefers-color-scheme: dark`

**Verovio 高亮和判定 CSS**:
- `g.note.highlight-active { fill: #7c3aed !important }` — 下一列全亮
- `g.note.highlight-preview { opacity: 0.3; fill: #7c3aed !important }` — 后续列暗淡
- `g.note[data-judgment="perfect"] { fill: #16a34a }` — 绿色
- `g.note[data-judgment="great"] { fill: #3b82f6 }` — 蓝色
- `g.note[data-judgment="good"] { fill: #eab308 }` — 黄色
- `g.note[data-judgment="miss"] { fill: #ef4444 }` — 红色

### 静态资源

| 路径 | 说明 |
|------|------|
| `public/favicon.svg` | 网站图标 |
| `public/icons.svg` | SVG 图标集 |
| `src/assets/Leland-0.80/Leland.otf` | Verovio 渲染用乐谱字体 |
| `src/assets/Leland-0.80/LelandText.otf` | Leland 文本字体 |

---

## 数据流全貌

```
用户点击 Open → ScoreFileSelector.tsx
  → FileReader 读取文件 → MusicxmlParser.parseFromXml(xml) → ScoreData
  → dispatch({ type: 'LOAD_SCORE', score, rawDocument: xml })

ScoreView.tsx (useEffect 响应 rawDocument 变化)
  → GameLoop.loadScore(score, rawDocument)
    → TempoClock.configure(tempoMap, bpmOverrideEnabled, bpmOverride, speedRatio)
    → EventRegistry.build(score, clock) → 展平 + 列分组
    → JudgmentEngine.setRegistry(registry)
    → VerovioRenderer.loadScore(rawDocument)
    → VerovioRenderer.applyLayout({ zoom, pageWidth, ... })
    → _buildFlatEventSvgIds() → EventRegistry.applySvgIds()

用户点击 Play → TransportControls.tsx
  → dispatch({ type: 'PLAY' })
  → GameLoop.play()
    → _startTime = performance.now()
    → _startLogicInterval() (setInterval → _logicTick)
    → _scheduleRender() 已在 init() 中启动 (RAF → _renderTick)

逻辑时钟 (_logicTick, ~60fps):
  → _getElapsed() → timeToBeat(elapsed)
  → dispatch SET_SCROLL_OFFSET
  → JudgmentEngine.checkMissed(judgeTime)
  → 检测播放结束 → dispatch STOP

渲染时钟 (_renderTick, ~60fps 可选节流):
  → _updateHighlights(displayBeat) → EventRegistry.getUpcomingColumns() → HighlightRenderer.update() → CSS class 切换
  → 滚动模式: svgWrap.style.transform = translateY(-offset)
  → 页面模式: 更新 playhead 水平位置 + 自动翻页

用户按下按键 (scroll + playing):
  → GameLoop._handleNoteInput(midiNote)
    → _getElapsed() → judgeTime
    → JudgmentEngine.onInputColumn([midiNote], judgeTime)
      → 在 _indexedEvents 中搜索 timeSec ± GOOD_WINDOW 内未判定事件
      → computeGrade(pitch, event.pitch, delta)
      → 返回 JudgmentResult

判定回调:
  → GameLoop._je.onJudgment = (result) => {
      const key = ... // "measureIndex:staffIndex:noteIndex"
      dispatch({ type: 'JUDGE', result })
        → practiceReducer: 更新 stats (grade 计数 + combo/maxCombo + measureErrors)
      const svgId = _eventRegistry.get(key)?.svgId
      → JudgmentDisplay.show(svgId, grade)
        → el.setAttribute('data-judgment', grade)
          → CSS 自动着色
    }
```

---

## PlayState 状态流转

```
stopped ──(PLAY)──► playing
playing ──(PAUSE)──► paused
paused  ──(PLAY)──► playing
任何态 ──(STOP)──► stopped (重置 page/offset/judgedNotes)
任何态 ──(RESTART)──► playing (重置 page/offset/judgedNotes)
playing ──(播放结束)──► STOP
```

---

## 常见修改场景

### 新增一个设置项

1. `ScoreTypes.ts` → `PracticeState` 添加字段
2. `ScoreTypes.ts` → `PracticeAction` 添加对应 action 类型
3. `practiceStore.tsx` → `initialState` 添加默认值
4. `practiceStore.tsx` → `practiceReducer` 添加 case
5. `practiceStore.tsx` → `PERSISTED_KEYS` + useEffect 依赖数组中添加
6. 在需要的组件中使用（通过 `usePractice()` 访问）
7. 如果需要传给 GameLoop，在 `GameLoopConfig` 接口和 `setConfig` 中处理

### 新增键盘映射

1. `GameLoop.ts` → `KEY_TO_MIDI` 对象中添加键值对
2. 如果是 page 模式的快捷键，在 `_keyDownHandler` 中 `displayMode === 'page'` 分支添加

### 修改判定窗口

`JudgmentEngine.ts` 顶部常量：`PERFECT_WINDOW`, `GREAT_WINDOW`, `GOOD_WINDOW`, `MISS_WINDOW`

### 修改 Verovio 渲染样式

`src/App.css` 底部 `g.note.highlight-*` 和 `g.note[data-judgment="*"]` CSS 规则

### 添加新的反馈效果

`JudgmentDisplay.ts` → `show()` 中添加新属性的设置逻辑，然后在 `App.css` 中添加对应的 CSS 规则
