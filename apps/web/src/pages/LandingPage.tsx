import { Button, Card, CardBody, Chip } from '@heroui/react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart3,
  Boxes,
  Check,
  CreditCard,
  LineChart,
  ScanBarcode,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Store,
} from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../auth/AuthContext'
import { n, usd } from '../lib/format'
import type { Plan } from '../types'

const FEATURES = [
  { icon: ShoppingCart, t: 'Caja (POS) ágil', d: 'Cobra rápido con búsqueda, multi-tasa BCV/USDT/Bs e IGTF automático.' },
  { icon: Boxes, t: 'Inventario inteligente', d: 'Stock por sucursal, kardex, importación por Excel y alertas de bajo stock.' },
  { icon: LineChart, t: 'Monitor en vivo', d: 'Ventas en tiempo real, productos en racha y recomendaciones de ofertas.' },
  { icon: ScanBarcode, t: 'Escáner con tu teléfono', d: 'Convierte cualquier celular en lector de códigos vía QR.' },
  { icon: BarChart3, t: 'Rentabilidad clara', d: 'Margen y ganancia por producto, comprobante y ticket térmico listos para imprimir.' },
  { icon: Smartphone, t: 'Instálalo como app', d: 'Boxy es PWA: úsalo desde el navegador o instálalo en el equipo.' },
]

export function LandingPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [planes, setPlanes] = useState<Plan[]>([])

  useEffect(() => {
    api.get<Plan[]>('/planes').then((r) => setPlanes(r.data)).catch(() => {})
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-default-200/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
              <Store className="h-5 w-5" strokeWidth={2.25} />
            </div>
            <span className="font-display text-xl font-bold">Boxy</span>
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <Button color="primary" variant="flat" onPress={() => navigate('/dashboard')}>
                Ir al sistema
              </Button>
            ) : (
              <>
                <Button variant="light" onPress={() => navigate('/login')}>
                  Iniciar sesión
                </Button>
                <Button color="primary" onPress={() => navigate('/registro')}>
                  Prueba gratis
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-primary/25 blur-3xl" />
          <div className="absolute right-0 top-1/4 h-80 w-80 rounded-full bg-primary/15 blur-3xl" />
        </div>
        <div className="mx-auto max-w-5xl px-6 py-24 text-center">
          <Chip color="primary" variant="flat" startContent={<Sparkles className="ml-1 h-3.5 w-3.5" />} className="mb-5">
            Hecho para minimarkets venezolanos
          </Chip>
          <h1 className="font-display text-5xl font-bold leading-tight tracking-tight sm:text-6xl">
            El sistema que tu <span className="text-primary">negocio</span> necesita
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-default-500">
            Inventario, punto de venta, caja y clientes en bolívares y divisas, con IVA e IGTF calculados.
            Todo en una sola app, lista para usar hoy.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button color="primary" size="lg" className="font-semibold" onPress={() => navigate('/registro')}>
              Empieza gratis 14 días
            </Button>
            <Button variant="bordered" size="lg" onPress={() => navigate('/login')}>
              Ya tengo cuenta
            </Button>
          </div>
          <p className="mt-3 text-tiny text-default-400">Sin tarjeta de crédito. Cancela cuando quieras.</p>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="mb-10 text-center font-display text-3xl font-bold">Todo lo que necesitas para vender</h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <Card key={f.t} className="border border-default-200/60 bg-content1">
              <CardBody className="gap-3 p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-display text-lg font-bold">{f.t}</h3>
                <p className="text-small text-default-500">{f.d}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="mb-3 text-center">
          <h2 className="font-display text-3xl font-bold">Planes simples</h2>
          <p className="mt-2 text-default-500">Paga mensual. Empieza con 14 días gratis en cualquier plan.</p>
        </div>
        <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
          {planes.map((p, i) => {
            const destacado = i === 1
            return (
              <Card
                key={p.id}
                className={`border bg-content1 ${destacado ? 'border-primary shadow-lg shadow-primary/20' : 'border-default-200/60'}`}
              >
                <CardBody className="gap-4 p-6">
                  {destacado && (
                    <Chip color="primary" variant="flat" className="self-start">
                      Más popular
                    </Chip>
                  )}
                  <div>
                    <h3 className="font-display text-xl font-bold">{p.nombre}</h3>
                    <p className="text-small text-default-500">{p.descripcion}</p>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="font-display text-4xl font-bold">{usd(p.precio_mensual_usd)}</span>
                    <span className="text-default-400">/mes</span>
                  </div>
                  <ul className="flex flex-col gap-2 text-small">
                    <Li>{p.max_sucursales === 0 ? 'Sucursales ilimitadas' : `${p.max_sucursales} sucursal(es)`}</Li>
                    <Li>{p.max_usuarios === 0 ? 'Usuarios ilimitados' : `${p.max_usuarios} usuarios`}</Li>
                    <Li>{p.max_productos === 0 ? 'Productos ilimitados' : `Hasta ${n(p.max_productos)} productos`}</Li>
                    {p.features?.monitor && <Li>Monitor en vivo</Li>}
                    {p.features?.analisis && <Li>Análisis de rentabilidad</Li>}
                    {p.features?.escaner_remoto && <Li>Escáner con el teléfono</Li>}
                  </ul>
                  <Button
                    color={destacado ? 'primary' : 'default'}
                    variant={destacado ? 'solid' : 'flat'}
                    className="mt-auto font-semibold"
                    onPress={() => navigate(`/registro?plan=${p.codigo}`)}
                  >
                    Elegir {p.nombre}
                  </Button>
                </CardBody>
              </Card>
            )
          })}
        </div>
      </section>

      {/* CTA final */}
      <section className="mx-auto max-w-4xl px-6 py-20 text-center">
        <CreditCard className="mx-auto mb-4 h-10 w-10 text-primary" />
        <h2 className="font-display text-3xl font-bold">¿Listo para ordenar tu negocio?</h2>
        <p className="mx-auto mt-3 max-w-xl text-default-500">
          Crea tu cuenta en menos de un minuto y empieza a vender con Boxy hoy mismo.
        </p>
        <Button color="primary" size="lg" className="mt-6 font-semibold" onPress={() => navigate('/registro')}>
          Crear mi cuenta
        </Button>
      </section>

      <footer className="border-t border-default-200/60 py-8 text-center text-tiny text-default-400">
        Boxy · Punto de venta e inventario para Venezuela · {new Date().getFullYear()}
      </footer>
    </div>
  )
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <Check className="h-4 w-4 shrink-0 text-primary" />
      <span className="text-default-600">{children}</span>
    </li>
  )
}
