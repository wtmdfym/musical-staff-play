import { useState } from 'react'
import { PracticeProvider } from './context/practiceStore'
import { usePractice } from './context/usePractice'
import TopBar from './components/TopBar'
import ControlBar from './components/ControlBar'
import ScoreView from './components/ScoreView'
import HeatmapView from './components/HeatmapView'
import SettingsPanel from './components/SettingsPanel'
import './App.css'

function ThemeSync() {
  const { state } = usePractice()
  const { theme, colorScheme } = state
  document.documentElement.setAttribute('data-theme', theme)
  if (colorScheme === 'auto') {
    document.documentElement.removeAttribute('data-color-scheme')
  } else {
    document.documentElement.setAttribute('data-color-scheme', colorScheme)
  }
  return null
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function ColorSync() {
  const { state } = usePractice()
  const { highlightColor, jdPerfectColor, jdGreatColor, jdGoodColor, jdMissColor, highlightStrokeWidthActive, highlightStrokeWidthPreview, jdStrokeWidth } = state
  const root = document.documentElement
  root.style.setProperty('--hl-color', highlightColor)
  root.style.setProperty('--hl-box-bg-active', hexToRgba(highlightColor, 0.15))
  root.style.setProperty('--hl-box-stroke-active', hexToRgba(highlightColor, 0.55))
  root.style.setProperty('--hl-box-bg-preview', hexToRgba(highlightColor, 0.06))
  root.style.setProperty('--hl-box-stroke-preview', hexToRgba(highlightColor, 0.25))
  root.style.setProperty('--jd-perfect', jdPerfectColor)
  root.style.setProperty('--jd-perfect-bg', hexToRgba(jdPerfectColor, 0.18))
  root.style.setProperty('--jd-great', jdGreatColor)
  root.style.setProperty('--jd-great-bg', hexToRgba(jdGreatColor, 0.18))
  root.style.setProperty('--jd-good', jdGoodColor)
  root.style.setProperty('--jd-good-bg', hexToRgba(jdGoodColor, 0.18))
  root.style.setProperty('--jd-miss', jdMissColor)
  root.style.setProperty('--jd-miss-bg', hexToRgba(jdMissColor, 0.18))
  root.style.setProperty('--hl-stroke-active-width', String(highlightStrokeWidthActive))
  root.style.setProperty('--hl-stroke-preview-width', String(highlightStrokeWidthPreview))
  root.style.setProperty('--jd-stroke-width', String(jdStrokeWidth))
  return null
}

function AppContent() {
  const [showSettings, setShowSettings] = useState(false)
  return (
    <>
      <ThemeSync />
      <ColorSync />
      <div className="app-layout">
        <TopBar />
        <ControlBar onOpenSettings={() => setShowSettings(true)} />
        <main className="app-main">
          <ScoreView />
        </main>
      </div>
      <HeatmapView />
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </>
  )
}

function App() {
  return (
    <PracticeProvider>
      <AppContent />
    </PracticeProvider>
  )
}

export default App
