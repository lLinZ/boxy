<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Siembra mínima para un servidor real: planes y el super-admin. Sin datos
 * de prueba y sin claves conocidas: la clave del super-admin se toma de
 * BOXY_SUPERADMIN_PASSWORD o se genera al azar y se muestra UNA vez.
 * La tienda se crea después con `php artisan boxy:instalar`.
 */
class ProduccionSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(PlanesSeeder::class);

        $email = env('BOXY_SUPERADMIN_EMAIL', 'superadmin@boxy.local');
        if (User::where('email', $email)->exists()) {
            $this->command?->info("El super-admin {$email} ya existe.");

            return;
        }

        $clave = env('BOXY_SUPERADMIN_PASSWORD') ?: Str::password(16, symbols: false);
        User::create([
            'name' => 'Administrador Boxy',
            'email' => $email,
            'password' => $clave,
            'rol' => 'super_admin',
            'debe_cambiar_clave' => true,
        ]);

        $this->command?->warn('Super-admin creado. Guarda estos datos (no se vuelven a mostrar):');
        $this->command?->line("  Correo: {$email}");
        if (! env('BOXY_SUPERADMIN_PASSWORD')) {
            $this->command?->line("  Clave:  {$clave}");
        }
    }
}
