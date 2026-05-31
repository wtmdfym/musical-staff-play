export type Dynamics = 'pp' | 'p' | 'mp' | 'mf' | 'f' | 'ff'

export interface ScoreEvent {
  pitch: number
  time: number
  duration: number
  measureIndex: number
  isRest: boolean
  voice: number
  staffIndex: number
  dynamics: Dynamics
}

export interface PedalEvent {
  beat: number
  type: 'start' | 'stop'
  measureIndex: number
}

export interface StaffData {
  clef: 'treble' | 'bass'
  events: ScoreEvent[]
}

export interface MeasureEvent {
  index: number
  staves: StaffData[]
  timeSignature: [number, number]
  startBeat: number
  duration: number
}

export interface TempoPoint {
  time: number
  bpm: number
}

export interface ScoreData {
  title: string
  measures: MeasureEvent[]
  totalBeats: number
  bpm: number
  tempoMap: TempoPoint[]
  pedalEvents: PedalEvent[]
}

export type DisplayMode = 'page' | 'scroll'

export type HighlightMode = 'color' | 'box'

export type PlayState = 'stopped' | 'playing' | 'paused'

export type ThemeName = 'ocean' | 'rose' | 'olive' | 'slate'

export type ColorScheme = 'light' | 'dark' | 'auto'

export interface HighlightColumnNote {
  svgId: string
  staffIndex: number
  voice: number
}

export interface HighlightColumn {
  notes: HighlightColumnNote[]
}

export interface MeasureErrorCounts {
  noteOn: number
  noteOff: number
  velocity: number
  pedal: number
}

export interface MeasureVelocityDeviation {
  totalDeviation: number
  count: number
}

export interface PracticeState {
  displayMode: DisplayMode
  zoom: number
  playState: PlayState
  currentPage: number
  scrollOffset: number
  score: ScoreData | null
  rangeStart: number
  rangeEnd: number
  fileName: string
  stats: ScoreStats
  showHeatmap: boolean
  highlightMeasure: number
  measureErrors: Record<number, MeasureErrorCounts>
  measureDeviations: Record<number, MeasureVelocityDeviation>
  bpmOverrideEnabled: boolean
  bpmOverride: number
  speedRatio: number
  measuresWindow: number
  emptyMeasures: number
  totalPages: number
  voiceColors: Record<number, string>
  judgedNotes: Record<string, boolean>
  highlightLeadBeats: number
  highlightRange: number
  logicFps: number
  renderFps: number
  verovioPageWidth: number
  verovioPageHeight: number
  verovioStaffSpacing: number
  verovioNoteSpacing: number
  midiEnabled: boolean
  midiDeviceId: string
  highlightMode: HighlightMode
  autoPlay: boolean
  autoPlayVolume: number
  autoPlayDelay: number
  velocityJudgmentEnabled: boolean
  pedalJudgmentEnabled: boolean
  noteOffJudgmentEnabled: boolean
  rawDocument: string | null
  documentFormat: 'musicxml' | 'mei' | null
  theme: ThemeName
  colorScheme: ColorScheme
  layoutCommitVersion: number
}

export interface PerDimensionStats {
  perfect: number
  great: number
  good: number
  miss: number
}

export interface ScoreStats {
  noteOn: PerDimensionStats
  noteOff: PerDimensionStats
  velocity: PerDimensionStats
  pedal: PerDimensionStats
  combo: number
  maxCombo: number
}

export type JudgmentGrade = 'perfect' | 'great' | 'good' | 'miss'

export type JudgmentType = 'noteOn' | 'noteOff' | 'velocity' | 'pedal'

export interface JudgmentResult {
  type: JudgmentType
  grade: JudgmentGrade
  pitch: number
  expectedPitch: number
  timingDelta: number
  expectedValue?: number
  beat: number
  measureIndex: number
  noteIndex: number
  staffIndex: number
  pedalType?: 'start' | 'stop'
}

export type PracticeAction =
  | { type: 'SET_DISPLAY_MODE'; mode: DisplayMode }
  | { type: 'SET_ZOOM'; zoom: number }
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'STOP' }
  | { type: 'RESTART' }
  | { type: 'NEXT_PAGE' }
  | { type: 'PREV_PAGE' }
  | { type: 'SET_PAGE'; page: number }
  | { type: 'SET_SCROLL_OFFSET'; offset: number }
  | { type: 'LOAD_SCORE'; score: ScoreData; fileName: string; rawDocument?: string; documentFormat?: 'musicxml' | 'mei' }
  | { type: 'SET_RANGE_START'; start: number }
  | { type: 'SET_RANGE_END'; end: number }
  | { type: 'SHOW_HEATMAP' }
  | { type: 'HIDE_HEATMAP' }
  | { type: 'JUDGE'; result: JudgmentResult }
  | { type: 'RESET_STATS' }
  | { type: 'SET_BPM'; bpm: number }
  | { type: 'SET_BPM_OVERRIDE_ENABLED'; enabled: boolean }
  | { type: 'SET_SPEED_RATIO'; ratio: number }
  | { type: 'SET_MEASURES_WINDOW'; count: number }
  | { type: 'SET_EMPTY_MEASURES'; count: number }
  | { type: 'SET_TOTAL_PAGES'; total: number }
  | { type: 'SET_VOICE_COLOR'; voice: number; color: string }
  | { type: 'LOAD_SETTINGS'; settings: Partial<PracticeState> }
  | { type: 'SET_HIGHLIGHT_LEAD'; beats: number }
  | { type: 'SET_HIGHLIGHT_RANGE'; count: number }
  | { type: 'SET_LOGIC_FPS'; fps: number }
  | { type: 'SET_RENDER_FPS'; fps: number }
  | { type: 'SET_VEROVIO_PAGE_WIDTH'; width: number }
  | { type: 'SET_VEROVIO_PAGE_HEIGHT'; height: number }
  | { type: 'SET_VEROVIO_STAFF_SPACING'; spacing: number }
  | { type: 'SET_VEROVIO_NOTE_SPACING'; spacing: number }
  | { type: 'CLEAR_JUDGED_NOTES' }
  | { type: 'SET_MIDI_ENABLED'; enabled: boolean }
  | { type: 'SET_MIDI_DEVICE_ID'; deviceId: string }
  | { type: 'SET_HIGHLIGHT_MODE'; mode: HighlightMode }
  | { type: 'SET_AUTO_PLAY'; enabled: boolean }
  | { type: 'SET_AUTO_PLAY_VOLUME'; volume: number }
  | { type: 'SET_AUTO_PLAY_DELAY'; delay: number }
  | { type: 'SET_VELOCITY_JUDGMENT'; enabled: boolean }
  | { type: 'SET_PEDAL_JUDGMENT'; enabled: boolean }
  | { type: 'SET_NOTE_OFF_JUDGMENT'; enabled: boolean }
  | { type: 'SET_THEME'; theme: ThemeName }
  | { type: 'SET_COLOR_SCHEME'; scheme: ColorScheme }
  | { type: 'COMMIT_LAYOUT' }
