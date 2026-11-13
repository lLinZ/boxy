<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Empresa;
use App\Models\Venta;
use App\Services\DevolucionService;
use App\Services\FacturacionService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;

class VentaController extends Controller
{
    public function __construct(
        private readonly FacturacionService $facturacion,
        private readonly DevolucionService $devoluciones,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Venta::where('empresa_id', $user->empresa_id)
            ->with(['cliente:id,nombre,documento,tipo_documento', 'user:id,name'])
            ->latest('fecha');

        // Sin permiso de ver todo, cada quien ve solo su sucursal
        if (! $user->puede('ventas.ver_todas')) {
            $query->where('sucursal_id', $user->sucursal_id);
        }

        if ($desde = $request->query('desde')) {
            $query->whereDate('fecha', '>=', $desde);
        }
        if ($hasta = $request->query('hasta')) {
            $query->whereDate('fecha', '<=', $hasta);
        }
        if ($estado = $request->query('estado')) {
            $query->where('estado', $estado);
        }
        if ($clienteId = $request->integer('cliente_id')) {
            $query->where('cliente_id', $clienteId);
        }
        if ($turnoId = $request->integer('turno_id')) {
            $query->where('turno_id', $turnoId);
        }
        if ($buscar = trim((string) $request->query('buscar'))) {
            $query->where(fn ($q) => $q->where('numero_factura', 'like', "%{$buscar}%")
                ->orWhereHas('cliente', fn ($c) => $c->where('nombre', 'like', "%{$buscar}%")->orWhere('documento', 'like', "%{$buscar}%")));
        }

        return response()->json($query->paginate($this->porPagina($request)));
    }

    public function show(Request $request, Venta $venta): JsonResponse
    {
        $this->autorizar($request, $venta);

        return response()->json($venta->load([
            'items.producto:id,nombre,sku,pesable,unidad', 'pagos', 'cliente', 'user:id,name',
            'devoluciones.items', 'devoluciones.user:id,name', 'anuladaPor:id,name', 'autorizadaPor:id,name',
        ]));
    }

    /** Registra una venta a través del motor de facturación. */
    public function store(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'uuid' => ['nullable', 'uuid'],
            'origen' => ['nullable', 'in:pos,offline'],
            'cliente_id' => ['nullable', 'integer'],
            'observacion' => ['nullable', 'string', 'max:255'],
            'total_esperado_usd' => ['nullable', 'numeric'],
            'vuelto_metodo' => ['nullable', Rule::in(array_keys(FacturacionService::METODOS_VUELTO))],
            'autorizacion' => ['nullable', 'array'],
            'autorizacion.email' => ['nullable', 'email'],
            'autorizacion.pin' => ['nullable', 'string', 'max:10'],
            'items' => ['required', 'array', 'min:1', 'max:300'],
            'items.*.producto_id' => ['nullable', 'integer'],
            'items.*.descripcion' => ['nullable', 'string', 'max:255'],
            'items.*.cantidad' => ['required', 'numeric', 'gt:0', 'max:100000'],
            'items.*.precio_unitario_usd' => ['nullable', 'numeric', 'min:0'],
            'items.*.tipo_iva' => ['nullable', 'in:general,reducido,exento'],
            'items.*.descuento_usd' => ['nullable', 'numeric', 'min:0'],
            'pagos' => ['required', 'array', 'min:1', 'max:10'],
            'pagos.*.metodo' => ['required', Rule::in(array_keys(FacturacionService::METODOS))],
            'pagos.*.moneda' => ['nullable', 'in:VES,USD'],
            'pagos.*.monto' => ['required', 'numeric', 'gt:0'],
            'pagos.*.referencia' => ['nullable', 'string', 'max:255'],
        ]);

        $venta = $this->facturacion->emitir($datos, $request->user());

        return response()->json($venta, $venta->wasRecentlyCreated ? 201 : 200);
    }

    /** Anula la venta completa (con motivo y, si hace falta, PIN de supervisor). */
    public function anular(Request $request, Venta $venta): JsonResponse
    {
        $this->autorizar($request, $venta);
        $datos = $request->validate([
            'motivo' => ['required', 'string', 'min:3', 'max:255'],
            'autorizacion' => ['nullable', 'array'],
            'autorizacion.email' => ['nullable', 'email'],
            'autorizacion.pin' => ['nullable', 'string', 'max:10'],
        ]);

        return response()->json(
            $this->devoluciones->anular($venta, $request->user(), $datos['motivo'], $datos['autorizacion'] ?? null)
        );
    }

    /** Devolución parcial o total. */
    public function devolver(Request $request, Venta $venta): JsonResponse
    {
        $this->autorizar($request, $venta);
        $datos = $request->validate([
            'motivo' => ['required', 'string', 'min:3', 'max:255'],
            'metodo' => ['required', Rule::in(array_keys(DevolucionService::METODOS_REINTEGRO))],
            'items' => ['required', 'array', 'min:1', 'max:300'],
            'items.*.venta_item_id' => ['required', 'integer'],
            'items.*.cantidad' => ['required', 'numeric', 'gt:0'],
            'items.*.reintegra_stock' => ['nullable', 'boolean'],
            'autorizacion' => ['nullable', 'array'],
            'autorizacion.email' => ['nullable', 'email'],
            'autorizacion.pin' => ['nullable', 'string', 'max:10'],
        ]);

        $devolucion = $this->devoluciones->devolver(
            $venta, $request->user(), $datos['items'], $datos['metodo'], $datos['motivo'], $datos['autorizacion'] ?? null,
        );

        return response()->json($devolucion, 201);
    }

    /** PDF del comprobante (documento NO fiscal). */
    public function pdf(Request $request, Venta $venta): Response
    {
        $this->autorizar($request, $venta);

        $venta->load(['items', 'pagos', 'cliente', 'sucursal', 'user:id,name', 'devoluciones']);
        $empresa = Empresa::find($venta->empresa_id);

        // Desglose de IVA por alícuota (exento / 8% / 16%)
        $desglose = [];
        foreach ($venta->items as $item) {
            $a = (string) (float) $item->alicuota_iva;
            $desglose[$a] ??= ['alicuota' => (float) $item->alicuota_iva, 'base' => 0.0, 'iva' => 0.0];
            $desglose[$a]['base'] += (float) $item->base_usd;
            $desglose[$a]['iva'] += (float) $item->iva_usd;
        }
        ksort($desglose);

        $pdf = Pdf::loadView('factura', [
            'venta' => $venta,
            'empresa' => $empresa,
            'desglose' => array_values($desglose),
        ])->setPaper('a4');

        return $pdf->stream("comprobante-{$venta->numero_factura}.pdf");
    }

    private function autorizar(Request $request, Venta $venta): void
    {
        $user = $request->user();
        abort_unless($venta->empresa_id === $user->empresa_id, 404);
        abort_unless($user->puede('ventas.ver_todas') || $venta->sucursal_id === $user->sucursal_id, 404);
    }
}
