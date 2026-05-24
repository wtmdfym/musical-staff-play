declare module 'verovio/wasm' {
  const createVerovioModule: () => Promise<Record<string, unknown>>
  export default createVerovioModule
}

declare module 'verovio/esm' {
  export class VerovioToolkit {
    constructor(verovioModule: Record<string, unknown>)
    destroy(): void
    loadData(data: string): boolean
    loadZipDataBase64(data: string): boolean
    loadZipDataBuffer(data: ArrayBuffer): boolean
    renderToSVG(pageNo: number, xmlDeclaration?: boolean): string
    renderToTimemap(options?: Record<string, unknown>): unknown
    renderToMIDI(): string
    renderData(data: string, options: Record<string, unknown>): string
    getPageCount(): number
    getPageWithElement(xmlId: string): number
    getTimeForElement(xmlId: string): number
    getTimesForElement(xmlId: string): Record<string, number>
    getElementAttr(xmlId: string): Record<string, string>
    getElementsAtTime(millisec: number): { notes?: string[]; rests?: string[] }
    getMEI(options?: Record<string, unknown>): string
    getLog(): string
    getVersion(): string
    redoLayout(options?: Record<string, unknown>): void
    redoPagePitchPosLayout(): void
    setOptions(options: Record<string, unknown>): void
    getOptions(): Record<string, unknown>
    getDefaultOptions(): Record<string, unknown>
    getAvailableOptions(): Record<string, unknown>
    resetOptions(): void
    resetXmlIdSeed(seed: number): void
    select(selection: Record<string, unknown>): boolean
    edit(editorAction: Record<string, unknown>): boolean
    editInfo(): Record<string, unknown>
    getHumdrum(): string
    getNotatedIdForElement(xmlId: string): string
    getExpansionIdsForElement(xmlId: string): string
    getMIDIValuesForElement(xmlId: string): Record<string, unknown>
    renderToExpansionMap(): Record<string, unknown>
    renderToPAE(): string
    convertHumdrumToHumdrum(data: string): string
    convertHumdrumToMIDI(data: string): string
    convertMEIToHumdrum(data: string): string
    getDescriptiveFeatures(options: Record<string, unknown>): Record<string, unknown>
    validatePAE(data: string): Record<string, unknown>
  }
}
