<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Inventario extends Model
{
    protected $table = 'inventarios';

    protected $fillable = ['sucursal_id', 'producto_id', 'cantidad', 'stock_minimo'];

    protected $casts = [
        'cantidad' => 'decimal:3',
        'stock_minimo' => 'decimal:3',
    ];

    public function sucursal(): BelongsTo
    {
        return $this->belongsTo(Sucursal::class);
    }

    public function producto(): BelongsTo
    {
        return $this->belongsTo(Producto::class);
    }
}
