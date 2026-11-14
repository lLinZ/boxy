<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Producto;
use App\Models\TasaCambio;
use App\Models\Venta;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Monitor en Vivo: métricas del día en tiempo real (el POS lo sondea cada ~5s)
 * y motor de recomendaciones (stock muerto, reorden, combos, ofertas, hot).
 * Ganancia = aproximada con productos.precio_costo_usd actual (etiquetada "estimada").
 */
class MonitorController extends Controller
{
    /** Métricas en vivo del día. */
    public function index(Request $request): JsonResponse
    {
        $empresaId = $request->user()->empresa_id;
        $tasaBcv = (float) (TasaCambio::vigente('BCV')->tasa ?? 0);

        return response()->json([
            'pulso' => $this->pulso($empresaId, $tasaBcv),
            'ganancia' => $this->ganancia($empresaId, $tasaBcv),
            'por_hora' => $this->porHora($empresaId),
            'pagos' => $this->pagos($empresaId),
            'igtf' => $this->igtf($empresaId, $tasaBcv),
            'cajeros' => $this->cajeros($empresaId),
            'feed' => $this->feed($empresaId),
            'tasas' => $this->tasas($tasaBcv),
            'hora_servidor' => Carbon::now()->toIso8601String(),
        ]);
    }

    /** Query base: ventas emitidas de hoy de la empresa. */
    private function ventasHoy(int $empresaId)
    {
        return Venta::where('empresa_id', $empresaId)
            ->where('estado', 'emitida')
            ->whereDate('fecha', Carbon::today());
    }

    /** P1 — Pulso: facturado hoy, tickets, ticket promedio y ritmo vs ayer a esta hora. */
    private function pulso(int $empresaId, float $tasaBcv): array
    {
        $hoy = $this->ventasHoy($empresaId)
            ->selectRaw('COUNT(*) c, COALESCE(SUM(total_usd),0) usd, COALESCE(SUM(total_bs),0) bs')
            ->first();

        $horaActual = Carbon::now()->toTimeString();

        // Ayer hasta la misma hora (comparación justa a media jornada)
        $ayerRef = (float) Venta::where('empresa_id', $empresaId)
            ->where('estado', 'emitida')
            ->whereDate('fecha', Carbon::yesterday())
            ->whereRaw('TIME(fecha) <= ?', [$horaActual])
            ->sum('total_usd');

        $hoyUsd = (float) $hoy->usd;
        $delta = $ayerRef > 0 ? ($hoyUsd - $ayerRef) / $ayerRef * 100 : null;

        $devoluciones = (float) \Illuminate\Support\Facades\DB::table('devoluciones')
            ->where('empresa_id', $empresaId)->whereDate('created_at', Carbon::today())->sum('total_usd');

        return [
            'tickets' => (int) $hoy->c,
            'total_usd' => round($hoyUsd, 2),
            'devoluciones_usd' => round($devoluciones, 2),
            'total_bs' => round((float) $hoy->bs, 2),
            'ticket_promedio_usd' => $hoy->c > 0 ? round($hoyUsd / $hoy->c, 2) : 0,
            'ayer_ref_usd' => round($ayerRef, 2),
            'delta_pct' => $delta !== null ? round($delta, 1) : null,
        ];
    }

    /** P2 — Ganancia bruta estimada del día. */
    private function ganancia(int $empresaId, float $tasaBcv): array
    {
        $r = DB::table('venta_items as vi')
            ->join('ventas as v', 'v.id', '=', 'vi.venta_id')
            ->join('productos as pr', 'pr.id', '=', 'vi.producto_id')
            ->where('v.empresa_id', $empresaId)
            ->where('v.estado', 'emitida')
            ->whereDate('v.fecha', Carbon::today())
            ->selectRaw('COALESCE(SUM((vi.precio_unitario_usd - pr.precio_costo_usd) * vi.cantidad - vi.descuento_usd),0) ganancia, COALESCE(SUM(vi.total_usd),0) ingreso')
            ->first();

        $ganancia = round((float) $r->ganancia, 2);
        $ingreso = (float) $r->ingreso;

        return [
            'ganancia_usd' => $ganancia,
            'ganancia_bs' => round($ganancia * $tasaBcv, 2),
            'margen_pct' => $ingreso > 0 ? round($ganancia / $ingreso * 100, 1) : 0,
            'estimada' => true,
        ];
    }

    /** P3 — Ventas por hora de hoy + patrón base (28 días). */
    private function porHora(int $empresaId): array
    {
        $hoy = $this->ventasHoy($empresaId)
            ->selectRaw('HOUR(fecha) h, COUNT(*) tickets, COALESCE(SUM(total_usd),0) usd')
            ->groupBy('h')->pluck('usd', 'h');

        $base = Venta::where('empresa_id', $empresaId)
            ->where('estado', 'emitida')
            ->whereBetween('fecha', [Carbon::today()->subDays(28), Carbon::yesterday()->endOfDay()])
            ->selectRaw('HOUR(fecha) h, SUM(total_usd)/COUNT(DISTINCT DATE(fecha)) usd')
            ->groupBy('h')->pluck('usd', 'h');

        $horas = [];
        for ($h = 0; $h < 24; $h++) {
            $horas[] = [
                'hora' => $h,
                'usd' => round((float) ($hoy[$h] ?? 0), 2),
                'base' => round((float) ($base[$h] ?? 0), 2),
            ];
        }

        // Ventas de la última hora
        $ultimaHora = (float) Venta::where('empresa_id', $empresaId)
            ->where('estado', 'emitida')
            ->where('fecha', '>=', Carbon::now()->subHour())
            ->sum('total_usd');

        return ['horas' => $horas, 'ultima_hora_usd' => round($ultimaHora, 2)];
    }

    /** P4 — Mix de medios de pago + % divisa. */
    private function pagos(int $empresaId): array
    {
        $filas = DB::table('pagos as p')
            ->join('ventas as v', 'v.id', '=', 'p.venta_id')
            ->where('v.empresa_id', $empresaId)
            ->where('v.estado', 'emitida')
            ->whereDate('v.fecha', Carbon::today())
            ->selectRaw('p.metodo, COUNT(*) ops, COALESCE(SUM(p.monto_usd),0) usd')
            ->groupBy('p.metodo')
            ->orderByDesc('usd')
            ->get();

        $totalUsd = (float) $filas->sum('usd');
        $divisaUsd = (float) $filas->whereIn('metodo', ['efectivo_usd', 'zelle', 'usdt'])->sum('usd');

        return [
            'metodos' => $filas->map(fn ($f) => [
                'metodo' => $f->metodo,
                'ops' => (int) $f->ops,
                'usd' => round((float) $f->usd, 2),
                'pct' => $totalUsd > 0 ? round((float) $f->usd / $totalUsd * 100, 1) : 0,
            ])->values(),
            'pct_divisa' => $totalUsd > 0 ? round($divisaUsd / $totalUsd * 100, 1) : 0,
            'total_usd' => round($totalUsd, 2),
        ];
    }

    /** P5 — IGTF acumulado del día (origen real: tabla pagos). */
    private function igtf(int $empresaId, float $tasaBcv): array
    {
        $r = DB::table('pagos as p')
            ->join('ventas as v', 'v.id', '=', 'p.venta_id')
            ->where('v.empresa_id', $empresaId)
            ->where('v.estado', 'emitida')
            ->whereDate('v.fecha', Carbon::today())
            ->where('p.igtf_usd', '>', 0)
            ->selectRaw('COALESCE(SUM(p.igtf_usd),0) igtf, COUNT(*) ops')
            ->first();

        $igtf = round((float) $r->igtf, 2);

        return [
            'igtf_usd' => $igtf,
            'igtf_bs' => round($igtf * $tasaBcv, 2),
            'ops' => (int) $r->ops,
        ];
    }

    /** P6 — Ranking de cajeros del día. */
    private function cajeros(int $empresaId): array
    {
        return DB::table('ventas as v')
            ->join('users as u', 'u.id', '=', 'v.user_id')
            ->where('v.empresa_id', $empresaId)
            ->whereDate('v.fecha', Carbon::today())
            ->selectRaw("u.id, u.name,
                COUNT(CASE WHEN v.estado='emitida' THEN 1 END) tickets,
                COALESCE(SUM(CASE WHEN v.estado='emitida' THEN v.total_usd END),0) usd,
                COUNT(CASE WHEN v.estado='anulada' THEN 1 END) anuladas")
            ->groupBy('u.id', 'u.name')
            ->orderByDesc('usd')
            ->get()
            ->map(fn ($c) => [
                'nombre' => $c->name,
                'tickets' => (int) $c->tickets,
                'usd' => round((float) $c->usd, 2),
                'ticket_promedio' => $c->tickets > 0 ? round((float) $c->usd / $c->tickets, 2) : 0,
                'anuladas' => (int) $c->anuladas,
            ])->all();
    }

    /** P7 — Feed de las últimas ventas (ticker en vivo). */
    private function feed(int $empresaId): array
    {
        return $this->ventasHoy($empresaId)
            ->with(['user:id,name', 'pagos:id,venta_id,metodo,monto_usd'])
            ->withCount('items')
            ->latest('fecha')
            ->limit(15)
            ->get()
            ->map(function (Venta $v) {
                $dominante = $v->pagos->sortByDesc('monto_usd')->first();

                return [
                    'id' => $v->id,
                    'numero' => $v->numero_factura,
                    'hora' => $v->fecha->format('H:i:s'),
                    'total_usd' => round((float) $v->total_usd, 2),
                    'total_bs' => round((float) $v->total_bs, 2),
                    'cajero' => $v->user?->name,
                    'items' => $v->items_count,
                    'metodo' => $dominante?->metodo,
                ];
            })->all();
    }

    /** P8 — Tasa BCV vigente + brecha con USDT + antigüedad. */
    private function tasas(float $tasaBcv): array
    {
        $bcv = TasaCambio::vigente('BCV');
        $usdt = TasaCambio::vigente('USDT');

        $brecha = ($bcv && $usdt && $bcv->tasa > 0)
            ? ($usdt->tasa / $bcv->tasa - 1) * 100
            : null;

        $antiguedad = $bcv ? Carbon::parse($bcv->fecha)->startOfDay()->diffInDays(Carbon::today()) : null;

        return [
            'bcv' => $tasaBcv,
            'usdt' => $usdt ? (float) $usdt->tasa : null,
            'brecha_pct' => $brecha !== null ? round($brecha, 1) : null,
            'antiguedad_dias' => $antiguedad,
            'desactualizada' => $antiguedad !== null && $antiguedad >= 1,
        ];
    }

    /**
     * Motor de recomendaciones: stock muerto, reorden por velocidad,
     * combos (market basket), ofertas para stock alto de baja rotación, y hot.
     */
    public function recomendaciones(Request $request): JsonResponse
    {
        $empresaId = $request->user()->empresa_id;

        // Ventas por producto en distintas ventanas (1 query)
        $ventana = DB::table('venta_items as vi')
            ->join('ventas as v', 'v.id', '=', 'vi.venta_id')
            ->where('v.empresa_id', $empresaId)
            ->where('v.estado', 'emitida')
            ->where('v.fecha', '>=', Carbon::today()->subDays(30))
            ->whereNotNull('vi.producto_id')
            ->selectRaw('vi.producto_id,
                SUM(vi.cantidad) v30,
                SUM(CASE WHEN v.fecha >= ? THEN vi.cantidad ELSE 0 END) v7,
                SUM(CASE WHEN v.fecha >= ? AND v.fecha < ? THEN vi.cantidad ELSE 0 END) v7prev,
                MAX(v.fecha) ultima',
                [Carbon::today()->subDays(7), Carbon::today()->subDays(14), Carbon::today()->subDays(7)])
            ->groupBy('vi.producto_id')
            ->get()->keyBy('producto_id');

        // Productos activos con stock total y costo/precio
        $productos = Producto::where('empresa_id', $empresaId)
            ->where('activo', true)
            ->with('categoria:id,nombre')
            ->withSum('inventarios as stock', 'cantidad')
            ->withMin('inventarios as stock_minimo', 'stock_minimo')
            ->get();

        $stockMuerto = [];
        $reorden = [];
        $ofertas = [];
        $hot = [];

        foreach ($productos as $p) {
            if (! $p->controla_stock) {
                continue;
            }
            $stock = (float) ($p->stock ?? 0);
            $min = (float) ($p->stock_minimo ?? 0);
            $stats = $ventana[$p->id] ?? null;
            $v30 = $stats ? (float) $stats->v30 : 0;
            $v7 = $stats ? (float) $stats->v7 : 0;
            $v7prev = $stats ? (float) $stats->v7prev : 0;
            $velocidadDia = $v30 / 30;
            $costo = (float) $p->precio_costo_usd;
            $venta = (float) $p->precio_venta_usd;

            // 1) Stock muerto: hay existencia pero sin ventas en 30 días
            if ($stock > 0 && $v30 == 0) {
                $diasSinVenta = $stats && $stats->ultima
                    ? Carbon::parse($stats->ultima)->diffInDays(Carbon::now())
                    : null;
                $stockMuerto[] = [
                    'producto' => $p->nombre,
                    'stock' => $stock,
                    'capital_inmovilizado_usd' => round($stock * $costo, 2),
                    'dias_sin_venta' => $diasSinVenta,
                ];
            }

            // 2) Reorden: se agota pronto según su velocidad
            if ($velocidadDia > 0) {
                $cobertura = $stock / $velocidadDia;
                if ($cobertura < 7) {
                    $reorden[] = [
                        'producto' => $p->nombre,
                        'stock' => $stock,
                        'velocidad_dia' => round($velocidadDia, 2),
                        'dias_cobertura' => round($cobertura, 1),
                        'sugerido_reponer' => max(1, (int) ceil($velocidadDia * 14 - $stock)),
                    ];
                }

                // 4) Oferta: stock alto + baja rotación (mucha cobertura)
                if ($cobertura > 45 && $stock * $costo >= 5) {
                    $ofertas[] = [
                        'producto' => $p->nombre,
                        'stock' => $stock,
                        'dias_cobertura' => round($cobertura, 0),
                        'capital_inmovilizado_usd' => round($stock * $costo, 2),
                        'descuento_sugerido_pct' => $venta > $costo * 1.2 ? 10 : 5,
                    ];
                }
            }

            // 5) Hot: aceleración de ventas (7d vs 7d previos)
            if ($v7 > 0 && $v7 > $v7prev) {
                $hot[] = [
                    'producto' => $p->nombre,
                    'vendidos_7d' => $v7,
                    'vendidos_7d_previo' => $v7prev,
                    'crecimiento_pct' => $v7prev > 0 ? round(($v7 - $v7prev) / $v7prev * 100, 0) : 100,
                ];
            }
        }

        // 3) Combos: productos comprados juntos (market basket, 30 días)
        $combos = DB::table('venta_items as a')
            ->join('venta_items as b', function ($j) {
                $j->on('a.venta_id', '=', 'b.venta_id')->whereColumn('a.producto_id', '<', 'b.producto_id');
            })
            ->join('ventas as v', 'v.id', '=', 'a.venta_id')
            ->join('productos as pa', 'pa.id', '=', 'a.producto_id')
            ->join('productos as pb', 'pb.id', '=', 'b.producto_id')
            ->where('v.empresa_id', $empresaId)
            ->where('v.estado', 'emitida')
            ->where('v.fecha', '>=', Carbon::today()->subDays(30))
            ->selectRaw('pa.nombre n1, pb.nombre n2, COUNT(*) veces')
            ->groupBy('n1', 'n2')
            ->having('veces', '>=', 2)
            ->orderByDesc('veces')
            ->limit(5)
            ->get()
            ->map(fn ($c) => ['producto_a' => $c->n1, 'producto_b' => $c->n2, 'veces' => (int) $c->veces])
            ->all();

        // Ordenar y recortar
        usort($stockMuerto, fn ($a, $b) => $b['capital_inmovilizado_usd'] <=> $a['capital_inmovilizado_usd']);
        usort($reorden, fn ($a, $b) => $a['dias_cobertura'] <=> $b['dias_cobertura']);
        usort($ofertas, fn ($a, $b) => $b['capital_inmovilizado_usd'] <=> $a['capital_inmovilizado_usd']);
        usort($hot, fn ($a, $b) => $b['crecimiento_pct'] <=> $a['crecimiento_pct']);

        return response()->json([
            'stock_muerto' => array_slice($stockMuerto, 0, 8),
            'reorden' => array_slice($reorden, 0, 8),
            'combos' => $combos,
            'ofertas' => array_slice($ofertas, 0, 8),
            'hot' => array_slice($hot, 0, 8),
        ]);
    }
}
