<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Support\Permisos;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'pin_supervisor',
        'empresa_id',
        'sucursal_id',
        'rol',
        'activo',
        'debe_cambiar_clave',
        'ultimo_acceso_el',
    ];

    public function empresa(): BelongsTo
    {
        return $this->belongsTo(Empresa::class);
    }

    public function sucursal(): BelongsTo
    {
        return $this->belongsTo(Sucursal::class);
    }

    /** Dueño del SaaS (por encima de las empresas). */
    public function esSuperAdmin(): bool
    {
        return $this->rol === 'super_admin';
    }

    /** ¿Tiene el permiso indicado? (ver App\Support\Permisos) */
    public function puede(string $permiso): bool
    {
        return Permisos::puede($this, $permiso);
    }

    /** Lista de permisos (la web arma el menú con esto). */
    public function getPermisosAttribute(): array
    {
        return Permisos::de($this);
    }

    public function getTienePinAttribute(): bool
    {
        return ! empty($this->pin_supervisor);
    }

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'pin_supervisor',
        'remember_token',
    ];

    protected $appends = ['permisos', 'tiene_pin'];

    /** Valores por defecto en memoria (iguales a los de la tabla). */
    protected $attributes = [
        'rol' => 'cajero',
        'activo' => true,
        'debe_cambiar_clave' => false,
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'ultimo_acceso_el' => 'datetime',
            'password' => 'hashed',
            'pin_supervisor' => 'hashed',
            'activo' => 'boolean',
            'debe_cambiar_clave' => 'boolean',
        ];
    }
}
