/**
 * The 50 states and DC: whether each taxes wage income, which resident form it uses, and whether this
 * app prepares it. A state moves to 'supported' once its engine, forms and tests are in place
 * (Virginia was the first). For the rest, the app says what to file and where, without guessing numbers.
 */
export type StateCode =
  | 'AL' | 'AK' | 'AZ' | 'AR' | 'CA' | 'CO' | 'CT' | 'DE' | 'DC' | 'FL' | 'GA' | 'HI' | 'ID' | 'IL' | 'IN' | 'IA' | 'KS'
  | 'KY' | 'LA' | 'ME' | 'MD' | 'MA' | 'MI' | 'MN' | 'MS' | 'MO' | 'MT' | 'NE' | 'NV' | 'NH' | 'NJ' | 'NM' | 'NY' | 'NC'
  | 'ND' | 'OH' | 'OK' | 'OR' | 'PA' | 'RI' | 'SC' | 'SD' | 'TN' | 'TX' | 'UT' | 'VT' | 'VA' | 'WA' | 'WV' | 'WI' | 'WY'

export type StateSupport = 'supported' | 'no-tax' | 'estimate'

export interface StateInfo {
  code: StateCode
  name: string
  support: StateSupport
  /** Resident individual income tax return (blank for states without an income tax). */
  form: string
  /** Who runs it. */
  agency: string
  /** A short note shown under the state, when there is something to know. */
  note?: string
}

const S = (code: StateCode, name: string, support: StateSupport, form: string, agency: string, note?: string): StateInfo => ({ code, name, support, form, agency, note })

export const STATES: readonly StateInfo[] = [
  S('AL', 'Alabama', 'estimate', 'Form 40', 'Alabama Department of Revenue'),
  S('AK', 'Alaska', 'no-tax', '', 'Alaska Department of Revenue', 'Alaska has no individual income tax.'),
  S('AZ', 'Arizona', 'estimate', 'Form 140', 'Arizona Department of Revenue'),
  S('AR', 'Arkansas', 'estimate', 'Form AR1000F', 'Arkansas Department of Finance and Administration'),
  S('CA', 'California', 'estimate', 'Form 540', 'California Franchise Tax Board'),
  S('CO', 'Colorado', 'estimate', 'Form DR 0104', 'Colorado Department of Revenue'),
  S('CT', 'Connecticut', 'estimate', 'Form CT-1040', 'Connecticut Department of Revenue Services'),
  S('DE', 'Delaware', 'estimate', 'Form PIT-RES', 'Delaware Division of Revenue'),
  S('DC', 'District of Columbia', 'estimate', 'Form D-40', 'DC Office of Tax and Revenue'),
  S('FL', 'Florida', 'no-tax', '', 'Florida Department of Revenue', 'Florida has no individual income tax.'),
  S('GA', 'Georgia', 'estimate', 'Form 500', 'Georgia Department of Revenue'),
  S('HI', 'Hawaii', 'estimate', 'Form N-11', 'Hawaii Department of Taxation'),
  S('ID', 'Idaho', 'estimate', 'Form 40', 'Idaho State Tax Commission'),
  S('IL', 'Illinois', 'estimate', 'Form IL-1040', 'Illinois Department of Revenue'),
  S('IN', 'Indiana', 'estimate', 'Form IT-40', 'Indiana Department of Revenue', 'Indiana also has county income tax, figured on the same return.'),
  S('IA', 'Iowa', 'estimate', 'Form IA 1040', 'Iowa Department of Revenue'),
  S('KS', 'Kansas', 'estimate', 'Form K-40', 'Kansas Department of Revenue'),
  S('KY', 'Kentucky', 'estimate', 'Form 740', 'Kentucky Department of Revenue'),
  S('LA', 'Louisiana', 'estimate', 'Form IT-540', 'Louisiana Department of Revenue'),
  S('ME', 'Maine', 'estimate', 'Form 1040ME', 'Maine Revenue Services'),
  S('MD', 'Maryland', 'estimate', 'Form 502', 'Comptroller of Maryland', 'Maryland also has county income tax, figured on the same return.'),
  S('MA', 'Massachusetts', 'estimate', 'Form 1', 'Massachusetts Department of Revenue'),
  S('MI', 'Michigan', 'estimate', 'Form MI-1040', 'Michigan Department of Treasury', 'Some Michigan cities also have their own income tax return.'),
  S('MN', 'Minnesota', 'estimate', 'Form M1', 'Minnesota Department of Revenue'),
  S('MS', 'Mississippi', 'estimate', 'Form 80-105', 'Mississippi Department of Revenue'),
  S('MO', 'Missouri', 'estimate', 'Form MO-1040', 'Missouri Department of Revenue'),
  S('MT', 'Montana', 'estimate', 'Form 2', 'Montana Department of Revenue'),
  S('NE', 'Nebraska', 'estimate', 'Form 1040N', 'Nebraska Department of Revenue'),
  S('NV', 'Nevada', 'no-tax', '', 'Nevada Department of Taxation', 'Nevada has no individual income tax.'),
  S('NH', 'New Hampshire', 'no-tax', '', 'New Hampshire Department of Revenue Administration', 'New Hampshire’s tax on interest and dividends was repealed starting with 2025, so there is no individual income tax return.'),
  S('NJ', 'New Jersey', 'estimate', 'Form NJ-1040', 'New Jersey Division of Taxation'),
  S('NM', 'New Mexico', 'estimate', 'Form PIT-1', 'New Mexico Taxation and Revenue Department'),
  S('NY', 'New York', 'estimate', 'Form IT-201', 'New York State Department of Taxation and Finance', 'New York City and Yonkers residents also figure city tax on the same return.'),
  S('NC', 'North Carolina', 'estimate', 'Form D-400', 'North Carolina Department of Revenue'),
  S('ND', 'North Dakota', 'estimate', 'Form ND-1', 'North Dakota Office of State Tax Commissioner'),
  S('OH', 'Ohio', 'estimate', 'Form IT 1040', 'Ohio Department of Taxation', 'Most Ohio cities and many school districts also tax income on their own returns.'),
  S('OK', 'Oklahoma', 'estimate', 'Form 511', 'Oklahoma Tax Commission'),
  S('OR', 'Oregon', 'estimate', 'Form OR-40', 'Oregon Department of Revenue'),
  S('PA', 'Pennsylvania', 'estimate', 'Form PA-40', 'Pennsylvania Department of Revenue', 'Pennsylvania municipalities also levy an earned income tax, filed locally.'),
  S('RI', 'Rhode Island', 'estimate', 'Form RI-1040', 'Rhode Island Division of Taxation'),
  S('SC', 'South Carolina', 'estimate', 'Form SC1040', 'South Carolina Department of Revenue'),
  S('SD', 'South Dakota', 'no-tax', '', 'South Dakota Department of Revenue', 'South Dakota has no individual income tax.'),
  S('TN', 'Tennessee', 'no-tax', '', 'Tennessee Department of Revenue', 'Tennessee has no individual income tax.'),
  S('TX', 'Texas', 'no-tax', '', 'Texas Comptroller of Public Accounts', 'Texas has no individual income tax.'),
  S('UT', 'Utah', 'estimate', 'Form TC-40', 'Utah State Tax Commission'),
  S('VT', 'Vermont', 'estimate', 'Form IN-111', 'Vermont Department of Taxes'),
  S('VA', 'Virginia', 'supported', 'Form 760', 'Virginia Department of Taxation'),
  S('WA', 'Washington', 'no-tax', '', 'Washington Department of Revenue', 'Washington has no tax on wages, but it taxes large long-term capital gains (capital gains excise tax, its own return).'),
  S('WV', 'West Virginia', 'estimate', 'Form IT-140', 'West Virginia State Tax Department'),
  S('WI', 'Wisconsin', 'estimate', 'Form 1', 'Wisconsin Department of Revenue'),
  S('WY', 'Wyoming', 'no-tax', '', 'Wyoming Department of Revenue', 'Wyoming has no individual income tax.')
]

export const stateInfo = (code: string): StateInfo | undefined => STATES.find((s) => s.code === code.toUpperCase())
export const isStateCode = (code: string): code is StateCode => !!stateInfo(code)
