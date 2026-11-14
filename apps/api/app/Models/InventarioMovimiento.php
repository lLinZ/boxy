<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class InventarioMovimiento extends Model
{
    protected $table = 'inventario_movimientos';

    protected $fillable = [
        'sucursal_id', 'producto_id', 'user_id', 'tipo', 'cantidad',
        'cantidad_anterior', 'cantidad_nueva', 'costo_usd',
        'referencia_type', 'referencia_id', 'observacion',
    ];

    protected $casts = [
        'cantidad' => 'decimal:3',
        'cantidad_anterior' => 'decimal:3',
        'cantidad_nueva' => 'decimal:3',
        'costo_usd' => 'decimal:4',
    ];

    public function producto(): BelongsTo
    {
        return $this->belongsTo(Producto::class);
    }

    /** Quién hizo el movimiento (null si fue automático). */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function referencia(): MorphTo
    {
        return $this->morphTo();
    }
}
