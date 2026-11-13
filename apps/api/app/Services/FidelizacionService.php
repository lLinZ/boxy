<?php

namespace App\Services;

use App\Exceptions\ReglaNegocioException;
use App\Models\Cliente;
use App\Models\Empresa;
use App\Models\PuntosMovimiento;
use App\Models\Venta;

/**
 * Programa de puntos: el cliente gana puntos por cada USD comprado y los
 * canjea como medio de pago ("puntos"). Se configura en Datos de la empresa.
 */
class FidelizacionService
{
    /** Puntos que hay que descontar para pagar $montoUsd. */
    public function puntosParaPagar(Empresa $empresa, float $montoUsd): int
    {
        $valor = (float) $empresa->ajuste('puntos_valor_usd');

        return $valor > 0 ? (int) ceil(round($montoUsd / $valor, 6)) : PHP_INT_MAX;
    }

    /** Valida y descuenta los puntos usados para pagar. Dentro de la transacción de la venta. */
    public function canjear(Cliente $cliente, Empresa $empresa, float $montoUsd, Venta $venta): void
    {
        if (! $empresa->ajuste('puntos_activo')) {
            throw new ReglaNegocioException('El programa de puntos no está activo.');
        }

        $puntos = $this->puntosParaPagar($empresa, $montoUsd);
        $fila = Cliente::whereKey($cliente->id)->lockForUpdate()->firstOrFail();

        if ($fila->puntos < (int) $empresa->ajuste('puntos_minimo_canje')) {
            throw new ReglaNegocioException('El cliente aún no llega al mínimo de puntos para canjear.');
        }
        if ($puntos > $fila->puntos) {
            throw new ReglaNegocioException("Puntos insuficientes: se necesitan {$puntos} y el cliente tiene {$fila->puntos}.");
        }

        $this->registrar($fila, -$puntos, 'canje', $venta, "Canje en {$venta->numero_factura}");
    }

    /** Suma los puntos ganados por la venta (sobre lo no pagado con puntos). */
    public function otorgar(Cliente $cliente, Empresa $empresa, Venta $venta, float $pagadoConPuntosUsd): int
    {
        if (! $empresa->ajuste('puntos_activo')) {
            return 0;
        }

        $base = max(0.0, (float) $venta->total_usd - (float) $venta->igtf_usd - $pagadoConPuntosUsd);
        $puntos = (int) floor(round($base * (float) $empresa->ajuste('puntos_por_usd'), 6));

        if ($puntos > 0) {
            $fila = Cliente::whereKey($cliente->id)->lockForUpdate()->firstOrFail();
            $this->registrar($fila, $puntos, 'gana', $venta, "Compra {$venta->numero_factura}");
            $venta->update(['puntos_ganados' => $puntos]);
        }

        return $puntos;
    }

    /** Anulación: quita lo ganado y devuelve lo canjeado. */
    public function revertirVenta(Venta $venta): void
    {
        if (! $venta->cliente_id) {
            return;
        }

        $neto = (int) PuntosMovimiento::where('venta_id', $venta->id)->sum('puntos');
        if ($neto !== 0) {
            $fila = Cliente::whereKey($venta->cliente_id)->lockForUpdate()->firstOrFail();
            $this->registrar($fila, -$neto, 'reverso', $venta, "Anulación de {$venta->numero_factura}");
        }
    }

    /** Devolución parcial: quita los puntos ganados en proporción a lo devuelto. */
    public function revertirParcial(Venta $venta, Empresa $empresa, float $devueltoUsd): void
    {
        if (! $venta->cliente_id || $venta->puntos_ganados <= 0) {
            return;
        }

        $quitar = (int) min(
            $venta->puntos_ganados,
            floor(round($devueltoUsd * (float) $empresa->ajuste('puntos_por_usd'), 6)),
        );
        if ($quitar > 0) {
            $fila = Cliente::whereKey($venta->cliente_id)->lockForUpdate()->firstOrFail();
            $this->registrar($fila, -$quitar, 'reverso', $venta, "Devolución en {$venta->numero_factura}");
            $venta->decrement('puntos_ganados', $quitar);
        }
    }

    private function registrar(Cliente $fila, int $puntos, string $tipo, ?Venta $venta, string $nota): void
    {
        $saldo = max(0, $fila->puntos + $puntos);
        $fila->update(['puntos' => $saldo]);

        PuntosMovimiento::create([
            'empresa_id' => $fila->empresa_id,
            'cliente_id' => $fila->id,
            'venta_id' => $venta?->id,
            'tipo' => $tipo,
            'puntos' => $puntos,
            'saldo' => $saldo,
            'nota' => $nota,
        ]);
    }
}
