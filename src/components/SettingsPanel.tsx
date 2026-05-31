import { useState, useEffect } from 'react'
import { usePractice } from '../context/usePractice'
import { useMidi } from '../playback/useMidi'
import ViewSettings from './settings/ViewSettings'
import AppearanceSettings from './settings/AppearanceSettings'
import PlaySettings from './settings/PlaySettings'
import JudgmentSettings from './settings/JudgmentSettings'
import AutoPlaySettings from './settings/AutoPlaySettings'
import LayoutSettings from './settings/LayoutSettings'
import PerfSettings from './settings/PerfSettings'
import MidiSettings from './settings/MidiSettings'
import VoiceColorSettings from './settings/VoiceColorSettings'

function SectionHeader({ title, expanded, onClick }: { title: string; expanded: boolean; onClick: () => void }) {
  return (
    <button className="settings-section-header" onClick={onClick}>
      <svg
        className={`section-chevron${expanded ? ' open' : ''}`}
        width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
      <h3>{title}</h3>
    </button>
  )
}

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = usePractice()
  const { midiDeviceId } = state
  const { devices: deviceList } = useMidi()

  const [sections, setSections] = useState<Record<string, boolean>>({
    view: true,
    appearance: true,
    play: true,
    judgment: false,
    autoPlay: false,
    layout: false,
    perf: false,
    midi: false,
    voices: false,
  })

  const toggleSection = (key: string) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  useEffect(() => {
    if (midiDeviceId && !deviceList.some((dev) => dev.id === midiDeviceId)) {
      dispatch({ type: 'SET_MIDI_DEVICE_ID', deviceId: '' })
    }
  }, [deviceList, midiDeviceId, dispatch])

  const resetDefaults = () => {
    dispatch({ type: 'SET_ZOOM', zoom: 1 })
    dispatch({ type: 'SET_DISPLAY_MODE', mode: 'page' })
    dispatch({ type: 'SET_BPM_OVERRIDE_ENABLED', enabled: false })
    dispatch({ type: 'SET_BPM', bpm: 0 })
    dispatch({ type: 'SET_SPEED_RATIO', ratio: 1 })
    dispatch({ type: 'SET_MEASURES_WINDOW', count: 4 })
    dispatch({ type: 'SET_EMPTY_MEASURES', count: 2 })
    dispatch({ type: 'SET_HIGHLIGHT_LEAD', beats: 0.5 })
    dispatch({ type: 'SET_HIGHLIGHT_RANGE', count: 2 })
    dispatch({ type: 'SET_LOGIC_FPS', fps: 60 })
    dispatch({ type: 'SET_RENDER_FPS', fps: 60 })
    dispatch({ type: 'SET_VEROVIO_PAGE_WIDTH', width: 2100 })
    dispatch({ type: 'SET_VEROVIO_PAGE_HEIGHT', height: 2970 })
    dispatch({ type: 'SET_VEROVIO_STAFF_SPACING', spacing: 12 })
    dispatch({ type: 'SET_VEROVIO_NOTE_SPACING', spacing: 0.25 })
    dispatch({ type: 'SET_MIDI_ENABLED', enabled: false })
    dispatch({ type: 'SET_MIDI_DEVICE_ID', deviceId: '' })
    dispatch({ type: 'SET_AUTO_PLAY_VOLUME', volume: 30 })
    dispatch({ type: 'SET_AUTO_PLAY_DELAY', delay: 0 })
    dispatch({ type: 'SET_VELOCITY_JUDGMENT', enabled: false })
    dispatch({ type: 'SET_PEDAL_JUDGMENT', enabled: false })
    dispatch({ type: 'SET_NOTE_OFF_JUDGMENT', enabled: false })
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="ctrl-btn" onClick={onClose}>X</button>
        </div>

        <div className="settings-body">

          <div className="settings-section">
            <SectionHeader expanded={sections.view} onClick={() => toggleSection('view')} title="视图" />
            {sections.view && <ViewSettings />}
          </div>

          <div className="settings-section">
            <SectionHeader expanded={sections.appearance} onClick={() => toggleSection('appearance')} title="外观" />
            {sections.appearance && <AppearanceSettings />}
          </div>

          <div className="settings-section">
            <SectionHeader expanded={sections.play} onClick={() => toggleSection('play')} title="演奏" />
            {sections.play && <PlaySettings />}
          </div>

          <div className="settings-section">
            <SectionHeader expanded={sections.judgment} onClick={() => toggleSection('judgment')} title="判定维度" />
            {sections.judgment && <JudgmentSettings />}
          </div>

          <div className="settings-section">
            <SectionHeader expanded={sections.autoPlay} onClick={() => toggleSection('autoPlay')} title="自动播放" />
            {sections.autoPlay && <AutoPlaySettings />}
          </div>

          <div className="settings-section">
            <SectionHeader expanded={sections.layout} onClick={() => toggleSection('layout')} title="布局" />
            {sections.layout && <LayoutSettings />}
          </div>

          <div className="settings-section">
            <SectionHeader expanded={sections.perf} onClick={() => toggleSection('perf')} title="性能" />
            {sections.perf && <PerfSettings />}
          </div>

          <div className="settings-section">
            <SectionHeader expanded={sections.midi} onClick={() => toggleSection('midi')} title="MIDI" />
            {sections.midi && <MidiSettings />}
          </div>

          <div className="settings-section">
            <SectionHeader expanded={sections.voices} onClick={() => toggleSection('voices')} title="声部颜色" />
            {sections.voices && <VoiceColorSettings />}
          </div>

        </div>

        <div className="settings-footer">
          <button className="ctrl-btn" onClick={resetDefaults}>Reset Defaults</button>
        </div>
      </div>
    </div>
  )
}
