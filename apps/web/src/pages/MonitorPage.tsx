import { Button, Card, CardBody, CardHeader, Chip, Spinner, Tooltip } from '@heroui/react'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Activity,
  Clock,
  DollarSign,
  Flame,
  Layers,
  Lightbulb,
  PackageX,
  Receipt,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Trophy,
  Wallet,
} from 'lucide-react'
import { api } from '../lib/api'
import { bs, usd } from '../lib/format'
import { useTheme } from '../theme/ThemeContext'
import type { MonitorData, Recomendaciones } from '../types'

const METODO: Record<string, { label: string; color: string }> = {
  efectivo_bs: { label: 'Efectivo Bs', color: '#3b82f6' },
  efectivo_usd: { label: 'Efectivo USD', color: '#22c55e' },
  pago_movil: { label: 'Pago Móvil', color: '#a855f7' },
  transferencia: { label: 'Transferencia', color: '#06b6d4' },
  tarjeta: { label: 'Tarjeta', color: '#f59e0b' },
  zelle: { label: 'Zelle', color: '#10b981' },
  otro: { label: 'Otro', color: '#94a3b8' },
}

export function MonitorPage() {
  const { panel } = useTheme()
  const [data, setData] = useState<MonitorData | null>(null)
  const [rec, setRec] = useState<Recomendaciones | null>(null)
  const [reloj, setReloj] = useState(() => new Date())
  const [sincronizando, setSincronizando] = useState(false)

  // Reloj en vivo
  useEffect(() => {
    const t = setInterval(() => setReloj(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Sondeo del monitor cada 5s
  useEffect(() => {
    let act = true
    const load = () => api.get<MonitorData>('/monitor').then((r) => act && setData(r.data)).catch(() => {})
    load()
    const t = setInterval(load, 5000)
    return () => {
      act = false
      clearInterval(t)
    }
  }, [])

  // Recomendaciones cada 30s (más pesadas)
  useEffect(() => {
    let act = true
    const load = () =>
      api.get<Recomendaciones>('/monitor/recomendaciones').then((r) => act && setRec(r.data)).catch(() => {})
    load()
    const t = setInterval(load, 30000)
    return () => {
      act = false
      clearInterval(t)
    }
  }, [])

  async function sincronizarTasa() {
    setSincronizando(true)
    try {
      await api.post('/tasas/sincronizar')
      const r = await api.get<MonitorData>('/monitor')
      setData(r.data)
    } finally {
      setSincronizando(false)
    }
  }

  // Insights en lenguaje natural
  const insights = useMemo<string[]>(() => {
    if (!data) return []
    const out: string[] = []
    const p = data.pulso
    if (p.delta_pct != null) {
      out.push(
        `Vas ${Math.abs(p.delta_pct)}% ${p.delta_pct >= 0 ? 'por encima' : 'por debajo'} de ayer a esta misma hora.`,
      )
    }
    if (data.pagos.total_usd > 0) {
      out.push(`El ${data.pagos.pct_divisa}% de tus cobros de hoy son en divisas.`)
    }
    const combo = rec?.combos?.[0]
    if (combo) out.push(`Quienes compran ${combo.producto_a} suelen llevar ${combo.producto_b} (${combo.veces}×). ¡Arma un combo!`)
    const hot = rec?.hot?.[0]
    if (hot) out.push(`${hot.producto} se está acelerando: +${hot.crecimiento_pct}% esta semana.`)
    const oferta = rec?.ofertas?.[0]
    if (oferta)
      out.push(
        `Tienes ${usd(oferta.capital_inmovilizado_usd)} parados en ${oferta.producto}; una oferta del ${oferta.descuento_sugerido_pct}% ayudaría a moverlo.`,
      )
    return out
  }, [data, rec])

  if (!data) {
    return (
      <div className="flex justify-center py-20">
        <Spinner label="Conectando al monitor en vivo…" />
      </div>
    )
  }

  const { pulso, ganancia, por_hora, pagos, igtf, cajeros, feed, tasas } = data
  const maxHora = Math.max(...por_hora.horas.map((h) => Math.max(h.usd, h.base)), 1)
  const visibles = por_hora.horas.filter((h) => h.usd > 0 || h.base > 0)
  const horas = visibles.length ? visibles : por_hora.horas.slice(8, 21)

  return (
    <div className="flex flex-col gap-5">
      {/* Barra de estado: en vivo + tasas */}
      <div className={`flex flex-wrap items-center gap-3 rounded-large px-4 py-2.5 ${panel}`}>
        <span className="flex items-center gap-2 text-small font-semibold">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
          </span>
          EN VIVO
        </span>
        <span className="flex items-center gap-1 text-small text-default-500">
          <Clock className="h-4 w-4" />
          {reloj.toLocaleTimeString('es-VE')}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Chip color="primary" variant="flat" className="font-semibold">
            BCV {bs(tasas.bcv)}
          </Chip>
          {tasas.usdt && (
            <Chip color="success" variant="flat" className="font-semibold">
              USDT {bs(tasas.usdt)}
            </Chip>
          )}
          {tasas.brecha_pct != null && (
            <Chip variant="flat" color="warning">
              brecha {tasas.brecha_pct}%
            </Chip>
          )}
          {tasas.desactualizada && (
            <Button
              size="sm"
              color="warning"
              variant="flat"
              isLoading={sincronizando}
              startContent={!sincronizando && <RefreshCw className="h-3.5 w-3.5" />}
              onPress={sincronizarTasa}
            >
              Tasa de hace {tasas.antiguedad_dias}d · actualizar
            </Button>
          )}
        </div>
      </div>

      {/* Insights en lenguaje natural */}
      {insights.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {insights.slice(0, 3).map((txt, i) => (
            <Card key={i} className={panel}>
              <CardBody className="flex-row items-start gap-2 py-3">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <p className="text-small leading-snug">{txt}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* KPIs hero */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Card className={`${panel} xl:col-span-1`}>
          <CardBody className="gap-1">
            <div className="flex items-center gap-2 text-default-500">
              <Receipt className="h-5 w-5" />
              <span className="text-small font-medium">Vendido hoy</span>
            </div>
            <p className="font-display text-3xl font-bold leading-none">{usd(pulso.total_usd)}</p>
            <p className="text-small text-default-500">{bs(pulso.total_bs)}</p>
            {pulso.delta_pct != null && (
              <Chip
                size="sm"
                variant="flat"
                color={pulso.delta_pct >= 0 ? 'success' : 'danger'}
                startContent={pulso.delta_pct >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                className="mt-1"
              >
                {pulso.delta_pct >= 0 ? '+' : ''}{pulso.delta_pct}% vs ayer
              </Chip>
            )}
          </CardBody>
        </Card>

        <Stat panel={panel} tone="bg-success/15 text-success" icon={<Wallet className="h-5 w-5" />} label="Ganancia estimada" value={usd(ganancia.ganancia_usd)} detail={`Margen ${ganancia.margen_pct}%`} />
        <Stat panel={panel} tone="bg-primary/15 text-primary" icon={<Activity className="h-5 w-5" />} label="Tickets / promedio" value={String(pulso.tickets)} detail={`${usd(pulso.ticket_promedio_usd)} c/u`} />
        <Stat panel={panel} tone="bg-secondary/15 text-secondary" icon={<DollarSign className="h-5 w-5" />} label="Divisa / IGTF" value={`${pagos.pct_divisa}%`} detail={`IGTF ${usd(igtf.igtf_usd)} · ${igtf.ops} ops`} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Columna izquierda: gráfico por hora + pagos + cajeros */}
        <div className="flex flex-col gap-5 xl:col-span-2">
          {/* Ventas por hora */}
          <Card className={panel}>
            <CardHeader className="items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <h3 className="font-display text-lg font-bold">Ritmo por hora</h3>
              <Chip size="sm" variant="flat" className="ml-auto">
                última hora {usd(por_hora.ultima_hora_usd)}
              </Chip>
            </CardHeader>
            <CardBody>
              <div className="flex h-44 items-end gap-1.5">
                {horas.map((h) => {
                  const hh = (h.usd / maxHora) * 100
                  const bb = (h.base / maxHora) * 100
                  const esActual = h.hora === reloj.getHours()
                  return (
                    <Tooltip key={h.hora} content={`${String(h.hora).padStart(2, '0')}:00 · hoy ${usd(h.usd)} · típico ${usd(h.base)}`} placement="top">
                      <div className="group relative flex h-full flex-1 items-end justify-center">
                        {/* patrón base (fantasma) */}
                        <div className="absolute bottom-5 w-full rounded-t bg-default-200/40" style={{ height: `calc(${bb}% )` }} />
                        {/* hoy */}
                        <div
                          className={`relative w-full rounded-t bg-gradient-to-t from-primary to-primary/60 transition-all ${esActual ? 'animate-pulse ring-2 ring-primary/40' : ''}`}
                          style={{ height: `calc(${Math.max(hh, 1)}% )`, marginBottom: '20px' }}
                        />
                        <span className="absolute bottom-0 text-[10px] text-default-400">{h.hora}</span>
                      </div>
                    </Tooltip>
                  )
                })}
              </div>
              <p className="mt-1 text-center text-tiny text-default-400">
                Barra sólida = hoy · sombra = promedio típico (28 días)
              </p>
            </CardBody>
          </Card>

          {/* Mix de pagos */}
          <Card className={panel}>
            <CardHeader className="items-center gap-2">
              <Layers className="h-5 w-5 text-secondary" />
              <h3 className="font-display text-lg font-bold">Medios de pago de hoy</h3>
            </CardHeader>
            <CardBody className="gap-3">
              {pagos.metodos.length === 0 ? (
                <p className="text-small text-default-400">Aún sin cobros hoy.</p>
              ) : (
                <>
                  <div className="flex h-3 overflow-hidden rounded-full">
                    {pagos.metodos.map((m) => (
                      <div key={m.metodo} style={{ width: `${m.pct}%`, backgroundColor: METODO[m.metodo]?.color ?? '#94a3b8' }} />
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {pagos.metodos.map((m) => (
                      <div key={m.metodo} className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: METODO[m.metodo]?.color ?? '#94a3b8' }} />
                        <span className="text-tiny text-default-600">{METODO[m.metodo]?.label ?? m.metodo}</span>
                        <span className="ml-auto text-tiny font-semibold">{m.pct}%</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardBody>
          </Card>

          {/* Cajeros */}
          <Card className={panel}>
            <CardHeader className="items-center gap-2">
              <Trophy className="h-5 w-5 text-warning" />
              <h3 className="font-display text-lg font-bold">Cajeros del día</h3>
            </CardHeader>
            <CardBody className="gap-2">
              {cajeros.length === 0 ? (
                <p className="text-small text-default-400">Sin ventas todavía.</p>
              ) : (
                cajeros.map((c, i) => (
                  <div key={c.nombre} className="flex items-center gap-3">
                    <span className={`flex h-7 w-7 items-center justify-center rounded-full font-display text-tiny font-bold ${i === 0 ? 'bg-warning/20 text-warning' : 'bg-default-100 text-default-500'}`}>
                      {i + 1}
                    </span>
                    <span className="flex-1 text-small font-medium">{c.nombre}</span>
                    {c.anuladas > 0 && (
                      <Chip size="sm" color="danger" variant="flat">{c.anuladas} anul.</Chip>
                    )}
                    <span className="text-tiny text-default-400">{c.tickets} tickets</span>
                    <span className="w-20 text-right font-semibold">{usd(c.usd)}</span>
                  </div>
                ))
              )}
            </CardBody>
          </Card>
        </div>

        {/* Columna derecha: feed en vivo */}
        <Card className={`${panel} h-fit`}>
          <CardHeader className="items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
            </span>
            <h3 className="font-display text-lg font-bold">Ventas en vivo</h3>
          </CardHeader>
          <CardBody className="gap-2">
            {feed.length === 0 ? (
              <p className="py-6 text-center text-small text-default-400">Esperando la primera venta del día…</p>
            ) : (
              <AnimatePresence initial={false}>
                {feed.map((f) => (
                  <motion.div
                    key={f.id}
                    layout
                    initial={{ opacity: 0, y: -14, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="flex items-center gap-3 rounded-large bg-default-50 px-3 py-2"
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: METODO[f.metodo ?? 'otro']?.color ?? '#94a3b8' }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-small font-semibold">{usd(f.total_usd)} <span className="font-normal text-default-400">· {bs(f.total_bs)}</span></p>
                      <p className="truncate text-tiny text-default-400">
                        #{f.numero} · {f.items} ítems · {f.cajero}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-tiny text-default-400">{f.hora}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Motor de recomendaciones */}
      {rec && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          <RecCard panel={panel} icon={<Layers className="h-5 w-5 text-secondary" />} titulo="Combos sugeridos" vacio="Aún no hay patrones de compra conjunta." items={rec.combos.length}>
            {rec.combos.map((c, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-small">{c.producto_a} <span className="text-default-400">+</span> {c.producto_b}</span>
                <Chip size="sm" variant="flat" color="secondary">{c.veces}×</Chip>
              </div>
            ))}
          </RecCard>

          <RecCard panel={panel} icon={<Flame className="h-5 w-5 text-danger" />} titulo="Productos en racha" vacio="Sin productos acelerándose." items={rec.hot.length}>
            {rec.hot.map((h, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-small">{h.producto}</span>
                <Chip size="sm" variant="flat" color="danger">+{h.crecimiento_pct}%</Chip>
              </div>
            ))}
          </RecCard>

          <RecCard panel={panel} icon={<Lightbulb className="h-5 w-5 text-warning" />} titulo="Ofertas recomendadas" vacio="Sin stock estancado relevante." items={rec.ofertas.length}>
            {rec.ofertas.map((o, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-small">{o.producto}</span>
                <div className="flex shrink-0 items-center gap-1">
                  <span className="text-tiny text-default-400">{o.dias_cobertura}d</span>
                  <Chip size="sm" variant="flat" color="warning">-{o.descuento_sugerido_pct}%</Chip>
                </div>
              </div>
            ))}
          </RecCard>

          <RecCard panel={panel} icon={<RefreshCw className="h-5 w-5 text-primary" />} titulo="Reponer pronto" vacio="Nada por agotarse." items={rec.reorden.length}>
            {rec.reorden.map((r, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-small">{r.producto}</span>
                <div className="flex shrink-0 items-center gap-1">
                  <span className="text-tiny text-default-400">{r.dias_cobertura}d</span>
                  <Chip size="sm" variant="flat" color="primary">+{r.sugerido_reponer}</Chip>
                </div>
              </div>
            ))}
          </RecCard>

          <RecCard panel={panel} icon={<PackageX className="h-5 w-5 text-default-500" />} titulo="Stock muerto" vacio="¡Todo tu inventario rota! 🎉" items={rec.stock_muerto.length}>
            {rec.stock_muerto.map((s, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-small">{s.producto}</span>
                <Chip size="sm" variant="flat">{usd(s.capital_inmovilizado_usd)}</Chip>
              </div>
            ))}
          </RecCard>
        </div>
      )}
    </div>
  )
}

function Stat({ panel, tone, icon, label, value, detail }: { panel: string; tone: string; icon: ReactNode; label: string; value: string; detail: string }) {
  return (
    <Card className={panel}>
      <CardBody className="gap-2">
        <div className="flex items-center gap-2">
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}>{icon}</div>
          <span className="text-small font-medium text-default-500">{label}</span>
        </div>
        <p className="font-display text-2xl font-bold leading-none">{value}</p>
        <p className="text-tiny text-default-400">{detail}</p>
      </CardBody>
    </Card>
  )
}

function RecCard({ panel, icon, titulo, vacio, items, children }: { panel: string; icon: ReactNode; titulo: string; vacio: string; items: number; children: ReactNode }) {
  return (
    <Card className={panel}>
      <CardHeader className="items-center gap-2">
        {icon}
        <h3 className="font-display text-base font-bold">{titulo}</h3>
        {items > 0 && <Chip size="sm" variant="flat" className="ml-auto">{items}</Chip>}
      </CardHeader>
      <CardBody className="gap-2 pt-0">
        {items === 0 ? <p className="text-small text-default-400">{vacio}</p> : children}
      </CardBody>
    </Card>
  )
}
