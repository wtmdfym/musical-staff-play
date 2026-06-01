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
import HighlightColorSettings from './settings/HighlightColorSettings'
import JudgmentColorSettings from './settings/JudgmentColorSettings'
import BoxSizeSettings from './settings/BoxSizeSettings'

const TABS = [
  { key: 'general', label: 'General' },
  { key: 'appearance', label: 'Appearance' },
  { key: 'playback', label: 'Playback' },
  { key: 'advanced', label: 'Advanced' },
] as const

type TabKey = typeof TABS[number]['key']

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = usePractice()
  const { midiDeviceId } = state
  const { devices: deviceList } = useMidi()
  const [activeTab, setActiveTab] = useState<TabKey>('general')

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
    dispatch({ type: 'SET_HIGHLIGHT_COLOR', color: '#7c3aed' })
    dispatch({ type: 'SET_JD_PERFECT_COLOR', color: '#16a34a' })
    dispatch({ type: 'SET_JD_GREAT_COLOR', color: '#3b82f6' })
    dispatch({ type: 'SET_JD_GOOD_COLOR', color: '#eab308' })
    dispatch({ type: 'SET_JD_MISS_COLOR', color: '#ef4444' })
    dispatch({ type: 'SET_HIGHLIGHT_PAD_X', value: 60 })
    dispatch({ type: 'SET_HIGHLIGHT_PAD_Y', value: 60 })
    dispatch({ type: 'SET_HIGHLIGHT_STROKE_ACTIVE', value: 1.5 })
    dispatch({ type: 'SET_HIGHLIGHT_STROKE_PREVIEW', value: 1 })
    dispatch({ type: 'SET_JD_STROKE_WIDTH', value: 1.5 })
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="ctrl-btn" onClick={onClose}>X</button>
        </div>

        <div className="settings-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              className={`settings-tab${activeTab === tab.key ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="settings-body">
          <div className="settings-tab-content">
            {activeTab === 'general' && (
              <>
                <div className="settings-section">
                  <h3>View</h3>
                  <ViewSettings />
                </div>
                <div className="settings-section">
                  <h3>Layout</h3>
                  <LayoutSettings />
                </div>
              </>
            )}

            {activeTab === 'appearance' && (
              <>
                <div className="settings-section">
                  <h3>Theme</h3>
                  <AppearanceSettings />
                </div>
                <div className="settings-section">
                  <h3>Highlight Color</h3>
                  <HighlightColorSettings />
                </div>
                <div className="settings-section">
                  <h3>Judgment Colors</h3>
                  <JudgmentColorSettings />
                </div>
                <div className="settings-section">
                  <h3>Box Sizing</h3>
                  <BoxSizeSettings />
                </div>
                <div className="settings-section">
                  <h3>Voice Colors</h3>
                  <VoiceColorSettings />
                </div>
              </>
            )}

            {activeTab === 'playback' && (
              <>
                <div className="settings-section">
                  <h3>Play</h3>
                  <PlaySettings />
                </div>
                <div className="settings-section">
                  <h3>Judgment</h3>
                  <JudgmentSettings />
                </div>
                <div className="settings-section">
                  <h3>Auto Play</h3>
                  <AutoPlaySettings />
                </div>
                <div className="settings-section">
                  <h3>MIDI</h3>
                  <MidiSettings />
                </div>
              </>
            )}

            {activeTab === 'advanced' && (
              <div className="settings-section">
                <h3>Performance</h3>
                <PerfSettings />
              </div>
            )}
          </div>
        </div>

        <div className="settings-footer">
          <button className="ctrl-btn" onClick={resetDefaults}>Reset Defaults</button>
        </div>
      </div>
    </div>
  )
}
