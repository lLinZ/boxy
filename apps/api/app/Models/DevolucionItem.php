<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DevolucionItem extends Model
{
    protected $table = 'devolucion_items';

    protected $fillable = [
        'devolucion_id', 'venta_item_id', 'producto_id', 'descripcion', 'cantidad', 'total_usd', 'reintegra_stock',
    ];

    protected $casts = [
        'cantidad' => 'decimal:3',
        'total_usd' => 'decimal:2',
        'reintegra_stock' => 'boolean',
    ];

    public function devolucion(): BelongsTo
    {
        return $this->belongsTo(Devolucion::class);
    }

    public function ventaItem(): BelongsTo
    {
        return $this->belongsTo(VentaItem::class);
    }
}
