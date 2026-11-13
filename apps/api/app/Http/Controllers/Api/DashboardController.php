<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Inventario;
use App\Models\Producto;
use App\Models\TasaCambio;
use App\Models\Venta;
use App\Models\VentaItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    /** Métricas para el panel principal (scope: empresa del usuario). */
    public function index(Request $request): JsonResponse
    {
        $empresaId = $request->user()->empresa_id;
        $hoy = Carbon::today();

        // Ventas de hoy
        $ventasHoy = Venta::where('empresa_id', $empresaId)
            ->where('estado', 'emitida')
            ->whereDate('fecha', $hoy)
            ->selectRaw('COUNT(*) as cantidad, COALESCE(SUM(total_usd),0) as total_usd, COALESCE(SUM(total_bs),0) as total_bs')
            ->first();

        // Serie de los últimos 7 días (incluye días sin ventas, en 0)
        $desde = $hoy->copy()->subDays(6);
        $porDia = Venta::where('empresa_id', $empresaId)
            ->where('estado', 'emitida')
            ->whereDate('fecha', '>=', $desde)
            ->selectRaw('DATE(fecha) as dia, COUNT(*) as cantidad, COALESCE(SUM(total_usd),0) as total_usd')
            ->groupBy('dia')
            ->pluck('total_usd', 'dia');

        $cantidadPorDia = Venta::where('empresa_id', $empresaId)
            ->where('estado', 'emitida')
            ->whereDate('fecha', '>=', $desde)
            ->selectRaw('DATE(fecha) as dia, COUNT(*) as cantidad')
            ->groupBy('dia')
            ->pluck('cantidad', 'dia');

        $semana = [];
        for ($i = 0; $i < 7; $i++) {
            $fecha = $desde->copy()->addDays($i)->toDateString();
            $semana[] = [
                'fecha' => $fecha,
                'total_usd' => (float) ($porDia[$fecha] ?? 0),
                'cantidad' => (int) ($cantidadPorDia[$fecha] ?? 0),
            ];
        }

        // Productos bajo stock mínimo (de las sucursales de la empresa)
        $bajoStock = Inventario::whereHas('sucursal', fn ($q) => $q->where('empresa_id', $empresaId))
            ->whereColumn('cantidad', '<=', 'stock_minimo')
            ->with('producto:id,nombre,sku,unidad')
            ->orderBy('cantidad')
            ->limit(5)
            ->get();

        $bajoStockCount = Inventario::whereHas('sucursal', fn ($q) => $q->where('empresa_id', $empresaId))
            ->whereColumn('cantidad', '<=', 'stock_minimo')
            ->count();

        // Top productos vendidos (últimos 30 días)
        $topProductos = VentaItem::whereHas('venta', function ($q) use ($empresaId) {
            $q->where('empresa_id', $empresaId)
                ->where('estado', 'emitida')
                ->where('fecha', '>=', Carbon::today()->subDays(30));
        })
            ->select('descripcion', DB::raw('SUM(cantidad) as total_cantidad'), DB::raw('SUM(total_usd) as total_usd'))
            ->groupBy('descripcion')
            ->orderByDesc('total_cantidad')
            ->limit(5)
            ->get();

        // Valor del inventario a costo (USD)
        $valorInventario = Inventario::whereHas('sucursal', fn ($q) => $q->where('empresa_id', $empresaId))
            ->join('productos', 'productos.id', '=', 'inventarios.producto_id')
            ->selectRaw('COALESCE(SUM(inventarios.cantidad * productos.precio_costo_usd),0) as valor')
            ->value('valor');

        // Devoluciones de hoy (restan de lo vendido) y fiado pendiente de cobro
        $devolucionesHoy = (float) DB::table('devoluciones')->where('empresa_id', $empresaId)
            ->whereDate('created_at', $hoy)->sum('total_usd');
        $porCobrar = (float) DB::table('clientes')->where('empresa_id', $empresaId)->where('saldo_usd', '>', 0)->sum('saldo_usd');

        return response()->json([
            'hoy' => [
                'cantidad' => (int) $ventasHoy->cantidad,
                'total_usd' => (float) $ventasHoy->total_usd,
                'total_bs' => (float) $ventasHoy->total_bs,
                'devoluciones_usd' => round($devolucionesHoy, 2),
                'neto_usd' => round((float) $ventasHoy->total_usd - $devolucionesHoy, 2),
            ],
            'por_cobrar_usd' => round($porCobrar, 2),
            'semana' => $semana,
            'bajo_stock' => $bajoStock,
            'bajo_stock_count' => $bajoStockCount,
            'top_productos' => $topProductos,
            'valor_inventario_usd' => (float) $valorInventario,
            'total_productos' => Producto::where('empresa_id', $empresaId)->where('activo', true)->count(),
            'tasa' => TasaCambio::vigente(),
        ]);
    }
}
