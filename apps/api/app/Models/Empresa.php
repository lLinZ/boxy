<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Empresa extends Model
{
    protected $table = 'empresas';

    protected $fillable = [
        'nombre', 'razon_social', 'tipo_rif', 'rif', 'direccion_fiscal',
        'telefono', 'email', 'logo_path', 'config', 'es_franquicia', 'matriz_id', 'activo',
    ];

    protected $casts = [
        'config' => 'array',
        'es_franquicia' => 'boolean',
        'activo' => 'boolean',
    ];

    /**
     * Preferencias por defecto de la empresa. Lo guardado en `config` se mezcla
     * encima de esto (ver ajustes()).
     */
    public const CONFIG_DEFECTO = [
        // Ticket térmico
        'ticket_ancho' => 80,                       // mm: 58 u 80
        'ticket_pie' => 'Gracias por su compra',
        'ticket_mostrar_logo' => false,
        'impresion_automatica' => false,            // imprimir el ticket al cobrar
        // Cobro
        'cobra_igtf' => true,                       // agente de percepción del IGTF (contribuyente especial)
        'vuelto_moneda' => 'VES',                   // moneda sugerida para el vuelto
        'exigir_turno' => true,                     // no se vende sin abrir caja
        'descuento_maximo_pct' => 100,              // tope de descuento manual por línea
        // CRM
        'whatsapp_codigo_pais' => '58',
        'fiado_limite_defecto_usd' => 20,
        // Fidelización (puntos)
        'puntos_activo' => false,
        'puntos_por_usd' => 1,                      // puntos ganados por cada USD comprado
        'puntos_valor_usd' => 0.01,                 // cuánto vale 1 punto al canjear
        'puntos_minimo_canje' => 100,
        // Balanza etiquetadora (códigos EAN-13 que empiezan por 2)
        'balanza_activa' => false,
        'balanza_prefijos' => '20,21,22,23,24,25,26,27,28,29',
        'balanza_digitos_plu' => 5,
        'balanza_tipo' => 'peso',                   // peso (gramos) | precio (céntimos de USD)
        // Impresora fiscal (a través del puente local)
        'fiscal_activa' => false,
        // Vencimientos
        'vencimiento_alerta_dias' => 30,
    ];

    /** Configuración efectiva (defaults + lo guardado). */
    public function ajustes(): array
    {
        return array_merge(self::CONFIG_DEFECTO, $this->config ?? []);
    }

    public function ajuste(string $clave, mixed $defecto = null): mixed
    {
        return $this->ajustes()[$clave] ?? $defecto;
    }

    public function matriz(): BelongsTo
    {
        return $this->belongsTo(Empresa::class, 'matriz_id');
    }

    public function franquicias(): HasMany
    {
        return $this->hasMany(Empresa::class, 'matriz_id');
    }

    public function sucursales(): HasMany
    {
        return $this->hasMany(Sucursal::class);
    }

    public function suscripcion(): HasOne
    {
        return $this->hasOne(Suscripcion::class);
    }

    public function productos(): HasMany
    {
        return $this->hasMany(Producto::class);
    }

    public function clientes(): HasMany
    {
        return $this->hasMany(Cliente::class);
    }

    public function usuarios(): HasMany
    {
        return $this->hasMany(User::class);
    }
}
