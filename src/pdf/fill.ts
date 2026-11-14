/**
 * Fills IRS AcroForm PDFs with pdf-lib and merges them into one flattened PDF.
 * The PDF bytes come from a loader so the same code runs in the browser (fetch) and in tests (fs).
 */
import type { PDFDocument as PDFDocumentType, PDFField } from 'pdf-lib'
import type { FormFill } from './irs2025.ts'

export type PdfLib = typeof import('pdf-lib')
export type Loader = (file: string) => Promise<Uint8Array | ArrayBuffer>

export interface FillProblem { form: string; key: string; problem: string }

/** A key matches a field whose full name equals it or ends with "." + key. */
export function findField(fields: PDFField[], key: string): PDFField[] {
  return fields.filter((f) => {
    const name = f.getName()
    return name === key || name.endsWith(`.${key}`)
  })
}

export async function fillForm(lib: PdfLib, bytes: Uint8Array | ArrayBuffer, fill: FormFill, problems: FillProblem[]): Promise<PDFDocumentType> {
  const doc = await lib.PDFDocument.load(bytes, { updateMetadata: false })
  const form = doc.getForm()
  form.deleteXFA()
  const fields = form.getFields()
  for (const [key, value] of Object.entries(fill.values)) {
    const matches = findField(fields, key)
    if (matches.length !== 1) {
      problems.push({ form: fill.id, key, problem: matches.length ? `${matches.length} fields match` : 'no field' })
      continue
    }
    const field = matches[0]
    if (field instanceof lib.PDFTextField) {
      let text = typeof value === 'string' ? value : value ? 'X' : ''
      const max = field.getMaxLength()
      if (max !== undefined && text.length > max) {
        const digitsOnly = text.replace(/[^0-9A-Za-z]/g, '')
        text = digitsOnly.length <= max ? digitsOnly : digitsOnly.slice(0, max)
      }
      field.setText(text || undefined)
    } else if (field instanceof lib.PDFCheckBox) {
      if (typeof value === 'string' && value) {
        // A check box with several widgets that each have their own "on" state (for example checking / savings).
        const on = lib.PDFName.of(value)
        const widgets = field.acroField.getWidgets()
        if (!widgets.some((w) => w.getOnValue() === on)) { problems.push({ form: fill.id, key, problem: `no "${value}" state` }); continue }
        field.acroField.dict.set(lib.PDFName.of('V'), on)
        widgets.forEach((w) => w.setAppearanceState(w.getOnValue() === on ? on : lib.PDFName.of('Off')))
      } else if (value === true) field.check()
      else field.uncheck()
    } else {
      problems.push({ form: fill.id, key, problem: `unsupported field type ${field.constructor.name}` })
    }
  }
  const font = await doc.embedFont(lib.StandardFonts.Helvetica)
  form.updateFieldAppearances(font)
  form.flatten()
  return doc
}

export async function buildPdf(lib: PdfLib, forms: FormFill[], load: Loader, title = '2025 Form 1040 — USTaxes NextGen'): Promise<{ bytes: Uint8Array; problems: FillProblem[] }> {
  const problems: FillProblem[] = []
  const out = await lib.PDFDocument.create()
  out.setTitle(title)
  out.setCreator('USTaxes NextGen')
  for (const fill of forms) {
    const doc = await fillForm(lib, await load(fill.file), fill, problems)
    const pages = await out.copyPages(doc, fill.pages ?? doc.getPageIndices())
    pages.forEach((p) => out.addPage(p))
  }
  return { bytes: await out.save(), problems }
}
