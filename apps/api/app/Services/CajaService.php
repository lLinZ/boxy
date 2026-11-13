<?php

namespace App\Services;

use App\Exceptions\ReglaNegocioException;
use App\Models\TasaCambio;
use App\Models\TurnoCaja;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Turnos de caja: apertura con fondo, resumen del turno (reporte X) y cierre
 * con arqueo (reporte Z no fiscal). El efectivo esperado se calcula así:
 *   fondo + cobros en efectivo + abonos en efectivo − vuelto en efectivo − devoluciones en efectivo.
 */
class CajaService
{
    public function abierto(User $user, bool $bloquear = false): ?TurnoCaja
    {
        $query = TurnoCaja::where('user_id', $user->id)->where('estado', 'abierto');

        return ($bloquear ? $query->lockForUpdate() : $query)->latest('id')->first();
    }

    public function abrir(User $user, float $fondoBs, float $fondoUsd, ?string $observacion = null): TurnoCaja
    {
        if (! $user->sucursal_id) {
            throw new ReglaNegocioException('El usuario no tiene una sucursal asignada.');
        }

        return DB::transaction(function () use ($user, $fondoBs, $fondoUsd, $observacion) {
            // Bloquea al usuario para que dos pestañas no abran dos turnos a la vez
            User::whereKey($user->id)->lockForUpdate()->first();

            if ($this->abierto($user, true)) {
                throw new ReglaNegocioException('Ya tienes una caja abierta.');
            }

            return TurnoCaja::create([
                'empresa_id' => $user->empresa_id,
                'sucursal_id' => $user->sucursal_id,
                'user_id' => $user->id,
                'estado' => 'abierto',
                'abierto_el' => now(),
                'tasa_apertura' => (float) (TasaCambio::vigente()?->tasa ?? 0),
                'fondo_bs' => round($fondoBs, 2),
                'fondo_usd' => round($fondoUsd, 2),
                'observacion' => $observacion,
            ]);
        });
    }

    /** Resumen del turno (reporte X). */
    public function resumen(TurnoCaja $turno): array
    {
        $ventas = DB::table('ventas')->where('turno_id', $turno->id);

        $emitidas = (clone $ventas)->where('estado', 'emitida')->selectRaw(
            'COUNT(*) cantidad, COALESCE(SUM(total_usd),0) total_usd, COALESCE(SUM(total_bs),0) total_bs,
             COALESCE(SUM(iva_usd),0) iva_usd, COALESCE(SUM(igtf_usd),0) igtf_usd, COALESCE(SUM(descuento_usd),0) descuento_usd'
        )->first();

        $anuladas = (clone $ventas)->where('estado', 'anulada')
            ->selectRaw('COUNT(*) cantidad, COALESCE(SUM(total_usd),0) total_usd')->first();

        // Cobros por método (solo ventas vigentes)
        $pagos = DB::table('pagos')
            ->join('ventas', 'ventas.id', '=', 'pagos.venta_id')
            ->where('ventas.turno_id', $turno->id)
            ->where('ventas.estado', 'emitida')
            ->groupBy('pagos.metodo', 'pagos.moneda')
            ->selectRaw('pagos.metodo, pagos.moneda, COUNT(*) ops, SUM(pagos.monto) monto, SUM(pagos.monto_usd) monto_usd')
            ->get();

        $vueltos = (clone $ventas)->where('estado', 'emitida')->where('vuelto_usd', '>', 0)
            ->groupBy('vuelto_metodo', 'vuelto_moneda')
            ->selectRaw('vuelto_metodo metodo, vuelto_moneda moneda, COUNT(*) ops, SUM(vuelto_monto) monto, SUM(vuelto_usd) monto_usd')
            ->get();

        $devoluciones = DB::table('devoluciones')->where('turno_id', $turno->id)
            ->groupBy('reintegro_metodo', 'reintegro_moneda')
            ->selectRaw('reintegro_metodo metodo, reintegro_moneda moneda, COUNT(*) ops, SUM(reintegro_monto) monto, SUM(total_usd) monto_usd')
            ->get();

        $abonos = DB::table('cuenta_movimientos')->where('turno_id', $turno->id)
            ->where('tipo', 'abono')->where('metodo', '!=', 'devolucion')
            ->groupBy('metodo', 'moneda')
            ->selectRaw('metodo, moneda, COUNT(*) ops, SUM(monto) monto, SUM(-monto_usd) monto_usd')
            ->get();

        // Consolidado por método: entradas (cobros + abonos) y salidas (vuelto + devoluciones)
        $metodos = [];
        $sumar = function ($filas, string $campo, int $signo) use (&$metodos) {
            foreach ($filas as $f) {
                $clave = $f->metodo.'|'.$f->moneda;
                $metodos[$clave] ??= ['metodo' => $f->metodo, 'moneda' => $f->moneda, 'cobros' => 0.0,
                    'abonos' => 0.0, 'vuelto' => 0.0, 'devoluciones' => 0.0, 'neto' => 0.0];
                $metodos[$clave][$campo] = round($metodos[$clave][$campo] + (float) $f->monto, 2);
                $metodos[$clave]['neto'] = round($metodos[$clave]['neto'] + $signo * (float) $f->monto, 2);
            }
        };
        $sumar($pagos, 'cobros', 1);
        $sumar($abonos, 'abonos', 1);
        $sumar($vueltos, 'vuelto', -1);
        $sumar($devoluciones, 'devoluciones', -1);

        $neto = fn (string $metodo) => (float) collect($metodos)->where('metodo', $metodo)->sum('neto');

        $esperadoBs = round((float) $turno->fondo_bs + $neto('efectivo_bs'), 2);
        $esperadoUsd = round((float) $turno->fondo_usd + $neto('efectivo_usd'), 2);

        return [
            'turno' => [
                'id' => $turno->id,
                'estado' => $turno->estado,
                'abierto_el' => $turno->abierto_el?->toIso8601String(),
                'cerrado_el' => $turno->cerrado_el?->toIso8601String(),
                'cajero' => $turno->user?->name,
                'sucursal' => $turno->sucursal?->nombre,
                'fondo_bs' => (float) $turno->fondo_bs,
                'fondo_usd' => (float) $turno->fondo_usd,
                'tasa_apertura' => (float) $turno->tasa_apertura,
            ],
            'ventas' => [
                'cantidad' => (int) $emitidas->cantidad,
                'total_usd' => round((float) $emitidas->total_usd, 2),
                'total_bs' => round((float) $emitidas->total_bs, 2),
                'iva_usd' => round((float) $emitidas->iva_usd, 2),
                'igtf_usd' => round((float) $emitidas->igtf_usd, 2),
                'descuento_usd' => round((float) $emitidas->descuento_usd, 2),
                'ticket_promedio_usd' => $emitidas->cantidad > 0 ? round($emitidas->total_usd / $emitidas->cantidad, 2) : 0,
            ],
            'anuladas' => ['cantidad' => (int) $anuladas->cantidad, 'total_usd' => round((float) $anuladas->total_usd, 2)],
            'devoluciones' => [
                'cantidad' => (int) $devoluciones->sum('ops'),
                'total_usd' => round((float) $devoluciones->sum('monto_usd'), 2),
            ],
            'abonos' => [
                'cantidad' => (int) $abonos->sum('ops'),
                'total_usd' => round((float) $abonos->sum('monto_usd'), 2),
            ],
            'fiado_otorgado_usd' => round((float) $pagos->where('metodo', 'credito')->sum('monto_usd'), 2),
            'metodos' => array_values($metodos),
            'efectivo' => ['esperado_bs' => $esperadoBs, 'esperado_usd' => $esperadoUsd],
        ];
    }

    /** Cierra el turno con el arqueo (lo contado) y guarda la foto del resumen. */
    public function cerrar(TurnoCaja $turno, User $user, float $contadoBs, float $contadoUsd, ?string $observacion): TurnoCaja
    {
        return DB::transaction(function () use ($turno, $user, $contadoBs, $contadoUsd, $observacion) {
            $turno = TurnoCaja::whereKey($turno->id)->lockForUpdate()->firstOrFail();
            if (! $turno->estaAbierto()) {
                throw new ReglaNegocioException('Este turno ya está cerrado.');
            }

            $resumen = $this->resumen($turno);
            $esperadoBs = $resumen['efectivo']['esperado_bs'];
            $esperadoUsd = $resumen['efectivo']['esperado_usd'];
            $cierre = now();

            // La foto guardada ya refleja el cierre y el arqueo
            $resumen['turno']['estado'] = 'cerrado';
            $resumen['turno']['cerrado_el'] = $cierre->toIso8601String();
            $resumen['turno']['cerrado_por'] = $user->name;
            $resumen['efectivo'] += [
                'contado_bs' => round($contadoBs, 2),
                'contado_usd' => round($contadoUsd, 2),
                'diferencia_bs' => round($contadoBs - $esperadoBs, 2),
                'diferencia_usd' => round($contadoUsd - $esperadoUsd, 2),
            ];

            $turno->update([
                'estado' => 'cerrado',
                'cerrado_el' => $cierre,
                'cerrado_por' => $user->id,
                'esperado_bs' => $esperadoBs,
                'esperado_usd' => $esperadoUsd,
                'contado_bs' => round($contadoBs, 2),
                'contado_usd' => round($contadoUsd, 2),
                'diferencia_bs' => round($contadoBs - $esperadoBs, 2),
                'diferencia_usd' => round($contadoUsd - $esperadoUsd, 2),
                'resumen' => $resumen,
                'observacion' => trim(($turno->observacion ? $turno->observacion.' · ' : '').($observacion ?? '')) ?: null,
            ]);

            return $turno;
        });
    }
}
