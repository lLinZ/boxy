<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * En producción solo siembra lo imprescindible (sin claves conocidas);
     * en desarrollo carga la cuenta de prueba (Boxy Demo Market).
     */
    public function run(): void
    {
        $this->call(app()->isProduction() ? ProduccionSeeder::class : DemoSeeder::class);
    }
}
