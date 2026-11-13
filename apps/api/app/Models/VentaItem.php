<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VentaItem extends Model
{
    protected $table = 'venta_items';

    protected $fillable = [
        'venta_id', 'producto_id', 'descripcion', 'cantidad', 'precio_unitario_usd',
        'tipo_iva', 'alicuota_iva', 'descuento_usd', 'promocion_usd', 'promocion_id', 'base_usd', 'iva_usd', 'total_usd',
    ];

    protected $casts = [
        'cantidad' => 'decimal:3',
        'precio_unitario_usd' => 'decimal:4',
        'alicuota_iva' => 'decimal:2',
        'descuento_usd' => 'decimal:2',
        'promocion_usd' => 'decimal:2',
        'base_usd' => 'decimal:2',
        'iva_usd' => 'decimal:2',
        'total_usd' => 'decimal:2',
    ];

    public function venta(): BelongsTo
    {
        return $this->belongsTo(Venta::class);
    }

    public function producto(): BelongsTo
    {
        return $this->belongsTo(Producto::class);
    }
}
