<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Compra a proveedor: suma stock y recalcula el costo promedio de cada producto. */
class Compra extends Model
{
    protected $table = 'compras';

    protected $fillable = [
        'empresa_id', 'sucursal_id', 'proveedor_id', 'user_id', 'numero', 'documento_proveedor', 'fecha',
        'tasa', 'moneda', 'subtotal_usd', 'iva_usd', 'total_usd', 'condicion', 'vence_el', 'pagada',
        'estado', 'observacion',
    ];

    protected $casts = [
        'fecha' => 'date:Y-m-d',
        'vence_el' => 'date:Y-m-d',
        'tasa' => 'decimal:6',
        'subtotal_usd' => 'decimal:2',
        'iva_usd' => 'decimal:2',
        'total_usd' => 'decimal:2',
        'pagada' => 'boolean',
    ];

    public function proveedor(): BelongsTo
    {
        return $this->belongsTo(Proveedor::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(CompraItem::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
