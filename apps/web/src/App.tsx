import { Suspense, lazy, useEffect, useState, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { useAuth } from './auth/AuthContext'
import { api } from './lib/api'
import { inicioPara, type Permiso } from './lib/permisos'
import { LandingPage } from './pages/LandingPage'

// Cada pantalla del sistema se descarga solo cuando se abre: la portada pública
// (LandingPage) carga liviana y no trae el código del POS, inventario, etc.
const RegistroPage = lazy(() => import('./pages/RegistroPage').then((m) => ({ default: m.RegistroPage })))
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const PosPage = lazy(() => import('./pages/PosPage').then((m) => ({ default: m.PosPage })))
const InventarioPage = lazy(() => import('./pages/InventarioPage').then((m) => ({ default: m.InventarioPage })))
const VentasPage = lazy(() => import('./pages/VentasPage').then((m) => ({ default: m.VentasPage })))
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const UsuariosPage = lazy(() => import('./pages/UsuariosPage').then((m) => ({ default: m.UsuariosPage })))
const ClientesPage = lazy(() => import('./pages/ClientesPage').then((m) => ({ default: m.ClientesPage })))
const ClienteFichaPage = lazy(() => import('./pages/ClienteFichaPage').then((m) => ({ default: m.ClienteFichaPage })))
const AnalisisPage = lazy(() => import('./pages/AnalisisPage').then((m) => ({ default: m.AnalisisPage })))
const TasasPage = lazy(() => import('./pages/TasasPage').then((m) => ({ default: m.TasasPage })))
const ScannerPage = lazy(() => import('./pages/ScannerPage').then((m) => ({ default: m.ScannerPage })))
const MonitorPage = lazy(() => import('./pages/MonitorPage').then((m) => ({ default: m.MonitorPage })))
const BillingPage = lazy(() => import('./pages/BillingPage').then((m) => ({ default: m.BillingPage })))
const SuperAdminPage = lazy(() => import('./pages/SuperAdminPage').then((m) => ({ default: m.SuperAdminPage })))
const CajaPage = lazy(() => import('./pages/CajaPage').then((m) => ({ default: m.CajaPage })))
const ComprasPage = lazy(() => import('./pages/ComprasPage').then((m) => ({ default: m.ComprasPage })))
const PromocionesPage = lazy(() => import('./pages/PromocionesPage').then((m) => ({ default: m.PromocionesPage })))
const EmpresaPage = lazy(() => import('./pages/EmpresaPage').then((m) => ({ default: m.EmpresaPage })))
const RespaldosPage = lazy(() => import('./pages/RespaldosPage').then((m) => ({ default: m.RespaldosPage })))
const PerfilPage = lazy(() => import('./pages/PerfilPage').then((m) => ({ default: m.PerfilPage })))

/** Muestra la página solo si el usuario tiene alguno de los permisos (el servidor igual los exige). */
function Con({ permisos, children }: { permisos: Permiso[]; children: ReactNode }) {
  const { user, puede } = useAuth()
  if (!user) return null
  return puede(...permisos) ? <>{children}</> : <Navigate to={inicioPara(user)} replace />
}

/** En una instalación dedicada (una sola tienda) la portada es el login. */
function Portada() {
  const [modo, setModo] = useState<string | null>(null)
  useEffect(() => {
    api.get<{ modo: string }>('/config').then((r) => setModo(r.data.modo)).catch(() => setModo('saas'))
  }, [])
  // La portada se pinta de inmediato; solo si la instalación es dedicada se va al login.
  return modo === 'dedicado' ? <Navigate to="/login" replace /> : <LandingPage />
}

function Inicio() {
  const { user } = useAuth()
  return user ? <Navigate to={inicioPara(user)} replace /> : null
}

export default function App() {
  return (
    <Suspense fallback={null}>
      <Routes>
        {/* Públicas */}
        <Route path="/" element={<Portada />} />
        <Route path="/registro" element={<RegistroPage />} />
        <Route path="/login" element={<LoginPage />} />
        {/* Página del teléfono: se autentica sola con el código del QR */}
        <Route path="/scanner" element={<ScannerPage />} />

        {/* App autenticada */}
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/dashboard" element={<Con permisos={['reportes.ver']}><DashboardPage /></Con>} />
                  <Route path="/monitor" element={<Con permisos={['reportes.ver']}><MonitorPage /></Con>} />
                  <Route path="/pos" element={<Con permisos={['ventas.crear']}><PosPage /></Con>} />
                  <Route path="/caja" element={<Con permisos={['caja.operar']}><CajaPage /></Con>} />
                  <Route path="/inventario" element={<InventarioPage />} />
                  <Route path="/clientes" element={<Con permisos={['clientes.gestionar']}><ClientesPage /></Con>} />
                  <Route path="/clientes/:id" element={<Con permisos={['clientes.gestionar']}><ClienteFichaPage /></Con>} />
                  <Route path="/ventas" element={<Con permisos={['ventas.crear', 'ventas.ver_todas']}><VentasPage /></Con>} />
                  <Route path="/compras" element={<Con permisos={['compras.gestionar']}><ComprasPage /></Con>} />
                  <Route path="/promociones" element={<Con permisos={['promociones.gestionar']}><PromocionesPage /></Con>} />
                  <Route path="/analisis" element={<Con permisos={['reportes.ver']}><AnalisisPage /></Con>} />
                  <Route path="/tasas" element={<TasasPage />} />
                  <Route path="/usuarios" element={<Con permisos={['usuarios.gestionar']}><UsuariosPage /></Con>} />
                  <Route path="/empresa" element={<Con permisos={['empresa.configurar']}><EmpresaPage /></Con>} />
                  <Route path="/respaldos" element={<Con permisos={['respaldos.gestionar']}><RespaldosPage /></Con>} />
                  <Route path="/billing" element={<BillingPage />} />
                  <Route path="/admin" element={<SuperAdminPage />} />
                  <Route path="/perfil" element={<PerfilPage />} />
                  <Route path="*" element={<Inicio />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </Suspense>
  )
}
