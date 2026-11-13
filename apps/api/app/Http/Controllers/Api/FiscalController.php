<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Venta;
use App\Services\FiscalService;
use App\Support\Auditoria;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Cola de la impresora fiscal. El puente local (scripts/puente-fiscal.ps1)
 * se autentica con una clave de solo "fiscal" y:
 *   1. pide las ventas pendientes de su sucursal con sus comandos TFHKA,
 *   2. las imprime,
 *   3. reporta el número fiscal (o el error).
 */
class FiscalController extends Controller
{
    public const HABILIDAD = 'fiscal';

    public function __construct(private readonly FiscalService $fiscal) {}

    /** (Admin) Genera la clave del puente. Revoca las anteriores de la sucursal del admin. */
    public function generarClave(Request $request): JsonResponse
    {
        $user = $request->user();
        $user->tokens()->where('name', 'puente-fiscal')->delete();
        $token = $user->createToken('puente-fiscal', [self::HABILIDAD])->plainTextToken;
        Auditoria::registrar('fiscal.clave_generada');

        return response()->json([
            'clave' => $token,
            'aviso' => 'Cópiala en el archivo de configuración del puente. No se vuelve a mostrar.',
        ], 201);
    }

    /** (Admin) Estado de la cola: pendientes y con error. */
    public function estado(Request $request): JsonResponse
    {
        $base = Venta::where('empresa_id', $request->user()->empresa_id);

        return response()->json([
            'pendientes' => (clone $base)->where('estado_fiscal', 'pendiente')->count(),
            'errores' => (clone $base)->where('estado_fiscal', 'error')->latest('fecha')->limit(20)
                ->get(['id', 'numero_factura', 'fecha', 'total_usd', 'error_fiscal']),
            'puente_configurado' => $request->user()->tokens()->where('name', 'puente-fiscal')->exists(),
        ]);
    }

    /** (Admin) Vuelve a poner en cola una venta que dio error. */
    public function reintentar(Request $request, Venta $venta): JsonResponse
    {
        abort_unless($venta->empresa_id === $request->user()->empresa_id, 404);
        abort_unless($venta->estado === 'emitida' && $venta->estado_fiscal === 'error', 422, 'La venta no está en error.');
        $venta->update(['estado_fiscal' => 'pendiente', 'error_fiscal' => null]);

        return response()->json(['message' => 'En cola de nuevo.']);
    }

    /** (Puente) Ventas pendientes de la sucursal, con sus comandos. */
    public function pendientes(Request $request): JsonResponse
    {
        $user = $request->user();
        $ventas = Venta::where('empresa_id', $user->empresa_id)
            ->where('sucursal_id', $user->sucursal_id)
            ->where('estado', 'emitida')
            ->where('estado_fiscal', 'pendiente')
            ->orderBy('id')
            ->limit(10)
            ->get();

        return response()->json($ventas->map(fn (Venta $v) => [
            'id' => $v->id,
            'numero' => $v->numero_factura,
            'total_bs' => (float) $v->total_bs,
            'comandos' => $this->fiscal->comandosFactura($v),
        ]));
    }

    /** (Puente) Resultado de la impresión. */
    public function resultado(Request $request, Venta $venta): JsonResponse
    {
        $user = $request->user();
        abort_unless($venta->empresa_id === $user->empresa_id && $venta->sucursal_id === $user->sucursal_id, 404);

        $datos = $request->validate([
            'ok' => ['required', 'boolean'],
            'numero_fiscal' => ['required_if:ok,true', 'nullable', 'string', 'max:30'],
            'serial' => ['nullable', 'string', 'max:30'],
            'error' => ['nullable', 'string', 'max:255'],
        ]);

        $venta->update($datos['ok']
            ? ['estado_fiscal' => 'impresa', 'numero_fiscal' => $datos['numero_fiscal'], 'serial_fiscal' => $datos['serial'] ?? null, 'error_fiscal' => null]
            : ['estado_fiscal' => 'error', 'error_fiscal' => $datos['error'] ?? 'Error sin detalle']);

        return response()->json(['message' => 'Registrado.']);
    }
}
