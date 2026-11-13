<?php

namespace App\Services;

use App\Exceptions\ReglaNegocioException;
use App\Models\Compra;
use App\Models\CompraItem;
use App\Models\Inventario;
use App\Models\Lote;
use App\Models\PrecioHistorial;
use App\Models\Producto;
use App\Models\Proveedor;
use App\Models\Sucursal;
use App\Models\TasaCambio;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Compras a proveedores: suben el stock, registran lotes con vencimiento y
 * recalculan el costo promedio ponderado de cada producto:
 *
 *   costo nuevo = (stock actual × costo actual + cantidad comprada × costo de compra)
 *                 / (stock actual + cantidad comprada)
 *
 * El stock que se pondera es el de todas las sucursales (el costo es por producto).
 */
class CompraService
{
    public function __construct(private readonly StockService $stock) {}

    public function registrar(array $datos, User $user): Compra
    {
        if (! $user->sucursal_id) {
            throw new ReglaNegocioException('El usuario no tiene una sucursal asignada.');
        }

        return DB::transaction(function () use ($datos, $user) {
            $sucursal = Sucursal::lockForUpdate()->findOrFail($user->sucursal_id);
            $moneda = $datos['moneda'] ?? 'USD';
            $tasa = (float) ($datos['tasa'] ?? TasaCambio::vigente()?->tasa ?? 0);
            if ($moneda === 'VES' && $tasa <= 0) {
                throw new ReglaNegocioException('Indica la tasa para convertir la compra en bolívares.');
            }

            if (! empty($datos['proveedor_id'])
                && ! Proveedor::where('empresa_id', $user->empresa_id)->whereKey($datos['proveedor_id'])->exists()) {
                throw new ReglaNegocioException('Proveedor no encontrado.');
            }

            $numero = 'C-'.str_pad((string) $sucursal->proximo_numero_compra, 8, '0', STR_PAD_LEFT);
            $sucursal->increment('proximo_numero_compra');

            $condicion = $datos['condicion'] ?? 'contado';
            $compra = Compra::create([
                'empresa_id' => $user->empresa_id,
                'sucursal_id' => $sucursal->id,
                'proveedor_id' => $datos['proveedor_id'] ?? null,
                'user_id' => $user->id,
                'numero' => $numero,
                'documento_proveedor' => $datos['documento_proveedor'] ?? null,
                'fecha' => $datos['fecha'] ?? now()->toDateString(),
                'tasa' => $tasa,
                'moneda' => $moneda,
                'condicion' => $condicion,
                'vence_el' => $condicion === 'credito' ? ($datos['vence_el'] ?? null) : null,
                'pagada' => $condicion === 'contado',
                'estado' => 'registrada',
                'observacion' => $datos['observacion'] ?? null,
            ]);

            $subtotal = 0.0;
            $iva = 0.0;
            foreach ($datos['items'] as $i => $item) {
                $producto = Producto::where('empresa_id', $user->empresa_id)->lockForUpdate()->find($item['producto_id']);
                if (! $producto) {
                    throw new ReglaNegocioException('Producto no encontrado en la línea '.($i + 1).'.');
                }

                $cantidad = round((float) $item['cantidad'], 3);
                $costo = (float) $item['costo_unitario'];
                $costoUsd = round($moneda === 'USD' ? $costo : $costo / $tasa, 4);
                $lineaUsd = round($cantidad * $costoUsd, 2);
                $ivaUsd = round($lineaUsd * (float) ($item['iva_pct'] ?? 0) / 100, 2);

                // Costo promedio ponderado (stock negativo cuenta como cero)
                $stockTotal = max(0.0, (float) Inventario::where('producto_id', $producto->id)->sum('cantidad'));
                $costoAnterior = (float) $producto->precio_costo_usd;
                $costoPromedio = $stockTotal + $cantidad > 0
                    ? round(($stockTotal * $costoAnterior + $cantidad * $costoUsd) / ($stockTotal + $cantidad), 4)
                    : $costoUsd;

                $compraItem = CompraItem::create([
                    'compra_id' => $compra->id,
                    'producto_id' => $producto->id,
                    'cantidad' => $cantidad,
                    'costo_unitario_usd' => $costoUsd,
                    'iva_usd' => $ivaUsd,
                    'total_usd' => round($lineaUsd + $ivaUsd, 2),
                    'costo_anterior_usd' => $costoAnterior,
                    'costo_promedio_usd' => $costoPromedio,
                    'lote' => $item['lote'] ?? null,
                    'vence_el' => $item['vence_el'] ?? null,
                ]);

                $cambios = ['precio_costo_usd' => $costoPromedio];
                $precioNuevo = isset($item['precio_venta_usd']) ? round((float) $item['precio_venta_usd'], 4) : null;
                if ($precioNuevo !== null && $precioNuevo > 0 && $precioNuevo !== round((float) $producto->precio_venta_usd, 4)) {
                    if (! $user->puede('precios.gestionar')) {
                        throw new ReglaNegocioException('No tienes permiso para cambiar precios de venta.', 403);
                    }
                    PrecioHistorial::create([
                        'producto_id' => $producto->id,
                        'user_id' => $user->id,
                        'precio_anterior_usd' => $producto->precio_venta_usd,
                        'precio_nuevo_usd' => $precioNuevo,
                        'motivo' => 'compra',
                    ]);
                    $cambios['precio_venta_usd'] = $precioNuevo;
                }
                $producto->update($cambios);

                if ($producto->controla_stock) {
                    $this->stock->mover($sucursal->id, $producto, $cantidad, 'compra', $user->id,
                        "Compra {$numero}", $compra, $costoUsd);
                }

                if (! empty($item['vence_el'])) {
                    Lote::create([
                        'sucursal_id' => $sucursal->id,
                        'producto_id' => $producto->id,
                        'compra_item_id' => $compraItem->id,
                        'lote' => $item['lote'] ?? null,
                        'vence_el' => $item['vence_el'],
                        'cantidad' => $cantidad,
                    ]);
                }

                $subtotal += $lineaUsd;
                $iva += $ivaUsd;
            }

            $compra->update([
                'subtotal_usd' => round($subtotal, 2),
                'iva_usd' => round($iva, 2),
                'total_usd' => round($subtotal + $iva, 2),
            ]);

            return $compra->load(['items.producto:id,nombre,sku', 'proveedor']);
        });
    }

    /**
     * Anula la compra: saca del stock lo que entró. El costo promedio no se
     * recalcula hacia atrás (queda como estaba); se deja constancia en el kardex.
     */
    public function anular(Compra $compra, User $user): Compra
    {
        return DB::transaction(function () use ($compra, $user) {
            $compra = Compra::whereKey($compra->id)->lockForUpdate()->with('items')->firstOrFail();
            if ($compra->estado !== 'registrada') {
                throw new ReglaNegocioException('La compra ya está anulada.');
            }

            foreach ($compra->items as $item) {
                $producto = Producto::find($item->producto_id);
                if ($producto && $producto->controla_stock) {
                    $this->stock->mover($compra->sucursal_id, $producto, -(float) $item->cantidad, 'salida',
                        $user->id, "Anulación compra {$compra->numero}", $compra, (float) $item->costo_unitario_usd);
                }
            }
            Lote::whereIn('compra_item_id', $compra->items->pluck('id'))->delete();

            $compra->update(['estado' => 'anulada']);

            return $compra->fresh(['items.producto:id,nombre,sku', 'proveedor']);
        });
    }
}
