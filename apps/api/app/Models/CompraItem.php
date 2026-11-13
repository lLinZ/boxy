<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CompraItem extends Model
{
    protected $table = 'compra_items';

    protected $fillable = [
        'compra_id', 'producto_id', 'cantidad', 'costo_unitario_usd', 'iva_usd', 'total_usd',
        'costo_anterior_usd', 'costo_promedio_usd', 'lote', 'vence_el',
    ];

    protected $casts = [
        'cantidad' => 'decimal:3',
        'costo_unitario_usd' => 'decimal:4',
        'iva_usd' => 'decimal:2',
        'total_usd' => 'decimal:2',
        'costo_anterior_usd' => 'decimal:4',
        'costo_promedio_usd' => 'decimal:4',
        'vence_el' => 'date:Y-m-d',
    ];

    public function compra(): BelongsTo
    {
        return $this->belongsTo(Compra::class);
    }

    public function producto(): BelongsTo
    {
        return $this->belongsTo(Producto::class);
    }
}
