// Permisos del usuario (los calcula el servidor en App\Support\Permisos y los
// manda en /me). La web solo los usa para mostrar u ocultar; el servidor los exige.
import type { User } from '../types'

export type Permiso =
  | 'ventas.crear'
  | 'ventas.ver_todas'
  | 'ventas.descuento'
  | 'ventas.item_libre'
  | 'ventas.anular'
  | 'ventas.devolver'
  | 'caja.operar'
  | 'caja.supervisar'
  | 'productos.gestionar'
  | 'precios.gestionar'
  | 'inventario.movimientos'
  | 'compras.gestionar'
  | 'promociones.gestionar'
  | 'clientes.gestionar'
  | 'clientes.eliminar'
  | 'fiado.configurar'
  | 'fiado.abonar'
  | 'fiado.exceder_limite'
  | 'reportes.ver'
  | 'tasas.sincronizar'
  | 'tasas.editar'
  | 'usuarios.gestionar'
  | 'empresa.configurar'
  | 'respaldos.gestionar'
  | 'licencia.gestionar'

export function puede(user: User | null | undefined, ...permisos: Permiso[]): boolean {
  if (!user?.permisos) return false
  return permisos.some((p) => user.permisos!.includes(p))
}

/** Primera pantalla útil según el rol. */
export function inicioPara(user: User): string {
  if (user.rol === 'super_admin') return '/admin'
  if (puede(user, 'reportes.ver')) return '/dashboard'
  if (puede(user, 'ventas.crear')) return '/pos'
  if (puede(user, 'productos.gestionar')) return '/inventario'
  return '/clientes'
}
