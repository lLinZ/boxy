<?php

namespace App\Services;

use App\Exceptions\ReglaNegocioException;
use App\Models\Cliente;
use App\Models\Devolucion;
use App\Models\DevolucionItem;
use App\Models\Empresa;
use App\Models\Producto;
use App\Models\Sucursal;
use App\Models\TasaCambio;
use App\Models\User;
use App\Models\Venta;
use Illuminate\Support\Facades\DB;

/**
 * Anulaciones y devoluciones, siempre con motivo y con rastro de quién autorizó.
 *
 *  - Anular: deja sin efecto la venta completa. Solo mientras su turno siga
 *    abierto (o el mismo día si no tuvo turno) y sin devoluciones previas.
 *    Reingresa el stock y revierte fiado y puntos.
 *  - Devolver: parcial o total, en cualquier momento. Reingresa el stock (salvo
 *    mercancía dañada) y reintegra el dinero en efectivo, pago móvil o a la cuenta del cliente.
 */
class DevolucionService
{
    public const METODOS_REINTEGRO = [
        'efectivo_bs' => 'VES', 'efectivo_usd' => 'USD', 'pago_movil' => 'VES', 'cuenta_cliente' => 'USD',
    ];

    public function __construct(
        private readonly StockService $stock,
        private readonly AutorizacionService $autorizacion,
        private readonly CuentaClienteService $cuentas,
        private readonly FidelizacionService $puntos,
        private readonly CajaService $caja,
    ) {}

    public function anular(Venta $venta, User $user, string $motivo, ?array $autorizacion): Venta
    {
        $supervisor = $this->autorizacion->exigir($user, 'ventas.anular', $autorizacion, 'anular una venta');

        return DB::transaction(function () use ($venta, $user, $motivo, $supervisor) {
            $venta = Venta::whereKey($venta->id)->lockForUpdate()->with(['items', 'turno'])->firstOrFail();

            if ($venta->estado !== 'emitida') {
                throw new ReglaNegocioException('La venta ya está anulada.');
            }
            if ((float) $venta->devuelto_usd > 0) {
                throw new ReglaNegocioException('La venta tiene devoluciones: registra una devolución por el resto.');
            }
            $turnoCerrado = $venta->turno && ! $venta->turno->estaAbierto();
            $deOtroDia = ! $venta->turno && ! $venta->fecha->isToday();
            if ($turnoCerrado || $deOtroDia) {
                throw new ReglaNegocioException('Esa caja ya se cerró: en lugar de anular, registra una devolución.');
            }
            if ($venta->estado_fiscal === 'impresa') {
                throw new ReglaNegocioException('La venta ya salió por la impresora fiscal: registra una devolución (nota de crédito fiscal).');
            }

            foreach ($venta->items as $item) {
                $producto = $item->producto_id ? Producto::find($item->producto_id) : null;
                if ($producto && $producto->controla_stock) {
                    $this->stock->mover($venta->sucursal_id, $producto, (float) $item->cantidad, 'anulacion',
                        $user->id, "Anulación {$venta->numero_factura}", $venta);
                }
            }

            $this->cuentas->revertirVenta($venta, $user->id);
            $this->puntos->revertirVenta($venta);

            $venta->update([
                'estado' => 'anulada',
                'anulada_el' => now(),
                'anulada_por' => $user->id,
                'autorizada_por' => $supervisor?->id ?? $venta->autorizada_por,
                'motivo_anulacion' => $motivo,
                'estado_fiscal' => $venta->estado_fiscal === 'pendiente' ? null : $venta->estado_fiscal,
            ]);

            return $venta->fresh(['items', 'pagos', 'cliente']);
        });
    }

    /**
     * @param  array  $items  [{venta_item_id, cantidad, reintegra_stock?}]
     * @param  string  $metodo  efectivo_bs | efectivo_usd | pago_movil | cuenta_cliente
     */
    public function devolver(Venta $venta, User $user, array $items, string $metodo, string $motivo, ?array $autorizacion): Devolucion
    {
        $supervisor = $this->autorizacion->exigir($user, 'ventas.devolver', $autorizacion, 'registrar una devolución');

        $moneda = self::METODOS_REINTEGRO[$metodo] ?? throw new ReglaNegocioException('Forma de reintegro no válida.');

        return DB::transaction(function () use ($venta, $user, $items, $metodo, $moneda, $motivo, $supervisor) {
            $venta = Venta::whereKey($venta->id)->lockForUpdate()->with('items')->firstOrFail();
            if ($venta->estado !== 'emitida') {
                throw new ReglaNegocioException('No se puede devolver una venta anulada.');
            }
            if ($metodo === 'cuenta_cliente' && ! $venta->cliente_id) {
                throw new ReglaNegocioException('La venta no tiene cliente: elige otra forma de reintegro.');
            }

            $turno = $this->caja->abierto($user, true);
            $empresa = Empresa::findOrFail($venta->empresa_id);
            if (! $turno && $metodo !== 'cuenta_cliente' && $empresa->ajuste('exigir_turno')) {
                throw new ReglaNegocioException('Abre tu caja para devolver dinero.', 422, ['requiere_turno' => true]);
            }

            $tasa = (float) (TasaCambio::vigente()?->tasa ?? $venta->tasa);
            $yaDevuelto = DevolucionItem::whereIn('venta_item_id', $venta->items->pluck('id'))
                ->selectRaw('venta_item_id, SUM(cantidad) cantidad')->groupBy('venta_item_id')
                ->pluck('cantidad', 'venta_item_id');

            $lineas = [];
            $total = 0.0;
            foreach ($items as $pedido) {
                $item = $venta->items->firstWhere('id', (int) $pedido['venta_item_id']);
                if (! $item) {
                    throw new ReglaNegocioException('Un artículo no pertenece a esta venta.');
                }
                $cantidad = round((float) $pedido['cantidad'], 3);
                $disponible = round((float) $item->cantidad - (float) ($yaDevuelto[$item->id] ?? 0), 3);
                if ($cantidad <= 0 || $cantidad > $disponible + 0.0001) {
                    throw new ReglaNegocioException("Cantidad a devolver inválida para {$item->descripcion} (máximo {$disponible}).");
                }
                // Proporcional al total de la línea (incluye IVA y descuentos; el IGTF no se reintegra)
                $monto = round((float) $item->total_usd * $cantidad / (float) $item->cantidad, 2);
                $lineas[] = [$item, $cantidad, $monto, (bool) ($pedido['reintegra_stock'] ?? true)];
                $total += $monto;
            }
            $total = round($total, 2);
            if (! $lineas) {
                throw new ReglaNegocioException('Indica qué artículos se devuelven.');
            }

            $sucursal = Sucursal::lockForUpdate()->findOrFail($venta->sucursal_id);
            $numero = 'DEV-'.str_pad((string) $sucursal->proximo_numero_devolucion, 8, '0', STR_PAD_LEFT);
            $sucursal->increment('proximo_numero_devolucion');

            $devolucion = Devolucion::create([
                'empresa_id' => $venta->empresa_id,
                'sucursal_id' => $venta->sucursal_id,
                'venta_id' => $venta->id,
                'turno_id' => $turno?->id,
                'user_id' => $user->id,
                'autorizada_por' => $supervisor?->id,
                'numero' => $numero,
                'motivo' => $motivo,
                'tasa' => $tasa,
                'total_usd' => $total,
                'reintegro_metodo' => $metodo,
                'reintegro_moneda' => $moneda,
                'reintegro_monto' => $moneda === 'USD' ? $total : round($total * $tasa, 2),
            ]);

            foreach ($lineas as [$item, $cantidad, $monto, $reintegra]) {
                DevolucionItem::create([
                    'devolucion_id' => $devolucion->id,
                    'venta_item_id' => $item->id,
                    'producto_id' => $item->producto_id,
                    'descripcion' => $item->descripcion,
                    'cantidad' => $cantidad,
                    'total_usd' => $monto,
                    'reintegra_stock' => $reintegra,
                ]);

                $producto = $item->producto_id ? Producto::find($item->producto_id) : null;
                if ($producto && $producto->controla_stock && $reintegra) {
                    $this->stock->mover($venta->sucursal_id, $producto, $cantidad, 'devolucion',
                        $user->id, "Devolución {$numero}", $devolucion);
                }
            }

            $venta->update(['devuelto_usd' => round((float) $venta->devuelto_usd + $total, 2)]);

            if ($metodo === 'cuenta_cliente') {
                $cliente = Cliente::findOrFail($venta->cliente_id);
                $this->cuentas->abonoPorDevolucion($cliente, $total, $devolucion, $user->id);
            }
            $this->puntos->revertirParcial($venta, $empresa, $total);

            return $devolucion->load('items');
        });
    }
}
