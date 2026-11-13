<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Producto extends Model
{
    protected $table = 'productos';

    protected $fillable = [
        'empresa_id', 'categoria_id', 'sku', 'codigo_barra', 'nombre', 'descripcion',
        'unidad', 'precio_costo_usd', 'precio_venta_usd', 'tipo_iva',
        'controla_stock', 'pesable', 'codigo_balanza', 'imagen_path', 'activo',
    ];

    protected $casts = [
        'precio_costo_usd' => 'decimal:4',
        'precio_venta_usd' => 'decimal:4',
        'controla_stock' => 'boolean',
        'pesable' => 'boolean',
        'activo' => 'boolean',
    ];

    public function empresa(): BelongsTo
    {
        return $this->belongsTo(Empresa::class);
    }

    public function categoria(): BelongsTo
    {
        return $this->belongsTo(Categoria::class);
    }

    public function inventarios(): HasMany
    {
        return $this->hasMany(Inventario::class);
    }

    /** Alícuota de IVA (%) según el tipo configurado en el producto. */
    public function alicuotaIva(): float
    {
        return match ($this->tipo_iva) {
            'general' => 16.0,
            'reducido' => 8.0,
            'exento' => 0.0,
            default => 16.0,
        };
    }
}
