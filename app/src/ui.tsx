import { useEffect, useState, type ReactNode } from 'react'
import type { Cat } from './domain/schedule'

export const CAT_COLOR: Record<Cat, string> = {
  despertar: '#e9a640', glow: '#d9b98c', ar: '#e9a640', fr: '#7d9bb8', uni: '#b9a9d6',
  ejercicio: '#c9705a', caminata: '#9cb380', comida: '#cfa26b', novia: '#e08a8a',
  diario: '#d9b98c', libre: '#8f8673', sueno: '#5f7590',
}

export function Kicker({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-dim" style={color ? { color } : undefined}>
      {children}
    </div>
  )
}

export function Screen({ title, kicker, right, children }: { title: string; kicker?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="safe-t px-5 pb-32">
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          {kicker && <Kicker>{kicker}</Kicker>}
          <h1 className="font-serif text-[44px] leading-[0.95] tracking-tight">{title}</h1>
        </div>
        {right}
      </div>
      {children}
    </div>
  )
}

export function Card({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={`rounded-2xl border border-line bg-raised p-4 ${onClick ? 'cursor-pointer active:scale-[0.99] transition' : ''} ${className}`}>
      {children}
    </div>
  )
}

export function Btn({ children, onClick, kind = 'solid', className = '', disabled }: {
  children: ReactNode; onClick?: () => void; kind?: 'solid' | 'ghost' | 'line'; className?: string; disabled?: boolean
}) {
  const k = {
    solid: 'bg-paper text-ink',
    ghost: 'text-dim',
    line: 'border border-line text-paper',
  }[kind]
  return (
    <button disabled={disabled} onClick={onClick}
      className={`rounded-full px-5 py-3 text-[15px] font-medium transition active:scale-[0.97] disabled:opacity-30 ${k} ${className}`}>
      {children}
    </button>
  )
}

export function Chips<T extends string>({ value, options, onChange }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="-mx-5 mb-5 flex gap-2 overflow-x-auto px-5">
      {options.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)}
          className={`shrink-0 rounded-full px-4 py-2 text-[13px] transition ${value === o.v ? 'bg-paper text-ink' : 'border border-line text-dim'}`}>
          {o.l}
        </button>
      ))}
    </div>
  )
}

export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const [show, setShow] = useState(open)
  useEffect(() => { if (open) setShow(true) }, [open])
  if (!show) return null
  return (
    <div className="fixed inset-0 z-50" onTransitionEnd={() => !open && setShow(false)}>
      <div onClick={onClose} className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`} />
      <div className={`safe-b absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-3xl border-t border-line bg-raised px-5 pt-3 transition-transform duration-300 ease-out ${open ? 'translate-y-0' : 'translate-y-full'}`}
        onTransitionEnd={(e) => { if (e.target === e.currentTarget && !open) setShow(false) }}>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />
        {children}
      </div>
    </div>
  )
}

export function Grade({ g }: { g: 'A' | 'B' | 'C' | 'D' }) {
  const c = { A: '#9cb380', B: '#7d9bb8', C: '#e9a640', D: '#c9705a' }[g]
  const t = { A: 'comprobado', B: 'prometedor', C: 'teoría', D: 'riesgo' }[g]
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider" style={{ color: c }}>
      <span className="grid h-4 w-4 place-items-center rounded-full border text-[9px]" style={{ borderColor: c }}>{g}</span>{t}
    </span>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-[14px] text-faint">{children}</p>
}

export function NumberInput({ value, onChange, placeholder, step = 0.1 }: { value: string; onChange: (v: string) => void; placeholder?: string; step?: number }) {
  return (
    <input inputMode="decimal" type="number" step={step} value={value} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-line bg-ink px-4 py-3 font-serif text-[28px] outline-none placeholder:text-faint focus:border-dim" />
  )
}
