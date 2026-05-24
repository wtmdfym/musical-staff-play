import { useState } from 'react'
import { PracticeProvider } from './context/practiceStore'
import TopBar from './components/TopBar'
import ControlBar from './components/ControlBar'
import ScoreView from './components/ScoreView'
import StatsPanel from './components/StatsPanel'
import TimelineBar from './components/TimelineBar'
import HeatmapView from './components/HeatmapView'
import SettingsPanel from './components/SettingsPanel'
import './App.css'

function App() {
  const [showSettings, setShowSettings] = useState(false)
  return (
    <PracticeProvider>
      <div className="app-layout">
        <TopBar />
        <ControlBar onOpenSettings={() => setShowSettings(true)} />
        <main className="app-main">
          <ScoreView />
          <StatsPanel />
        </main>
        <TimelineBar />
        <footer className="app-footer">
          <span className="hint">← → to turn pages · Open MusicXML files · Adjust display · Play to auto-scroll</span>
        </footer>
      </div>
      <HeatmapView />
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </PracticeProvider>
  )
}

export default App
