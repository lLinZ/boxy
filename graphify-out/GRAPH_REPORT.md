# Graph Report - crotone  (2026-11-11)

## Corpus Check
- 251 files · ~249,392 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 40 file(s) not represented in the graph (top: (none) 17, .woff2 16, .css 3)

## Summary
- 1601 nodes · 3943 edges · 114 communities (58 shown, 56 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 71 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Modales y componentes web
- Documentacion y alcance de Boxy
- Shell de la app y Auth web
- Tickets y utilidades de impresion
- Dashboard y excepciones de negocio
- Calculo de venta (PHP=TS)
- Pruebas de operacion API
- Monitor en vivo
- Dependencias Composer
- Cuenta y precios masivos
- Empresa y promociones
- Auth y fiscal API
- Instalador y categorias
- Clientes y fiado
- Inventario y productos
- Facturacion SaaS web
- Middleware de seguridad
- Capturas UI y tema oscuro
- Compras y comprobantes
- Analisis y monitor web
- Modelos Cliente y Empresa
- Comandos de respaldo y tasas
- Dependencias web
- Dependencias api js
- Usuario y turno de caja
- Cliente HTTP y tokens
- Service worker PWA
- Modelos de devolucion y pago
- Config TypeScript
- Dev tooling eslint
- Grupo 30
- Grupo 31
- Grupo 32
- Grupo 33
- Grupo 34
- Grupo 35
- Grupo 36
- Grupo 37
- Grupo 38
- Grupo 39
- Grupo 40
- Grupo 41
- Grupo 42
- Grupo 43
- Grupo 44
- Grupo 45
- Grupo 46
- Grupo 47
- Grupo 48
- Grupo 49
- Grupo 50
- Grupo 51
- Grupo 52
- Grupo 53
- Grupo 54
- Grupo 55
- Grupo 56
- Grupo 57
- Grupo 58
- Grupo 59
- Grupo 60
- Grupo 61
- Grupo 62
- Grupo 63
- Grupo 64
- Grupo 65
- Grupo 66
- Grupo 67
- Grupo 68
- Grupo 69
- Grupo 70
- Grupo 71
- Grupo 92
- Grupo 93
- Grupo 94
- Grupo 95
- Grupo 104
- Grupo 105

## God Nodes (most connected - your core abstractions)
1. `usd()` - 61 edges
2. `User` - 56 edges
3. `n()` - 55 edges
4. `Empresa` - 48 edges
5. `mensajeError()` - 46 edges
6. `Venta` - 45 edges
7. `Controller` - 44 edges
8. `Boxy - Informe tecnico interno previo a la venta (29 sep 2026)` - 44 edges
9. `Producto` - 39 edges
10. `useTheme()` - 39 edges

## Surprising Connections (you probably didn't know these)
- `Crotone monorepo README` --semantically_similar_to--> `Boxy (POS product)`  [INFERRED] [semantically similar]
  README.md → CLAUDE.md
- `Elegir modo (dedicado/saas)` --semantically_similar_to--> `Modos SaaS y dedicado`  [INFERRED] [semantically similar]
  docs/DESPLIEGUE.md → CLAUDE.md
- `IVA, IGTF y bolivares (presentacion)` --semantically_similar_to--> `IVA e IGTF`  [INFERRED] [semantically similar]
  entregables/presentacion/presentacion.html → CLAUDE.md
- `Caracteristicas fiscales Venezuela` --semantically_similar_to--> `IVA e IGTF`  [INFERRED] [semantically similar]
  README.md → CLAUDE.md
- `Caja y turnos (presentacion)` --semantically_similar_to--> `Caja por turnos`  [INFERRED] [semantically similar]
  entregables/presentacion/presentacion.html → CLAUDE.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Sale processing service pipeline** — claude_facturacion_service, claude_calculadora_venta, claude_stock_service, claude_caja_service, claude_cuenta_cliente_service, claude_fidelizacion_service [INFERRED 0.85]
- **Fiscal printer integration flow** — docs_impresora_fiscal_puente, docs_impresora_fiscal_inttfhka, docs_impresora_fiscal_estado_fiscal, claude_fiscal_service [EXTRACTED 0.95]
- **Faltantes de abasto priorizados en el plan** — entregables_boxy_informe_tecnico_interno_cierre_caja, entregables_boxy_informe_tecnico_interno_anulaciones, entregables_boxy_informe_tecnico_interno_vuelto, entregables_boxy_informe_tecnico_interno_fiado, entregables_boxy_informe_tecnico_interno_compras [INFERRED 0.75]
- **Cadena de riesgo en tasas** — entregables_boxy_informe_tecnico_interno_c1, entregables_boxy_informe_tecnico_interno_m1, entregables_boxy_informe_tecnico_interno_m6 [INFERRED 0.75]
- **Flujo de venta: POS, listado de ventas y descuento de stock en kardex** — entregables_presentacion_capturas_pos_pantallapos, entregables_presentacion_capturas_ventas_listaventas, entregables_presentacion_capturas_kardex_kardexmodal [INFERRED 0.85]
- **Gestion de inventario: tabla, etiqueta de codigo de barras y kardex** — entregables_presentacion_capturas_inventario_tablainventario, entregables_presentacion_capturas_etiqueta_etiquetacodigobarras, entregables_presentacion_capturas_kardex_kardexmodal [INFERRED 0.85]

## Communities (114 total, 56 thin omitted)

### Community 0 - "Modales y componentes web"
Cohesion: 0.05
Nodes (68): Props, Op, Props, ClienteModal(), Props, TIPOS, ConectarTelefonoModal(), Emparejamiento (+60 more)

### Community 1 - "Documentacion y alcance de Boxy"
Cohesion: 0.05
Nodes (83): API REST resumen, App movil React Native (pendiente), Capa SaaS / licencias (planificada), Crotone - Informe de avance (16 jun 2026), Escaner remoto telefono-PC por QR, Estado general del proyecto, Importacion masiva por Excel, Kardex auditable (+75 more)

### Community 2 - "Shell de la app y Auth web"
Cohesion: 0.08
Nodes (43): Con(), Inicio(), AuthContext, AuthContextValue, AuthProvider(), aplicarSesion(), login(), logout() (+35 more)

### Community 3 - "Tickets y utilidades de impresion"
Cohesion: 0.12
Nodes (48): BarcodeLabelModal(), imprimir(), useSupervisor(), bs(), n(), usd(), cant(), encabezado() (+40 more)

### Community 4 - "Dashboard y excepciones de negocio"
Cohesion: 0.07
Nodes (19): ReglaNegocioException, DashboardController, TasaCambioController, TasaCambio, VentaItem, AutorizacionService, CuentaClienteService, DevolucionService (+11 more)

### Community 5 - "Calculo de venta (PHP=TS)"
Cohesion: 0.07
Nodes (46): casos, comparar(), ALICUOTA_IGTF, ALICUOTAS, calcular(), calcularLinea(), descuentoNxM(), LineaCalculo (+38 more)

### Community 6 - "Pruebas de operacion API"
Cohesion: 0.05
Nodes (7): OperacionTest, SeguridadTest, VentasTest, TestCase, Illuminate\Foundation\Testing\RefreshDatabase, Illuminate\Foundation\Testing\TestCase, Illuminate\Testing\TestResponse

### Community 7 - "Monitor en vivo"
Cohesion: 0.08
Nodes (9): MonitorController, VentaController, Venta, FidelizacionService, FiscalService, static, UserFactory, Illuminate\Database\Eloquent\Factories\Factory (+1 more)

### Community 8 - "Dependencias Composer"
Cohesion: 0.04
Nodes (46): pestphp/pest-plugin, php-http/discovery, autoload, autoload-dev, psr-4, psr-4, config, allow-plugins (+38 more)

### Community 9 - "Cuenta y precios masivos"
Cohesion: 0.06
Nodes (29): CuentaModal(), cambiarClave(), cambiarPin(), Props, PreciosMasivosModal(), aplicar(), previsualizar(), ProductoFormModal() (+21 more)

### Community 10 - "Empresa y promociones"
Cohesion: 0.10
Nodes (8): EmpresaController, SuperAdminController, SuscripcionController, Empresa, Suscripcion, Barryvdh\DomPDF\Facade\Pdf, Illuminate\Http\JsonResponse, Illuminate\Validation\Rule

### Community 11 - "Auth y fiscal API"
Cohesion: 0.08
Nodes (11): AuthController, FiscalController, RespaldoController, ScannerController, UserController, Controller, Auditoria, Illuminate\Support\Facades\Cache (+3 more)

### Community 12 - "Instalador y categorias"
Cohesion: 0.08
Nodes (14): Instalar, CategoriaController, RegistroController, SucursalController, Categoria, Plan, Sucursal, DemoSeeder (+6 more)

### Community 13 - "Clientes y fiado"
Cohesion: 0.13
Nodes (6): ClienteController, CompraController, PromocionController, Cliente, CompraService, Illuminate\Http\Request

### Community 14 - "Inventario y productos"
Cohesion: 0.13
Nodes (7): InventarioController, ProductoController, Inventario, Lote, PrecioHistorial, Producto, StockService

### Community 15 - "Facturacion SaaS web"
Cohesion: 0.07
Nodes (26): descargarArchivo(), fecha(), BillingPage(), cargar(), reportar(), ESTADO_COLOR, ESTADO_LABEL, METODOS (+18 more)

### Community 16 - "Middleware de seguridad"
Cohesion: 0.11
Nodes (10): CabecerasSeguridad, RequiereEmpresa, RequierePermiso, SoloSuperAdmin, UsuarioActivo, VerificarLicencia, Archivos, Permisos (+2 more)

### Community 17 - "Capturas UI y tema oscuro"
Cohesion: 0.07
Nodes (30): Captura Analisis de rentabilidad, Analisis de rentabilidad por producto (30 dias, costo/precio/margen), Captura Clientes, Lista de clientes CRM (cedula/RIF, telefono, correo), Captura Dashboard modo oscuro, Tema oscuro con selector de color de acento, Captura Caja POS modo oscuro, POS en modo oscuro (factura actual, calculadora) (+22 more)

### Community 18 - "Compras y comprobantes"
Cohesion: 0.08
Nodes (3): CompraItem, PagoLicencia, Illuminate\Database\Eloquent\Relations\BelongsTo

### Community 19 - "Analisis y monitor web"
Cohesion: 0.10
Nodes (18): AnalisisPage(), METODO, MonitorPage(), describir(), DIAS, PromocionesPage(), Accent, ACCENT_KEYS (+10 more)

### Community 20 - "Modelos Cliente y Empresa"
Cohesion: 0.08
Nodes (3): Proveedor, Illuminate\Database\Eloquent\Relations\HasMany, Illuminate\Database\Eloquent\Relations\HasOne

### Community 21 - "Comandos de respaldo y tasas"
Cohesion: 0.13
Nodes (7): Respaldar, Restaurar, SincronizarTasas, RespaldoService, TasaService, Illuminate\Console\Command, PendingRequest

### Community 22 - "Dependencias web"
Cohesion: 0.10
Nodes (22): autoprefixer, axios, postcss, tailwindcss, vite, name, private, type (+14 more)

### Community 23 - "Dependencias api js"
Cohesion: 0.09
Nodes (21): devDependencies, autoprefixer, axios, concurrently, laravel-vite-plugin, postcss, tailwindcss, vite (+13 more)

### Community 24 - "Usuario y turno de caja"
Cohesion: 0.15
Nodes (7): User, Escenario, static, Illuminate\Database\Eloquent\Factories\HasFactory, Illuminate\Foundation\Auth\User, Illuminate\Notifications\Notifiable, Laravel\Sanctum\HasApiTokens

### Community 25 - "Cliente HTTP y tokens"
Cohesion: 0.14
Nodes (14): abrirArchivo(), abrirFacturaPdf(), ErrorApi, leerError(), tokenStore, DIAS, FUENTE_INFO, TasasPage() (+6 more)

### Community 26 - "Service worker PWA"
Cohesion: 0.13
Nodes (16): addRoute(), cacheMatchIgnoreParams(), cacheWillUpdate(), canConstructResponseFromBodyStream(), copyResponse(), createHandlerBoundToURL(), Deferred, executeQuotaErrorCallbacks() (+8 more)

### Community 27 - "Modelos de devolucion y pago"
Cohesion: 0.12
Nodes (4): DevolucionItem, Pago, PuntosMovimiento, Illuminate\Database\Eloquent\Model

### Community 28 - "Config TypeScript"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+10 more)

### Community 29 - "Dev tooling eslint"
Cohesion: 0.11
Nodes (18): devDependencies, autoprefixer, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, postcss (+10 more)

### Community 30 - "Grupo 30"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+9 more)

### Community 31 - "Grupo 31"
Cohesion: 0.19
Nodes (4): createCacheKey(), PrecacheController, PrecacheRoute, WorkboxError

### Community 32 - "Grupo 32"
Cohesion: 0.18
Nodes (4): CalculadoraVenta, CalculadoraVentaTest, PHPUnit\Framework\Attributes\DataProvider, PHPUnit\Framework\TestCase

### Community 33 - "Grupo 33"
Cohesion: 0.21
Nodes (11): ACCENTS, aHex(), aRgb(), BLANCO, escala(), legible(), mezclar(), NEGRO (+3 more)

### Community 34 - "Grupo 34"
Cohesion: 0.14
Nodes (14): dependencies, axios, @fontsource-variable/inter, @fontsource-variable/space-grotesk, framer-motion, @heroui/react, html5-qrcode, lucide-react (+6 more)

### Community 35 - "Grupo 35"
Cohesion: 0.21
Nodes (3): NetworkOnly, Strategy, timeout()

### Community 38 - "Grupo 38"
Cohesion: 0.18
Nodes (6): cleanupOutdatedCaches(), _nestedGroup(), PrecacheInstallReportPlugin, printCleanupDetails(), printInstallDetails(), waitUntil()

### Community 40 - "Grupo 40"
Cohesion: 0.22
Nodes (7): EmpresasTab(), PagosTab(), confirmar(), rechazar(), PlanesTab(), cargar(), RiesgoTab()

### Community 41 - "Grupo 41"
Cohesion: 0.18
Nodes (11): CompraService (costo promedio), CuentaClienteService (fiado), DevolucionService, FacturacionService, Fiado (credito), FidelizacionService (puntos), Kardex, Precio e IVA del catalogo (+3 more)

### Community 43 - "Grupo 43"
Cohesion: 0.27
Nodes (4): DatabaseSeeder, PlanesSeeder, ProduccionSeeder, Illuminate\Database\Seeder

### Community 45 - "Grupo 45"
Cohesion: 0.33
Nodes (8): Calculadora(), borrar(), calcular(), digito(), igual(), operar(), porcentaje(), fmt()

### Community 47 - "Grupo 47"
Cohesion: 0.28
Nodes (4): NavigationRoute, RegExpRoute, registerRoute(), Route

### Community 48 - "Grupo 48"
Cohesion: 0.22
Nodes (9): API REST resumen, CajaService (turnos y arqueo), Caja por turnos, Escaner remoto (telefono a PC), Caja y turnos (presentacion), Doce herramientas, Inventario, CRM y monitor (presentacion), Presentacion comercial Boxy (+1 more)

### Community 49 - "Grupo 49"
Cohesion: 0.22
Nodes (9): CalculadoraVenta (calculo.ts mirror), IVA e IGTF, Multi-tasa (BCV, USDT), PromocionService, IVA, IGTF y bolivares (presentacion), Caracteristicas fiscales Venezuela, Crotone monorepo README, Estructura monorepo (api, web, mobile) (+1 more)

### Community 50 - "Grupo 50"
Cohesion: 0.25
Nodes (8): Bitacora de seguridad (Auditoria::registrar), Auditoria de seguridad (resuelta), Auditoria de seguridad (informe), Lo que le falta para un abasto, Informe tecnico, Plan antes de vender, SENIAT y facturacion fiscal, El sistema es vendible, pero no todavia

### Community 51 - "Grupo 51"
Cohesion: 0.25
Nodes (8): RespaldoService, Guia de despliegue, Instalacion API (boxy:instalar), Base de datos con usuario propio, Lista de control antes de entregar, Respaldos, Tareas programadas, Build web y Nginx

### Community 52 - "Grupo 52"
Cohesion: 0.33
Nodes (4): AppServiceProvider, Illuminate\Cache\RateLimiting\Limit, Illuminate\Support\Facades\RateLimiter, Illuminate\Support\ServiceProvider

### Community 53 - "Grupo 53"
Cohesion: 0.29
Nodes (6): Web index.html (Boxy PWA entry), Boxy (POS product), Crotone (empresa demo), Modos SaaS y dedicado, SaaS licencias mensuales, Elegir modo (dedicado/saas)

### Community 57 - "Grupo 57"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lan, lint, preview, test:calculo

### Community 58 - "Grupo 58"
Cohesion: 0.29
Nodes (4): ImportarProductosModal(), leerArchivo(), normalizar(), parseTipoIva()

### Community 59 - "Grupo 59"
Cohesion: 0.33
Nodes (7): Documentos no fiscales, FiscalService (TFHKA), Impresora fiscal (ampliacion opcional), estado_fiscal pendiente y reintento, IntTFHKA.exe (The Factory HKA), Puente fiscal (puente-fiscal.ps1), Integracion sin probar con equipo real

### Community 61 - "Grupo 61"
Cohesion: 0.33
Nodes (5): App(), apps_web_src_index, @fontsource-variable/inter, @fontsource-variable/space-grotesk, react-dom

### Community 67 - "Grupo 67"
Cohesion: 0.40
Nodes (4): Monolog\Handler\NullHandler, Monolog\Handler\StreamHandler, Monolog\Handler\SyslogUdpHandler, Monolog\Processor\PsrLogMessageProcessor

### Community 68 - "Grupo 68"
Cohesion: 0.40
Nodes (5): Tests workflow, StyleCI config (laravel preset), React + TypeScript + Vite template README, Stack: Laravel 12, React 19, HeroUI, Convenciones de UI HeroUI

### Community 69 - "Grupo 69"
Cohesion: 0.50
Nodes (3): Illuminate\Foundation\Application, Illuminate\Foundation\Configuration\Exceptions, Illuminate\Foundation\Configuration\Middleware

### Community 70 - "Grupo 70"
Cohesion: 0.50
Nodes (3): vite-plugin-pwa, @vitejs/plugin-basic-ssl, @vitejs/plugin-react

### Community 71 - "Grupo 71"
Cohesion: 0.67
Nodes (3): Laravel skeleton changelog (v11.x), Update Changelog workflow, Laravel default README

### Community 93 - "Grupo 93"
Cohesion: 0.67
Nodes (3): AutorizacionService (PIN supervisor), Permisos (mapa rol-permisos), SupervisorModal

## Knowledge Gaps
- **255 isolated node(s):** `$schema`, `name`, `type`, `description`, `keywords` (+250 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 488 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **56 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Documentos no fiscales` connect `Grupo 59` to `Tickets y utilidades de impresion`, `Grupo 53`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Why does `User` connect `Usuario y turno de caja` to `Dashboard y excepciones de negocio`, `Grupo 37`, `Pruebas de operacion API`, `Empresa y promociones`, `Auth y fiscal API`, `Instalador y categorias`, `Grupo 43`, `Inventario y productos`, `Middleware de seguridad`, `Compras y comprobantes`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `@heroui/react` connect `Modales y componentes web` to `Grupo 33`, `Shell de la app y Auth web`, `Tickets y utilidades de impresion`, `Cuenta y precios masivos`, `Facturacion SaaS web`, `Analisis y monitor web`, `Dependencias web`, `Cliente HTTP y tokens`, `Grupo 61`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **What connects `$schema`, `name`, `type` to the rest of the system?**
  _255 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Modales y componentes web` be split into smaller, more focused modules?**
  _Cohesion score 0.045942571785268414 - nodes in this community are weakly interconnected._
- **Should `Documentacion y alcance de Boxy` be split into smaller, more focused modules?**
  _Cohesion score 0.05230678812812224 - nodes in this community are weakly interconnected._
- **Should `Shell de la app y Auth web` be split into smaller, more focused modules?**
  _Cohesion score 0.08469449485783424 - nodes in this community are weakly interconnected._