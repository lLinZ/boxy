<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PagoLicencia;
use App\Models\Suscripcion;
use App\Support\Archivos;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Billing self-service del cliente (admin de la empresa): ver su licencia,
 * reportar un pago para aprobación y consultar el historial.
 */
class SuscripcionController extends Controller
{
    /** Estado de la licencia de mi empresa. */
    public function mostrar(Request $request): JsonResponse
    {
        $sus = Suscripcion::with('plan')
            ->where('empresa_id', $request->user()->empresa_id)
            ->first();

        abort_if(! $sus, 404, 'Sin suscripción.');

        return response()->json([
            'suscripcion' => $sus,
            'estado' => $sus->estado,
            'dias_restantes' => $sus->diasRestantes(),
            'puede_operar' => $sus->puedeOperar(),
            'fecha_limite' => $sus->fechaLimite(),
            // Medios de pago de la licencia (config/boxy.php → cobro) y contacto comercial
            'cobro' => (object) config('boxy.cobro', []),
            'ventas' => (object) config('boxy.ventas', []),
        ]);
    }

    /** Historial de pagos de licencia de mi empresa. */
    public function pagos(Request $request): JsonResponse
    {
        $pagos = PagoLicencia::with('plan:id,nombre')
            ->where('empresa_id', $request->user()->empresa_id)
            ->latest()
            ->get()
            ->each(function (PagoLicencia $p) {
                $p->tiene_comprobante = (bool) $p->comprobante_path;
                $p->makeHidden('comprobante_path');
            });

        return response()->json($pagos);
    }

    /** Comprobante de un pago propio (se sirve autenticado desde el disco privado). */
    public function comprobante(Request $request, PagoLicencia $pago)
    {
        abort_unless($pago->empresa_id === $request->user()->empresa_id, 404);

        return Archivos::servirPrivado($pago->comprobante_path, "comprobante-{$pago->id}");
    }

    /** Reportar un pago (queda 'reportado' hasta que el super-admin lo confirme). */
    public function reportarPago(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'plan_id' => ['nullable', 'exists:planes,id'],
            'metodo' => ['required', 'in:pago_movil,transferencia,usdt,binance,zelle,efectivo,otro'],
            'moneda' => ['required', 'in:USD,VES'],
            'monto' => ['required', 'numeric', 'gt:0', 'max:100000000'],
            'monto_usd' => ['required', 'numeric', 'gt:0', 'max:1000000'],
            'referencia' => ['nullable', 'string', 'max:255'],
            'meses' => ['nullable', 'integer', 'min:1', 'max:12'],
            // Solo fotos o PDF (sin SVG, que puede llevar código)
            'comprobante' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:4096'],
            'nota' => ['nullable', 'string', 'max:500'],
        ]);

        $sus = Suscripcion::where('empresa_id', $request->user()->empresa_id)->firstOrFail();

        $comprobantePath = null;
        if ($request->hasFile('comprobante')) {
            // Disco privado: no hay URL pública, se sirve por /suscripcion/pagos/{id}/comprobante
            $comprobantePath = $request->file('comprobante')->store("comprobantes/{$request->user()->empresa_id}", 'local');
        }

        $pago = PagoLicencia::create([
            'empresa_id' => $request->user()->empresa_id,
            'suscripcion_id' => $sus->id,
            'plan_id' => $datos['plan_id'] ?? $sus->plan_id,
            'metodo' => $datos['metodo'],
            'moneda' => $datos['moneda'],
            'monto' => $datos['monto'],
            'monto_usd' => $datos['monto_usd'],
            'referencia' => $datos['referencia'] ?? null,
            'comprobante_path' => $comprobantePath,
            'meses' => $datos['meses'] ?? 1,
            'estado' => 'reportado',
            'nota' => $datos['nota'] ?? null,
        ]);

        return response()->json($pago->makeHidden('comprobante_path'), 201);
    }
}
