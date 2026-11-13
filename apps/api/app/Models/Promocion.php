<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Promoción automática: porcentaje, lleva N paga M, o precio especial por cantidad. */
class Promocion extends Model
{
    protected $table = 'promociones';

    protected $fillable = [
        'empresa_id', 'nombre', 'tipo', 'producto_id', 'categoria_id', 'valor', 'lleva', 'paga',
        'cantidad_minima', 'desde', 'hasta', 'dias_semana', 'activo',
    ];

    protected $casts = [
        'valor' => 'decimal:4',
        'cantidad_minima' => 'decimal:3',
        'lleva' => 'integer',
        'paga' => 'integer',
        'desde' => 'date:Y-m-d',
        'hasta' => 'date:Y-m-d',
        'dias_semana' => 'array',
        'activo' => 'boolean',
    ];

    public function producto(): BelongsTo
    {
        return $this->belongsTo(Producto::class);
    }

    public function categoria(): BelongsTo
    {
        return $this->belongsTo(Categoria::class);
    }
}
