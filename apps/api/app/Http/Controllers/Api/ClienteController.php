<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ReglaNegocioException;
use App\Http\Controllers\Controller;
use App\Models\Cliente;
use App\Models\CuentaMovimiento;
use App\Models\PuntosMovimiento;
use App\Services\CajaService;
use App\Services\CuentaClienteService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Clientes (CRM): ficha con historial y estadísticas, fiado con abonos y
 * estado de cuenta, y puntos de fidelización.
 */
class ClienteController extends Controller
{
    public function __construct(
        private readonly CuentaClienteService $cuentas,
        private readonly CajaService $caja,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = Cliente::where('empresa_id', $request->user()->empresa_id);

        if ($buscar = trim((string) $request->query('buscar'))) {
            $query->where(function ($q) use ($buscar) {
                $q->where('nombre', 'like', "%{$buscar}%")
                    ->orWhere('documento', 'like', "%{$buscar}%")
                    ->orWhere('telefono', 'like', "%{$buscar}%");
            });
        }
        if ($request->boolean('con_deuda')) {
            $query->where('saldo_usd', '>', 0);
        }

        $orden = $request->query('orden') === 'deuda' ? ['saldo_usd', 'desc'] : ['nombre', 'asc'];

        return response()->json($query->orderBy(...$orden)->paginate($this->porPagina($request)));
    }

    /** Ficha del cliente: datos, estadísticas de compra, productos favoritos y últimas compras. */
    public function show(Request $request, Cliente $cliente): JsonResponse
    {
        $this->autorizar($request, $cliente);

        $ventas = DB::table('ventas')->where('cliente_id', $cliente->id)->where('estado', 'emitida');
        $stats = (clone $ventas)->selectRaw(
            'COUNT(*) compras, COALESCE(SUM(total_usd - devuelto_usd),0) total_usd, MIN(fecha) primera, MAX(fecha) ultima'
        )->first();

        $compras = (int) $stats->compras;
        $diasCliente = $stats->primera ? max(1, now()->diffInDays($stats->primera, true)) : 0;

        $favoritos = DB::table('venta_items')
            ->join('ventas', 'ventas.id', '=', 'venta_items.venta_id')
            ->where('ventas.cliente_id', $cliente->id)
            ->where('ventas.estado', 'emitida')
            ->groupBy('venta_items.descripcion')
            ->selectRaw('venta_items.descripcion producto, SUM(venta_items.cantidad) cantidad, SUM(venta_items.total_usd) total_usd, COUNT(DISTINCT ventas.id) veces')
            ->orderByDesc('veces')->orderByDesc('total_usd')
            ->limit(8)->get();

        $ultimas = (clone $ventas)->orderByDesc('fecha')->limit(10)
            ->get(['id', 'numero_factura', 'fecha', 'total_usd', 'total_bs', 'devuelto_usd']);

        $porMes = (clone $ventas)->where('fecha', '>=', now()->subMonths(6)->startOfMonth())
            ->selectRaw("DATE_FORMAT(fecha, '%Y-%m') mes, COUNT(*) compras, SUM(total_usd) total_usd")
            ->groupBy('mes')->orderBy('mes')->get();

        return response()->json([
            'cliente' => $cliente,
            'estadisticas' => [
                'compras' => $compras,
                'total_usd' => round((float) $stats->total_usd, 2),
                'ticket_promedio_usd' => $compras ? round($stats->total_usd / $compras, 2) : 0,
                'primera_compra' => $stats->primera,
                'ultima_compra' => $stats->ultima,
                'dias_sin_comprar' => $stats->ultima ? (int) now()->diffInDays($stats->ultima, true) : null,
                // Cada cuántos días compra, en promedio
                'frecuencia_dias' => $compras > 1 ? round($diasCliente / ($compras - 1), 1) : null,
            ],
            'favoritos' => $favoritos,
            'ultimas_compras' => $ultimas,
            'por_mes' => $porMes,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $datos = $this->validar($request);
        $datos['empresa_id'] = $request->user()->empresa_id;

        if (! empty($datos['credito_habilitado']) && ! isset($datos['limite_credito_usd'])) {
            $datos['limite_credito_usd'] = $request->user()->empresa->ajuste('fiado_limite_defecto_usd');
        }

        $cliente = Cliente::create($datos);

        return response()->json($cliente, 201);
    }

    public function update(Request $request, Cliente $cliente): JsonResponse
    {
        $this->autorizar($request, $cliente);
        $cliente->update($this->validar($request, $cliente));

        return response()->json($cliente);
    }

    public function destroy(Request $request, Cliente $cliente): JsonResponse
    {
        $this->autorizar($request, $cliente);
        if ((float) $cliente->saldo_usd != 0.0) {
            throw new ReglaNegocioException('El cliente tiene saldo pendiente en su cuenta: no se puede eliminar.');
        }
        $cliente->delete();

        return response()->json(['message' => 'Cliente eliminado.']);
    }

    /** Estado de cuenta (fiado): movimientos con saldo corrido. */
    public function cuenta(Request $request, Cliente $cliente): JsonResponse
    {
        $this->autorizar($request, $cliente);

        $movimientos = CuentaMovimiento::where('cliente_id', $cliente->id)
            ->with(['venta:id,numero_factura', 'user:id,name'])
            ->orderByDesc('id')
            ->paginate($this->porPagina($request, 50));

        // Antigüedad de la deuda: días desde el cargo más viejo que aún no se ha cubierto
        $antiguedad = null;
        if ((float) $cliente->saldo_usd > 0) {
            $ultimoEnCero = CuentaMovimiento::where('cliente_id', $cliente->id)->where('saldo_usd', '<=', 0)->max('id') ?? 0;
            $primerCargo = CuentaMovimiento::where('cliente_id', $cliente->id)->where('id', '>', $ultimoEnCero)
                ->where('tipo', 'cargo')->min('created_at');
            $antiguedad = $primerCargo ? (int) now()->diffInDays($primerCargo, true) : null;
        }

        return response()->json([
            'cliente' => $cliente->only(['id', 'nombre', 'tipo_documento', 'documento', 'telefono', 'saldo_usd',
                'limite_credito_usd', 'credito_habilitado']),
            'antiguedad_dias' => $antiguedad,
            'movimientos' => $movimientos,
        ]);
    }

    /** Abono a la deuda, cobrado en caja. */
    public function abonar(Request $request, Cliente $cliente): JsonResponse
    {
        $this->autorizar($request, $cliente);
        $datos = $request->validate([
            'metodo' => ['required', Rule::in(array_keys(CuentaClienteService::METODOS_ABONO))],
            'monto' => ['required', 'numeric', 'gt:0', 'max:100000000'],
            'referencia' => ['nullable', 'string', 'max:255'],
            'nota' => ['nullable', 'string', 'max:255'],
        ]);

        $user = $request->user();
        $turno = $this->caja->abierto($user);
        $esEfectivo = str_starts_with($datos['metodo'], 'efectivo');
        if (! $turno && $esEfectivo && $user->empresa->ajuste('exigir_turno')) {
            throw new ReglaNegocioException('Abre tu caja para recibir abonos en efectivo.', 422, ['requiere_turno' => true]);
        }

        $movimiento = $this->cuentas->abonar($cliente, $datos, $user, $turno);

        return response()->json([
            'movimiento' => $movimiento,
            'cliente' => $cliente->fresh(),
        ], 201);
    }

    /** Historial de puntos de fidelización. */
    public function puntos(Request $request, Cliente $cliente): JsonResponse
    {
        $this->autorizar($request, $cliente);

        return response()->json(
            PuntosMovimiento::where('cliente_id', $cliente->id)->orderByDesc('id')->paginate($this->porPagina($request, 50))
        );
    }

    /** Cuentas por cobrar: clientes con deuda y su antigüedad. */
    public function porCobrar(Request $request): JsonResponse
    {
        $empresaId = $request->user()->empresa_id;
        $clientes = Cliente::where('empresa_id', $empresaId)->where('saldo_usd', '>', 0)
            ->orderByDesc('saldo_usd')
            ->get(['id', 'nombre', 'tipo_documento', 'documento', 'telefono', 'saldo_usd', 'limite_credito_usd']);

        $ultimoAbono = CuentaMovimiento::whereIn('cliente_id', $clientes->pluck('id'))->where('tipo', 'abono')
            ->groupBy('cliente_id')->selectRaw('cliente_id, MAX(created_at) fecha')->pluck('fecha', 'cliente_id');

        return response()->json([
            'total_usd' => round((float) $clientes->sum('saldo_usd'), 2),
            'clientes' => $clientes->map(fn ($c) => $c->toArray() + [
                'ultimo_abono' => $ultimoAbono[$c->id] ?? null,
            ]),
        ]);
    }

    private function validar(Request $request, ?Cliente $cliente = null): array
    {
        $empresaId = $request->user()->empresa_id;

        $reglas = [
            'tipo_documento' => ['required', 'in:V,E,J,G,P'],
            'documento' => ['required', 'string', 'max:20',
                Rule::unique('clientes')->where(fn ($q) => $q->where('empresa_id', $empresaId)
                    ->where('tipo_documento', $request->input('tipo_documento')))->ignore($cliente?->id)],
            'nombre' => ['required', 'string', 'max:255'],
            'direccion' => ['nullable', 'string', 'max:255'],
            'telefono' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:255'],
            'fecha_nacimiento' => ['nullable', 'date', 'before:today'],
            'notas' => ['nullable', 'string', 'max:2000'],
        ];

        // Habilitar fiado y fijar el límite es decisión del supervisor
        if ($request->user()->puede('fiado.configurar')) {
            $reglas['credito_habilitado'] = ['sometimes', 'boolean'];
            $reglas['limite_credito_usd'] = ['sometimes', 'numeric', 'min:0', 'max:1000000'];
        }

        return $request->validate($reglas, [
            'documento.unique' => 'Ya existe un cliente con ese documento.',
        ]);
    }

    private function autorizar(Request $request, Cliente $cliente): void
    {
        abort_unless($cliente->empresa_id === $request->user()->empresa_id, 404);
    }
}
