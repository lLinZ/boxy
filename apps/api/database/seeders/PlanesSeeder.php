<?php

namespace Database\Seeders;

use App\Models\Plan;
use Illuminate\Database\Seeder;

/** Planes del SaaS. Idempotente: se puede correr en producción. */
class PlanesSeeder extends Seeder
{
    public function run(): void
    {
        $planes = [
            ['basico', 'Básico', 'Para bodegas y abastos pequeños', 15, 1, 2, 500, ['monitor' => false, 'analisis' => false, 'escaner_remoto' => true], 1],
            ['minimarket', 'Minimarket', 'Para minimarkets con varias cajas', 25, 1, 5, 0, ['monitor' => true, 'analisis' => true, 'escaner_remoto' => true], 2],
            ['franquicia', 'Franquicia', 'Para cadenas y varias sucursales', 50, 0, 0, 0, ['monitor' => true, 'analisis' => true, 'escaner_remoto' => true], 3],
        ];

        foreach ($planes as [$codigo, $nombre, $descripcion, $precio, $sucursales, $usuarios, $productos, $features, $orden]) {
            Plan::firstOrCreate(['codigo' => $codigo], [
                'nombre' => $nombre,
                'descripcion' => $descripcion,
                'precio_mensual_usd' => $precio,
                'max_sucursales' => $sucursales,
                'max_usuarios' => $usuarios,
                'max_productos' => $productos,
                'features' => $features,
                'dias_trial' => 14,
                'dias_gracia' => 5,
                'orden' => $orden,
                'visible' => true,
                'activo' => true,
            ]);
        }
    }
}
