/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NoteInputPipeline } from '../src/core/NoteInputPipeline'

function kd(key: string, opts?: { repeat?: boolean }): KeyboardEvent {
  return { key, repeat: opts?.repeat ?? false } as KeyboardEvent
}

function mockPlayback(elapsed: number, state: string) {
  return {
    get elapsed() { return elapsed },
    get state() { return state },
  }
}

function mockPlaybackMutable(initialElapsed: number, state: string) {
  const box = { elapsed: initialElapsed }
  return {
    get elapsed() { return box.elapsed },
    get state() { return state },
    box,
  }
}

function mockJudgment() {
  return {
    onInputColumn: vi.fn(),
    onNoteOff: vi.fn(),
    setPedal: vi.fn(),
  }
}

function mockAutoPlayer(active: boolean) {
  return { active }
}

function mockMidi() {
  return {
    onNoteOn: null as ((p: number, v: number) => void) | null,
    onNoteOff: null as ((p: number) => void) | null,
    onControlChange: null as ((c: number, v: number) => void) | null,
    open: vi.fn().mockReturnValue(true),
    close: vi.fn(),
  }
}

let capturedHandler: ((e: KeyboardEvent) => void) | null = null

function mockWindow() {
  const listeners: Record<string, ((e: Event) => void)[]> = {}
  return {
    addEventListener: vi.fn((type: string, handler: (e: Event) => void) => {
      if (type === 'keydown') capturedHandler = handler as any
      if (!listeners[type]) listeners[type] = []
      listeners[type].push(handler)
    }),
    removeEventListener: vi.fn((type: string) => {
      if (type === 'keydown') capturedHandler = null
    }),
  }
}

beforeEach(() => {
  capturedHandler = null
  const win = mockWindow()
  vi.stubGlobal('window', win)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('NoteInputPipeline', () => {
  it('noteOn forwards to JudgmentEngine.onInputColumn', () => {
    const je = mockJudgment()
    const p = new NoteInputPipeline(mockMidi(), mockPlayback(3.5, 'playing'), je as any, mockAutoPlayer(false))
    p.noteOn(60, 100)
    expect(je.onInputColumn).toHaveBeenCalledWith([60], 3.5, 100)
  })

  it('noteOff forwards to JudgmentEngine.onNoteOff', () => {
    const je = mockJudgment()
    const p = new NoteInputPipeline(mockMidi(), mockPlayback(4.2, 'playing'), je as any, mockAutoPlayer(false))
    p.noteOff(72)
    expect(je.onNoteOff).toHaveBeenCalledWith(72, 4.2)
  })

  it('cc 64 pedal down forwards to JudgmentEngine.setPedal', () => {
    const je = mockJudgment()
    const p = new NoteInputPipeline(mockMidi(), mockPlayback(2.1, 'playing'), je as any, mockAutoPlayer(false))
    p.cc(64, 127)
    expect(je.setPedal).toHaveBeenCalledWith(true, 2.1)
  })

  it('cc 64 pedal up (value < 64) forwards to JudgmentEngine.setPedal', () => {
    const je = mockJudgment()
    const p = new NoteInputPipeline(mockMidi(), mockPlayback(5.0, 'playing'), je as any, mockAutoPlayer(false))
    p.cc(64, 0)
    expect(je.setPedal).toHaveBeenCalledWith(false, 5.0)
  })

  it('cc 64 pedal up (value = 63, boundary)', () => {
    const je = mockJudgment()
    const p = new NoteInputPipeline(mockMidi(), mockPlayback(5.0, 'playing'), je as any, mockAutoPlayer(false))
    p.cc(64, 63)
    expect(je.setPedal).toHaveBeenCalledWith(false, 5.0)
  })

  it('cc non-64 controller is ignored', () => {
    const je = mockJudgment()
    const p = new NoteInputPipeline(mockMidi(), mockPlayback(1.0, 'playing'), je as any, mockAutoPlayer(false))
    p.cc(65, 100)
    p.cc(63, 100)
    p.cc(0, 100)
    expect(je.setPedal).not.toHaveBeenCalled()
  })

  it('blocks noteOn when autoPlay is active', () => {
    const je = mockJudgment()
    const p = new NoteInputPipeline(mockMidi(), mockPlayback(1.0, 'playing'), je as any, mockAutoPlayer(true))
    p.noteOn(60, 100)
    expect(je.onInputColumn).not.toHaveBeenCalled()
  })

  it('blocks noteOff when autoPlay is active', () => {
    const je = mockJudgment()
    const p = new NoteInputPipeline(mockMidi(), mockPlayback(1.0, 'playing'), je as any, mockAutoPlayer(true))
    p.noteOff(60)
    expect(je.onNoteOff).not.toHaveBeenCalled()
  })

  it('blocks cc when autoPlay is active', () => {
    const je = mockJudgment()
    const p = new NoteInputPipeline(mockMidi(), mockPlayback(1.0, 'playing'), je as any, mockAutoPlayer(true))
    p.cc(64, 127)
    expect(je.setPedal).not.toHaveBeenCalled()
  })

  it('uses current elapsed time on each call', () => {
    const je = mockJudgment()
    const pb = mockPlaybackMutable(0, 'playing')
    const p = new NoteInputPipeline(mockMidi(), pb, je as any, mockAutoPlayer(false))
    pb.box.elapsed = 2.0
    p.noteOn(60, 100)
    pb.box.elapsed = 4.0
    p.noteOn(62, 90)
    expect(je.onInputColumn).toHaveBeenNthCalledWith(1, [60], 2.0, 100)
    expect(je.onInputColumn).toHaveBeenNthCalledWith(2, [62], 4.0, 90)
  })
})

describe('NoteInputPipeline keyboard', () => {
  it('keyboard key → MIDI note → forwards to JudgmentEngine', () => {
    const je = mockJudgment()
    const p = new NoteInputPipeline(mockMidi(), mockPlayback(1.5, 'playing'), je as any, mockAutoPlayer(false))
    p.setDisplayMode('scroll')
    p.attachKeyboard()

    capturedHandler?.(kd('a'))
    expect(je.onInputColumn).toHaveBeenCalledWith([60], 1.5, 64)
  })

  it('keyboard handles all 12 keys (A-K,W,E,T,Y,U,J)', () => {
    const je = mockJudgment()
    const p = new NoteInputPipeline(mockMidi(), mockPlayback(0.5, 'playing'), je as any, mockAutoPlayer(false))
    p.setDisplayMode('scroll')
    p.attachKeyboard()
    const cases: [string, number][] = [
      ['a', 60], ['w', 61], ['s', 62], ['e', 63], ['d', 64], ['f', 65],
      ['t', 66], ['g', 67], ['y', 68], ['h', 69], ['u', 70], ['j', 71],
    ]
    for (const [key, midi] of cases) {
      capturedHandler?.(kd(key))
      expect(je.onInputColumn).toHaveBeenCalledWith([midi], 0.5, 64)
    }
    expect(je.onInputColumn).toHaveBeenCalledTimes(12)
  })

  it('keyboard ignores key repeat', () => {
    const je = mockJudgment()
    const p = new NoteInputPipeline(mockMidi(), mockPlayback(0.3, 'playing'), je as any, mockAutoPlayer(false))
    p.setDisplayMode('scroll')
    p.attachKeyboard()

    capturedHandler?.(kd('a', { repeat: true }))
    expect(je.onInputColumn).not.toHaveBeenCalled()
  })

  it('keyboard suppressed in page mode', () => {
    const je = mockJudgment()
    const p = new NoteInputPipeline(mockMidi(), mockPlayback(1.0, 'playing'), je as any, mockAutoPlayer(false))
    p.setDisplayMode('page')
    p.attachKeyboard()

    capturedHandler?.(kd('a'))
    expect(je.onInputColumn).not.toHaveBeenCalled()
  })

  it('keyboard suppressed when not playing', () => {
    const je = mockJudgment()
    const p = new NoteInputPipeline(mockMidi(), mockPlayback(1.0, 'paused'), je as any, mockAutoPlayer(false))
    p.setDisplayMode('scroll')
    p.attachKeyboard()

    capturedHandler?.(kd('a'))
    expect(je.onInputColumn).not.toHaveBeenCalled()
  })

  it('keyboard suppressed when autoPlay active (via noteOn gate)', () => {
    const je = mockJudgment()
    const p = new NoteInputPipeline(mockMidi(), mockPlayback(1.0, 'playing'), je as any, mockAutoPlayer(true))
    p.setDisplayMode('scroll')
    p.attachKeyboard()

    capturedHandler?.(kd('a'))
    expect(je.onInputColumn).not.toHaveBeenCalled()
  })

  it('setDisplayMode changes keyboard behavior at runtime', () => {
    const je = mockJudgment()
    const p = new NoteInputPipeline(mockMidi(), mockPlayback(0.8, 'playing'), je as any, mockAutoPlayer(false))
    p.attachKeyboard()

    p.setDisplayMode('page')
    capturedHandler?.(kd('a'))
    expect(je.onInputColumn).not.toHaveBeenCalled()

    p.setDisplayMode('scroll')
    capturedHandler?.(kd('a'))
    expect(je.onInputColumn).toHaveBeenCalledWith([60], 0.8, 64)
  })

  it('detachKeyboard removes listener', () => {
    const je = mockJudgment()
    const p = new NoteInputPipeline(mockMidi(), mockPlayback(0.5, 'playing'), je as any, mockAutoPlayer(false))
    p.setDisplayMode('scroll')
    p.attachKeyboard()
    p.detachKeyboard()

    capturedHandler?.(kd('a'))
    expect(je.onInputColumn).not.toHaveBeenCalled()
  })

  it('attachKeyboard is idempotent', () => {
    const p = new NoteInputPipeline(mockMidi(), mockPlayback(0, 'playing'), mockJudgment() as any, mockAutoPlayer(false))
    p.attachKeyboard()
    p.attachKeyboard()
    expect((window as any).addEventListener).toHaveBeenCalledTimes(1)
  })
})

describe('NoteInputPipeline MIDI lifecycle', () => {
  it('syncMidi wires callbacks and opens device when playing and enabled', () => {
    const midi = mockMidi()
    const p = new NoteInputPipeline(midi, mockPlayback(0, 'playing'), mockJudgment() as any, mockAutoPlayer(false))
    p.syncMidi(true, 'device-1')

    expect(midi.open).toHaveBeenCalledWith('device-1')
    expect(midi.onNoteOn).toBeDefined()
    expect(midi.onNoteOff).toBeDefined()
    expect(midi.onControlChange).toBeDefined()
  })

  it('syncMidi does not open when not playing', () => {
    const midi = mockMidi()
    const p = new NoteInputPipeline(midi, mockPlayback(0, 'paused'), mockJudgment() as any, mockAutoPlayer(false))
    p.syncMidi(true, 'device-1')

    expect(midi.open).not.toHaveBeenCalled()
  })

  it('syncMidi does not open when midi not enabled', () => {
    const midi = mockMidi()
    const p = new NoteInputPipeline(midi, mockPlayback(0, 'playing'), mockJudgment() as any, mockAutoPlayer(false))
    p.syncMidi(false, 'device-1')

    expect(midi.open).not.toHaveBeenCalled()
  })

  it('syncMidi blocked when autoPlay active', () => {
    const midi = mockMidi()
    const p = new NoteInputPipeline(midi, mockPlayback(0, 'playing'), mockJudgment() as any, mockAutoPlayer(true))
    p.syncMidi(true, 'device-1')

    expect(midi.open).not.toHaveBeenCalled()
  })

  it('syncMidi opens first available device when deviceId empty', () => {
    const midi = mockMidi()
    const p = new NoteInputPipeline(midi, mockPlayback(0, 'playing'), mockJudgment() as any, mockAutoPlayer(false))
    p.syncMidi(true, '')

    expect(midi.open).toHaveBeenCalledWith(undefined)
  })

  it('closeMidi calls midi.close()', () => {
    const midi = mockMidi()
    const p = new NoteInputPipeline(midi, mockPlayback(0, 'playing'), mockJudgment() as any, mockAutoPlayer(false))
    p.closeMidi()
    expect(midi.close).toHaveBeenCalled()
  })

  it('MIDI callback integration: onNoteOn → JudgmentEngine', () => {
    const je = mockJudgment()
    const midi = mockMidi()
    const p = new NoteInputPipeline(midi, mockPlayback(2.0, 'playing'), je as any, mockAutoPlayer(false))
    p.syncMidi(true, 'device-1')

    midi.onNoteOn!(72, 110)
    expect(je.onInputColumn).toHaveBeenCalledWith([72], 2.0, 110)
  })

  it('MIDI callback integration: onNoteOff → JudgmentEngine', () => {
    const je = mockJudgment()
    const midi = mockMidi()
    const p = new NoteInputPipeline(midi, mockPlayback(3.0, 'playing'), je as any, mockAutoPlayer(false))
    p.syncMidi(true, 'device-1')

    midi.onNoteOff!(72)
    expect(je.onNoteOff).toHaveBeenCalledWith(72, 3.0)
  })

  it('MIDI callback integration: onControlChange CC 64 → JudgmentEngine', () => {
    const je = mockJudgment()
    const midi = mockMidi()
    const p = new NoteInputPipeline(midi, mockPlayback(4.0, 'playing'), je as any, mockAutoPlayer(false))
    p.syncMidi(true, 'device-1')

    midi.onControlChange!(64, 127)
    expect(je.setPedal).toHaveBeenCalledWith(true, 4.0)
  })
})
