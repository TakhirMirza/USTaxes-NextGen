import { ReactElement, ReactNode, useEffect, useState } from 'react'

export const usd = (n: number, opts: { cents?: boolean } = {}): string => {
  const abs = Math.abs(n).toLocaleString('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: opts.cents ? 2 : 0, maximumFractionDigits: opts.cents ? 2 : 0
  })
  return n < 0 ? `−${abs}` : abs
}

const parseMoney = (text: string): number | null => {
  const clean = text.replace(/[$,\s]/g, '')
  if (clean === '') return 0
  if (!/^-?\d*(\.\d{0,2})?$/.test(clean) || clean === '-' || clean === '.') return null
  const n = Number(clean)
  return Number.isFinite(n) && Math.abs(n) < 1e11 ? n : null
}
const showMoney = (n: number): string => (n === 0 ? '' : n.toLocaleString('en-US', { maximumFractionDigits: 2 }))

let uid = 0
const useFieldId = (prefix: string): string => {
  const [id] = useState(() => `${prefix}-${++uid}`)
  return id
}

interface MoneyFieldProps {
  label: string
  hint?: string
  box?: string
  value: number
  onChange: (n: number) => void
  allowNegative?: boolean
}

export function MoneyField({ label, hint, box, value, onChange, allowNegative }: MoneyFieldProps): ReactElement {
  const id = useFieldId('m')
  const [text, setText] = useState(showMoney(value))
  const [focused, setFocused] = useState(false)
  useEffect(() => { if (!focused) setText(showMoney(value)) }, [value, focused])
  const parsed = parseMoney(text)
  const invalid = parsed === null || (!allowNegative && parsed !== null && parsed < 0)
  return (
    <div className={`field ${invalid ? 'is-invalid' : ''}`}>
      <label htmlFor={id}>
        <span>{label}</span>
        {box && <span className="box-tag">{box}</span>}
      </label>
      <div className="money-input">
        <span aria-hidden="true">$</span>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          value={text}
          placeholder="0"
          aria-invalid={invalid}
          aria-describedby={hint || invalid ? `${id}-hint` : undefined}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); if (!invalid) setText(showMoney(parsed ?? 0)) }}
          onChange={(e) => {
            setText(e.target.value)
            const n = parseMoney(e.target.value)
            if (n !== null && (allowNegative || n >= 0)) onChange(n)
          }}
        />
      </div>
      {(hint || invalid) && <small id={`${id}-hint`}>{invalid ? 'Enter a dollar amount, like 1250.50' : hint}</small>}
    </div>
  )
}

export function TextField({ label, value, onChange, placeholder, hint }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string }): ReactElement {
  const id = useFieldId('t')
  return (
    <div className="field">
      <label htmlFor={id}><span>{label}</span></label>
      <input id={id} type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {hint && <small>{hint}</small>}
    </div>
  )
}

export function Check({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }): ReactElement {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
    </label>
  )
}

export function Choice<T extends string>({ legend, value, options, onChange, columns }: {
  legend: string
  value: T
  options: { value: T; label: string; hint?: string }[]
  onChange: (v: T) => void
  columns?: number
}): ReactElement {
  const name = useFieldId('c')
  return (
    <fieldset className="choice" style={columns ? { gridTemplateColumns: `repeat(auto-fill, minmax(${Math.floor(560 / columns)}px, 1fr))` } : undefined}>
      <legend>{legend}</legend>
      {options.map((o) => (
        <label key={o.value} className={`choice-option ${value === o.value ? 'is-selected' : ''}`}>
          <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
          <span><strong>{o.label}</strong>{o.hint && <small>{o.hint}</small>}</span>
        </label>
      ))}
    </fieldset>
  )
}

export function Section({ title, intro, children, aside }: { title: string; intro?: ReactNode; children: ReactNode; aside?: ReactNode }): ReactElement {
  return (
    <section className="section">
      <header className="section-head">
        <div>
          <h2>{title}</h2>
          {intro && <p>{intro}</p>}
        </div>
        {aside}
      </header>
      {children}
    </section>
  )
}

export function DocList<T extends { id: string }>({ items, title, render, onAdd, onRemove, addLabel, emptyText }: {
  items: T[]
  title: (item: T, index: number) => string
  render: (item: T, index: number) => ReactNode
  onAdd: () => void
  onRemove: (id: string) => void
  addLabel: string
  emptyText: string
}): ReactElement {
  return (
    <div className="doc-list">
      {items.length === 0 && <p className="empty">{emptyText}</p>}
      {items.map((item, i) => (
        <article className="doc" key={item.id}>
          <header>
            <h3>{title(item, i)}</h3>
            <button type="button" className="link-button" onClick={() => onRemove(item.id)} aria-label={`Remove ${title(item, i)}`}>Remove</button>
          </header>
          <div className="grid">{render(item, i)}</div>
        </article>
      ))}
      <button type="button" className="add-button" onClick={onAdd}>+ {addLabel}</button>
    </div>
  )
}

export function NumberField({ label, value, onChange, min = 0, max = 130, hint, suffix }: {
  label: string; value: number; onChange: (n: number) => void; min?: number; max?: number; hint?: string; suffix?: string
}): ReactElement {
  const id = useFieldId('n')
  const [text, setText] = useState(value ? String(value) : '')
  const [focused, setFocused] = useState(false)
  useEffect(() => { if (!focused) setText(value ? String(value) : '') }, [value, focused])
  return (
    <div className="field">
      <label htmlFor={id}><span>{label}</span></label>
      <div className="number-input">
        <input id={id} inputMode="numeric" autoComplete="off" value={text}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          onChange={(e) => {
            const t = e.target.value.replace(/\D/g, '').slice(0, 3)
            setText(t)
            const n = t === '' ? 0 : Math.min(max, Math.max(min, Number(t)))
            onChange(n)
          }} />
        {suffix && <span aria-hidden="true">{suffix}</span>}
      </div>
      {hint && <small>{hint}</small>}
    </div>
  )
}

export function Tags({ items }: { items: { label: string; on: boolean }[] }): ReactElement {
  return (
    <ul className="tags" aria-label="Credits this dependent qualifies for">
      {items.map((t) => <li key={t.label} className={t.on ? 'is-on' : ''}>{t.on ? '✓' : '–'} {t.label}</li>)}
    </ul>
  )
}
