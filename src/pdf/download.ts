import type { TaxReturnInput } from '../engine/model.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import type { VaResult } from '../engine/va2025.ts'
import { buildPacket2025 } from './irs2025.ts'
import type { FormFill, PreparerInfo } from './irs2025.ts'
import { buildVirginiaPacket } from './va2025.ts'
import { buildPdf } from './fill.ts'

/** Fills the forms and saves the PDF. Nothing leaves the device: the blank forms are static files of this site. */
async function save(forms: FormFill[], title: string, fileName: string): Promise<{ pages: number; problems: number }> {
  const lib = await import('pdf-lib')
  const load = async (file: string): Promise<ArrayBuffer> => {
    const response = await fetch(new URL(`forms/2025/${file}`, document.baseURI).toString())
    if (!response.ok) throw new Error(`Could not load the blank form ${file} (HTTP ${response.status}).`)
    return response.arrayBuffer()
  }
  const { bytes, problems } = await buildPdf(lib, forms, load, title)
  if (problems.length) console.warn('Form fields not filled:', problems)
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
  const doc = await lib.PDFDocument.load(bytes)
  return { pages: doc.getPageCount(), problems: problems.length }
}

const slug = (ret: TaxReturnInput): string => (ret.taxpayer.lastName || 'return').replace(/[^A-Za-z0-9]+/g, '-')

export function downloadIrsForms(ret: TaxReturnInput, res: TaxReturnResult, preparer?: PreparerInfo | null): Promise<{ pages: number; problems: number }> {
  return save(buildPacket2025(ret, res, preparer).forms, '2025 Form 1040 — USTaxes NextGen', `2025-Form-1040-${slug(ret)}.pdf`)
}

export function downloadVirginiaForms(ret: TaxReturnInput, res: TaxReturnResult, va: VaResult, preparer?: PreparerInfo | null): Promise<{ pages: number; problems: number }> {
  return save(buildVirginiaPacket(ret, res, va, preparer).forms, '2025 Virginia Form 760 — USTaxes NextGen', `2025-Virginia-760-${slug(ret)}.pdf`)
}
