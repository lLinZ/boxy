import {
  Button,
  Chip,
  Drawer,
  DrawerBody,
  DrawerContent,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Tooltip,
  User as UserChip,
  useDisclosure,
} from '@heroui/react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState, type ReactNode } from 'react'
import {
  Activity,
  Building2,
  CircleDollarSign,
  CloudOff,
  Contact,
  CreditCard,
  DatabaseBackup,
  KeyRound,
  LayoutDashboard,
  LineChart,
  LogOut,
  Menu,
  Package,
  Percent,
  Receipt,
  ShieldCheck,
  ShoppingCart,
  Store,
  Truck,
  Users,
  Wallet,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useTheme } from '../theme/ThemeContext'
import { api } from '../lib/api'
import { bs } from '../lib/format'
import { alCambiarCola, iniciarSincronizacion, type VentaPendiente } from '../lib/offline'
import type { Permiso } from '../lib/permisos'
import { ThemeControls } from './ThemeControls'
import { CuentaModal } from './CuentaModal'
import type { TasaCambio } from '../types'

interface ItemMenu {
  to: string
  label: string
  icon: typeof Store
  permisos?: Permiso[] // cualquiera de ellos; sin permisos = todos los de la empresa
  soloSaas?: boolean
}

const navItems: ItemMenu[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permisos: ['reportes.ver'] },
  { to: '/monitor', label: 'Monitor en vivo', icon: Activity, permisos: ['reportes.ver'] },
  { to: '/pos', label: 'Caja (POS)', icon: ShoppingCart, permisos: ['ventas.crear'] },
  { to: '/caja', label: 'Turnos de caja', icon: Wallet, permisos: ['caja.operar'] },
  { to: '/ventas', label: 'Ventas', icon: Receipt, permisos: ['ventas.crear', 'ventas.ver_todas'] },
  { to: '/clientes', label: 'Clientes y fiado', icon: Contact, permisos: ['clientes.gestionar'] },
  { to: '/inventario', label: 'Inventario', icon: Package },
  { to: '/compras', label: 'Compras', icon: Truck, permisos: ['compras.gestionar'] },
  { to: '/promociones', label: 'Promociones', icon: Percent, permisos: ['promociones.gestionar'] },
  { to: '/analisis', label: 'Análisis', icon: LineChart, permisos: ['reportes.ver'] },
  { to: '/tasas', label: 'Tasas', icon: CircleDollarSign, permisos: ['tasas.sincronizar', 'tasas.editar'] },
  { to: '/usuarios', label: 'Usuarios', icon: Users, permisos: ['usuarios.gestionar'] },
  { to: '/empresa', label: 'Mi empresa', icon: Building2, permisos: ['empresa.configurar'] },
  { to: '/respaldos', label: 'Respaldos', icon: DatabaseBackup, permisos: ['respaldos.gestionar'] },
  { to: '/billing', label: 'Mi licencia', icon: CreditCard, permisos: ['licencia.gestionar'], soloSaas: true },
]

// Menú del dueño del SaaS (super-admin): no pertenece a ninguna empresa.
const navSuperAdmin: ItemMenu[] = [
  { to: '/admin', label: 'Panel Boxy', icon: ShieldCheck },
  { to: '/tasas', label: 'Tasas', icon: CircleDollarSign },
  { to: '/respaldos', label: 'Respaldos', icon: DatabaseBackup },
]

const titulos: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/monitor': 'Monitor en vivo',
  '/pos': 'Caja (POS)',
  '/caja': 'Turnos de caja',
  '/inventario': 'Inventario',
  '/clientes': 'Clientes y fiado',
  '/ventas': 'Ventas',
  '/compras': 'Compras y proveedores',
  '/promociones': 'Promociones',
  '/analisis': 'Análisis de rentabilidad',
  '/tasas': 'Tasas de cambio',
  '/usuarios': 'Usuarios',
  '/empresa': 'Mi empresa',
  '/respaldos': 'Respaldos',
  '/billing': 'Mi licencia',
  '/admin': 'Panel Boxy',
}

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout, puede, empresa } = useAuth()
  const { glass } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [tasa, setTasa] = useState<TasaCambio | null>(null)
  const [modo, setModo] = useState<string>('saas')
  const [enLinea, setEnLinea] = useState(navigator.onLine)
  const [cola, setCola] = useState<VentaPendiente[]>([])
  const menuMovil = useDisclosure()
  const cuenta = useDisclosure()

  useEffect(() => {
    api.get<TasaCambio>('/tasas/vigente').then((r) => setTasa(r.data)).catch(() => {})
    api.get<{ modo: string }>('/config').then((r) => setModo(r.data.modo)).catch(() => {})
  }, [])

  // Conexión y cola de ventas sin conexión (se envían solas al volver la red)
  useEffect(() => {
    const on = () => setEnLinea(true)
    const off = () => setEnLinea(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    const parar = user?.empresa_id ? iniciarSincronizacion() : () => {}
    const quitar = alCambiarCola(setCola)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
      parar()
      quitar()
    }
  }, [user?.empresa_id])

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  const titulo = titulos[location.pathname] ?? (location.pathname.startsWith('/clientes/') ? 'Ficha del cliente' : 'Boxy')
  const items = user?.rol === 'super_admin'
    ? navSuperAdmin
    : navItems.filter((i) => (!i.permisos || puede(...i.permisos)) && (!i.soloSaas || (empresa?.modo ?? modo) === 'saas'))

  const nav = (
    <>
      <div className="mb-6 flex items-center gap-3 px-1">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
          <Store className="h-6 w-6" strokeWidth={2.25} />
        </div>
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold leading-none tracking-tight">Boxy</h1>
          <p className="truncate text-tiny text-default-500">{user?.empresa?.nombre ?? user?.sucursal?.nombre ?? 'Minimarket'}</p>
        </div>
      </div>

      {items.map((item) => {
        const Icon = item.icon
        return (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={menuMovil.onClose} // en el teléfono, cierra el menú al elegir
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-large px-3 py-2.5 text-small font-semibold transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/30'
                  : 'text-default-600 hover:bg-default-100'
              }`
            }
          >
            <Icon className="h-[18px] w-[18px]" />
            {item.label}
          </NavLink>
        )
      })}

      <div className="mt-auto pt-4">
        <Dropdown placement="top">
          <DropdownTrigger>
            <div className="cursor-pointer rounded-large p-2 transition-colors hover:bg-default-100">
              <UserChip
                name={user?.name}
                description={user?.rol?.replace('_', ' ')}
                avatarProps={{ name: user?.name?.charAt(0), size: 'sm', color: 'primary' }}
              />
            </div>
          </DropdownTrigger>
          <DropdownMenu aria-label="Cuenta">
            <DropdownItem key="cuenta" onPress={cuenta.onOpen} startContent={<KeyRound className="h-4 w-4" />}>
              Mi cuenta (clave y PIN)
            </DropdownItem>
            <DropdownItem key="logout" color="danger" onPress={handleLogout} startContent={<LogOut className="h-4 w-4" />}>
              Cerrar sesión
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </div>
    </>
  )

  const pendientes = cola.filter((v) => !v.error).length
  const rechazadas = cola.filter((v) => v.error).length

  return (
    <div className="relative isolate flex h-[100dvh] overflow-hidden bg-background">
      {/* Blobs de color: el fondo que el efecto glass difumina */}
      {glass && (
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-primary/25 blur-3xl" />
          <div className="absolute right-[-6rem] top-1/4 h-96 w-96 rounded-full bg-primary/15 blur-3xl" />
          <div className="absolute bottom-[-8rem] left-1/3 h-[26rem] w-[26rem] rounded-full bg-primary/20 blur-3xl" />
        </div>
      )}

      {/* Sidebar fija en pantallas grandes */}
      <aside
        className={`hidden h-full w-64 shrink-0 flex-col gap-1 overflow-y-auto border-r border-default-200/60 p-4 lg:flex ${
          glass ? 'bg-content1/50 backdrop-blur-2xl' : 'bg-content1'
        }`}
      >
        {nav}
      </aside>

      {/* En el teléfono, el menú se abre desde el costado */}
      <Drawer isOpen={menuMovil.isOpen} onOpenChange={menuMovil.onOpenChange} placement="left" size="xs">
        <DrawerContent>
          <DrawerBody className="flex flex-col gap-1 p-4">{nav}</DrawerBody>
        </DrawerContent>
      </Drawer>

      {/* Columna principal (solo esta scrollea) */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header
          className={`z-30 flex shrink-0 items-center justify-between gap-2 border-b border-default-200/60 px-3 py-2.5 sm:px-6 sm:py-3 ${
            glass ? 'bg-background/50 backdrop-blur-2xl' : 'bg-background/80 backdrop-blur-md'
          }`}
        >
          <div className="flex min-w-0 items-center gap-2">
            <Button isIconOnly variant="light" className="lg:hidden" aria-label="Abrir menú" onPress={menuMovil.onOpen}>
              <Menu className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <h2 className="truncate font-display text-lg font-bold tracking-tight sm:text-xl">{titulo}</h2>
              <p className="hidden truncate text-tiny text-default-500 sm:block">{user?.empresa?.nombre}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            {(!enLinea || pendientes > 0 || rechazadas > 0) && (
              <Tooltip
                content={
                  !enLinea
                    ? 'Sin conexión: las ventas se guardan en este equipo y se envían solas al volver la red.'
                    : rechazadas > 0
                      ? `${rechazadas} venta(s) sin conexión rechazada(s) por el servidor: revísalas en Ventas.`
                      : `${pendientes} venta(s) esperando para enviarse.`
                }
              >
                <Chip color={rechazadas > 0 ? 'danger' : 'warning'} variant="flat" startContent={<CloudOff className="h-3.5 w-3.5" />}>
                  {!enLinea ? 'Sin conexión' : ''}{pendientes > 0 ? ` ${pendientes} por enviar` : ''}{rechazadas > 0 ? ` ${rechazadas} con error` : ''}
                </Chip>
              </Tooltip>
            )}
            {tasa && (
              <Chip color="success" variant="flat" className="hidden font-semibold sm:flex">
                BCV {bs(tasa.tasa)}
              </Chip>
            )}
            <ThemeControls />
          </div>
        </header>

        <main className="flex-1 overflow-auto p-3 sm:p-6">{children}</main>
      </div>

      <CuentaModal isOpen={cuenta.isOpen} onOpenChange={cuenta.onOpenChange} />
      {/* Primer ingreso con clave temporal: se cambia antes de seguir */}
      <CuentaModal isOpen={!!user?.debe_cambiar_clave} onOpenChange={() => {}} obligatorio />
    </div>
  )
}
