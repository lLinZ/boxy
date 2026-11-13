<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Cliente extends Model
{
    protected $table = 'clientes';

    protected $fillable = [
        'empresa_id', 'tipo_documento', 'documento', 'nombre',
        'direccion', 'telefono', 'email', 'fecha_nacimiento', 'notas',
        'credito_habilitado', 'limite_credito_usd', 'saldo_usd', 'puntos',
    ];

    protected $casts = [
        'fecha_nacimiento' => 'date:Y-m-d',
        'credito_habilitado' => 'boolean',
        'limite_credito_usd' => 'decimal:2',
        'saldo_usd' => 'decimal:2',
        'puntos' => 'integer',
    ];

    public function empresa(): BelongsTo
    {
        return $this->belongsTo(Empresa::class);
    }

    public function ventas(): HasMany
    {
        return $this->hasMany(Venta::class);
    }

    public function movimientosCuenta(): HasMany
    {
        return $this->hasMany(CuentaMovimiento::class);
    }

    public function movimientosPuntos(): HasMany
    {
        return $this->hasMany(PuntosMovimiento::class);
    }

    /** Documento formateado: ej. "J-12345678-9" */
    public function getDocumentoCompletoAttribute(): string
    {
        return "{$this->tipo_documento}-{$this->documento}";
    }
}
