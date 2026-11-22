import type { TaxReturnInput } from '../engine/model.ts'
import type { DeResult } from '../engine/de2025.ts'
import type { VtResult } from '../engine/vt2025.ts'
import type { NdResult } from '../engine/nd2025.ts'
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
import type { GaResult } from '../engine/ga2025.ts'
import type { OhResult } from '../engine/oh2025.ts'
import { buildGaPacket } from './ga2025.ts'
import { buildOhPacket } from './oh2025.ts'
import type { NjResult } from '../engine/nj2025.ts'
import type { MaResult } from '../engine/ma2025.ts'
import { buildNjPacket } from './nj2025.ts'
import { buildMaPacket } from './ma2025.ts'
import type { AzResult } from '../engine/az2025.ts'
import type { CoResult } from '../engine/co2025.ts'
import { buildAzPacket } from './az2025.ts'
import { buildCoPacket } from './co2025.ts'
import type { MnResult } from '../engine/mn2025.ts'
import { buildMnPacket } from './mn2025.ts'
import type { WiResult } from '../engine/wi2025.ts'
import { buildWiPacket } from './wi2025.ts'
import type { InResult } from '../engine/in2025.ts'
import { buildInPacket } from './in2025.ts'
import type { ScResult } from '../engine/sc2025.ts'
import { buildScPacket } from './sc2025.ts'
import type { LaResult } from '../engine/la2025.ts'
import { buildLaPacket } from './la2025.ts'
import type { AlResult } from '../engine/al2025.ts'
import { buildAlPacket } from './al2025.ts'
import type { OrResult } from '../engine/or2025.ts'
import { buildOrPacket } from './or2025.ts'
import type { KyResult } from '../engine/ky2025.ts'
import { buildKyPacket } from './ky2025.ts'
import type { OkResult } from '../engine/ok2025.ts'
import { buildOkPacket } from './ok2025.ts'
import type { CtResult } from '../engine/ct2025.ts'
import { buildCtPacket } from './ct2025.ts'
import type { UtResult } from '../engine/ut2025.ts'
import { buildUtPacket } from './ut2025.ts'
import type { IaResult } from '../engine/ia2025.ts'
import { buildIaPacket } from './ia2025.ts'
import type { KsResult } from '../engine/ks2025.ts'
import { buildKsPacket } from './ks2025.ts'
import type { ArResult } from '../engine/ar2025.ts'
import { buildArPacket } from './ar2025.ts'
import type { NeResult } from '../engine/ne2025.ts'
import { buildNePacket } from './ne2025.ts'
import type { MsResult } from '../engine/ms2025.ts'
import { buildMsPacket } from './ms2025.ts'
import type { WvResult } from '../engine/wv2025.ts'
import { buildWvPacket } from './wv2025.ts'
import type { NmResult } from '../engine/nm2025.ts'
import { buildNmPacket } from './nm2025.ts'
import type { HiResult } from '../engine/hi2025.ts'
import { buildHiPacket } from './hi2025.ts'
import type { IdResult } from '../engine/id2025.ts'
import { buildIdPacket } from './id2025.ts'
import type { MeResult } from '../engine/me2025.ts'
import { buildMePacket } from './me2025.ts'
import type { MtResult } from '../engine/mt2025.ts'
import { buildMtPacket } from './mt2025.ts'
import type { RiResult } from '../engine/ri2025.ts'
import { buildRiPacket } from './ri2025.ts'
import { buildDePacket } from './de2025.ts'
import { buildVtPacket } from './vt2025.ts'
import { buildNdPacket } from './nd2025.ts'
import { buildIlPacket } from './il2025.ts'
import { buildPaPacket } from './pa2025.ts'
import { buildNyPacket } from './ny2025.ts'
import { buildCaPacket } from './ca2025.ts'
import { buildDcPacket } from './dc2025.ts'
import { buildPacket2025 } from './irs2025.ts'
import type { FormFill, PreparerInfo } from './irs2025.ts'
import { buildVirginiaPacket } from './va2025.ts'
import { buildPdf } from './fill.ts'
import { TAX_YEAR } from '../engine/rules.ts'

/** Fills the forms and saves the PDF. Nothing leaves the device: the blank forms are static files of this site. */
async function save(forms: FormFill[], title: string, fileName: string): Promise<{ pages: number; problems: number }> {
  const lib = await import('pdf-lib')
  const load = async (file: string): Promise<ArrayBuffer> => {
    const response = await fetch(new URL(`forms/${TAX_YEAR}/${file}`, document.baseURI).toString())
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
  return save(buildPacket2025(ret, res, preparer).forms, `${TAX_YEAR} Form 1040 — USTaxes NextGen`, `${TAX_YEAR}-Form-1040-${slug(ret)}.pdf`)
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

export function downloadGeorgiaForms(ret: TaxReturnInput, res: TaxReturnResult, ga: GaResult, preparer?: PreparerInfo | null): Promise<{ pages: number; problems: number }> {
  return save(buildGaPacket(ret, res, ga, preparer).forms, '2025 Georgia Form 500 — USTaxes NextGen', `2025-Georgia-Form-500-${slug(ret)}.pdf`)
}

export function downloadOhioForms(ret: TaxReturnInput, res: TaxReturnResult, oh: OhResult, preparer?: PreparerInfo | null): Promise<{ pages: number; problems: number }> {
  return save(buildOhPacket(ret, res, oh, preparer).forms, '2025 Ohio IT 1040 — USTaxes NextGen', `2025-Ohio-IT-1040-${slug(ret)}.pdf`)
}

export function downloadNewJerseyForms(ret: TaxReturnInput, res: TaxReturnResult, nj: NjResult, preparer?: PreparerInfo | null): Promise<{ pages: number; problems: number }> {
  return save(buildNjPacket(ret, res, nj, preparer).forms, '2025 New Jersey Form NJ-1040 — USTaxes NextGen', `2025-New-Jersey-NJ-1040-${slug(ret)}.pdf`)
}

export function downloadMassachusettsForms(ret: TaxReturnInput, res: TaxReturnResult, ma: MaResult, preparer?: PreparerInfo | null): Promise<{ pages: number; problems: number }> {
  return save(buildMaPacket(ret, res, ma, preparer).forms, '2025 Massachusetts Form 1 — USTaxes NextGen', `2025-Massachusetts-Form-1-${slug(ret)}.pdf`)
}

export function downloadArizonaForms(ret: TaxReturnInput, res: TaxReturnResult, az: AzResult, preparer?: PreparerInfo | null): Promise<{ pages: number; problems: number }> {
  return save(buildAzPacket(ret, res, az, preparer).forms, '2025 Arizona Form 140 — USTaxes NextGen', `2025-Arizona-Form-140-${slug(ret)}.pdf`)
}

export function downloadColoradoForms(ret: TaxReturnInput, res: TaxReturnResult, co: CoResult, preparer?: PreparerInfo | null): Promise<{ pages: number; problems: number }> {
  return save(buildCoPacket(ret, res, co, preparer).forms, '2025 Colorado Form DR 0104 — USTaxes NextGen', `2025-Colorado-DR-0104-${slug(ret)}.pdf`)
}

export function downloadMinnesotaForms(ret: TaxReturnInput, res: TaxReturnResult, mn: MnResult, preparer?: PreparerInfo | null): Promise<{ pages: number; problems: number }> {
  return save(buildMnPacket(ret, res, mn, preparer).forms, '2025 Minnesota Form M1 — USTaxes NextGen', `2025-Minnesota-M1-${slug(ret)}.pdf`)
}

export function downloadWisconsinForms(ret: TaxReturnInput, res: TaxReturnResult, wi: WiResult, preparer?: PreparerInfo | null): Promise<{ pages: number; problems: number }> {
  return save(buildWiPacket(ret, res, wi, preparer).forms, '2025 Wisconsin Form 1 — USTaxes NextGen', `2025-Wisconsin-Form-1-${slug(ret)}.pdf`)
}

export function downloadIndianaForms(ret: TaxReturnInput, res: TaxReturnResult, it: InResult, preparer?: PreparerInfo | null): Promise<{ pages: number; problems: number }> {
  return save(buildInPacket(ret, res, it, preparer).forms, '2025 Indiana Form IT-40 — USTaxes NextGen', `2025-Indiana-IT-40-${slug(ret)}.pdf`)
}

export function downloadSouthCarolinaForms(ret: TaxReturnInput, res: TaxReturnResult, sc: ScResult, preparer?: PreparerInfo | null): Promise<{ pages: number; problems: number }> {
  return save(buildScPacket(ret, res, sc, preparer).forms, '2025 South Carolina SC1040 — USTaxes NextGen', `2025-South-Carolina-SC1040-${slug(ret)}.pdf`)
}

export function downloadLouisianaForms(ret: TaxReturnInput, res: TaxReturnResult, la: LaResult, preparer?: PreparerInfo | null): Promise<{ pages: number; problems: number }> {
  return save(buildLaPacket(ret, res, la, preparer).forms, '2025 Louisiana Form IT-540 — USTaxes NextGen', `2025-Louisiana-IT-540-${slug(ret)}.pdf`)
}

export function downloadAlabamaForms(ret: TaxReturnInput, res: TaxReturnResult, al: AlResult, preparer?: PreparerInfo | null): Promise<{ pages: number; problems: number }> {
  return save(buildAlPacket(ret, res, al, preparer).forms, '2025 Alabama Form 40 — USTaxes NextGen', `2025-Alabama-Form-40-${slug(ret)}.pdf`)
}

export function downloadOregonForms(ret: TaxReturnInput, res: TaxReturnResult, or: OrResult, preparer?: PreparerInfo | null): Promise<{ pages: number; problems: number }> {
  return save(buildOrPacket(ret, res, or, preparer).forms, '2025 Oregon Form OR-40 — USTaxes NextGen', `2025-Oregon-OR-40-${slug(ret)}.pdf`)
}

export function downloadKentuckyForms(ret: TaxReturnInput, res: TaxReturnResult, ky: KyResult, preparer?: PreparerInfo | null): Promise<{ pages: number; problems: number }> {
  return save(buildKyPacket(ret, res, ky, preparer).forms, '2025 Kentucky Form 740 — USTaxes NextGen', `2025-Kentucky-740-${slug(ret)}.pdf`)
}

export function downloadOklahomaForms(ret: TaxReturnInput, res: TaxReturnResult, ok: OkResult, preparer?: PreparerInfo | null): Promise<{ pages: number; problems: number }> {
  return save(buildOkPacket(ret, res, ok, preparer).forms, '2025 Oklahoma Form 511 — USTaxes NextGen', `2025-Oklahoma-511-${slug(ret)}.pdf`)
}

export function downloadConnecticutForms(ret: TaxReturnInput, res: TaxReturnResult, ct: CtResult, preparer?: PreparerInfo | null): Promise<{ pages: number; problems: number }> {
  return save(buildCtPacket(ret, res, ct, preparer).forms, '2025 Connecticut Form CT-1040 — USTaxes NextGen', `2025-Connecticut-CT-1040-${slug(ret)}.pdf`)
}

export function downloadUtahForms(ret: TaxReturnInput, res: TaxReturnResult, ut: UtResult, preparer?: PreparerInfo | null): Promise<{ pages: number; problems: number }> {
  return save(buildUtPacket(ret, res, ut, preparer).forms, '2025 Utah Form TC-40 — USTaxes NextGen', `2025-Utah-TC-40-${slug(ret)}.pdf`)
}

export function downloadIowaForms(ret: TaxReturnInput, res: TaxReturnResult, ia: IaResult, preparer?: PreparerInfo | null): Promise<{ pages: number; problems: number }> {
  return save(buildIaPacket(ret, res, ia, preparer).forms, '2025 Iowa Form IA 1040 — USTaxes NextGen', `2025-Iowa-IA-1040-${slug(ret)}.pdf`)
}

export function downloadKansasForms(ret: TaxReturnInput, res: TaxReturnResult, ks: KsResult, preparer?: PreparerInfo | null): Promise<{ pages: number; problems: number }> {
  return save(buildKsPacket(ret, res, ks, preparer).forms, '2025 Kansas Form K-40 — USTaxes NextGen', `2025-Kansas-K-40-${slug(ret)}.pdf`)
}

export function downloadArkansasForms(ret: TaxReturnInput, res: TaxReturnResult, ar: ArResult, preparer?: PreparerInfo | null): Promise<{ pages: number; problems: number }> {
  return save(buildArPacket(ret, res, ar, preparer).forms, '2025 Arkansas Form AR1000F — USTaxes NextGen', `2025-Arkansas-AR1000F-${slug(ret)}.pdf`)
}

export function downloadNebraskaForms(ret: TaxReturnInput, res: TaxReturnResult, ne: NeResult, preparer?: PreparerInfo | null): Promise<{ pages: number; problems: number }> {
  return save(buildNePacket(ret, res, ne, preparer).forms, '2025 Nebraska Form 1040N — USTaxes NextGen', `2025-Nebraska-1040N-${slug(ret)}.pdf`)
}

export function downloadMississippiForms(ret: TaxReturnInput, res: TaxReturnResult, ms: MsResult, preparer?: PreparerInfo | null): Promise<{ pages: number; problems: number }> {
  return save(buildMsPacket(ret, res, ms, preparer).forms, '2025 Mississippi Form 80-105 — USTaxes NextGen', `2025-Mississippi-80-105-${slug(ret)}.pdf`)
}

export function downloadWestVirginiaForms(ret: TaxReturnInput, res: TaxReturnResult, wv: WvResult, preparer?: PreparerInfo | null): Promise<{ pages: number; problems: number }> {
  return save(buildWvPacket(ret, res, wv, preparer).forms, '2025 West Virginia Form IT-140 — USTaxes NextGen', `2025-West-Virginia-IT-140-${slug(ret)}.pdf`)
}

export function downloadNewMexicoForms(ret: TaxReturnInput, res: TaxReturnResult, nm: NmResult, preparer?: PreparerInfo | null): Promise<{ pages: number; problems: number }> {
  return save(buildNmPacket(ret, res, nm, preparer).forms, '2025 New Mexico Form PIT-1 — USTaxes NextGen', `2025-New-Mexico-PIT-1-${slug(ret)}.pdf`)
}

export function downloadHawaiiForms(ret: TaxReturnInput, res: TaxReturnResult, hi: HiResult, preparer?: PreparerInfo | null): Promise<{ pages: number; problems: number }> {
  return save(buildHiPacket(ret, res, hi, preparer).forms, '2025 Hawaii Form N-11 — USTaxes NextGen', `2025-Hawaii-N-11-${slug(ret)}.pdf`)
}

export function downloadIdahoForms(ret: TaxReturnInput, res: TaxReturnResult, id: IdResult, preparer?: PreparerInfo | null): Promise<{ pages: number; problems: number }> {
  return save(buildIdPacket(ret, res, id, preparer).forms, '2025 Idaho Form 40 — USTaxes NextGen', `2025-Idaho-Form-40-${slug(ret)}.pdf`)
}

export function downloadMaineForms(ret: TaxReturnInput, res: TaxReturnResult, me: MeResult, preparer?: PreparerInfo | null): Promise<{ pages: number; problems: number }> {
  return save(buildMePacket(ret, res, me, preparer).forms, '2025 Maine Form 1040ME — USTaxes NextGen', `2025-Maine-1040ME-${slug(ret)}.pdf`)
}

export function downloadMontanaForms(ret: TaxReturnInput, res: TaxReturnResult, mt: MtResult, preparer?: PreparerInfo | null): Promise<{ pages: number; problems: number }> {
  return save(buildMtPacket(ret, res, mt, preparer).forms, '2025 Montana Form 2 — USTaxes NextGen', `2025-Montana-Form-2-${slug(ret)}.pdf`)
}

export function downloadRhodeIslandForms(ret: TaxReturnInput, res: TaxReturnResult, ri: RiResult, preparer?: PreparerInfo | null): Promise<{ pages: number; problems: number }> {
  return save(buildRiPacket(ret, res, ri, preparer).forms, '2025 Rhode Island RI-1040 — USTaxes NextGen', `2025-Rhode-Island-RI-1040-${slug(ret)}.pdf`)
}

export function downloadDelawareForms(ret: TaxReturnInput, res: TaxReturnResult, de: DeResult, preparer?: PreparerInfo | null): Promise<{ pages: number; problems: number }> {
  return save(buildDePacket(ret, res, de, preparer).forms, '2025 Delaware PIT-RES — USTaxes NextGen', `2025-Delaware-PIT-RES-${slug(ret)}.pdf`)
}

export function downloadVermontForms(ret: TaxReturnInput, res: TaxReturnResult, vt: VtResult, preparer?: PreparerInfo | null): Promise<{ pages: number; problems: number }> {
  return save(buildVtPacket(ret, res, vt, preparer).forms, '2025 Vermont IN-111 — USTaxes NextGen', `2025-Vermont-IN-111-${slug(ret)}.pdf`)
}

export function downloadNorthDakotaForms(ret: TaxReturnInput, res: TaxReturnResult, nd: NdResult, preparer?: PreparerInfo | null): Promise<{ pages: number; problems: number }> {
  return save(buildNdPacket(ret, res, nd, preparer).forms, '2025 North Dakota ND-1 — USTaxes NextGen', `2025-North-Dakota-ND-1-${slug(ret)}.pdf`)
}
