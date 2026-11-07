/** Central registry of implemented tax-year calculation and PDF adapters.
 * Adding a year requires verified IRS rules, forms, and regression tests. */
import { Asset, Information, TaxYear } from 'ustaxes/core/data'
import { Either, left, run } from 'ustaxes/core/util'
import { create1040 as create1040For2020 } from 'ustaxes/forms/Y2020/irsForms/Main'
import { create1040 as create1040For2021 } from 'ustaxes/forms/Y2021/irsForms/Main'
import F1040For2020 from 'ustaxes/forms/Y2020/irsForms/F1040'
import F1040For2021 from 'ustaxes/forms/Y2021/irsForms/F1040'
import Form from 'ustaxes/core/irsForms/Form'
import StateForm from 'ustaxes/core/stateForms/Form'
import { createStateReturn as createStateReturn2020 } from 'ustaxes/forms/Y2020/stateForms'
import { createStateReturn as createStateReturn2021 } from 'ustaxes/forms/Y2021/stateForms'
import { PDFDocument } from 'pdf-lib'
import { F1040Error } from './errors'
import { StateFormError } from './StateForms'

export interface CreateFormConfig {
  createF1040: (
    info: Information,
    assets: Asset[]
  ) => Either<F1040Error[], Form[]>
  getPDF: (f: Form) => Promise<PDFDocument>
  getStatePDF: (f: StateForm) => Promise<PDFDocument>
  createStateReturn: (
    f1040: Form
  ) => Either<Array<F1040Error | StateFormError>, StateForm[]>
}


export const IMPLEMENTED_TAX_YEARS: readonly TaxYear[] = ['Y2020', 'Y2021']

const takeSecond = <A, AA, E, B, C>(
  f: (a: A, aa: AA) => Either<E, [B, C]>
): ((a: A, aa: AA) => Either<E, C>) =>
  (a: A, aa: AA): Either<E, C> =>
    run(f(a, aa)).map(([, c]) => c).value()

export const createYearConfigs = (
  downloader: (url: string) => Promise<PDFDocument>
): { [K in TaxYear]: CreateFormConfig } => {
  const baseConfig = {
    getPDF: (form: Form): Promise<PDFDocument> =>
      downloader(`irs/${form.tag}.pdf`),
    getStatePDF: (form: StateForm): Promise<PDFDocument> =>
      downloader(`states/${form.state}/${form.formName}.pdf`)
  }

  return {
    Y2019: {
      ...baseConfig,
      createF1040: () => left([F1040Error.unsupportedTaxYear]),
      createStateReturn: () => left([StateFormError.unsupportedTaxYear])
    },
    Y2020: {
      ...baseConfig,
      createF1040: takeSecond(create1040For2020),
      createStateReturn: (f: Form) => createStateReturn2020(f as F1040For2020)
    },
    Y2021: {
      ...baseConfig,
      createF1040: takeSecond(create1040For2021),
      createStateReturn: (f: Form) => createStateReturn2021(f as F1040For2021)
    }
  }
}
