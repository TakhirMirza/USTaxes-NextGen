import type { TaxReturnInput } from '../engine/model.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import type { VaResult } from '../engine/va2025.ts'
import type { MdResult } from '../engine/md2025.ts'
import { buildMarylandPacket } from './md2025.ts'
import type { DcResult } from '../engine/dc2025.ts'
import type { CaResult } from '../engine/ca2025.ts'
import type { NyResult } from '../engine/ny2025.ts'
import type { IlResult } from '../engine/il2025.ts'
import type { PaResult } from '../engine/pa2025.ts'
import type { NcResult } from '../engine/nc2025.ts'
import type { MiResult } from '../engine/mi2025.ts'
import { buildNcPacket } from './nc2025.ts'
import { buildMiPacket } from './mi2025.ts'
import { buildIlPacket } from './il2025.ts'
import { buildPaPacket } from './pa2025.ts'
import { buildNyPacket } from './ny2025.ts'
import { buildCaPacket } from './ca2025.ts'
import { buildDcPacket } from './dc2025.ts'
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

export function downloadMarylandForms(ret: TaxReturnInput, res: TaxReturnResult, md: MdResult, preparer?: PreparerInfo | null): Promise<{ pages: number; problems: number }> {
  return save(buildMarylandPacket(ret, res, md, preparer).forms, '2025 Maryland Form 502 — USTaxes NextGen', `2025-Maryland-502-${slug(ret)}.pdf`)
}

export function downloadDcForms(ret: TaxReturnInput, res: TaxReturnResult, dc: DcResult, preparer?: PreparerInfo | null): Promise<{ pages: number; problems: number }> {
  return save(buildDcPacket(ret, res, dc, preparer).forms, '2025 DC Form D-40 — USTaxes NextGen', `2025-DC-D40-${slug(ret)}.pdf`)
}

export function downloadCaliforniaForms(ret: TaxReturnInput, res: TaxReturnResult, ca: CaResult, preparer?: PreparerInfo | null): Promise<{ pages: number; problems: number }> {
  return save(buildCaPacket(ret, res, ca, preparer).forms, '2025 California Form 540 — USTaxes NextGen', `2025-California-540-${slug(ret)}.pdf`)
}

export function downloadNewYorkForms(ret: TaxReturnInput, res: TaxReturnResult, ny: NyResult, preparer?: PreparerInfo | null): Promise<{ pages: number; problems: number }> {
  return save(buildNyPacket(ret, res, ny, preparer).forms, '2025 New York Form IT-201 — USTaxes NextGen', `2025-New-York-IT-201-${slug(ret)}.pdf`)
}

export function downloadIllinoisForms(ret: TaxReturnInput, res: TaxReturnResult, il: IlResult, preparer?: PreparerInfo | null): Promise<{ pages: number; problems: number }> {
  return save(buildIlPacket(ret, res, il, preparer).forms, '2025 Illinois Form IL-1040 — USTaxes NextGen', `2025-Illinois-IL-1040-${slug(ret)}.pdf`)
}

export function downloadPennsylvaniaForms(ret: TaxReturnInput, res: TaxReturnResult, pa: PaResult, preparer?: PreparerInfo | null): Promise<{ pages: number; problems: number }> {
  return save(buildPaPacket(ret, res, pa, preparer).forms, '2025 Pennsylvania Form PA-40 — USTaxes NextGen', `2025-Pennsylvania-PA-40-${slug(ret)}.pdf`)
}

export function downloadNorthCarolinaForms(ret: TaxReturnInput, res: TaxReturnResult, nc: NcResult, preparer?: PreparerInfo | null): Promise<{ pages: number; problems: number }> {
  return save(buildNcPacket(ret, res, nc, preparer).forms, '2025 North Carolina Form D-400 — USTaxes NextGen', `2025-North-Carolina-D-400-${slug(ret)}.pdf`)
}

export function downloadMichiganForms(ret: TaxReturnInput, res: TaxReturnResult, mi: MiResult, preparer?: PreparerInfo | null): Promise<{ pages: number; problems: number }> {
  return save(buildMiPacket(ret, res, mi, preparer).forms, '2025 Michigan Form MI-1040 — USTaxes NextGen', `2025-Michigan-MI-1040-${slug(ret)}.pdf`)
}
