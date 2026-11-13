<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Lote de un producto con fecha de vencimiento (se registra al comprar). */
class Lote extends Model
{
    protected $table = 'lotes';

    protected $fillable = [
        'sucursal_id', 'producto_id', 'compra_item_id', 'lote', 'vence_el', 'cantidad',
    ];

    protected $casts = [
        'vence_el' => 'date:Y-m-d',
        'cantidad' => 'decimal:3',
    ];

    public function producto(): BelongsTo
    {
        return $this->belongsTo(Producto::class);
    }
}
