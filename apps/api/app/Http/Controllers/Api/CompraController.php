<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Compra;
use App\Models\Proveedor;
use App\Services\CompraService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Compras a proveedores y proveedores. */
class CompraController extends Controller
{
    public function __construct(private readonly CompraService $compras) {}

    public function index(Request $request): JsonResponse
    {
        $query = Compra::where('empresa_id', $request->user()->empresa_id)
            ->with(['proveedor:id,nombre', 'user:id,name'])
            ->withCount('items')
            ->latest('fecha')->latest('id');

        if ($proveedorId = $request->integer('proveedor_id')) {
            $query->where('proveedor_id', $proveedorId);
        }
        if ($request->boolean('por_pagar')) {
            $query->where('pagada', false)->where('estado', 'registrada');
        }
        if ($desde = $request->query('desde')) {
            $query->whereDate('fecha', '>=', $desde);
        }
        if ($hasta = $request->query('hasta')) {
            $query->whereDate('fecha', '<=', $hasta);
        }

        return response()->json($query->paginate($this->porPagina($request)));
    }

    public function show(Request $request, Compra $compra): JsonResponse
    {
        $this->autorizar($request, $compra);

        return response()->json($compra->load(['items.producto:id,nombre,sku,unidad', 'proveedor', 'user:id,name']));
    }

    public function store(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'proveedor_id' => ['nullable', 'integer'],
            'documento_proveedor' => ['nullable', 'string', 'max:50'],
            'fecha' => ['nullable', 'date', 'before_or_equal:today'],
            'moneda' => ['required', 'in:USD,VES'],
            'tasa' => ['nullable', 'numeric', 'gt:0'],
            'condicion' => ['required', 'in:contado,credito'],
            'vence_el' => ['nullable', 'date'],
            'observacion' => ['nullable', 'string', 'max:255'],
            'items' => ['required', 'array', 'min:1', 'max:500'],
            'items.*.producto_id' => ['required', 'integer'],
            'items.*.cantidad' => ['required', 'numeric', 'gt:0', 'max:1000000'],
            'items.*.costo_unitario' => ['required', 'numeric', 'min:0', 'max:100000000'],
            'items.*.iva_pct' => ['nullable', 'in:0,8,16'],
            'items.*.lote' => ['nullable', 'string', 'max:50'],
            'items.*.vence_el' => ['nullable', 'date'],
            'items.*.precio_venta_usd' => ['nullable', 'numeric', 'gt:0', 'max:1000000'],
        ]);

        return response()->json($this->compras->registrar($datos, $request->user()), 201);
    }

    public function anular(Request $request, Compra $compra): JsonResponse
    {
        $this->autorizar($request, $compra);

        return response()->json($this->compras->anular($compra, $request->user()));
    }

    public function marcarPagada(Request $request, Compra $compra): JsonResponse
    {
        $this->autorizar($request, $compra);
        $compra->update(['pagada' => true]);

        return response()->json($compra);
    }

    // ───────── Proveedores ─────────

    public function proveedores(Request $request): JsonResponse
    {
        $query = Proveedor::where('empresa_id', $request->user()->empresa_id)
            ->withCount('compras')
            ->withSum(['compras as total_comprado_usd' => fn ($q) => $q->where('estado', 'registrada')], 'total_usd')
            ->orderBy('nombre');

        if ($buscar = trim((string) $request->query('buscar'))) {
            $query->where(fn ($q) => $q->where('nombre', 'like', "%{$buscar}%")->orWhere('documento', 'like', "%{$buscar}%"));
        }
        if ($request->boolean('solo_activos')) {
            $query->where('activo', true);
        }

        return response()->json($query->get());
    }

    public function guardarProveedor(Request $request, ?Proveedor $proveedor = null): JsonResponse
    {
        if ($proveedor?->exists) {
            abort_unless($proveedor->empresa_id === $request->user()->empresa_id, 404);
        }

        $datos = $request->validate([
            'tipo_documento' => ['required', 'in:V,E,J,G,P'],
            'documento' => ['nullable', 'string', 'max:20'],
            'nombre' => ['required', 'string', 'max:255'],
            'contacto' => ['nullable', 'string', 'max:255'],
            'telefono' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:255'],
            'direccion' => ['nullable', 'string', 'max:255'],
            'notas' => ['nullable', 'string', 'max:2000'],
            'activo' => ['boolean'],
        ]);

        if ($proveedor?->exists) {
            $proveedor->update($datos);
        } else {
            $proveedor = Proveedor::create($datos + ['empresa_id' => $request->user()->empresa_id]);
        }

        return response()->json($proveedor, $proveedor->wasRecentlyCreated ? 201 : 200);
    }

    private function autorizar(Request $request, Compra $compra): void
    {
        abort_unless($compra->empresa_id === $request->user()->empresa_id, 404);
    }
}
