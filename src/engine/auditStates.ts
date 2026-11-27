/**
 * Every state with a full 2025 return: its engine, its PDF packet builder and the lines for the amount owed and the
 * refund (the same lines the summary shows). Used by the audit sweep (audit2025.test.ts).
 */
import type { TaxReturnResult } from './compute.ts'
import type { TaxReturnInput } from './model.ts'
import type { FormPacket } from '../pdf/irs2025.ts'
import { computeIllinois } from './il2025.ts'
import { buildIlPacket } from '../pdf/il2025.ts'
import { computePennsylvania } from './pa2025.ts'
import { buildPaPacket } from '../pdf/pa2025.ts'
import { computeNorthCarolina } from './nc2025.ts'
import { buildNcPacket } from '../pdf/nc2025.ts'
import { computeMichigan } from './mi2025.ts'
import { buildMiPacket } from '../pdf/mi2025.ts'
import { computeGeorgia } from './ga2025.ts'
import { buildGaPacket } from '../pdf/ga2025.ts'
import { computeOhio } from './oh2025.ts'
import { buildOhPacket } from '../pdf/oh2025.ts'
import { computeNewJersey } from './nj2025.ts'
import { buildNjPacket } from '../pdf/nj2025.ts'
import { computeMassachusetts } from './ma2025.ts'
import { buildMaPacket } from '../pdf/ma2025.ts'
import { computeArizona } from './az2025.ts'
import { buildAzPacket } from '../pdf/az2025.ts'
import { computeColorado } from './co2025.ts'
import { buildCoPacket } from '../pdf/co2025.ts'
import { computeMinnesota } from './mn2025.ts'
import { buildMnPacket } from '../pdf/mn2025.ts'
import { computeWisconsin } from './wi2025.ts'
import { buildWiPacket } from '../pdf/wi2025.ts'
import { computeIndiana } from './in2025.ts'
import { buildInPacket } from '../pdf/in2025.ts'
import { computeSouthCarolina } from './sc2025.ts'
import { buildScPacket } from '../pdf/sc2025.ts'
import { computeLouisiana } from './la2025.ts'
import { buildLaPacket } from '../pdf/la2025.ts'
import { computeAlabama } from './al2025.ts'
import { buildAlPacket } from '../pdf/al2025.ts'
import { computeOregon } from './or2025.ts'
import { buildOrPacket } from '../pdf/or2025.ts'
import { computeKentucky } from './ky2025.ts'
import { buildKyPacket } from '../pdf/ky2025.ts'
import { computeOklahoma } from './ok2025.ts'
import { buildOkPacket } from '../pdf/ok2025.ts'
import { computeConnecticut } from './ct2025.ts'
import { buildCtPacket } from '../pdf/ct2025.ts'
import { computeUtah } from './ut2025.ts'
import { buildUtPacket } from '../pdf/ut2025.ts'
import { computeIowa } from './ia2025.ts'
import { buildIaPacket } from '../pdf/ia2025.ts'
import { computeKansas } from './ks2025.ts'
import { buildKsPacket } from '../pdf/ks2025.ts'
import { computeArkansas } from './ar2025.ts'
import { buildArPacket } from '../pdf/ar2025.ts'
import { computeNebraska } from './ne2025.ts'
import { buildNePacket } from '../pdf/ne2025.ts'
import { computeMississippi } from './ms2025.ts'
import { buildMsPacket } from '../pdf/ms2025.ts'
import { computeWestVirginia } from './wv2025.ts'
import { buildWvPacket } from '../pdf/wv2025.ts'
import { computeNewMexico } from './nm2025.ts'
import { buildNmPacket } from '../pdf/nm2025.ts'
import { computeHawaii } from './hi2025.ts'
import { buildHiPacket } from '../pdf/hi2025.ts'
import { computeIdaho } from './id2025.ts'
import { buildIdPacket } from '../pdf/id2025.ts'
import { computeMaine } from './me2025.ts'
import { buildMePacket } from '../pdf/me2025.ts'
import { computeMontana } from './mt2025.ts'
import { buildMtPacket } from '../pdf/mt2025.ts'
import { computeRhodeIsland } from './ri2025.ts'
import { buildRiPacket } from '../pdf/ri2025.ts'
import { computeDelaware } from './de2025.ts'
import { buildDePacket } from '../pdf/de2025.ts'
import { computeVermont } from './vt2025.ts'
import { buildVtPacket } from '../pdf/vt2025.ts'
import { computeNorthDakota } from './nd2025.ts'
import { buildNdPacket } from '../pdf/nd2025.ts'
import { computeMissouri } from './mo2025.ts'
import { buildMoPacket } from '../pdf/mo2025.ts'
import { computeNewYork } from './ny2025.ts'
import { buildNyPacket } from '../pdf/ny2025.ts'
import { computeCalifornia } from './ca2025.ts'
import { buildCaPacket } from '../pdf/ca2025.ts'
import { computeDc } from './dc2025.ts'
import { buildDcPacket } from '../pdf/dc2025.ts'
import { computeMaryland } from './md2025.ts'
import { buildMarylandPacket } from '../pdf/md2025.ts'
import { computeVirginia } from './va2025.ts'
import { buildVirginiaPacket } from '../pdf/va2025.ts'

type Compute = (ret: TaxReturnInput, res: TaxReturnResult) => { lines: Record<string, number> }
type Build = (ret: TaxReturnInput, res: TaxReturnResult, x: unknown) => FormPacket
export const STATES: { code: string; compute: Compute; build: Build; owed: string; refund: string }[] = [
  { code: 'IL', compute: computeIllinois as Compute, build: buildIlPacket as Build, owed: '41', refund: '38' },
  { code: 'PA', compute: computePennsylvania as Compute, build: buildPaPacket as Build, owed: '28', refund: '30' },
  { code: 'NC', compute: computeNorthCarolina as Compute, build: buildNcPacket as Build, owed: '27', refund: '34' },
  { code: 'MI', compute: computeMichigan as Compute, build: buildMiPacket as Build, owed: '36', refund: '39' },
  { code: 'GA', compute: computeGeorgia as Compute, build: buildGaPacket as Build, owed: '45', refund: '46' },
  { code: 'OH', compute: computeOhio as Compute, build: buildOhPacket as Build, owed: '22', refund: '26' },
  { code: 'NJ', compute: computeNewJersey as Compute, build: buildNjPacket as Build, owed: '79', refund: '80' },
  { code: 'MA', compute: computeMassachusetts as Compute, build: buildMaPacket as Build, owed: '55', refund: '54' },
  { code: 'AZ', compute: computeArizona as Compute, build: buildAzPacket as Build, owed: '80', refund: '79' },
  { code: 'CO', compute: computeColorado as Compute, build: buildCoPacket as Build, owed: '47', refund: '42' },
  { code: 'MN', compute: computeMinnesota as Compute, build: buildMnPacket as Build, owed: '26', refund: '24' },
  { code: 'WI', compute: computeWisconsin as Compute, build: buildWiPacket as Build, owed: '45', refund: '41' },
  { code: 'IN', compute: computeIndiana as Compute, build: buildInPacket as Build, owed: '26', refund: '21' },
  { code: 'SC', compute: computeSouthCarolina as Compute, build: buildScPacket as Build, owed: '34', refund: '30' },
  { code: 'LA', compute: computeLouisiana as Compute, build: buildLaPacket as Build, owed: '47', refund: '38' },
  { code: 'AL', compute: computeAlabama as Compute, build: buildAlPacket as Build, owed: '30', refund: '35' },
  { code: 'OR', compute: computeOregon as Compute, build: buildOrPacket as Build, owed: '46', refund: '53' },
  { code: 'KY', compute: computeKentucky as Compute, build: buildKyPacket as Build, owed: '36', refund: '41' },
  { code: 'OK', compute: computeOklahoma as Compute, build: buildOkPacket as Build, owed: '39', refund: '38' },
  { code: 'CT', compute: computeConnecticut as Compute, build: buildCtPacket as Build, owed: '26', refund: '25' },
  { code: 'UT', compute: computeUtah as Compute, build: buildUtPacket as Build, owed: '41', refund: '44' },
  { code: 'IA', compute: computeIowa as Compute, build: buildIaPacket as Build, owed: '37', refund: '32' },
  { code: 'KS', compute: computeKansas as Compute, build: buildKsPacket as Build, owed: '32', refund: '43' },
  { code: 'AR', compute: computeArkansas as Compute, build: buildArPacket as Build, owed: '51', refund: '50' },
  { code: 'NE', compute: computeNebraska as Compute, build: buildNePacket as Build, owed: '59', refund: '63' },
  { code: 'MS', compute: computeMississippi as Compute, build: buildMsPacket as Build, owed: '37', refund: '34' },
  { code: 'WV', compute: computeWestVirginia as Compute, build: buildWvPacket as Build, owed: '24', refund: '28' },
  { code: 'NM', compute: computeNewMexico as Compute, build: buildNmPacket as Build, owed: '33', refund: '42' },
  { code: 'HI', compute: computeHawaii as Compute, build: buildHiPacket as Build, owed: '49', refund: '47a' },
  { code: 'ID', compute: computeIdaho as Compute, build: buildIdPacket as Build, owed: '54', refund: '56' },
  { code: 'ME', compute: computeMaine as Compute, build: buildMePacket as Build, owed: '35', refund: '34b' },
  { code: 'MT', compute: computeMontana as Compute, build: buildMtPacket as Build, owed: '22', refund: '26' },
  { code: 'RI', compute: computeRhodeIsland as Compute, build: buildRiPacket as Build, owed: '15c', refund: '17' },
  { code: 'DE', compute: computeDelaware as Compute, build: buildDePacket as Build, owed: '46', refund: '47' },
  { code: 'VT', compute: computeVermont as Compute, build: buildVtPacket as Build, owed: '32', refund: '29' },
  { code: 'ND', compute: computeNorthDakota as Compute, build: buildNdPacket as Build, owed: '36', refund: '32' },
  { code: 'MO', compute: computeMissouri as Compute, build: buildMoPacket as Build, owed: '56', refund: '53' },
  { code: 'NY', compute: computeNewYork as Compute, build: buildNyPacket as Build, owed: '80', refund: '78b' },
  { code: 'CA', compute: computeCalifornia as Compute, build: buildCaPacket as Build, owed: '111', refund: '115' },
  { code: 'DC', compute: computeDc as Compute, build: buildDcPacket as Build, owed: '37', refund: '43' },
  { code: 'MD', compute: computeMaryland as Compute, build: buildMarylandPacket as Build, owed: '47', refund: '50' },
  { code: 'VA', compute: computeVirginia as Compute, build: buildVirginiaPacket as Build, owed: '35', refund: '36' },
]
