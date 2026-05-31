import { useState, useEffect, useCallback } from 'react'
import { getMidiInputManager, type MidiDeviceInfo, type MidiStatus } from '../playback/MidiInputManager'

export function useMidi() {
  const [status, setStatus] = useState<MidiStatus>('disconnected')
  const [inputName, setInputName] = useState('')
  const [devices, setDevices] = useState<MidiDeviceInfo[]>([])
  const [isAccessGranted, setAccessGranted] = useState(false)

  useEffect(() => {
    const m = getMidiInputManager()

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus(m.status)
    setInputName(m.inputName)
    setDevices(m.devices)
    setAccessGranted(m.isAccessGranted)

    m.onStatusChange = (s) => {
      setStatus(s)
      setAccessGranted(m.isAccessGranted)
      if (s !== 'connected') {
        setInputName('')
      } else {
        setInputName(m.inputName)
      }
    }

    m.onDevicesChange = (d) => {
      setDevices(d)
    }

    return () => {
      m.onStatusChange = null
      m.onDevicesChange = null
    }
  }, [])

  const connect = useCallback(async () => {
    await getMidiInputManager().requestAccess()
  }, [])

  const close = useCallback(() => {
    getMidiInputManager().close()
  }, [])

  const statusLabel =
    status === 'unavailable' ? 'Unavailable' :
    status === 'denied' ? 'Denied' :
    status === 'connecting' ? 'Connecting...' :
    status === 'connected' ? (inputName || 'Connected') :
    'Disconnected'

  return { status, inputName, devices, isAccessGranted, connect, close, statusLabel }
}
