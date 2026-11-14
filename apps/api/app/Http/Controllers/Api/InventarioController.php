<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Empresa;
use App\Models\Inventario;
use App\Models\InventarioMovimiento;
use App\Models\Lote;
use App\Models\Producto;
use App\Services\StockService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InventarioController extends Controller
{
    public function __construct(private readonly StockService $stock) {}

    /**
     * Stock actual de una sucursal: la del usuario o, para quien ve reportes o
     * gestiona productos (dueño/gerente), cualquiera de su empresa (?sucursal_id=).
     * Incluye los productos activos que aún no tienen movimientos (stock 0), para
     * que un producto recién creado aparezca en el inventario.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $verCostos = $user->puede('productos.gestionar') || $user->puede('reportes.ver');
        $sucursalId = $this->sucursalConsultada($request);

        $columnas = ['id', 'nombre', 'sku', 'codigo_barra', 'unidad', 'tipo_iva', 'precio_venta_usd', 'categoria_id',
            'imagen_path', 'controla_stock', 'pesable', 'codigo_balanza', 'activo', ...($verCostos ? ['precio_costo_usd'] : [])];
        $campos = 'producto:'.implode(',', $columnas);

        $query = Inventario::where('sucursal_id', $sucursalId)
            ->with([$campos, 'producto.categoria:id,nombre']);

        if ($request->boolean('bajo_minimo')) {
            $query->whereColumn('cantidad', '<=', 'stock_minimo');
        }

        $items = $query->get();

        if (! $request->boolean('bajo_minimo')) {
            $sinFila = Producto::where('empresa_id', $user->empresa_id)
                ->where('activo', true)
                ->whereNotIn('id', $items->pluck('producto_id'))
                ->with('categoria:id,nombre')
                ->get($columnas);
            foreach ($sinFila as $producto) {
                $fila = new Inventario(['sucursal_id' => $sucursalId, 'producto_id' => $producto->id, 'cantidad' => 0, 'stock_minimo' => 0]);
                $fila->setRelation('producto', $producto);
                $items->push($fila);
            }
        }

        // Unidades vendidas por producto (últimos 30 días) → para el indicador "hot" 🔥
        $vendidos = DB::table('venta_items')
            ->join('ventas', 'ventas.id', '=', 'venta_items.venta_id')
            ->where('ventas.empresa_id', $user->empresa_id)
            ->where('ventas.estado', 'emitida')
            ->where('ventas.fecha', '>=', now()->subDays(30))
            ->whereNotNull('venta_items.producto_id')
            ->groupBy('venta_items.producto_id')
            ->selectRaw('venta_items.producto_id as pid, SUM(venta_items.cantidad) as total')
            ->pluck('total', 'pid');

        $items->each(function ($inv) use ($vendidos) {
            $inv->vendidos_30d = (float) ($vendidos[$inv->producto_id] ?? 0);
        });

        return response()->json($items);
    }

    /** Historial (kardex) de un producto en la sucursal. */
    public function kardex(Request $request, Producto $producto): JsonResponse
    {
        abort_unless($producto->empresa_id === $request->user()->empresa_id, 404);

        $movimientos = InventarioMovimiento::where('sucursal_id', $this->sucursalConsultada($request))
            ->where('producto_id', $producto->id)
            ->with('user:id,name')
            ->latest('id')
            ->paginate($this->porPagina($request, 50));

        return response()->json($movimientos);
    }

    /**
     * Registra un movimiento manual: entrada, salida, merma o ajuste.
     * Actualiza el stock y deja traza en el kardex, todo en una transacción.
     * Una entrada puede traer lote y fecha de vencimiento.
     */
    public function movimiento(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'producto_id' => ['required', 'integer'],
            'tipo' => ['required', 'in:entrada,salida,ajuste,merma'],
            'cantidad' => ['required', 'numeric', 'min:-1000000', 'max:1000000'],
            'costo_usd' => ['nullable', 'numeric', 'min:0'],
            'stock_minimo' => ['nullable', 'numeric', 'min:0'],
            'observacion' => ['nullable', 'string', 'max:255'],
            'lote' => ['nullable', 'string', 'max:50'],
            'vence_el' => ['nullable', 'date', 'after:yesterday'],
        ]);

        $user = $request->user();
        abort_if(! $user->sucursal_id, 422, 'El usuario no tiene una sucursal asignada.');

        $producto = Producto::where('empresa_id', $user->empresa_id)->findOrFail($datos['producto_id']);

        $movimiento = DB::transaction(function () use ($datos, $user, $producto) {
            $anterior = (float) (Inventario::where('sucursal_id', $user->sucursal_id)
                ->where('producto_id', $producto->id)->lockForUpdate()->value('cantidad') ?? 0);
            $cantidad = (float) $datos['cantidad'];

            // 'ajuste' fija el stock exacto; entrada suma; salida y merma restan.
            $delta = match ($datos['tipo']) {
                'entrada' => abs($cantidad),
                'salida', 'merma' => -abs($cantidad),
                'ajuste' => $cantidad - $anterior,
            };

            $mov = $this->stock->mover($user->sucursal_id, $producto, $delta, $datos['tipo'], $user->id,
                $datos['observacion'] ?? null, null, isset($datos['costo_usd']) ? (float) $datos['costo_usd'] : null);

            // Permite fijar el stock mínimo en el mismo movimiento (alta de producto)
            if (isset($datos['stock_minimo'])) {
                Inventario::where('sucursal_id', $user->sucursal_id)->where('producto_id', $producto->id)
                    ->update(['stock_minimo' => $datos['stock_minimo']]);
            }

            if ($datos['tipo'] === 'entrada' && ! empty($datos['vence_el'])) {
                Lote::create([
                    'sucursal_id' => $user->sucursal_id,
                    'producto_id' => $producto->id,
                    'lote' => $datos['lote'] ?? null,
                    'vence_el' => $datos['vence_el'],
                    'cantidad' => abs($cantidad),
                ]);
            }

            return $mov;
        });

        return response()->json($movimiento, 201);
    }

    /**
     * Productos por vencer (o vencidos) en la sucursal.
     *
     * No se registra de qué lote sale cada venta; se estima con la regla de
     * "primero en vencer, primero en salir": el stock que queda está en los
     * lotes que vencen más tarde.
     */
    public function vencimientos(Request $request): JsonResponse
    {
        $user = $request->user();
        $dias = $request->integer('dias') ?: (int) Empresa::find($user->empresa_id)?->ajuste('vencimiento_alerta_dias', 30);
        $limite = now()->addDays($dias)->toDateString();

        $lotes = Lote::where('sucursal_id', $user->sucursal_id)
            ->with('producto:id,nombre,sku,unidad,precio_venta_usd,precio_costo_usd,empresa_id')
            ->orderBy('producto_id')->orderByDesc('vence_el')->orderByDesc('id')
            ->get()
            ->groupBy('producto_id');

        $stock = Inventario::where('sucursal_id', $user->sucursal_id)
            ->whereIn('producto_id', $lotes->keys())->pluck('cantidad', 'producto_id');

        $resultado = [];
        foreach ($lotes as $productoId => $grupo) {
            $restante = max(0.0, (float) ($stock[$productoId] ?? 0));
            foreach ($grupo as $lote) {
                $enLote = min((float) $lote->cantidad, $restante);
                $restante -= $enLote;
                if ($enLote > 0 && $lote->vence_el->toDateString() <= $limite) {
                    $diasRestantes = (int) now()->startOfDay()->diffInDays($lote->vence_el, false);
                    $resultado[] = [
                        'lote_id' => $lote->id,
                        'producto_id' => $productoId,
                        'producto' => $lote->producto?->nombre,
                        'sku' => $lote->producto?->sku,
                        'lote' => $lote->lote,
                        'vence_el' => $lote->vence_el->toDateString(),
                        'dias' => $diasRestantes,
                        'vencido' => $diasRestantes < 0,
                        'cantidad_estimada' => round($enLote, 3),
                        'valor_costo_usd' => round($enLote * (float) ($lote->producto?->precio_costo_usd ?? 0), 2),
                    ];
                }
            }
        }

        usort($resultado, fn ($a, $b) => $a['dias'] <=> $b['dias']);

        return response()->json(['dias' => $dias, 'lotes' => $resultado]);
    }

    /** Sucursal pedida (?sucursal_id=) si el usuario puede ver otras; si no, la suya. */
    private function sucursalConsultada(Request $request): ?int
    {
        $user = $request->user();
        $pedida = $request->integer('sucursal_id');
        if ($pedida && $pedida !== $user->sucursal_id) {
            abort_unless($user->puede('reportes.ver') || $user->puede('productos.gestionar'), 403, 'Solo puedes ver el inventario de tu sucursal.');
            abort_unless(DB::table('sucursales')->where('id', $pedida)->where('empresa_id', $user->empresa_id)->exists(), 404);

            return $pedida;
        }

        return $user->sucursal_id;
    }
}
