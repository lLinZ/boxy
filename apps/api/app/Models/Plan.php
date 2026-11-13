<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Plan extends Model
{
    protected $table = 'planes';

    protected $fillable = [
        'codigo', 'nombre', 'descripcion', 'precio_mensual_usd',
        'max_sucursales', 'max_usuarios', 'max_productos', 'features',
        'dias_trial', 'dias_gracia', 'orden', 'visible', 'activo',
    ];

    protected $casts = [
        'features' => 'array',
        'precio_mensual_usd' => 'decimal:2',
        'visible' => 'boolean',
        'activo' => 'boolean',
    ];

    public function suscripciones(): HasMany
    {
        return $this->hasMany(Suscripcion::class);
    }
}
