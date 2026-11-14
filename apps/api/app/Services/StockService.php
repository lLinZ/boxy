<?php

namespace App\Services;

use App\Models\Inventario;
use App\Models\InventarioMovimiento;
use App\Models\Producto;
use Illuminate\Database\Eloquent\Model;

/**
 * Único punto por el que cambia el stock: actualiza la existencia de la
 * sucursal (con bloqueo de fila) y deja la traza en el kardex.
 * Debe llamarse dentro de una transacción.
 */
class StockService
{
    /**
     * @param  float  $delta  positivo suma, negativo resta
     * @param  string  $tipo  venta | anulacion | devolucion | compra | entrada | salida | ajuste | merma
     */
    public function mover(
        int $sucursalId,
        Producto $producto,
        float $delta,
        string $tipo,
        ?int $userId,
        ?string $observacion = null,
        ?Model $referencia = null,
        ?float $costoUsd = null,
    ): InventarioMovimiento {
        $inventario = Inventario::lockForUpdate()->firstOrCreate(
            ['sucursal_id' => $sucursalId, 'producto_id' => $producto->id],
            ['cantidad' => 0, 'stock_minimo' => 0],
        );

        $anterior = (float) $inventario->cantidad;
        $nueva = round($anterior + $delta, 3);
        $inventario->update(['cantidad' => $nueva]);

        return InventarioMovimiento::create([
            'sucursal_id' => $sucursalId,
            'producto_id' => $producto->id,
            'user_id' => $userId,
            'tipo' => $tipo,
            'cantidad' => $delta,
            'cantidad_anterior' => $anterior,
            'cantidad_nueva' => $nueva,
            // Un producto recién creado sin costo trae null en memoria (en la base es 0).
            'costo_usd' => $costoUsd ?? (float) ($producto->precio_costo_usd ?? 0),
            'referencia_type' => $referencia ? $referencia::class : null,
            'referencia_id' => $referencia?->getKey(),
            'observacion' => $observacion,
        ]);
    }
}
