import { useState } from 'react'
import { PracticeProvider } from './context/practiceStore'
import { usePractice } from './context/usePractice'
import TopBar from './components/TopBar'
import ControlBar from './components/ControlBar'
import ScoreView from './components/ScoreView'
import TimelineBar from './components/TimelineBar'
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

function AppContent() {
  const [showSettings, setShowSettings] = useState(false)
  return (
    <>
      <ThemeSync />
      <div className="app-layout">
        <TopBar />
        <ControlBar onOpenSettings={() => setShowSettings(true)} />
        <main className="app-main">
          <ScoreView />
        </main>
        <TimelineBar />
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
