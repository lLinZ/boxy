// Tipos del dominio Crotone (espejo de la API Laravel).
// Nota: Laravel serializa los decimales como string.

export type TipoIva = 'general' | 'reducido' | 'exento'
export type Moneda = 'VES' | 'USD'
export type MetodoPago =
  | 'efectivo_bs'
  | 'efectivo_usd'
  | 'pago_movil'
  | 'transferencia'
  | 'tarjeta'
  | 'zelle'
  | 'credito'
  | 'puntos'
  | 'otro'

export interface Empresa {
  id: number
  nombre: string
  razon_social: string
  tipo_rif?: string
  rif: string
  direccion_fiscal?: string | null
  telefono?: string | null
  email?: string | null
  logo_path?: string | null
}

/** Preferencias de la empresa (empresas.config + valores por defecto). */
export interface AjustesEmpresa {
  ticket_ancho: number
  ticket_pie: string | null
  ticket_mostrar_logo: boolean
  impresion_automatica: boolean
  cobra_igtf: boolean
  vuelto_moneda: 'VES' | 'USD'
  exigir_turno: boolean
  descuento_maximo_pct: number
  whatsapp_codigo_pais: string
  fiado_limite_defecto_usd: number
  puntos_activo: boolean
  puntos_por_usd: number
  puntos_valor_usd: number
  puntos_minimo_canje: number
  balanza_activa: boolean
  balanza_prefijos: string
  balanza_digitos_plu: number
  balanza_tipo: 'peso' | 'precio'
  fiscal_activa: boolean
  vencimiento_alerta_dias: number
}

export interface SucursalFull extends Sucursal {
  direccion: string | null
  telefono: string | null
}

export interface EmpresaInfo {
  empresa: Empresa & { sucursales: SucursalFull[] }
  ajustes: AjustesEmpresa
  modo: 'saas' | 'dedicado'
}

export interface Sucursal {
  id: number
  nombre: string
  codigo: string
}

export interface User {
  id: number
  name: string
  email: string
  rol: string
  activo: boolean | number
  empresa_id: number
  sucursal_id: number | null
  empresa?: Empresa
  sucursal?: Sucursal
  permisos?: string[]
  tiene_pin?: boolean
  debe_cambiar_clave?: boolean
}

export interface Categoria {
  id: number
  nombre: string
  slug: string
  productos_count?: number
}

export interface Inventario {
  id: number
  sucursal_id: number
  producto_id: number
  cantidad: string
  stock_minimo: string
  vendidos_30d?: number
  producto?: Producto
}

export interface Producto {
  id: number
  categoria_id: number | null
  sku: string
  codigo_barra: string | null
  nombre: string
  unidad: string
  precio_costo_usd: string
  precio_venta_usd: string
  tipo_iva: TipoIva
  controla_stock: boolean
  pesable?: boolean
  codigo_balanza?: string | null
  imagen_path: string | null
  activo: boolean
  categoria?: Categoria
  inventarios?: Inventario[]
  /** Cantidad leída de una etiqueta de balanza (peso en kg). */
  cantidad_balanza?: number
}

// Movimiento de kardex
export interface Movimiento {
  id: number
  tipo: string
  cantidad: string
  cantidad_anterior: string
  cantidad_nueva: string
  observacion: string | null
  created_at: string
}

// Métricas de rentabilidad por producto
export interface MetricaProducto {
  id: number
  nombre: string
  sku: string
  categoria: string | null
  precio_costo_usd: number | string
  precio_venta_usd: number | string
  margen_pct: number
  ganancia_usd: number
  stock: number | string
  vendidos_30d: number | string
  ingresos_30d_usd: number | string
  ganancia_30d_usd: number | string
}

// Tasa vigente por fuente (BCV, USDT, …)
export interface TasaVigente {
  fuente: string
  tasa: string
  fecha: string
}

// Resultado de importación masiva
export interface ImportResult {
  creados: number
  actualizados: number
  errores: { fila: number; error: string }[]
}

// Fila normalizada del Excel de productos
export interface FilaImport {
  sku: string
  nombre: string
  precio_venta_usd: number
  precio_costo_usd?: number
  tipo_iva?: TipoIva
  categoria?: string
  codigo_barra?: string
  unidad?: string
  stock_inicial?: number
  stock_minimo?: number
}

export interface Cliente {
  id: number
  tipo_documento: string
  documento: string
  nombre: string
  telefono?: string | null
  email?: string | null
  direccion?: string | null
  fecha_nacimiento?: string | null
  notas?: string | null
  credito_habilitado?: boolean
  limite_credito_usd?: string
  saldo_usd?: string
  puntos?: number
}

export interface TasaCambio {
  id: number
  fecha: string
  fuente: string
  tasa: string
}

export interface VentaItem {
  id: number
  producto_id?: number | null
  descripcion: string
  cantidad: string
  precio_unitario_usd: string
  tipo_iva: TipoIva
  alicuota_iva: string
  descuento_usd?: string
  promocion_usd?: string
  base_usd?: string
  iva_usd: string
  total_usd: string
}

export interface PagoVenta {
  id: number
  metodo: MetodoPago
  moneda: Moneda
  monto: string
  monto_usd: string
  aplicado_usd?: string
  igtf_usd: string
  referencia?: string | null
}

export interface DevolucionItem {
  id: number
  venta_item_id: number
  descripcion: string
  cantidad: string
  total_usd: string
  reintegra_stock: boolean
}

export interface Devolucion {
  id: number
  numero: string
  motivo: string
  total_usd: string
  reintegro_metodo: string
  reintegro_moneda: Moneda
  reintegro_monto: string
  created_at: string
  items?: DevolucionItem[]
  user?: { id: number; name: string }
}

export interface Venta {
  id: number
  uuid?: string | null
  numero_factura: string
  numero_control: string
  fecha: string
  tasa: string
  subtotal_usd: string
  descuento_usd: string
  base_imponible_usd: string
  iva_usd: string
  igtf_usd: string
  total_usd: string
  total_bs: string
  vuelto_usd?: string
  vuelto_metodo?: string | null
  vuelto_moneda?: Moneda | null
  vuelto_monto?: string
  devuelto_usd?: string
  puntos_ganados?: number
  estado: string
  origen?: string
  motivo_anulacion?: string | null
  anulada_el?: string | null
  estado_fiscal?: string | null
  numero_fiscal?: string | null
  turno_id?: number | null
  cliente?: Cliente | null
  user?: { id: number; name: string } | null
  items?: VentaItem[]
  pagos?: PagoVenta[]
  devoluciones?: Devolucion[]
  anulada_por?: { id: number; name: string } | null
  /** Solo en la cola sin conexión: aún no llegó al servidor. */
  pendiente?: boolean
}

// ── Caja por turnos ──
export interface TurnoCaja {
  id: number
  estado: 'abierto' | 'cerrado'
  abierto_el: string
  cerrado_el: string | null
  fondo_bs: string
  fondo_usd: string
  esperado_bs?: string | null
  esperado_usd?: string | null
  contado_bs?: string | null
  contado_usd?: string | null
  diferencia_bs?: string | null
  diferencia_usd?: string | null
  observacion?: string | null
  user?: { id: number; name: string }
  sucursal?: { id: number; nombre: string }
  cerrado_por?: { id: number; name: string } | null
}

export interface MetodoCaja {
  metodo: string
  moneda: Moneda
  cobros: number
  abonos: number
  vuelto: number
  devoluciones: number
  neto: number
}

export interface ResumenCaja {
  turno: {
    id: number
    estado: string
    abierto_el: string
    cerrado_el: string | null
    cerrado_por?: string
    cajero: string | null
    sucursal: string | null
    fondo_bs: number
    fondo_usd: number
    tasa_apertura: number
  }
  ventas: {
    cantidad: number
    total_usd: number
    total_bs: number
    iva_usd: number
    igtf_usd: number
    descuento_usd: number
    ticket_promedio_usd: number
  }
  anuladas: { cantidad: number; total_usd: number }
  devoluciones: { cantidad: number; total_usd: number }
  abonos: { cantidad: number; total_usd: number }
  fiado_otorgado_usd: number
  metodos: MetodoCaja[]
  efectivo?: {
    esperado_bs: number
    esperado_usd: number
    contado_bs?: number
    contado_usd?: number
    diferencia_bs?: number
    diferencia_usd?: number
  }
}

// ── CRM ──
export interface FichaCliente {
  cliente: Cliente
  estadisticas: {
    compras: number
    total_usd: number
    ticket_promedio_usd: number
    primera_compra: string | null
    ultima_compra: string | null
    dias_sin_comprar: number | null
    frecuencia_dias: number | null
  }
  favoritos: { producto: string; cantidad: string; total_usd: string; veces: number }[]
  ultimas_compras: { id: number; numero_factura: string; fecha: string; total_usd: string; total_bs: string; devuelto_usd: string }[]
  por_mes: { mes: string; compras: number; total_usd: string }[]
}

export interface MovimientoCuenta {
  id: number
  tipo: 'cargo' | 'abono' | 'reverso' | 'ajuste'
  metodo: string | null
  moneda: Moneda | null
  monto: string
  monto_usd: string
  igtf_usd: string
  saldo_usd: string
  referencia: string | null
  nota: string | null
  created_at: string
  venta?: { id: number; numero_factura: string } | null
  user?: { id: number; name: string } | null
}

export interface CuentaCliente {
  cliente: Cliente
  antiguedad_dias: number | null
  movimientos: Paginated<MovimientoCuenta>
}

export interface PorCobrar {
  total_usd: number
  clientes: (Cliente & { ultimo_abono: string | null })[]
}

// ── Compras ──
export interface Proveedor {
  id: number
  tipo_documento: string
  documento: string | null
  nombre: string
  contacto: string | null
  telefono: string | null
  email: string | null
  direccion: string | null
  notas: string | null
  activo: boolean
  compras_count?: number
  total_comprado_usd?: string | null
}

export interface CompraItem {
  id: number
  producto_id: number
  cantidad: string
  costo_unitario_usd: string
  iva_usd: string
  total_usd: string
  costo_anterior_usd: string
  costo_promedio_usd: string
  lote: string | null
  vence_el: string | null
  producto?: { id: number; nombre: string; sku: string; unidad?: string }
}

export interface Compra {
  id: number
  numero: string
  documento_proveedor: string | null
  fecha: string
  moneda: Moneda
  tasa: string
  subtotal_usd: string
  iva_usd: string
  total_usd: string
  condicion: 'contado' | 'credito'
  vence_el: string | null
  pagada: boolean
  estado: 'registrada' | 'anulada'
  observacion: string | null
  items_count?: number
  proveedor?: { id: number; nombre: string } | null
  user?: { id: number; name: string } | null
  items?: CompraItem[]
}

// ── Promociones ──
export interface Promocion {
  id: number
  nombre: string
  tipo: 'porcentaje' | 'nxm' | 'precio_cantidad'
  producto_id: number | null
  categoria_id: number | null
  valor: string
  lleva: number | null
  paga: number | null
  cantidad_minima: string
  desde: string | null
  hasta: string | null
  dias_semana: number[] | null
  activo: boolean
  producto?: { id: number; nombre: string } | null
  categoria?: { id: number; nombre: string } | null
}

export interface LoteVencimiento {
  lote_id: number
  producto_id: number
  producto: string
  sku: string
  lote: string | null
  vence_el: string
  dias: number
  vencido: boolean
  cantidad_estimada: number
  valor_costo_usd: number
}

export interface CambioPrecio {
  id: number
  nombre: string
  sku: string
  costo_usd: number
  precio_actual_usd: number
  precio_nuevo_usd: number
  margen_nuevo_pct: number
  bajo_costo: boolean
}

export interface Paginated<T> {
  data: T[]
  current_page: number
  last_page: number
  total: number
}

// Datos del panel principal
export interface DashboardData {
  hoy: { cantidad: number; total_usd: number; total_bs: number; devoluciones_usd?: number; neto_usd?: number }
  por_cobrar_usd?: number
  semana: { fecha: string; total_usd: number; cantidad: number }[]
  bajo_stock: Inventario[]
  bajo_stock_count: number
  top_productos: { descripcion: string; total_cantidad: string; total_usd: string }[]
  valor_inventario_usd: number
  total_productos: number
  tasa: TasaCambio | null
}

// Monitor en vivo
export interface MonitorData {
  pulso: {
    tickets: number
    total_usd: number
    total_bs: number
    ticket_promedio_usd: number
    ayer_ref_usd: number
    delta_pct: number | null
  }
  ganancia: { ganancia_usd: number; ganancia_bs: number; margen_pct: number; estimada: boolean }
  por_hora: { horas: { hora: number; usd: number; base: number }[]; ultima_hora_usd: number }
  pagos: {
    metodos: { metodo: string; ops: number; usd: number; pct: number }[]
    pct_divisa: number
    total_usd: number
  }
  igtf: { igtf_usd: number; igtf_bs: number; ops: number }
  cajeros: { nombre: string; tickets: number; usd: number; ticket_promedio: number; anuladas: number }[]
  feed: {
    id: number
    numero: string
    hora: string
    total_usd: number
    total_bs: number
    cajero: string | null
    items: number
    metodo: string | null
  }[]
  tasas: {
    bcv: number
    usdt: number | null
    brecha_pct: number | null
    antiguedad_dias: number | null
    desactualizada: boolean
  }
  hora_servidor: string
}

export interface Recomendaciones {
  stock_muerto: { producto: string; stock: number; capital_inmovilizado_usd: number; dias_sin_venta: number | null }[]
  reorden: { producto: string; stock: number; velocidad_dia: number; dias_cobertura: number; sugerido_reponer: number }[]
  combos: { producto_a: string; producto_b: string; veces: number }[]
  ofertas: { producto: string; stock: number; dias_cobertura: number; capital_inmovilizado_usd: number; descuento_sugerido_pct: number }[]
  hot: { producto: string; vendidos_7d: number; vendidos_7d_previo: number; crecimiento_pct: number }[]
}

// ── SaaS: planes, suscripción, licencias ──
export interface Plan {
  id: number
  codigo: string
  nombre: string
  descripcion: string | null
  precio_mensual_usd: string | number
  max_sucursales: number
  max_usuarios: number
  max_productos: number
  features: Record<string, boolean> | null
  dias_trial: number
  dias_gracia?: number
  orden: number
  visible?: boolean
  activo?: boolean
  // conteos en vivo (endpoint admin/planes)
  empresas?: number
  al_dia?: number
  en_trial?: number
  mrr_plan?: number
}

export interface SuscripcionInfo {
  suscripcion: {
    id: number
    estado: string
    plan?: Plan
    vence_el: string | null
    trial_termina_el: string | null
  }
  estado: string
  dias_restantes: number
  puede_operar: boolean
  fecha_limite: string | null
}

export interface PagoLicencia {
  id: number
  metodo: string
  moneda: string
  monto: string | number
  monto_usd: string | number
  meses: number
  estado: 'reportado' | 'confirmado' | 'rechazado'
  referencia: string | null
  created_at: string
  tiene_comprobante?: boolean
  plan?: { id: number; nombre: string }
  empresa?: { id: number; nombre: string }
}

export interface EmpresaAdmin {
  id: number
  nombre: string
  rif: string
  sucursales: number
  usuarios: number
  plan: string | null
  estado: string
  dias_restantes: number
  vence_el: string | null
}

export interface MetricasSaaS {
  empresas: number
  activas: number
  trial: number
  gracia: number
  suspendidas: number
  vencidas: number
  mrr_usd: number
  arr_usd: number
  arpu_usd: number
  ingresos_mes_usd: number
  pagos_pendientes: number
}

export interface IngresosSaaS {
  serie: { mes: string; ym: string; total_usd: number }[]
  por_plan: { plan: string; empresas: number; mrr_usd: number }[]
  total_confirmado_usd: number
}

export interface SuscripcionRiesgo {
  empresa_id: number
  empresa: string | null
  estado: string
  dias_restantes: number
  fecha_limite: string | null
}

export interface EmpresaDetalle {
  empresa: {
    id: number
    nombre: string
    razon_social: string
    rif: string
    telefono: string | null
    email: string | null
  }
  suscripcion: {
    id: number
    estado: string
    plan_id: number | null
    precio_usd: string | number | null
    max_sucursales: number | null
    max_usuarios: number | null
    max_productos: number | null
    vence_el: string | null
    trial_termina_el: string | null
    plan?: Plan
  } | null
  dias_restantes: number
  usuarios: { id: number; name: string; email: string; rol: string; activo: boolean | number }[]
  sucursales: { id: number; nombre: string; codigo: string }[]
  pagos: PagoLicencia[]
  uso: { ventas: number; productos: number; clientes: number }
}

// Carrito del POS (estado local antes de emitir)
export interface LineaCarrito {
  producto: Producto
  cantidad: number
  /** Descuento manual de la línea en USD (requiere permiso o PIN de supervisor). */
  descuento_usd?: number
}

export interface LineaPago {
  metodo: MetodoPago
  moneda: Moneda
  monto: string // texto crudo del input; se parsea con n() al usarlo
}
