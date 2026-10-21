import { Information, Asset, TaxYear } from 'ustaxes/core/data'
import { Either, isLeft, isRight, run, runAsync } from 'ustaxes/core/util'
import Form from 'ustaxes/core/irsForms/Form'
import StateForm from 'ustaxes/core/stateForms/Form'

import { PDFDocument } from 'pdf-lib'
import { fillPDF } from 'ustaxes/core/pdfFiller/fillPdf'
import {
  combinePdfs,
  downloadPDF,
  PDFDownloader
} from 'ustaxes/core/pdfFiller/pdfHandler'
import { F1040Error } from './errors'
import { CreateFormConfig, createYearConfigs } from './yearRegistry'
import { validate } from './F1040Base'

export class YearCreateForm {
  year: TaxYear
  unvalidatedInfo: Information
  assets: Asset[]
  config: CreateFormConfig

  constructor(
    year: TaxYear,
    info: Information,
    assets: Asset[],
    config: CreateFormConfig
  ) {
    this.year = year
    this.unvalidatedInfo = info
    this.assets = assets

    this.config = config
  }

  errors = (): F1040Error[] => {
    const errors = validate(this.unvalidatedInfo)
    return isLeft(errors) ? errors.left : []
  }

  f1040 = (): Either<F1040Error[], Form[]> =>
    run(validate(this.unvalidatedInfo))
      .chain((info) => this.config.createF1040(info, this.assets))
      .value()

  f1040Pdfs = async (): Promise<Either<string[], PDFDocument[]>> => {
    const r1 = await run(this.f1040()).mapAsync((forms) =>
      Promise.all(
        forms.map(async (form) =>
          fillPDF(await this.config.getPDF(form), form.renderedFields())
        )
      )
    )
    return r1.value()
  }

  f1040Pdf = async (): Promise<Either<string[], PDFDocument>> => {
    const r1 = await runAsync(this.f1040Pdfs())
    const r2 = await r1.mapAsync(combinePdfs)
    return r2.value()
  }

  f1040Bytes = async (): Promise<Either<string[], Uint8Array>> => {
    const r1 = await runAsync(this.f1040Pdf())
    const r2 = await r1.mapAsync((pdf) => pdf.save())
    return r2.value()
  }

  makeStateReturn = (): Either<(F1040Error | StateFormError)[], StateForm[]> =>
    run(this.f1040())
      .mapLeft<Array<F1040Error | StateFormError>>((e) => e)
      .chain((forms) => {
        if (forms.length < 1) {
          throw new Error('No forms to create state return')
        }
        const f1040 = forms.find((f) => f.tag === 'f1040')
        if (f1040 === undefined) {
          throw new Error('Fed forms sent to state creator without 1040')
        }
        return this.config.createStateReturn(f1040)
      })
      .value()

  stateReturnPDFs = async (): Promise<Either<string[], PDFDocument[]>> => {
    const r1 = run(this.makeStateReturn())
    const r2 = await r1.mapAsync((forms) =>
      Promise.all(
        forms.map(async (form) =>
          fillPDF(await this.config.getStatePDF(form), form.renderedFields())
        )
      )
    )
    return r2.value()
  }

  stateReturnPDF = async (): Promise<Either<string[], PDFDocument>> => {
    const r1 = await runAsync(this.stateReturnPDFs())
    const r2 = await r1.mapAsync(combinePdfs)
    return r2.value()
  }

  stateReturnBytes = async (): Promise<Either<string[], Uint8Array>> => {
    const r1 = await runAsync(this.stateReturnPDF())
    const r2 = await r1.mapAsync((pdf) => pdf.save())
    return r2.value()
  }

  canCreateFederal = (): boolean => isRight(this.f1040())

  canCreateState = (): boolean => isRight(this.makeStateReturn())
}

export class CreateForms {
  readonly year: TaxYear
  downloader: PDFDownloader

  constructor(year: TaxYear) {
    this.year = year
    this.downloader = (url: string) => downloadPDF(`/forms/${year}/${url}`)
  }

  setDownloader = (downloader: PDFDownloader): CreateForms => {
    this.downloader = downloader
    return this
  }

  build = (info: Information, assets: Asset<Date>[]): YearCreateForm => {
    const configs = createYearConfigs(this.downloader)
    return new YearCreateForm(this.year, info, assets, configs[this.year])
  }
}

export const yearFormBuilder = (year: TaxYear): CreateForms =>
  new CreateForms(year)

export default (
  year: TaxYear,
  info: Information,
  assets: Asset<Date>[]
): YearCreateForm => yearFormBuilder(year).build(info, assets)
