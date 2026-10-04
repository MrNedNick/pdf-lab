// @vitest-environment node
/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PDFDocument } from '@cantoo/pdf-lib'
import { fieldFrom, fillForm, filledCount, initialValues, type Widget } from './form'

const flip = (rect: number[]) => [rect[0]!, 842 - rect[3]!, rect[2]!, 842 - rect[1]!]

describe('fieldFrom', () => {
  it('reads a text field, labelled by its tooltip, placed from the top', () => {
    const widget: Widget = { id: '5R', fieldType: 'Tx', fieldName: 'full_name', alternativeText: 'Full name', fieldValue: 'Ann', rect: [72, 700, 300, 720], maxLen: 40 }
    expect(fieldFrom(widget, 1, flip)).toMatchObject({ kind: 'text', label: 'Full name', value: 'Ann', x: 72, y: 122, width: 228, height: 20, maxLength: 40 })
  })

  it('falls back to the field name, and knows a ticked checkbox from its export value', () => {
    const widget: Widget = { id: '6R', fieldType: 'Btn', checkBox: true, fieldName: 'agree.terms', fieldValue: 'Yes', exportValue: 'Yes', rect: [0, 0, 10, 10] }
    expect(fieldFrom(widget, 2, flip)).toMatchObject({ kind: 'checkbox', label: 'agree terms', value: true, choice: 'Yes', page: 2 })
  })

  it('skips push buttons', () => {
    expect(fieldFrom({ id: '7R', fieldType: 'Btn', pushButton: true, fieldName: 'print', rect: [0, 0, 1, 1] }, 1, flip)).toBeNull()
  })

  it('takes the chosen radio of a group as the group value', () => {
    const radio = (choice: string): Widget => ({ id: choice, fieldType: 'Btn', radioButton: true, fieldName: 'plan', fieldValue: 'pro', buttonValue: choice, rect: [0, 0, 1, 1] })
    const fields = ['basic', 'pro'].map((choice) => fieldFrom(radio(choice), 1, flip)!)
    expect(initialValues(fields)).toEqual({ plan: 'pro' })
    expect(filledCount({ plan: 'pro', name: '', agree: false, langs: [] })).toBe(1)
  })
})

describe('fillForm', () => {
  async function blankForm() {
    const doc = await PDFDocument.create()
    const page = doc.addPage([595, 842])
    const form = doc.getForm()
    form.createTextField('name').addToPage(page, { x: 72, y: 700, width: 220, height: 22 })
    form.createCheckBox('agree').addToPage(page, { x: 72, y: 660, width: 14, height: 14 })
    const country = form.createDropdown('country')
    country.addOptions(['Ukraine', 'Poland', 'Germany'])
    country.addToPage(page, { x: 72, y: 620, width: 160, height: 22 })
    const plan = form.createRadioGroup('plan')
    plan.addOptionToPage('basic', page, { x: 72, y: 580, width: 14, height: 14 })
    plan.addOptionToPage('pro', page, { x: 120, y: 580, width: 14, height: 14 })
    return doc.save()
  }
  const noto = () => Promise.resolve(new Uint8Array(readFileSync(new URL('../../public/fonts/NotoSans-Regular.ttf', import.meta.url))))

  it('writes every kind of value, Cyrillic included', async () => {
    const out = await fillForm(await blankForm(), undefined, { name: 'Олена Коваль', agree: true, country: 'Poland', plan: 'pro' }, false, noto)
    const form = (await PDFDocument.load(out)).getForm()
    expect(form.getTextField('name').getText()).toBe('Олена Коваль')
    expect(form.getCheckBox('agree').isChecked()).toBe(true)
    expect(form.getDropdown('country').getSelected()).toEqual(['Poland'])
    expect(form.getRadioGroup('plan').getSelected()).toBe('pro')
  })

  it('flattening leaves no fields behind', async () => {
    const out = await fillForm(await blankForm(), undefined, { name: 'Ann Lee' }, true, noto)
    expect((await PDFDocument.load(out)).getForm().getFields()).toHaveLength(0)
  })
})
