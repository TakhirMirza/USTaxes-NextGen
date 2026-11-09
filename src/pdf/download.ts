import type { TaxReturnInput } from '../engine/model.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import { buildPacket2025 } from './irs2025.ts'
import { buildPdf } from './fill.ts'

/** Builds the filled IRS PDF in the browser. Nothing leaves the device: the blank forms are static files of this site. */
export async function downloadIrsForms(ret: TaxReturnInput, res: TaxReturnResult): Promise<{ pages: number; problems: number }> {
  const lib = await import('pdf-lib')
  const packet = buildPacket2025(ret, res)
  const load = async (file: string): Promise<ArrayBuffer> => {
    const response = await fetch(new URL(`forms/2025/${file}`, document.baseURI).toString())
    if (!response.ok) throw new Error(`Could not load the blank form ${file} (HTTP ${response.status}).`)
    return response.arrayBuffer()
  }
  const { bytes, problems } = await buildPdf(lib, packet.forms, load)
  if (problems.length) console.warn('IRS form fields not filled:', problems)
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `2025-Form-1040-${(ret.taxpayer.lastName || 'return').replace(/[^A-Za-z0-9]+/g, '-')}.pdf`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
  const doc = await lib.PDFDocument.load(bytes)
  return { pages: doc.getPageCount(), problems: problems.length }
}
