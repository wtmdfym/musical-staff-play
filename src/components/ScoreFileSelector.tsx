import { useRef, useState } from 'react'
import { usePractice } from '../context/usePractice'
import { parseFromXml } from '../score/MusicxmlParser'


function getExt(name: string): string {
  const i = name.lastIndexOf('.')
  return i < 0 ? '' : name.slice(i).toLowerCase()
}

async function extractMxlXml(buf: ArrayBuffer): Promise<string> {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(buf)

  const containerXml = await zip.file('META-INF/container.xml')?.async('string')
  if (!containerXml) throw new Error('META-INF/container.xml not found in .mxl archive')

  const doc = new DOMParser().parseFromString(containerXml, 'text/xml')
  const rootfile = doc.querySelector('rootfile')
  const fullPath = rootfile?.getAttribute('full-path')
  if (!fullPath) throw new Error('No rootfile found in META-INF/container.xml')

  const scoreXml = await zip.file(fullPath)?.async('string')
  if (!scoreXml) throw new Error(`File "${fullPath}" (referenced by container.xml) not found in .mxl archive`)

  return scoreXml
}

export default function ScoreFileSelector() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const { dispatch } = usePractice()

  const handleClick = () => {
    setError(null)
    inputRef.current?.click()
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    const ext = getExt(file.name)

    const onErr = (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Unknown parse error'
      console.error('Score parse failed:', msg)
      setError(msg)
    }

    if (ext === '.mxl') {
      const reader = new FileReader()
      reader.onload = () => {
        extractMxlXml(reader.result as ArrayBuffer)
          .then(xml => {
            const score = parseFromXml(xml)
            dispatch({ type: 'LOAD_SCORE', score, fileName: file.name, rawDocument: xml, documentFormat: 'musicxml' })
          })
          .catch(onErr)
      }
      reader.onerror = () => setError('Failed to read file')
      reader.readAsArrayBuffer(file)
    } else {
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const raw = reader.result as string
          const format = ext === '.mei' ? 'mei' as const : 'musicxml' as const
          const score = parseFromXml(raw)
          dispatch({ type: 'LOAD_SCORE', score, fileName: file.name, rawDocument: raw, documentFormat: format })
        } catch (err) { onErr(err) }
      }
      reader.onerror = () => setError('Failed to read file')
      reader.readAsText(file)
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
