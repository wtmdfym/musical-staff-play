import { useReducer, useEffect, type ReactNode, useRef } from 'react'
import type { PracticeState, PracticeAction } from '../score/ScoreTypes'
import { getMockScore } from '../data/mockScore'
import { PracticeStateContext, PracticeDispatchContext } from './practiceContext'

const DEFAULT_VOICE_COLORS: Record<number, string> = {
  0: '#111111',
  1: '#7c3aed',
  2: '#16a34a',
  3: '#dc2626',
  4: '#2563eb',
  5: '#d97706',
  6: '#0891b2',
  7: '#be185d',
}

function loadPersistedState(): Partial<PracticeState> {
  try {
    const raw = localStorage.getItem('musicalStaffPlay_settings')
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore parse errors
  }
  return {}
}

const persisted = loadPersistedState()

const initialState: PracticeState = {
  displayMode: 'page',
  zoom: 1,
  playState: 'stopped',
  currentPage: 0,
  scrollOffset: 0,
  score: getMockScore(),
  rangeStart: 0,
  rangeEnd: 4,
  fileName: 'C Major Scale',
        stats: {
          noteOn: { perfect: 0, great: 0, good: 0, miss: 0 },
          noteOff: { perfect: 0, great: 0, good: 0, miss: 0 },
          velocity: { perfect: 0, great: 0, good: 0, miss: 0 },
          pedal: { perfect: 0, great: 0, good: 0, miss: 0 },
          combo: 0,
          maxCombo: 0,
        },
  showHeatmap: false,
  highlightMeasure: -1,
  measureErrors: {},
  measureDeviations: {},
  bpmOverrideEnabled: false,
  bpmOverride: 0,
  speedRatio: 1,
  measuresWindow: 4,
  emptyMeasures: 2,
  totalPages: 1,
  voiceColors: { ...DEFAULT_VOICE_COLORS },
  judgedNotes: {},
  highlightLeadBeats: 0.5,
  highlightRange: 2,
  logicFps: 60,
  renderFps: 60,
  verovioPageWidth: 2100,
  verovioPageHeight: 2970,
  verovioStaffSpacing: 12,
  verovioNoteSpacing: 0.25,
  midiEnabled: false,
  midiDeviceId: '',
  highlightMode: 'color',
  autoPlay: false,
  autoPlayVolume: 30,
  autoPlayDelay: 0,
  velocityJudgmentEnabled: false,
  pedalJudgmentEnabled: false,
  noteOffJudgmentEnabled: false,
  rawDocument: null,
  documentFormat: null,
  theme: 'ocean',
  colorScheme: 'auto',
  layoutCommitVersion: 0,
  ...persisted,
}

function practiceReducer(state: PracticeState, action: PracticeAction): PracticeState {
  switch (action.type) {
    case 'SET_DISPLAY_MODE':
      return { ...state, displayMode: action.mode, currentPage: 0, scrollOffset: 0 }
    case 'SET_ZOOM':
      return { ...state, zoom: Math.max(0.25, Math.min(3, action.zoom)) }
    case 'PLAY':
      return { ...state, playState: 'playing', showHeatmap: false }
    case 'PAUSE':
      return { ...state, playState: 'paused' }
    case 'STOP':
      return { ...state, playState: 'stopped', currentPage: 0, scrollOffset: 0, judgedNotes: {} }
    case 'RESTART':
      return { ...state, playState: 'playing', currentPage: 0, scrollOffset: 0, judgedNotes: {} }
    case 'NEXT_PAGE':
      return { ...state, currentPage: state.currentPage + 1 }
    case 'PREV_PAGE':
      return { ...state, currentPage: Math.max(0, state.currentPage - 1) }
    case 'SET_PAGE':
      return { ...state, currentPage: Math.max(0, action.page) }
    case 'SET_SCROLL_OFFSET':
      return { ...state, scrollOffset: Math.max(0, action.offset) }
    case 'LOAD_SCORE':
      return {
        ...state,
        score: action.score,
        fileName: action.fileName,
        rawDocument: action.rawDocument ?? null,
        documentFormat: action.documentFormat ?? null,
        currentPage: 0,
        scrollOffset: 0,
        playState: 'stopped',
  stats: {
    noteOn: { perfect: 0, great: 0, good: 0, miss: 0 },
    noteOff: { perfect: 0, great: 0, good: 0, miss: 0 },
    velocity: { perfect: 0, great: 0, good: 0, miss: 0 },
    pedal: { perfect: 0, great: 0, good: 0, miss: 0 },
    combo: 0,
    maxCombo: 0,
  },
        measureErrors: {},
        measureDeviations: {},
      }
    case 'SET_RANGE_START':
      return { ...state, rangeStart: Math.max(0, Math.min(state.rangeEnd, action.start)) }
    case 'SET_RANGE_END':
      return { ...state, rangeEnd: Math.max(state.rangeStart, action.end) }
    case 'SHOW_HEATMAP':
      return { ...state, showHeatmap: true }
    case 'HIDE_HEATMAP':
      return { ...state, showHeatmap: false }
    case 'JUDGE': {
      const stats = {
        noteOn: { ...state.stats.noteOn },
        noteOff: { ...state.stats.noteOff },
        velocity: { ...state.stats.velocity },
        pedal: { ...state.stats.pedal },
        combo: state.stats.combo,
        maxCombo: state.stats.maxCombo,
      }
      const dim = action.result.type
      stats[dim][action.result.grade]++
      const key = `${action.result.measureIndex}:${action.result.noteIndex}`
      const judgedNotes = { ...state.judgedNotes, [key]: true }
      const mIdx = action.result.measureIndex

      let measureErrors = state.measureErrors
      let measureDeviations = state.measureDeviations

      if (action.result.grade === 'miss') {
        measureErrors = { ...state.measureErrors }
        if (!measureErrors[mIdx]) {
          measureErrors[mIdx] = { noteOn: 0, noteOff: 0, velocity: 0, pedal: 0 }
        } else {
          measureErrors[mIdx] = { ...measureErrors[mIdx] }
        }
        measureErrors[mIdx][dim]++
      }

      if (dim === 'velocity') {
        measureDeviations = { ...state.measureDeviations }
        if (!measureDeviations[mIdx]) {
          measureDeviations[mIdx] = { totalDeviation: action.result.timingDelta, count: 1 }
        } else {
          measureDeviations[mIdx] = {
            totalDeviation: measureDeviations[mIdx].totalDeviation + action.result.timingDelta,
            count: measureDeviations[mIdx].count + 1,
          }
        }
      }

      if (dim === 'noteOn' && action.result.grade !== 'miss') {
        stats.combo++
        if (stats.combo > stats.maxCombo) stats.maxCombo = stats.combo
        return { ...state, stats, judgedNotes, measureErrors, measureDeviations }
      } else if (dim === 'noteOn') {
        stats.combo = 0
        return { ...state, stats, measureErrors, judgedNotes, measureDeviations }
      }
      return { ...state, stats, judgedNotes, measureErrors, measureDeviations }
    }
    case 'RESET_STATS':
      return { ...state, stats: {
        noteOn: { perfect: 0, great: 0, good: 0, miss: 0 },
        noteOff: { perfect: 0, great: 0, good: 0, miss: 0 },
        velocity: { perfect: 0, great: 0, good: 0, miss: 0 },
        pedal: { perfect: 0, great: 0, good: 0, miss: 0 },
        combo: 0,
        maxCombo: 0,
      }, measureErrors: {}, measureDeviations: {} }
    case 'SET_BPM':
      return { ...state, bpmOverride: Math.max(20, Math.min(300, action.bpm)) }
    case 'SET_BPM_OVERRIDE_ENABLED':
      return { ...state, bpmOverrideEnabled: action.enabled }
    case 'SET_SPEED_RATIO':
      return { ...state, speedRatio: Math.max(0.25, Math.min(4, action.ratio)) }
    case 'SET_MEASURES_WINDOW':
      return { ...state, measuresWindow: Math.max(2, Math.min(16, action.count)) }
    case 'SET_EMPTY_MEASURES':
      return { ...state, emptyMeasures: Math.max(0, Math.min(8, action.count)) }
    case 'SET_TOTAL_PAGES':
      return { ...state, totalPages: Math.max(1, action.total) }
    case 'SET_VOICE_COLOR':
      return { ...state, voiceColors: { ...state.voiceColors, [action.voice]: action.color } }
    case 'LOAD_SETTINGS':
      return { ...state, ...action.settings }
    case 'SET_HIGHLIGHT_LEAD':
      return { ...state, highlightLeadBeats: Math.max(0.1, Math.min(4, action.beats)) }
    case 'SET_HIGHLIGHT_RANGE':
      return { ...state, highlightRange: Math.max(1, Math.min(8, action.count)) }
    case 'SET_LOGIC_FPS':
      return { ...state, logicFps: [0, 15, 30, 60, 120].includes(action.fps) ? action.fps : 60 }
    case 'SET_RENDER_FPS':
      return { ...state, renderFps: [0, 15, 30, 60].includes(action.fps) ? action.fps : 60 }
    case 'SET_VEROVIO_PAGE_WIDTH':
      return { ...state, verovioPageWidth: Math.max(500, Math.min(10000, action.width)) }
    case 'SET_VEROVIO_PAGE_HEIGHT':
      return { ...state, verovioPageHeight: Math.max(500, Math.min(60000, action.height)) }
    case 'SET_VEROVIO_STAFF_SPACING':
      return { ...state, verovioStaffSpacing: Math.max(0, Math.min(48, action.spacing)) }
    case 'SET_VEROVIO_NOTE_SPACING':
      return { ...state, verovioNoteSpacing: Math.max(0, Math.min(1, action.spacing)) }
    case 'CLEAR_JUDGED_NOTES':
      return { ...state, judgedNotes: {} }
    case 'SET_MIDI_ENABLED':
      return { ...state, midiEnabled: action.enabled }
    case 'SET_MIDI_DEVICE_ID':
      return { ...state, midiDeviceId: action.deviceId }
    case 'SET_HIGHLIGHT_MODE':
      return { ...state, highlightMode: action.mode }
    case 'SET_AUTO_PLAY':
      return { ...state, autoPlay: action.enabled }
    case 'SET_AUTO_PLAY_VOLUME':
      return { ...state, autoPlayVolume: Math.max(1, Math.min(100, action.volume)) }
    case 'SET_AUTO_PLAY_DELAY':
      return { ...state, autoPlayDelay: Math.max(-500, Math.min(500, action.delay)) }
    case 'SET_VELOCITY_JUDGMENT':
      return { ...state, velocityJudgmentEnabled: action.enabled }
    case 'SET_PEDAL_JUDGMENT':
      return { ...state, pedalJudgmentEnabled: action.enabled }
    case 'SET_NOTE_OFF_JUDGMENT':
      return { ...state, noteOffJudgmentEnabled: action.enabled }
    case 'SET_THEME':
      return { ...state, theme: action.theme }
    case 'SET_COLOR_SCHEME':
      return { ...state, colorScheme: action.scheme }
    case 'COMMIT_LAYOUT':
      return { ...state, layoutCommitVersion: state.layoutCommitVersion + 1 }
    default:
      return state
  }
}

const PERSISTED_KEYS: (keyof PracticeState)[] = [
  'zoom', 'measuresWindow', 'emptyMeasures',
  'bpmOverrideEnabled', 'bpmOverride', 'speedRatio', 'voiceColors', 'displayMode', 'highlightLeadBeats',
  'highlightRange', 'logicFps', 'renderFps',
  'verovioPageWidth', 'verovioPageHeight', 'verovioStaffSpacing', 'verovioNoteSpacing',
  'midiEnabled', 'midiDeviceId', 'highlightMode', 'autoPlayVolume', 'autoPlayDelay',
  'velocityJudgmentEnabled', 'pedalJudgmentEnabled', 'noteOffJudgmentEnabled',
  'theme', 'colorScheme',
]

export function PracticeProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(practiceReducer, initialState)
  const lastPersisted = useRef('')
  useEffect(() => {
    const toSave: Record<string, unknown> = {}
    for (const key of PERSISTED_KEYS) {
      toSave[key] = state[key]
    }
    const json = JSON.stringify(toSave)
    if (json === lastPersisted.current) return
    lastPersisted.current = json
    try {
      localStorage.setItem('musicalStaffPlay_settings', json)
    } catch {
      // ignore write errors
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    state.zoom, state.measuresWindow, state.emptyMeasures,
    state.bpmOverrideEnabled, state.bpmOverride, state.speedRatio, state.voiceColors,
    state.displayMode, state.highlightLeadBeats,
    state.highlightRange, state.logicFps, state.renderFps,
    state.verovioPageWidth, state.verovioPageHeight, state.verovioStaffSpacing, state.verovioNoteSpacing,
    state.midiEnabled, state.midiDeviceId, state.highlightMode, state.autoPlayVolume, state.autoPlayDelay,
    state.velocityJudgmentEnabled, state.pedalJudgmentEnabled, state.noteOffJudgmentEnabled,
    state.theme, state.colorScheme,
  ])
  return (
    <PracticeStateContext.Provider value={state}>
      <PracticeDispatchContext.Provider value={dispatch}>
        {children}
      </PracticeDispatchContext.Provider>
    </PracticeStateContext.Provider>
  )
}
