/** Stable NextGen 2.0 preview routes. No sensitive information is stored in the URL. */
export type V2Step = 'overview' | 'profile' | 'income' | 'deductions' | 'review'

const validSteps: readonly V2Step[] = ['overview', 'profile', 'income', 'deductions', 'review']

export function v2PathForStep(step: V2Step): string {
  return step === 'overview' ? '/start' : `/v2/${step}`
}

export function stepFromV2Path(pathname: string): V2Step {
  if (pathname === '/start' || pathname === '/v2' || pathname === '/v2/' || pathname === '/') return 'overview'
  const match = /^\/v2\/(profile|income|deductions|review)\/?$/.exec(pathname)
  if (match && validSteps.includes(match[1] as V2Step)) return match[1] as V2Step
  return 'overview'
}
