import { useState, useRef, useCallback } from 'react'
import { usePractice } from '../context/usePractice'

export function useBpmInput() {
  const { state, dispatch } = usePractice()
  const { bpmOverride, score } = state
  const defaultBpm = score?.bpm ?? 60

  const [bpmInput, setBpmInput] = useState(String(bpmOverride || defaultBpm))
  const bpmRef = useRef<HTMLInputElement>(null)

  const commitBpm = useCallback(() => {
    const val = parseInt(bpmInput, 10)
    if (isNaN(val) || val < 1) {
      setBpmInput(String(bpmOverride || defaultBpm))
      return
    }
    const clamped = Math.max(20, Math.min(300, val))
    dispatch({ type: 'SET_BPM', bpm: clamped })
    if (clamped !== val) setBpmInput(String(clamped))
  }, [bpmInput, bpmOverride, defaultBpm, dispatch])

  const resetBpm = useCallback(() => {
    dispatch({ type: 'SET_BPM', bpm: 0 })
    setBpmInput(String(defaultBpm))
  }, [defaultBpm, dispatch])

  const handleBpmKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') bpmRef.current?.blur()
  }, [])

  return { bpmInput, setBpmInput, bpmRef, commitBpm, resetBpm, handleBpmKeyDown, defaultBpm }
}
