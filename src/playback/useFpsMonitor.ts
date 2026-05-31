import { useState, useEffect } from 'react'
import { getGameLoop } from '../core/GameLoop'

let _sharedInterval: ReturnType<typeof setInterval> | null = null
let _refCount = 0
const POLL_MS = 500

export function useFpsMonitor(): { logicFps: number; renderFps: number } {
  const [fps, setFps] = useState({ logicFps: 60, renderFps: 60 })

  useEffect(() => {
    _refCount++
    if (!_sharedInterval) {
      _sharedInterval = setInterval(() => {
        const gl = getGameLoop()
        setFps({ logicFps: gl.logicFpsActual, renderFps: 0 })
      }, POLL_MS)
    }
    return () => {
      _refCount--
      if (_refCount <= 0 && _sharedInterval) {
        clearInterval(_sharedInterval)
        _sharedInterval = null
      }
    }
  }, [])

  return fps
}
