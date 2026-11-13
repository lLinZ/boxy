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
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Cuenta de prueba comercial: una empresa de muestra con catálogo y un admin
 * con acceso a todas las funciones de la empresa (plan Franquicia activo).
 * Sirve para enseñar Boxy a clientes. Idempotente y apta para producción:
 * la clave NO vive en el código, sale de BOXY_DEMO_PASSWORD (o se genera y
 * se muestra una vez).
 *
 *   php artisan db:seed --class=CuentaPruebaSeeder
 */
class CuentaPruebaSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(PlanesSeeder::class);

        $email = env('BOXY_DEMO_EMAIL', 'aristides@boxy.com');
        if (User::where('email', $email)->exists()) {
            $this->command?->info("La cuenta de prueba {$email} ya existe.");

            return;
        }

        $empresa = Empresa::create([
            'nombre' => 'Boxy Demo Market',
            'razon_social' => 'Empresa de Prueba Boxy, C.A.',
            'tipo_rif' => 'J',
            'rif' => '000000000',
            'direccion_fiscal' => 'Av. Francisco de Miranda, Chacao, Caracas',
            'telefono' => '0212-0000000',
            'email' => 'demo@boxy.com',
        ]);

        $sucursal = Sucursal::create([
            'empresa_id' => $empresa->id,
            'codigo' => 'PRINCIPAL',
            'nombre' => 'Sede Principal',
            'direccion' => 'Av. Francisco de Miranda, Chacao, Caracas',
            'serie_control' => '00',
        ]);

        $clave = env('BOXY_DEMO_PASSWORD') ?: Str::password(14, symbols: false);
        User::create([
            'name' => env('BOXY_DEMO_NOMBRE', 'Aristides'),
            'email' => $email,
            'password' => Hash::make($clave),
            'empresa_id' => $empresa->id,
            'sucursal_id' => $sucursal->id,
            'rol' => 'admin', // el rol con todos los permisos de la empresa
        ]);

        // Plan más completo, activo por un año: todas las funciones encendidas.
        $plan = Plan::where('codigo', 'franquicia')->first() ?? Plan::orderByDesc('orden')->first();
        Suscripcion::create([
            'empresa_id' => $empresa->id,
            'plan_id' => $plan->id,
            'estado' => 'activa',
            'precio_usd' => $plan->precio_mensual_usd,
            'max_sucursales' => $plan->max_sucursales,
            'max_usuarios' => $plan->max_usuarios,
            'max_productos' => $plan->max_productos,
            'features' => $plan->features,
            'vence_el' => Carbon::now()->addYear(),
            'gracia_hasta' => Carbon::now()->addYear()->addDays($plan->dias_gracia),
        ]);

        $this->sembrarCatalogo($empresa, $sucursal);
        $this->sembrarClientes($empresa);

        $this->command?->info("Cuenta de prueba creada: {$email} (empresa \"{$empresa->nombre}\").");
        if (! env('BOXY_DEMO_PASSWORD')) {
            $this->command?->warn("Clave generada (no se vuelve a mostrar): {$clave}");
        }
    }

    /** Catálogo típico de un minimarket venezolano (precios en USD). */
    private function sembrarCatalogo(Empresa $empresa, Sucursal $sucursal): void
    {
        // [nombre, IVA, venta, costo, código de barras, stock]
        $catalogo = [
            'Bebidas' => [
                ['Coca-Cola 2 L', 'general', 1.80, 1.20, '7591016000113', 48],
                ['Agua mineral 1,5 L', 'general', 0.90, 0.55, '7591016000120', 60],
                ['Malta 355 ml', 'general', 0.75, 0.48, '7591016000137', 72],
                ['Jugo de naranja 1 L', 'general', 1.60, 1.05, '7591016000144', 24],
            ],
            'Víveres' => [
                ['Harina de maíz 1 kg', 'reducido', 1.10, 0.75, '7591001100114', 120],
                ['Arroz 1 kg', 'reducido', 1.30, 0.90, '7591001100121', 90],
                ['Pasta larga 1 kg', 'reducido', 1.45, 0.98, '7591001100138', 70],
                ['Caraotas negras 1 kg', 'reducido', 2.10, 1.45, '7591001100145', 40],
                ['Azúcar 1 kg', 'reducido', 1.25, 0.88, '7591001100152', 65],
                ['Aceite vegetal 1 L', 'general', 3.20, 2.30, '7591001100169', 35],
                ['Café molido 500 g', 'general', 4.50, 3.20, '7591001100176', 30],
            ],
            'Lácteos y charcutería' => [
                ['Leche completa 1 L', 'exento', 1.70, 1.15, '7591002200117', 50],
                ['Queso blanco (kg)', 'exento', 6.80, 4.90, '2100000000016', 15],
                ['Jamón de pierna (kg)', 'general', 9.50, 6.70, '2100000000023', 10],
                ['Mantequilla 250 g', 'general', 2.40, 1.65, '7591002200124', 28],
            ],
            'Panadería' => [
                ['Pan canilla', 'exento', 0.70, 0.40, '2000000000017', 80],
                ['Pan de sándwich', 'general', 2.20, 1.50, '2000000000024', 20],
            ],
            'Limpieza e higiene' => [
                ['Jabón de tocador', 'general', 0.95, 0.60, '7593003300118', 60],
                ['Detergente en polvo 1 kg', 'general', 3.10, 2.15, '7593003300125', 25],
                ['Papel higiénico x4', 'general', 2.60, 1.80, '7593003300132', 40],
            ],
        ];

        foreach ($catalogo as $nombreCat => $productos) {
            $categoria = Categoria::create([
                'empresa_id' => $empresa->id,
                'nombre' => $nombreCat,
                'slug' => Str::slug($nombreCat),
            ]);

            foreach ($productos as $i => [$nombre, $tipoIva, $venta, $costo, $codigoBarra, $stock]) {
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
                    'cantidad' => $stock,
                    'stock_minimo' => 10,
                ]);
            }
        }
    }

    private function sembrarClientes(Empresa $empresa): void
    {
        Cliente::create([
            'empresa_id' => $empresa->id,
            'tipo_documento' => 'V',
            'documento' => '00000000',
            'nombre' => 'Consumidor Final',
        ]);

        Cliente::create([
            'empresa_id' => $empresa->id,
            'tipo_documento' => 'V',
            'documento' => '12345678',
            'nombre' => 'Cliente Frecuente',
            'telefono' => '0414-0000000',
            'credito_habilitado' => true,
            'limite_credito_usd' => 50,
        ]);
    }
}
