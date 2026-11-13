<?php

namespace App\Console\Commands;

use App\Models\Empresa;
use App\Models\Plan;
use App\Models\Sucursal;
use App\Models\Suscripcion;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

/**
 * Crea la tienda en una instalación nueva: empresa, sucursal principal y su
 * administrador. La clave se genera al azar (o se pide) y el admin debe
 * cambiarla en su primer ingreso. No hay usuarios con claves conocidas.
 */
class Instalar extends Command
{
    protected $signature = 'boxy:instalar
        {--empresa= : Nombre comercial}
        {--razon-social= : Razón social}
        {--rif= : RIF sin la letra (ej. 401234567)}
        {--tipo-rif=J : Letra del RIF (V, E, J, G, P)}
        {--admin= : Nombre del administrador}
        {--email= : Correo del administrador}
        {--pedir-clave : Pedir la clave en vez de generarla}';

    protected $description = 'Crea la empresa, la sucursal principal y el administrador de la tienda';

    public function handle(): int
    {
        $datos = [
            'empresa' => $this->option('empresa') ?? $this->ask('Nombre comercial de la tienda'),
            'razon_social' => $this->option('razon-social') ?? $this->ask('Razón social', $this->option('empresa')),
            'tipo_rif' => strtoupper((string) $this->option('tipo-rif')),
            'rif' => $this->option('rif') ?? $this->ask('RIF (solo números)'),
            'admin' => $this->option('admin') ?? $this->ask('Nombre del administrador'),
            'email' => $this->option('email') ?? $this->ask('Correo del administrador'),
        ];

        $clave = $this->option('pedir-clave') ? $this->secret('Clave del administrador (mín. 8, letras y números)') : Str::password(12, symbols: false);
        $datos['clave'] = $clave;

        $validador = Validator::make($datos, [
            'empresa' => ['required', 'string', 'max:255'],
            'razon_social' => ['required', 'string', 'max:255'],
            'tipo_rif' => ['required', 'in:V,E,J,G,P'],
            'rif' => ['required', 'regex:/^[0-9-]{5,20}$/', 'unique:empresas,rif'],
            'admin' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'unique:users,email'],
            'clave' => ['required', Password::defaults()],
        ]);
        if ($validador->fails()) {
            foreach ($validador->errors()->all() as $error) {
                $this->error($error);
            }

            return self::FAILURE;
        }

        DB::transaction(function () use ($datos, $clave) {
            $empresa = Empresa::create([
                'nombre' => $datos['empresa'],
                'razon_social' => $datos['razon_social'],
                'tipo_rif' => $datos['tipo_rif'],
                'rif' => $datos['rif'],
            ]);
            $sucursal = Sucursal::create([
                'empresa_id' => $empresa->id,
                'codigo' => 'PRINCIPAL',
                'nombre' => 'Sucursal principal',
                'serie_control' => '00',
            ]);
            User::create([
                'name' => $datos['admin'],
                'email' => $datos['email'],
                'password' => $clave,
                'empresa_id' => $empresa->id,
                'sucursal_id' => $sucursal->id,
                'rol' => 'admin',
                'debe_cambiar_clave' => true,
            ]);

            // En modo SaaS la empresa necesita una licencia; arranca en período de prueba
            if (config('boxy.modo') === 'saas' && ($plan = Plan::where('codigo', 'minimarket')->first())) {
                Suscripcion::create([
                    'empresa_id' => $empresa->id,
                    'plan_id' => $plan->id,
                    'estado' => 'trialing',
                    'precio_usd' => $plan->precio_mensual_usd,
                    'max_sucursales' => $plan->max_sucursales,
                    'max_usuarios' => $plan->max_usuarios,
                    'max_productos' => $plan->max_productos,
                    'features' => $plan->features,
                    'trial_termina_el' => now()->addDays($plan->dias_trial),
                ]);
            }
        });

        $this->info('Tienda creada.');
        $this->line("  Entrar con: {$datos['email']}");
        if (! $this->option('pedir-clave')) {
            $this->line("  Clave temporal: {$clave}  (se pide cambiarla al entrar; no se vuelve a mostrar)");
        }

        return self::SUCCESS;
    }
}
