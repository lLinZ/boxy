import {
  Avatar,
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Input,
  Select,
  SelectItem,
  Snippet,
  Switch,
  Textarea,
} from '@heroui/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, DatabaseBackup, Printer, Receipt, Scale, Star } from 'lucide-react'
import { api, mensajeError } from '../lib/api'
import { usd } from '../lib/format'
import { imprimirTicket, ticketVenta } from '../lib/ticket'
import { useAuth } from '../auth/AuthContext'
import { useTheme } from '../theme/ThemeContext'
import type { AjustesEmpresa, EmpresaInfo, SucursalFull } from '../types'

/** Datos de la empresa (encabezado de tickets) y preferencias de operación. */
export function EmpresaPage() {
  const { panel } = useTheme()
  const { refrescar, puede } = useAuth()
  const navigate = useNavigate()
  const [info, setInfo] = useState<EmpresaInfo | null>(null)
  const [datos, setDatos] = useState<Record<string, string>>({})
  const [aj, setAj] = useState<AjustesEmpresa | null>(null)
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [fiscal, setFiscal] = useState<{ pendientes: number; errores: { id: number; numero_factura: string; error_fiscal: string }[]; puente_configurado: boolean } | null>(null)
  const [claveFiscal, setClaveFiscal] = useState('')
  const logoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.get<EmpresaInfo>('/empresa').then((r) => {
      setInfo(r.data)
      const e = r.data.empresa
      setDatos({
        nombre: e.nombre, razon_social: e.razon_social, tipo_rif: e.tipo_rif ?? 'J', rif: e.rif,
        direccion_fiscal: e.direccion_fiscal ?? '', telefono: e.telefono ?? '', email: e.email ?? '',
      })
      setAj(r.data.ajustes)
    })
    api.get('/fiscal/estado').then((r) => setFiscal(r.data)).catch(() => {})
  }, [])

  const set = (k: keyof AjustesEmpresa, v: unknown) => setAj((a) => (a ? { ...a, [k]: v } : a))

  async function guardar() {
    if (!aj) return
    setGuardando(true)
    setMensaje(null)
    try {
      const r = await api.put<EmpresaInfo>('/empresa', { ...datos, ajustes: aj })
      setInfo(r.data)
      setAj(r.data.ajustes)
      await refrescar()
      setMensaje({ ok: true, texto: 'Cambios guardados.' })
    } catch (e) {
      setMensaje({ ok: false, texto: mensajeError(e) })
    } finally {
      setGuardando(false)
    }
  }

  async function subirLogo(archivo: File) {
    const fd = new FormData()
    fd.append('logo', archivo)
    try {
      const r = await api.post<{ logo_path: string }>('/empresa/logo', fd)
      setInfo((i) => (i ? { ...i, empresa: { ...i.empresa, logo_path: r.data.logo_path } } : i))
      await refrescar()
    } catch (e) {
      setMensaje({ ok: false, texto: mensajeError(e) })
    }
  }

  async function generarClaveFiscal() {
    if (fiscal?.puente_configurado && !confirm('Ya hay un puente configurado. Generar una clave nueva desconecta el anterior. ¿Seguir?')) return
    const r = await api.post<{ clave: string }>('/fiscal/clave')
    setClaveFiscal(r.data.clave)
    setFiscal((f) => (f ? { ...f, puente_configurado: true } : f))
  }

  function ticketDePrueba() {
    if (!info || !aj) return
    imprimirTicket(
      ticketVenta(
        {
          id: 0, numero_factura: 'PRUEBA', numero_control: '', fecha: new Date().toISOString(), tasa: '36.5',
          subtotal_usd: '3.00', descuento_usd: '0', base_imponible_usd: '3.00', iva_usd: '0.24', igtf_usd: '0',
          total_usd: '3.24', total_bs: '118.26', estado: 'emitida',
          items: [{ id: 1, descripcion: 'Harina de maíz 1 kg', cantidad: '2', precio_unitario_usd: '1.50', tipo_iva: 'reducido', alicuota_iva: '8', iva_usd: '0.24', total_usd: '3.24' }],
          pagos: [{ id: 1, metodo: 'efectivo_bs', moneda: 'VES', monto: '118.26', monto_usd: '3.24', igtf_usd: '0' }],
        },
        { empresa: { ...info.empresa, ...datos }, ajustes: aj },
      ),
      aj.ticket_ancho,
    )
  }

  if (!info || !aj) return null

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <Seccion titulo="Datos de la empresa" icono={<Building2 className="h-5 w-5 text-primary" />} panel={panel}>
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex flex-col items-center gap-2">
            <Avatar src={info.empresa.logo_path ?? undefined} name={info.empresa.nombre.charAt(0)} className="h-24 w-24 text-large" radius="lg" />
            <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && subirLogo(e.target.files[0])} />
            <Button size="sm" variant="flat" onPress={() => logoRef.current?.click()}>Cambiar logo</Button>
          </div>
          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="Nombre comercial" variant="bordered" value={datos.nombre} onValueChange={(v) => setDatos((d) => ({ ...d, nombre: v }))} />
            <Input label="Razón social" variant="bordered" value={datos.razon_social} onValueChange={(v) => setDatos((d) => ({ ...d, razon_social: v }))} />
            <div className="grid grid-cols-[90px_1fr] gap-2">
              <Select label="RIF" variant="bordered" selectedKeys={[datos.tipo_rif]} onChange={(e) => e.target.value && setDatos((d) => ({ ...d, tipo_rif: e.target.value }))}>
                {['J', 'V', 'E', 'G', 'P'].map((t) => <SelectItem key={t}>{t}</SelectItem>)}
              </Select>
              <Input label="Número" variant="bordered" value={datos.rif} onValueChange={(v) => setDatos((d) => ({ ...d, rif: v }))} />
            </div>
            <Input label="Teléfono" variant="bordered" value={datos.telefono} onValueChange={(v) => setDatos((d) => ({ ...d, telefono: v }))} />
            <Input className="sm:col-span-2" label="Dirección fiscal" variant="bordered" value={datos.direccion_fiscal} onValueChange={(v) => setDatos((d) => ({ ...d, direccion_fiscal: v }))} />
            <Input label="Correo" type="email" variant="bordered" value={datos.email} onValueChange={(v) => setDatos((d) => ({ ...d, email: v }))} />
          </div>
        </div>
        <Sucursales sucursales={info.empresa.sucursales} />
      </Seccion>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        <Seccion titulo="Ticket e impresión" icono={<Printer className="h-5 w-5 text-primary" />} panel={panel}>
          <Select label="Ancho del papel" variant="bordered" selectedKeys={[String(aj.ticket_ancho)]} onChange={(e) => e.target.value && set('ticket_ancho', Number(e.target.value))}>
            <SelectItem key="80">80 mm</SelectItem>
            <SelectItem key="58">58 mm</SelectItem>
          </Select>
          <Textarea label="Mensaje al pie del ticket" variant="bordered" minRows={1} value={aj.ticket_pie ?? ''} onValueChange={(v) => set('ticket_pie', v)} />
          <Switch isSelected={aj.ticket_mostrar_logo} onValueChange={(v) => set('ticket_mostrar_logo', v)}>Logo en el ticket</Switch>
          <Switch isSelected={aj.impresion_automatica} onValueChange={(v) => set('impresion_automatica', v)}>Imprimir el ticket al cobrar</Switch>
          <Button variant="flat" size="sm" className="w-fit" startContent={<Printer className="h-4 w-4" />} onPress={ticketDePrueba}>Imprimir ticket de prueba</Button>
          <p className="text-tiny text-default-400">
            La impresora térmica se instala en Windows como cualquier impresora. Para que la gaveta abra sola, actívalo en su
            controlador ("abrir cajón al imprimir").
          </p>
        </Seccion>

        <Seccion titulo="Cobro en caja" icono={<Receipt className="h-5 w-5 text-primary" />} panel={panel}>
          <Switch isSelected={aj.exigir_turno} onValueChange={(v) => set('exigir_turno', v)}>Exigir caja abierta (turno) para vender</Switch>
          <Switch isSelected={aj.cobra_igtf} onValueChange={(v) => set('cobra_igtf', v)}>
            Cobrar IGTF 3 % en pagos con divisas
          </Switch>
          <p className="-mt-2 text-tiny text-default-400">Solo si la empresa es contribuyente especial (agente de percepción del IGTF).</p>
          <Select label="Vuelto sugerido" variant="bordered" selectedKeys={[aj.vuelto_moneda]} onChange={(e) => e.target.value && set('vuelto_moneda', e.target.value)}>
            <SelectItem key="VES">En bolívares</SelectItem>
            <SelectItem key="USD">En dólares</SelectItem>
          </Select>
          <Input label="Descuento máximo por línea (%)" type="number" min="0" max="100" variant="bordered" value={String(aj.descuento_maximo_pct)} onValueChange={(v) => set('descuento_maximo_pct', Number(v))} />
          <Input label="Límite de fiado por defecto (USD)" inputMode="decimal" variant="bordered" value={String(aj.fiado_limite_defecto_usd)} onValueChange={(v) => set('fiado_limite_defecto_usd', Number(v) || 0)} />
          <Input label="Código de país para WhatsApp" variant="bordered" value={aj.whatsapp_codigo_pais} onValueChange={(v) => set('whatsapp_codigo_pais', v.replace(/\D/g, ''))} startContent={<span className="text-tiny text-default-400">+</span>} />
        </Seccion>

        <Seccion titulo="Programa de puntos" icono={<Star className="h-5 w-5 text-primary" />} panel={panel}>
          <Switch isSelected={aj.puntos_activo} onValueChange={(v) => set('puntos_activo', v)}>Activar puntos para clientes</Switch>
          {aj.puntos_activo && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Puntos por cada USD" inputMode="decimal" variant="bordered" value={String(aj.puntos_por_usd)} onValueChange={(v) => set('puntos_por_usd', Number(v) || 0)} />
                <Input label="Valor de 1 punto (USD)" inputMode="decimal" variant="bordered" value={String(aj.puntos_valor_usd)} onValueChange={(v) => set('puntos_valor_usd', Number(v) || 0)} />
              </div>
              <Input label="Mínimo de puntos para canjear" type="number" variant="bordered" value={String(aj.puntos_minimo_canje)} onValueChange={(v) => set('puntos_minimo_canje', Number(v) || 0)} />
              <p className="text-tiny text-default-500">
                Ejemplo: una compra de $20 da {Math.floor(20 * aj.puntos_por_usd)} puntos; {aj.puntos_minimo_canje} puntos valen {usd(aj.puntos_minimo_canje * aj.puntos_valor_usd)}.
                En el POS se cobran con el método "Puntos".
              </p>
            </>
          )}
        </Seccion>

        <Seccion titulo="Balanza y vencimientos" icono={<Scale className="h-5 w-5 text-primary" />} panel={panel}>
          <Switch isSelected={aj.balanza_activa} onValueChange={(v) => set('balanza_activa', v)}>Leer etiquetas de balanza</Switch>
          {aj.balanza_activa && (
            <>
              <Input label="Prefijos de las etiquetas" variant="bordered" value={aj.balanza_prefijos} onValueChange={(v) => set('balanza_prefijos', v)} description="Los 2 primeros dígitos del código (normalmente del 20 al 29)." />
              <div className="grid grid-cols-2 gap-3">
                <Select label="Dígitos del PLU" variant="bordered" selectedKeys={[String(aj.balanza_digitos_plu)]} onChange={(e) => e.target.value && set('balanza_digitos_plu', Number(e.target.value))}>
                  {['4', '5', '6'].map((d) => <SelectItem key={d}>{d}</SelectItem>)}
                </Select>
                <Select label="La etiqueta trae" variant="bordered" selectedKeys={[aj.balanza_tipo]} onChange={(e) => e.target.value && set('balanza_tipo', e.target.value)}>
                  <SelectItem key="peso">El peso (gramos)</SelectItem>
                  <SelectItem key="precio">El precio (céntimos)</SelectItem>
                </Select>
              </div>
              <p className="text-tiny text-default-400">A cada producto pesable se le asigna su PLU (el código de la balanza) en Inventario.</p>
            </>
          )}
          <Input label="Avisar vencimientos con (días)" type="number" variant="bordered" value={String(aj.vencimiento_alerta_dias)} onValueChange={(v) => set('vencimiento_alerta_dias', Number(v) || 30)} />
        </Seccion>

        <Seccion titulo="Impresora fiscal (opcional)" icono={<Printer className="h-5 w-5 text-warning" />} panel={panel}>
          <p className="text-small text-default-500">
            Los comprobantes de Boxy no son fiscales. Si la tienda tiene una impresora fiscal homologada (familia The Factory HKA),
            el puente de Boxy le envía cada venta para que imprima la factura fiscal. Ver docs/IMPRESORA-FISCAL.md.
          </p>
          <Switch isSelected={aj.fiscal_activa} onValueChange={(v) => set('fiscal_activa', v)}>Enviar las ventas a la impresora fiscal</Switch>
          {fiscal && (
            <div className="flex flex-wrap gap-2">
              <Chip variant="flat" color={fiscal.puente_configurado ? 'success' : 'default'}>{fiscal.puente_configurado ? 'Puente configurado' : 'Puente sin configurar'}</Chip>
              <Chip variant="flat" color={fiscal.pendientes ? 'warning' : 'default'}>{fiscal.pendientes} en cola</Chip>
              {fiscal.errores.length > 0 && <Chip variant="flat" color="danger">{fiscal.errores.length} con error</Chip>}
            </div>
          )}
          <Button size="sm" variant="flat" className="w-fit" onPress={generarClaveFiscal}>Generar clave del puente</Button>
          {claveFiscal && (
            <div className="flex flex-col gap-1">
              <p className="text-tiny text-warning">Cópiala ahora en la configuración del puente; no se vuelve a mostrar.</p>
              <Snippet symbol="" size="sm" className="max-w-full" codeString={claveFiscal}>
                <span className="block max-w-[260px] truncate sm:max-w-none">{claveFiscal}</span>
              </Snippet>
            </div>
          )}
        </Seccion>

        {puede('respaldos.gestionar') && (
          <Seccion titulo="Respaldos" icono={<DatabaseBackup className="h-5 w-5 text-primary" />} panel={panel}>
            <p className="text-small text-default-500">Boxy respalda la base de datos todas las noches. Desde aquí puedes descargar una copia.</p>
            <Button size="sm" variant="flat" className="w-fit" onPress={() => navigate('/respaldos')}>Ver respaldos</Button>
          </Seccion>
        )}
      </div>

      <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-3 rounded-large bg-background/80 p-3 backdrop-blur-md">
        {mensaje && <p className={`text-small ${mensaje.ok ? 'text-success' : 'text-danger'}`}>{mensaje.texto}</p>}
        <Button color="primary" isLoading={guardando} onPress={guardar}>Guardar cambios</Button>
      </div>
    </div>
  )
}

function Seccion({ titulo, icono, panel, children }: { titulo: string; icono: ReactNode; panel: string; children: ReactNode }) {
  return (
    <Card className={panel}>
      <CardHeader className="gap-2">
        {icono}
        <h2 className="font-display text-lg font-bold">{titulo}</h2>
      </CardHeader>
      <CardBody className="gap-3">{children}</CardBody>
    </Card>
  )
}

function Sucursales({ sucursales }: { sucursales: SucursalFull[] }) {
  const [lista, setLista] = useState(sucursales)
  const [guardada, setGuardada] = useState<number | null>(null)

  async function guardar(s: SucursalFull) {
    await api.put(`/sucursales/${s.id}`, { nombre: s.nombre, direccion: s.direccion, telefono: s.telefono })
    setGuardada(s.id)
    setTimeout(() => setGuardada(null), 1500)
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      <p className="text-small font-semibold">Sucursales</p>
      {lista.map((s, i) => (
        <div key={s.id} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1.5fr_1fr_auto]">
          <Input size="sm" label={`Nombre (${s.codigo})`} variant="bordered" value={s.nombre} onValueChange={(v) => setLista((l) => l.map((x, j) => (j === i ? { ...x, nombre: v } : x)))} />
          <Input size="sm" label="Dirección" variant="bordered" value={s.direccion ?? ''} onValueChange={(v) => setLista((l) => l.map((x, j) => (j === i ? { ...x, direccion: v } : x)))} />
          <Input size="sm" label="Teléfono" variant="bordered" value={s.telefono ?? ''} onValueChange={(v) => setLista((l) => l.map((x, j) => (j === i ? { ...x, telefono: v } : x)))} />
          <Button size="sm" variant="flat" className="self-center" onPress={() => guardar(lista[i])}>{guardada === s.id ? '✓' : 'Guardar'}</Button>
        </div>
      ))}
    </div>
  )
}
