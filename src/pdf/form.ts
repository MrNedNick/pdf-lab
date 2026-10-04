import type { PDFDocumentProxy } from 'pdfjs-dist'
import { pdfLib } from './lib'
import { standardCanWrite } from './stamp'
import { loadForWriting } from './write'

export type FieldValue = string | boolean | string[]

/** One input on a page, placed in view space (points from the top-left, as the page is shown). */
export interface FormField {
  /** Unique per widget: radio buttons share a name but each has its own spot. */
  id: string
  name: string
  kind: 'text' | 'checkbox' | 'radio' | 'select' | 'list'
  page: number
  x: number
  y: number
  width: number
  height: number
  label: string
  /** What the widget means when chosen: a checkbox's or radio button's own value. */
  choice?: string
  options?: { value: string; label: string }[]
  multiline?: boolean
  multiple?: boolean
  maxLength?: number
  readOnly?: boolean
  value: FieldValue
}

/** The part of a pdf.js widget annotation that matters here. */
export interface Widget {
  id: string
  fieldType?: string
  fieldName?: string
  fieldValue?: unknown
  alternativeText?: string
  rect: number[]
  checkBox?: boolean
  radioButton?: boolean
  pushButton?: boolean
  exportValue?: string
  buttonValue?: string
  options?: { exportValue: string; displayValue: string }[]
  combo?: boolean
  multiSelect?: boolean
  multiLine?: boolean
  maxLen?: number
  readOnly?: boolean
}

/** A widget as an input, or nothing for push buttons, signatures and unknown kinds. */
export function fieldFrom(widget: Widget, page: number, toView: (rect: number[]) => number[]): FormField | null {
  if (!widget.fieldName || widget.pushButton) return null
  const [x1, y1, x2, y2] = toView(widget.rect) as [number, number, number, number]
  const base = {
    id: `${page}:${widget.id}`,
    name: widget.fieldName,
    page,
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
    // The field's own tooltip is the closest thing to a label a PDF form has; the name is the fallback.
    label: widget.alternativeText?.trim() || widget.fieldName.replace(/[_.]+/g, ' ').trim(),
    readOnly: widget.readOnly,
  }
  const value = widget.fieldValue
  switch (widget.fieldType) {
    case 'Tx':
      return { ...base, kind: 'text', value: typeof value === 'string' ? value : '', multiline: widget.multiLine, maxLength: widget.maxLen || undefined }
    case 'Btn':
      if (widget.checkBox) {
        const choice = widget.exportValue ?? 'Yes'
        return { ...base, kind: 'checkbox', choice, value: value !== undefined && value !== 'Off' && value === choice }
      }
      if (widget.radioButton) {
        const choice = widget.buttonValue ?? ''
        return { ...base, kind: 'radio', choice, value: typeof value === 'string' && value !== 'Off' ? value : '' }
      }
      return null
    case 'Ch': {
      const options = (widget.options ?? []).map((option) => ({ value: option.exportValue, label: option.displayValue || option.exportValue }))
      const chosen = Array.isArray(value) ? value.map(String) : typeof value === 'string' && value ? [value] : []
      return widget.combo || !widget.multiSelect
        ? { ...base, kind: widget.combo ? 'select' : 'list', options, value: chosen[0] ?? '' }
        : { ...base, kind: 'list', options, multiple: true, value: chosen }
    }
    default:
      return null
  }
}

/** Every fillable widget of the document, page by page; empty for a PDF without a form. */
export async function readFields(doc: PDFDocumentProxy): Promise<FormField[]> {
  // Cheap check first: a document without an AcroForm has nothing to read on any page.
  if (!(await doc.getFieldObjects())) return []
  const fields: FormField[] = []
  for (let number = 1; number <= doc.numPages; number++) {
    const page = await doc.getPage(number)
    const viewport = page.getViewport({ scale: 1 })
    for (const annotation of await page.getAnnotations({ intent: 'display' })) {
      if (annotation.subtype !== 'Widget') continue
      const field = fieldFrom(annotation as Widget, number, ([x1, y1, x2, y2]) => [
        ...(viewport.convertToViewportPoint(x1!, y1!) as number[]),
        ...(viewport.convertToViewportPoint(x2!, y2!) as number[]),
      ])
      if (field) fields.push(field)
    }
  }
  return fields
}

/** One value per field name, as the form starts; radio buttons of one group share theirs. */
export function initialValues(fields: FormField[]): Record<string, FieldValue> {
  const values: Record<string, FieldValue> = {}
  for (const field of fields) if (!(field.name in values) || (field.kind === 'radio' && field.value)) values[field.name] = field.value
  return values
}

/** How many fields (by name) have something in them, for the "3 of 7 filled" line. */
export function filledCount(values: Record<string, FieldValue>): number {
  return Object.values(values).filter((value) => (Array.isArray(value) ? value.length > 0 : Boolean(value))).length
}

/**
 * Writes the values into the form. `flatten` turns fields into plain page
 * content, so the result reads the same everywhere and cannot be changed.
 */
export async function fillForm(
  bytes: Uint8Array,
  password: string | undefined,
  values: Record<string, FieldValue>,
  flatten: boolean,
  loadUnicodeFont: () => Promise<ArrayBuffer | Uint8Array>,
): Promise<Uint8Array> {
  const { PDFCheckBox, PDFDropdown, PDFOptionList, PDFRadioGroup, PDFTextField } = await pdfLib()
  const doc = await loadForWriting(bytes, password)
  const form = doc.getForm()
  for (const [name, value] of Object.entries(values)) {
    const field = form.getFieldMaybe(name)
    if (!field || field.isReadOnly()) continue
    if (field instanceof PDFTextField) field.setText(typeof value === 'string' && value ? value : undefined)
    else if (field instanceof PDFCheckBox) {
      if (value) field.check()
      else field.uncheck()
    } else if (field instanceof PDFRadioGroup || field instanceof PDFDropdown) {
      if (typeof value === 'string' && value) field.select(value)
      else field.clear()
    } else if (field instanceof PDFOptionList) {
      const chosen = Array.isArray(value) ? value : typeof value === 'string' && value ? [value] : []
      if (chosen.length) field.select(chosen)
      else field.clear()
    }
  }
  // Text the standard font cannot draw gets an embedded one, or the field would show "?".
  const texts = Object.values(values).flatMap((value) => (typeof value === 'string' ? [value] : Array.isArray(value) ? value : []))
  if (!texts.every(standardCanWrite)) {
    doc.registerFontkit((await import('@cantoo/fontkit')).default)
    form.updateFieldAppearances(await doc.embedFont(await loadUnicodeFont(), { subset: true }))
  }
  if (flatten) form.flatten()
  return doc.save()
}
