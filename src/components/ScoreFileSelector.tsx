import { useRef, useState } from 'react'
import { usePractice } from '../context/usePractice'
import { parseFromXml } from '../score/MusicxmlParser'
import { addRecentFile } from '../data/recentFiles'
import { loadScoreFromFile } from '../score/loadScoreFile'

export default function ScoreFileSelector() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const { dispatch } = usePractice()

  const handleClick = () => {
    setError(null)
    inputRef.current?.click()
  }

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)

    try {
      const { xml, fileName, format } = await loadScoreFromFile(file)
      const score = parseFromXml(xml)
      addRecentFile(fileName)
      dispatch({ type: 'LOAD_SCORE', score, fileName, rawDocument: xml, documentFormat: format })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown parse error'
      console.error('Score parse failed:', msg)
      setError(msg)
    }

    e.target.value = ''
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".musicxml,.mxl,.xml"
        style={{ display: 'none' }}
        onChange={handleChange}
      />
      <div className="file-selector">
        <button className="ctrl-btn file-btn" onClick={handleClick} title="Open score file">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
          <span>Open</span>
        </button>
        {error && <span className="file-error" title={error}>!</span>}
      </div>
    </>
  )
}
