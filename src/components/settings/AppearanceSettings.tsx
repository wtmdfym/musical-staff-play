import { usePractice } from '../../context/usePractice'
import type { ThemeName, ColorScheme } from '../../score/ScoreTypes'

const THEMES: { key: ThemeName; color: string; label: string }[] = [
  { key: 'ocean', color: '#3b82f6', label: 'Ocean' },
  { key: 'rose', color: '#db2777', label: 'Rose' },
  { key: 'olive', color: '#65a30d', label: 'Olive' },
  { key: 'slate', color: '#64748b', label: 'Slate' },
]

const SCHEMES: { key: ColorScheme; label: string }[] = [
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
  { key: 'auto', label: 'Auto' },
]

export default function AppearanceSettings() {
  const { state, dispatch } = usePractice()
  const { theme, colorScheme } = state

  return (
    <div className="section-content">
      <div className="setting-row">
        <label className="setting-label">Theme</label>
        <div className="theme-swatches">
          {THEMES.map((t) => (
            <button
              key={t.key}
              className={`theme-swatch${theme === t.key ? ' active' : ''}`}
              style={{ backgroundColor: t.color }}
              title={t.label}
              onClick={() => dispatch({ type: 'SET_THEME', theme: t.key })}
            />
          ))}
        </div>
      </div>
      <div className="setting-row">
        <label className="setting-label">Mode</label>
        <div className="setting-options">
          {SCHEMES.map((s) => (
            <button
              key={s.key}
              className={`ctrl-btn${colorScheme === s.key ? ' active' : ''}`}
              onClick={() => dispatch({ type: 'SET_COLOR_SCHEME', scheme: s.key })}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
