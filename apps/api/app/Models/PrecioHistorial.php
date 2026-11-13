<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PrecioHistorial extends Model
{
    protected $table = 'precio_historial';

    protected $fillable = [
        'producto_id', 'user_id', 'precio_anterior_usd', 'precio_nuevo_usd', 'motivo',
    ];

    protected $casts = [
        'precio_anterior_usd' => 'decimal:4',
        'precio_nuevo_usd' => 'decimal:4',
    ];

    public function producto(): BelongsTo
    {
        return $this->belongsTo(Producto::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
