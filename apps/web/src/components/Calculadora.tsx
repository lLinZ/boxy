import { Card, CardBody, CardHeader } from '@heroui/react'
import { useState } from 'react'
import { Calculator, Delete } from 'lucide-react'
import { bs } from '../lib/format'

interface Props {
  /** Tasa vigente para mostrar el equivalente en Bs de lo que hay en pantalla. */
  tasa: number
  panel?: string
}

type Op = '+' | '-' | '*' | '/' | null

// Quita ruido de coma flotante y separa miles.
function fmt(num: number): string {
  if (!Number.isFinite(num)) return 'Error'
  const redondeado = Math.round(num * 1e6) / 1e6
  return redondeado.toLocaleString('en-US', { maximumFractionDigits: 6 })
}

export function Calculadora({ tasa, panel = '' }: Props) {
  const [display, setDisplay] = useState('0')
  const [acc, setAcc] = useState<number | null>(null)
  const [op, setOp] = useState<Op>(null)
  const [nuevo, setNuevo] = useState(true) // el próximo dígito empieza un número nuevo

  const valor = Number(display.replace(/,/g, ''))

  function digito(d: string) {
    if (display === 'Error' || nuevo) {
      setDisplay(d)
      setNuevo(false)
    } else {
      const limpio = display.replace(/,/g, '')
      if (limpio.replace('.', '').length >= 12) return
      setDisplay(fmt(Number(limpio + d)) === 'Error' ? limpio + d : limpio + d)
    }
  }

  function punto() {
    if (nuevo) {
      setDisplay('0.')
      setNuevo(false)
    } else if (!display.includes('.')) {
      setDisplay(display + '.')
    }
  }

  function calcular(a: number, b: number, o: Op): number {
    switch (o) {
      case '+': return a + b
      case '-': return a - b
      case '*': return a * b
      case '/': return b === 0 ? NaN : a / b
      default: return b
    }
  }

  function operar(o: Op) {
    if (op && !nuevo && acc !== null) {
      const r = calcular(acc, valor, op)
      setAcc(r)
      setDisplay(fmt(r))
    } else {
      setAcc(valor)
    }
    setOp(o)
    setNuevo(true)
  }

  function igual() {
    if (op !== null && acc !== null) {
      const r = calcular(acc, valor, op)
      setDisplay(fmt(r))
      setAcc(null)
      setOp(null)
      setNuevo(true)
    }
  }

  function limpiar() {
    setDisplay('0')
    setAcc(null)
    setOp(null)
    setNuevo(true)
  }

  function borrar() {
    if (nuevo || display === 'Error') return
    const s = display.replace(/,/g, '')
    const next = s.length > 1 ? s.slice(0, -1) : '0'
    setDisplay(fmt(Number(next)) === 'Error' ? '0' : (next === '0' ? '0' : Number(next).toLocaleString('en-US', { maximumFractionDigits: 6 })))
  }

  function porcentaje() {
    setDisplay(fmt(valor / 100))
    setNuevo(true)
  }

  const keys: { label: React.ReactNode; on: () => void; cls?: string }[] = [
    { label: 'C', on: limpiar, cls: 'bg-danger/15 text-danger' },
    { label: <Delete className="h-4 w-4" />, on: borrar, cls: 'bg-default-100' },
    { label: '%', on: porcentaje, cls: 'bg-default-100' },
    { label: '÷', on: () => operar('/'), cls: 'bg-primary/15 text-primary' },
    { label: '7', on: () => digito('7') },
    { label: '8', on: () => digito('8') },
    { label: '9', on: () => digito('9') },
    { label: '×', on: () => operar('*'), cls: 'bg-primary/15 text-primary' },
    { label: '4', on: () => digito('4') },
    { label: '5', on: () => digito('5') },
    { label: '6', on: () => digito('6') },
    { label: '−', on: () => operar('-'), cls: 'bg-primary/15 text-primary' },
    { label: '1', on: () => digito('1') },
    { label: '2', on: () => digito('2') },
    { label: '3', on: () => digito('3') },
    { label: '+', on: () => operar('+'), cls: 'bg-primary/15 text-primary' },
    { label: '0', on: () => digito('0') },
    { label: '.', on: punto },
    { label: '=', on: igual, cls: 'col-span-2 bg-primary text-primary-foreground' },
  ]

  return (
    <Card className={panel}>
      <CardHeader className="items-center gap-2">
        <Calculator className="h-5 w-5 text-primary" />
        <h2 className="font-display text-lg font-bold">Calculadora</h2>
      </CardHeader>
      <CardBody className="gap-3">
        {/* Pantalla */}
        <div className="rounded-large bg-default-50 px-4 py-3 text-right">
          <p className="truncate font-display text-3xl font-bold leading-none">{display}</p>
          {tasa > 0 && display !== 'Error' && (
            <p className="mt-1 text-tiny text-default-400">≈ {bs(valor * tasa)}</p>
          )}
        </div>
        {/* Teclado */}
        <div className="grid grid-cols-4 gap-2">
          {keys.map((k, i) => (
            <button
              key={i}
              onClick={k.on}
              className={`flex h-12 items-center justify-center rounded-large text-lg font-semibold transition-transform active:scale-95 ${k.cls ?? 'bg-default-100 hover:bg-default-200'}`}
            >
              {k.label}
            </button>
          ))}
        </div>
      </CardBody>
    </Card>
  )
}
