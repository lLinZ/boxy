<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CajaController;
use App\Http\Controllers\Api\CategoriaController;
use App\Http\Controllers\Api\ClienteController;
use App\Http\Controllers\Api\CompraController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\EmpresaController;
use App\Http\Controllers\Api\FiscalController;
use App\Http\Controllers\Api\InventarioController;
use App\Http\Controllers\Api\MonitorController;
use App\Http\Controllers\Api\ProductoController;
use App\Http\Controllers\Api\PromocionController;
use App\Http\Controllers\Api\RegistroController;
use App\Http\Controllers\Api\RespaldoController;
use App\Http\Controllers\Api\ScannerController;
use App\Http\Controllers\Api\SucursalController;
use App\Http\Controllers\Api\SuperAdminController;
use App\Http\Controllers\Api\SuscripcionController;
use App\Http\Controllers\Api\TasaCambioController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\VentaController;
use Illuminate\Support\Facades\Route;

/*
| Permisos por rol: ver App\Support\Permisos. Cada ruta de operación declara
| el permiso que exige (middleware "permiso:..."); la web usa la misma lista.
*/

// ───────── Público (sin auth, con límite de intentos) ─────────
Route::get('/config', [RegistroController::class, 'configuracion']);
Route::get('/planes', [RegistroController::class, 'planes']);                                       // pricing landing
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:login');
Route::post('/registro', [RegistroController::class, 'registrar'])->middleware('throttle:registro');     // onboarding SaaS
Route::post('/scanner/canjear', [ScannerController::class, 'canjear'])->middleware('throttle:scanner-canje'); // teléfono

// ───────── Teléfono-escáner: su token solo sirve para encolar lecturas ─────────
Route::middleware(['auth:sanctum', 'activo', 'ability:'.ScannerController::HABILIDAD, 'licencia', 'plan:escaner_remoto'])
    ->post('scanner/scan', [ScannerController::class, 'scan']);

// ───────── Puente de la impresora fiscal: token de solo "fiscal" ─────────
Route::middleware(['auth:sanctum', 'activo', 'ability:'.FiscalController::HABILIDAD, 'licencia'])
    ->prefix('fiscal/puente')->group(function () {
        Route::get('pendientes', [FiscalController::class, 'pendientes']);
        Route::post('ventas/{venta}/resultado', [FiscalController::class, 'resultado']);
    });

// ───────── Sesión completa (login web) ─────────
Route::middleware(['auth:sanctum', 'activo', 'abilities:*'])->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::post('/cuenta/clave', [AuthController::class, 'cambiarClave']);
    Route::post('/cuenta/pin', [AuthController::class, 'cambiarPin']);

    // Billing del cliente (NO gateado por licencia: un tenant vencido debe poder pagar)
    Route::middleware('empresa')->group(function () {
        Route::get('suscripcion', [SuscripcionController::class, 'mostrar']);
        Route::middleware('permiso:licencia.gestionar')->group(function () {
            Route::get('suscripcion/pagos', [SuscripcionController::class, 'pagos']);
            Route::get('suscripcion/pagos/{pago}/comprobante', [SuscripcionController::class, 'comprobante']);
            Route::post('suscripcion/pago', [SuscripcionController::class, 'reportarPago']);
        });
    });

    // Panel del dueño del SaaS (super-admin)
    Route::middleware('superadmin')->prefix('admin')->group(function () {
        Route::get('metricas', [SuperAdminController::class, 'metricas']);
        Route::get('ingresos', [SuperAdminController::class, 'ingresos']);
        Route::get('riesgo', [SuperAdminController::class, 'riesgo']);
        // Empresas
        Route::get('empresas', [SuperAdminController::class, 'empresas']);
        Route::post('empresas', [SuperAdminController::class, 'crearEmpresa']);
        Route::get('empresas/{empresa}', [SuperAdminController::class, 'empresaDetalle']);
        Route::post('empresas/{empresa}/suspender', [SuperAdminController::class, 'suspender']);
        Route::post('empresas/{empresa}/activar', [SuperAdminController::class, 'activar']);
        Route::post('empresas/{empresa}/extender', [SuperAdminController::class, 'extenderVigencia']);
        Route::post('empresas/{empresa}/plan', [SuperAdminController::class, 'cambiarPlan']);
        // Pagos
        Route::get('pagos', [SuperAdminController::class, 'pagos']);
        Route::get('pagos/{pago}/comprobante', [SuperAdminController::class, 'comprobante']);
        Route::post('pagos/{pago}/confirmar', [SuperAdminController::class, 'confirmarPago']);
        Route::post('pagos/{pago}/rechazar', [SuperAdminController::class, 'rechazarPago']);
        // Planes
        Route::get('planes', [SuperAdminController::class, 'planes']);
        Route::post('planes', [SuperAdminController::class, 'crearPlan']);
        Route::put('planes/{plan}', [SuperAdminController::class, 'actualizarPlan']);
    });

    // Respaldos de la base (super-admin; en modo dedicado también el admin)
    Route::middleware('permiso:respaldos.gestionar')->group(function () {
        Route::get('respaldos', [RespaldoController::class, 'index']);
        Route::post('respaldos', [RespaldoController::class, 'store'])->middleware('throttle:6,1');
        Route::get('respaldos/{archivo}', [RespaldoController::class, 'descargar']);
    });

    // ───────── Funcionalidad del sistema (requiere licencia activa) ─────────
    Route::middleware('licencia')->group(function () {
        // Tasas de cambio (globales). Las ve cualquiera; cargarlas a mano, solo super-admin.
        Route::get('tasas/vigentes', [TasaCambioController::class, 'vigentes']);
        Route::get('tasas/vigente', [TasaCambioController::class, 'vigente']);
        Route::get('tasas', [TasaCambioController::class, 'index']);
        Route::post('tasas/sincronizar', [TasaCambioController::class, 'sincronizar'])
            ->middleware(['permiso:tasas.sincronizar', 'throttle:6,1']);
        Route::post('tasas', [TasaCambioController::class, 'store'])->middleware('permiso:tasas.editar');

        // Todo lo demás es de una empresa (el super-admin no opera tiendas)
        Route::middleware('empresa')->group(function () {
            // Panel principal + monitor
            Route::middleware('permiso:reportes.ver')->group(function () {
                Route::get('dashboard', [DashboardController::class, 'index']);
                // Funciones según el plan contratado
                Route::middleware('plan:monitor')->group(function () {
                    Route::get('monitor', [MonitorController::class, 'index']);
                    Route::get('monitor/recomendaciones', [MonitorController::class, 'recomendaciones']);
                });
                Route::get('productos/metricas', [ProductoController::class, 'metricas'])->middleware('plan:analisis');
            });

            // Datos de la empresa y sucursales
            Route::get('empresa', [EmpresaController::class, 'show']);
            Route::get('sucursales', [SucursalController::class, 'index']);
            Route::get('plan', [SucursalController::class, 'plan']); // límites, uso y funciones del plan
            Route::middleware('permiso:empresa.configurar')->group(function () {
                Route::put('empresa', [EmpresaController::class, 'update']);
                Route::post('empresa/logo', [EmpresaController::class, 'subirLogo']);
                Route::post('sucursales', [SucursalController::class, 'store']);
                Route::put('sucursales/{sucursal}', [EmpresaController::class, 'actualizarSucursal']);
                // Impresora fiscal (administración de la cola)
                Route::post('fiscal/clave', [FiscalController::class, 'generarClave']);
                Route::get('fiscal/estado', [FiscalController::class, 'estado']);
                Route::post('fiscal/ventas/{venta}/reintentar', [FiscalController::class, 'reintentar']);
            });

            // Usuarios
            Route::apiResource('usuarios', UserController::class)
                ->only(['index', 'store', 'update', 'destroy'])
                ->parameters(['usuarios' => 'usuario'])
                ->middleware('permiso:usuarios.gestionar');

            // Escáner remoto (la PC de la caja)
            Route::middleware('permiso:ventas.crear')->group(function () {
                Route::post('scanner/emparejar', [ScannerController::class, 'emparejar'])->middleware('plan:escaner_remoto');
                Route::get('scanner/cola', [ScannerController::class, 'cola']);
            });

            // Catálogo (consulta para todos; cambios con permiso)
            Route::get('categorias', [CategoriaController::class, 'index']);
            Route::get('productos', [ProductoController::class, 'index']);
            Route::get('productos/codigo-barra/{codigo}', [ProductoController::class, 'porCodigoBarra']);
            Route::get('productos/{producto}', [ProductoController::class, 'show'])->whereNumber('producto');
            Route::middleware('permiso:productos.gestionar')->group(function () {
                Route::post('categorias', [CategoriaController::class, 'store']);
                Route::put('categorias/{categoria}', [CategoriaController::class, 'update']);
                Route::delete('categorias/{categoria}', [CategoriaController::class, 'destroy']);
                Route::post('productos', [ProductoController::class, 'store']);
                Route::post('productos/importar', [ProductoController::class, 'importar']);
                Route::put('productos/{producto}', [ProductoController::class, 'update']);
                Route::delete('productos/{producto}', [ProductoController::class, 'destroy']);
                Route::post('productos/{producto}/imagen', [ProductoController::class, 'subirImagen']);
                Route::get('productos/{producto}/precios', [ProductoController::class, 'historialPrecios']);
            });
            Route::post('productos/precios-masivos', [ProductoController::class, 'preciosMasivos'])
                ->middleware('permiso:precios.gestionar');

            // Inventario
            Route::get('inventario', [InventarioController::class, 'index']);
            Route::get('inventario/kardex/{producto}', [InventarioController::class, 'kardex'])
                ->middleware('permiso:inventario.movimientos,productos.gestionar,reportes.ver');
            Route::get('inventario/vencimientos', [InventarioController::class, 'vencimientos'])
                ->middleware('permiso:inventario.movimientos,reportes.ver');
            Route::post('inventario/movimiento', [InventarioController::class, 'movimiento'])
                ->middleware('permiso:inventario.movimientos');

            // Compras y proveedores
            Route::middleware('permiso:compras.gestionar')->group(function () {
                Route::get('proveedores', [CompraController::class, 'proveedores']);
                Route::post('proveedores', [CompraController::class, 'guardarProveedor']);
                Route::put('proveedores/{proveedor}', [CompraController::class, 'guardarProveedor']);
                Route::get('compras', [CompraController::class, 'index']);
                Route::post('compras', [CompraController::class, 'store']);
                Route::get('compras/{compra}', [CompraController::class, 'show']);
                Route::post('compras/{compra}/anular', [CompraController::class, 'anular']);
                Route::post('compras/{compra}/pagada', [CompraController::class, 'marcarPagada']);
            });

            // Promociones
            Route::get('promociones/vigentes', [PromocionController::class, 'vigentes'])->middleware('permiso:ventas.crear');
            Route::apiResource('promociones', PromocionController::class)->except('show')
                ->parameters(['promociones' => 'promocion'])
                ->middleware('permiso:promociones.gestionar');

            // Clientes (CRM) y fiado
            Route::get('clientes/por-cobrar', [ClienteController::class, 'porCobrar'])
                ->middleware('permiso:fiado.configurar,reportes.ver');
            Route::middleware('permiso:clientes.gestionar')->group(function () {
                Route::get('clientes', [ClienteController::class, 'index']);
                Route::post('clientes', [ClienteController::class, 'store']);
                Route::get('clientes/{cliente}', [ClienteController::class, 'show']);
                Route::put('clientes/{cliente}', [ClienteController::class, 'update']);
                Route::get('clientes/{cliente}/cuenta', [ClienteController::class, 'cuenta']);
                Route::get('clientes/{cliente}/puntos', [ClienteController::class, 'puntos']);
            });
            Route::delete('clientes/{cliente}', [ClienteController::class, 'destroy'])->middleware('permiso:clientes.eliminar');
            Route::post('clientes/{cliente}/abonos', [ClienteController::class, 'abonar'])->middleware('permiso:fiado.abonar');

            // Caja por turnos
            Route::middleware('permiso:caja.operar')->prefix('caja')->group(function () {
                Route::get('actual', [CajaController::class, 'actual']);
                Route::post('abrir', [CajaController::class, 'abrir']);
                Route::get('turnos', [CajaController::class, 'index']);
                Route::get('turnos/{turno}', [CajaController::class, 'show']);
                Route::post('turnos/{turno}/cerrar', [CajaController::class, 'cerrar']);
            });

            // Ventas (anular/devolver: el servicio exige permiso o PIN de supervisor)
            Route::middleware('permiso:ventas.crear,ventas.ver_todas')->group(function () {
                Route::get('ventas', [VentaController::class, 'index']);
                Route::get('ventas/{venta}', [VentaController::class, 'show']);
                Route::get('ventas/{venta}/pdf', [VentaController::class, 'pdf']);
            });
            Route::middleware('permiso:ventas.crear')->group(function () {
                Route::post('ventas', [VentaController::class, 'store']);
                Route::post('ventas/{venta}/anular', [VentaController::class, 'anular']);
                Route::post('ventas/{venta}/devoluciones', [VentaController::class, 'devolver']);
            });
        });
    });
});
