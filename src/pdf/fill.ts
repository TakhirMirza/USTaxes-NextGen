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
      // pdf-lib lays combed text from the first cell; a right-aligned comb field (money boxes) needs the text pushed right.
      if (text && max !== undefined && text.length < max && field.isCombed() && field.acroField.getQuadding() === 2) text = text.padStart(max, ' ')
      field.setText(text || undefined)
    } else if (field instanceof lib.PDFCheckBox) {
      if (typeof value === 'string' && value) {
        // A check box with several widgets that each have their own "on" state (for example checking / savings).
        const widgets = field.acroField.getWidgets()
        // Match by name; some forms use non-ASCII bytes in state names (for example a curly apostrophe), so also match the decoded text.
        const named = lib.PDFName.of(value)
        const plain = (t: string): string => t.replace(/[^\x20-\x7e]/g, '')
        const on = widgets.map((w) => w.getOnValue()).find((v) => v === named || (v !== undefined && plain(v.decodeText()) === plain(value)))
        if (!on) { problems.push({ form: fill.id, key, problem: `no "${value}" state` }); continue }
        field.acroField.dict.set(lib.PDFName.of('V'), on)
        widgets.forEach((w) => w.setAppearanceState(w.getOnValue() === on ? on : lib.PDFName.of('Off')))
      } else if (value === true) field.check()
      else field.uncheck()
    } else if (field instanceof lib.PDFRadioGroup) {
      if (typeof value !== 'string' || !value) continue
      // "#n" picks the n-th button (0-based), for groups whose buttons share an export value.
      const byIndex = /^#(\d+)$/.exec(value)
      if (byIndex) {
        const widgets = field.acroField.getWidgets()
        const w = widgets[Number(byIndex[1])]
        const on = w?.getOnValue()
        if (!w || !on) { problems.push({ form: fill.id, key, problem: `no button ${value}` }); continue }
        field.acroField.dict.set(lib.PDFName.of('V'), on)
        widgets.forEach((x) => x.setAppearanceState(x === w ? on : lib.PDFName.of('Off')))
        continue
      }
      if (!field.getOptions().includes(value)) { problems.push({ form: fill.id, key, problem: `no "${value}" option` }); continue }
      field.select(value)
    } else if (field instanceof lib.PDFDropdown) {
      // A choice list: select the option, or clear it so a "Select" placeholder does not print.
      if (typeof value !== 'string' || !value) { field.clear(); continue }
      if (!field.getOptions().includes(value)) { problems.push({ form: fill.id, key, problem: `no "${value}" option` }); continue }
      field.select(value)
    } else {
      problems.push({ form: fill.id, key, problem: `unsupported field type ${field.constructor.name}` })
    }
  }
  const font = await doc.embedFont(lib.StandardFonts.Helvetica)
  if (fill.draw?.length) {
    const pages = doc.getPages()
    for (const t of fill.draw) {
      const page = pages[t.page]
      if (!page || !t.text) continue
      const size = t.size ?? 9
      const x = t.right ? t.x - font.widthOfTextAtSize(t.text, size) : t.x
      page.drawText(t.text, { x, y: t.y, size, font, color: lib.rgb(0, 0, 0) })
    }
  }
  form.updateFieldAppearances(font)
  form.flatten()
  // pdf-lib's flatten deletes the widgets of fields that have several widgets but can leave their references in
  // the page’s /Annots; drop references to objects that no longer exist so the output has no dangling entries.
  for (const page of doc.getPages()) {
    const annots = page.node.Annots()
    if (!annots) continue
    for (let i = annots.size() - 1; i >= 0; i--) {
      const ref = annots.get(i)
      if (ref instanceof lib.PDFRef && !doc.context.lookup(ref)) annots.remove(i)
    }
  }
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
