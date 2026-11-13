<?php

namespace App\Services;

use App\Exceptions\ReglaNegocioException;
use App\Models\Cliente;
use App\Models\CuentaMovimiento;
use App\Models\Devolucion;
use App\Models\Empresa;
use App\Models\TasaCambio;
use App\Models\TurnoCaja;
use App\Models\User;
use App\Models\Venta;
use Illuminate\Support\Facades\DB;

/**
 * Fiado: cuenta corriente del cliente en USD. Los cargos vienen de ventas
 * pagadas con el método "credito"; los abonos se cobran en caja.
 */
class CuentaClienteService
{
    /** Métodos con los que se puede abonar una deuda. */
    public const METODOS_ABONO = [
        'efectivo_bs' => 'VES', 'pago_movil' => 'VES', 'transferencia' => 'VES', 'tarjeta' => 'VES',
        'efectivo_usd' => 'USD', 'zelle' => 'USD',
    ];

    /** Venta a crédito: aumenta la deuda. Llamar dentro de la transacción de la venta. */
    public function cargo(Cliente $cliente, float $montoUsd, Venta $venta, ?int $turnoId, ?int $userId): CuentaMovimiento
    {
        return $this->registrar($cliente, [
            'tipo' => 'cargo',
            'venta_id' => $venta->id,
            'turno_id' => $turnoId,
            'user_id' => $userId,
            'metodo' => 'credito',
            'moneda' => 'USD',
            'monto' => $montoUsd,
            'monto_usd' => $montoUsd,
            'tasa' => $venta->tasa,
            'nota' => "Compra {$venta->numero_factura}",
        ]);
    }

    /** Anulación de una venta fiada: devuelve la deuda que generó. */
    public function revertirVenta(Venta $venta, ?int $userId): void
    {
        $cargo = (float) CuentaMovimiento::where('venta_id', $venta->id)->where('tipo', 'cargo')->sum('monto_usd');
        if ($cargo <= 0 || ! $venta->cliente_id) {
            return;
        }

        $cliente = Cliente::findOrFail($venta->cliente_id);
        $this->registrar($cliente, [
            'tipo' => 'reverso',
            'venta_id' => $venta->id,
            'user_id' => $userId,
            'monto_usd' => -$cargo,
            'tasa' => $venta->tasa,
            'nota' => "Anulación de {$venta->numero_factura}",
        ]);
    }

    /** Devolución reintegrada a la cuenta del cliente: reduce su deuda. */
    public function abonoPorDevolucion(Cliente $cliente, float $montoUsd, Devolucion $devolucion, ?int $userId): CuentaMovimiento
    {
        return $this->registrar($cliente, [
            'tipo' => 'abono',
            'devolucion_id' => $devolucion->id,
            'venta_id' => $devolucion->venta_id,
            'turno_id' => $devolucion->turno_id,
            'user_id' => $userId,
            'metodo' => 'devolucion',
            'moneda' => 'USD',
            'monto' => $montoUsd,
            'monto_usd' => -$montoUsd,
            'tasa' => $devolucion->tasa,
            'nota' => "Devolución {$devolucion->numero}",
        ]);
    }

    /**
     * Abono cobrado en caja.
     *
     * @param  array  $datos  metodo, monto (lo que se descuenta de la deuda, en la moneda del método), referencia?, nota?
     */
    public function abonar(Cliente $cliente, array $datos, User $user, ?TurnoCaja $turno): CuentaMovimiento
    {
        $moneda = self::METODOS_ABONO[$datos['metodo']] ?? null;
        if (! $moneda) {
            throw new ReglaNegocioException('Método de pago no válido para abonos.');
        }

        $tasa = (float) (TasaCambio::vigente()?->tasa ?? 0);
        if ($tasa <= 0) {
            throw new ReglaNegocioException('No hay tasa BCV registrada.');
        }

        $empresa = Empresa::findOrFail($cliente->empresa_id);
        $monto = round((float) $datos['monto'], 2);
        $montoUsd = $moneda === 'USD' ? $monto : round($monto / $tasa, 2);

        // IGTF sobre el abono en divisas (solo si la empresa es agente de percepción)
        $igtfUsd = $moneda === 'USD' && $empresa->ajuste('cobra_igtf')
            ? round($montoUsd * CalculadoraVenta::ALICUOTA_IGTF / 100, 2)
            : 0.0;

        return DB::transaction(function () use ($cliente, $datos, $user, $turno, $moneda, $monto, $montoUsd, $igtfUsd, $tasa) {
            $saldo = (float) Cliente::whereKey($cliente->id)->lockForUpdate()->value('saldo_usd');
            if ($montoUsd > $saldo + CalculadoraVenta::TOLERANCIA) {
                throw new ReglaNegocioException('El abono supera la deuda del cliente ($'.number_format($saldo, 2).').');
            }

            return $this->registrar($cliente, [
                'tipo' => 'abono',
                'turno_id' => $turno?->id,
                'user_id' => $user->id,
                'metodo' => $datos['metodo'],
                'moneda' => $moneda,
                // Lo recibido en caja incluye el IGTF (en divisas)
                'monto' => $moneda === 'USD' ? round($monto + $igtfUsd, 2) : $monto,
                'monto_usd' => -min($montoUsd, $saldo),
                'igtf_usd' => $igtfUsd,
                'tasa' => $tasa,
                'referencia' => $datos['referencia'] ?? null,
                'nota' => $datos['nota'] ?? null,
            ]);
        });
    }

    /** Inserta el movimiento y actualiza el saldo con la fila del cliente bloqueada. */
    private function registrar(Cliente $cliente, array $datos): CuentaMovimiento
    {
        return DB::transaction(function () use ($cliente, $datos) {
            $fila = Cliente::whereKey($cliente->id)->lockForUpdate()->firstOrFail();
            $nuevoSaldo = round((float) $fila->saldo_usd + (float) $datos['monto_usd'], 2);
            $fila->update(['saldo_usd' => $nuevoSaldo]);
            $cliente->saldo_usd = $nuevoSaldo;

            return CuentaMovimiento::create($datos + [
                'empresa_id' => $fila->empresa_id,
                'cliente_id' => $fila->id,
                'saldo_usd' => $nuevoSaldo,
            ]);
        });
    }
}
