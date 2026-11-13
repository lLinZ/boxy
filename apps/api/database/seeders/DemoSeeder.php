<?php

namespace Database\Seeders;

use App\Models\Empresa;
use App\Models\TasaCambio;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;

/**
 * Datos de desarrollo: la cuenta de prueba (empresa "Boxy Demo Market"),
 * tasas del día y usuarios de cada rol. Los usuarios extra usan la clave
 * conocida "password", así que NUNCA corre en producción.
 */
class DemoSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->isProduction()) {
            throw new \RuntimeException('DemoSeeder usa claves conocidas: no se ejecuta en producción.');
        }

        $this->call(CuentaPruebaSeeder::class);

        // Tasas del día (BCV oficial + USDT referencial)
        TasaCambio::create(['fecha' => Carbon::today(), 'fuente' => 'BCV', 'tasa' => 36.50]);
        TasaCambio::create(['fecha' => Carbon::today(), 'fuente' => 'USDT', 'tasa' => 39.80]);

        // Dueño del SaaS (super-admin): no pertenece a ninguna empresa
        User::create([
            'name' => 'Dueño Boxy',
            'email' => 'super@boxy.com',
            'password' => Hash::make('password'),
            'rol' => 'super_admin',
        ]);

        // Otros roles dentro de la empresa de prueba, para probar permisos
        $empresa = Empresa::where('nombre', 'Boxy Demo Market')->firstOrFail();
        $sucursalId = $empresa->sucursales()->value('id');

        User::create([
            'name' => 'Luis Gerente',
            'email' => 'gerente@boxy.com',
            'password' => Hash::make('password'),
            'empresa_id' => $empresa->id,
            'sucursal_id' => $sucursalId,
            'rol' => 'gerente',
            'pin_supervisor' => '4321',
        ]);

        User::create([
            'name' => 'María Cajera',
            'email' => 'caja@boxy.com',
            'password' => Hash::make('password'),
            'empresa_id' => $empresa->id,
            'sucursal_id' => $sucursalId,
            'rol' => 'cajero',
        ]);
    }
}
