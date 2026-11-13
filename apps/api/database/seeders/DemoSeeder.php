<?php

namespace Database\Seeders;

use App\Models\Categoria;
use App\Models\Cliente;
use App\Models\Empresa;
use App\Models\Inventario;
use App\Models\Plan;
use App\Models\Producto;
use App\Models\Sucursal;
use App\Models\Suscripcion;
use App\Models\TasaCambio;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Datos de demostración (empresa "Crotone Minimarket"). Las claves son
 * conocidas ("password"), así que NUNCA corre en producción.
 */
class DemoSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->isProduction()) {
            throw new \RuntimeException('DemoSeeder usa claves conocidas: no se ejecuta en producción.');
        }

        $this->call(PlanesSeeder::class);

        // Empresa matriz
        $empresa = Empresa::create([
            'nombre' => 'Crotone Minimarket',
            'razon_social' => 'Inversiones Crotone, C.A.',
            'tipo_rif' => 'J',
            'rif' => '401234567',
            'direccion_fiscal' => 'Av. Principal, Caracas',
            'telefono' => '0212-0000000',
            'email' => 'info@crotone.com',
        ]);

        // Sucursal principal
        $sucursal = Sucursal::create([
            'empresa_id' => $empresa->id,
            'codigo' => 'CCS-01',
            'nombre' => 'Crotone Centro',
            'direccion' => 'Av. Principal, Caracas',
            'serie_control' => '00',
        ]);

        // Usuario administrador
        User::create([
            'name' => 'Administrador',
            'email' => 'admin@crotone.com',
            'password' => Hash::make('password'),
            'empresa_id' => $empresa->id,
            'sucursal_id' => $sucursal->id,
            'rol' => 'admin',
            'pin_supervisor' => '1234', // PIN de supervisor de la demo
        ]);

        // Dueño del SaaS (super-admin)
        User::create([
            'name' => 'Dueño Boxy',
            'email' => 'super@crotone.com',
            'password' => Hash::make('password'),
            'rol' => 'super_admin',
        ]);

        // Licencia activa para que la demo funcione en modo SaaS
        $plan = Plan::where('codigo', 'minimarket')->first();
        Suscripcion::create([
            'empresa_id' => $empresa->id,
            'plan_id' => $plan->id,
            'estado' => 'activa',
            'precio_usd' => $plan->precio_mensual_usd,
            'max_sucursales' => $plan->max_sucursales,
            'max_usuarios' => 0,
            'max_productos' => $plan->max_productos,
            'features' => $plan->features,
            'vence_el' => Carbon::now()->addYear(),
            'gracia_hasta' => Carbon::now()->addYear()->addDays($plan->dias_gracia),
        ]);

        // Tasa BCV de hoy
        TasaCambio::create([
            'fecha' => Carbon::today(),
            'fuente' => 'BCV',
            'tasa' => 36.50,
        ]);

        // Tasa paralela (USDT) de hoy
        TasaCambio::create([
            'fecha' => Carbon::today(),
            'fuente' => 'USDT',
            'tasa' => 39.80,
        ]);

        // Usuario cajero de prueba
        User::create([
            'name' => 'María Cajera',
            'email' => 'caja@crotone.com',
            'password' => Hash::make('password'),
            'empresa_id' => $empresa->id,
            'sucursal_id' => $sucursal->id,
            'rol' => 'cajero',
        ]);

        // Gerente (supervisor con PIN para autorizar anulaciones y descuentos en caja)
        User::create([
            'name' => 'Luis Gerente',
            'email' => 'gerente@crotone.com',
            'password' => Hash::make('password'),
            'empresa_id' => $empresa->id,
            'sucursal_id' => $sucursal->id,
            'rol' => 'gerente',
            'pin_supervisor' => '4321',
        ]);

        // Categorías + productos de ejemplo (con código de barras para el escáner)
        $catalogo = [
            'Bebidas' => [
                ['Coca-Cola 2L', 'general', 1.80, 1.20, '7591016000113'],
                ['Agua Mineral 1.5L', 'general', 0.90, 0.55, '7591016000120'],
            ],
            'Víveres' => [
                ['Harina de Maíz 1Kg', 'reducido', 1.10, 0.75, '7591001100114'],
                ['Arroz 1Kg', 'reducido', 1.30, 0.90, '7591001100121'],
            ],
            'Panadería' => [
                ['Pan Canilla', 'exento', 0.70, 0.40, '2000000000017'],
            ],
        ];

        foreach ($catalogo as $nombreCat => $productos) {
            $categoria = Categoria::create([
                'empresa_id' => $empresa->id,
                'nombre' => $nombreCat,
                'slug' => Str::slug($nombreCat),
            ]);

            foreach ($productos as $i => [$nombre, $tipoIva, $venta, $costo, $codigoBarra]) {
                $producto = Producto::create([
                    'empresa_id' => $empresa->id,
                    'categoria_id' => $categoria->id,
                    'sku' => strtoupper(Str::slug($nombreCat).'-'.($i + 1)),
                    'codigo_barra' => $codigoBarra,
                    'nombre' => $nombre,
                    'precio_venta_usd' => $venta,
                    'precio_costo_usd' => $costo,
                    'tipo_iva' => $tipoIva,
                ]);

                Inventario::create([
                    'sucursal_id' => $sucursal->id,
                    'producto_id' => $producto->id,
                    'cantidad' => 100,
                    'stock_minimo' => 10,
                ]);
            }
        }

        // Cliente genérico (consumidor final)
        Cliente::create([
            'empresa_id' => $empresa->id,
            'tipo_documento' => 'V',
            'documento' => '00000000',
            'nombre' => 'Consumidor Final',
        ]);

        // Cliente frecuente con fiado habilitado
        Cliente::create([
            'empresa_id' => $empresa->id,
            'tipo_documento' => 'V',
            'documento' => '12345678',
            'nombre' => 'Carmen Rodríguez',
            'telefono' => '0414-1234567',
            'credito_habilitado' => true,
            'limite_credito_usd' => 50,
        ]);
    }
}
