function getExt(name: string): string {
  const i = name.lastIndexOf('.')
  return i < 0 ? '' : name.slice(i).toLowerCase()
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsArrayBuffer(file)
  })
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

export interface LoadedFileResult {
  xml: string
  fileName: string
  format: 'musicxml' | 'mei'
}

export async function loadScoreFromFile(file: File): Promise<LoadedFileResult> {
  const ext = getExt(file.name)

  if (ext === '.mxl') {
    const buf = await readFileAsArrayBuffer(file)
    const xml = await extractMxlXml(buf)
    return { xml, fileName: file.name, format: 'musicxml' }
  }

  const xml = await readFileAsText(file)
  const format = ext === '.mei' ? 'mei' as const : 'musicxml' as const
  return { xml, fileName: file.name, format }
}
