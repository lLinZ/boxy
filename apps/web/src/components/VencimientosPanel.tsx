import { Card, CardBody, CardHeader, Chip, Select, SelectItem, Spinner } from '@heroui/react'
import { useEffect, useState } from 'react'
import { CalendarClock } from 'lucide-react'
import { api } from '../lib/api'
import { usd } from '../lib/format'
import type { LoteVencimiento } from '../types'

/**
 * Productos vencidos o por vencer. Boxy no sabe de qué lote salió cada venta:
 * estima lo que queda de cada lote suponiendo que primero se vende lo que vence antes.
 */
export function VencimientosPanel({ panel }: { panel: string }) {
  const [dias, setDias] = useState('30')
  const [lotes, setLotes] = useState<LoteVencimiento[] | null>(null)

  useEffect(() => {
    setLotes(null)
    api.get<{ lotes: LoteVencimiento[] }>('/inventario/vencimientos', { params: { dias } }).then((r) => setLotes(r.data.lotes)).catch(() => setLotes([]))
  }, [dias])

  const valor = (lotes ?? []).reduce((a, l) => a + l.valor_costo_usd, 0)

  return (
    <Card className={panel}>
      <CardHeader className="flex-wrap justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-warning" />
            <h2 className="font-display text-xl font-bold">Vencimientos</h2>
          </div>
          <p className="text-small text-default-500">
            Carga lote y fecha de vencimiento al registrar compras o entradas. Valor en riesgo: <b>{usd(valor)}</b> a costo.
          </p>
        </div>
        <Select aria-label="Horizonte" size="sm" className="max-w-[170px]" selectedKeys={[dias]} onChange={(e) => e.target.value && setDias(e.target.value)}>
          <SelectItem key="7">Próximos 7 días</SelectItem>
          <SelectItem key="15">Próximos 15 días</SelectItem>
          <SelectItem key="30">Próximos 30 días</SelectItem>
          <SelectItem key="60">Próximos 60 días</SelectItem>
          <SelectItem key="90">Próximos 90 días</SelectItem>
        </Select>
      </CardHeader>
      <CardBody className="overflow-x-auto">
        {!lotes ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : lotes.length === 0 ? (
          <p className="py-6 text-center text-small text-default-400">Nada vence en ese plazo.</p>
        ) : (
          <table className="w-full min-w-[560px] text-small">
            <thead>
              <tr className="text-left text-tiny uppercase text-default-400">
                <th className="py-1">Producto</th>
                <th className="py-1">Lote</th>
                <th className="py-1">Vence</th>
                <th className="py-1 text-right">Quedan (aprox.)</th>
                <th className="py-1 text-right">Valor a costo</th>
              </tr>
            </thead>
            <tbody>
              {lotes.map((l) => (
                <tr key={l.lote_id} className="border-t border-default-100">
                  <td className="py-1.5">{l.producto} <span className="text-tiny text-default-400">{l.sku}</span></td>
                  <td className="py-1.5">{l.lote ?? '—'}</td>
                  <td className="py-1.5">
                    {new Date(l.vence_el + 'T12:00:00').toLocaleDateString('es-VE')}{' '}
                    <Chip size="sm" variant="flat" color={l.vencido ? 'danger' : l.dias <= 7 ? 'warning' : 'default'}>
                      {l.vencido ? `vencido hace ${-l.dias} d` : l.dias === 0 ? 'hoy' : `en ${l.dias} d`}
                    </Chip>
                  </td>
                  <td className="py-1.5 text-right">{l.cantidad_estimada.toLocaleString('es-VE')}</td>
                  <td className="py-1.5 text-right">{usd(l.valor_costo_usd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardBody>
    </Card>
  )
}
