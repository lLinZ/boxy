<?php

namespace Tests\Feature;

use App\Models\Plan;
use App\Models\Producto;
use App\Models\Suscripcion;
use Database\Seeders\PlanesSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Lo que la landing promete por plan se cumple en el sistema:
 * límites de productos, usuarios y sucursales, y funciones por plan.
 */
class PlanesTest extends TestCase
{
    use Escenario, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->crearEscenario(40.0);
        // El escenario trae su propio plan "minimarket" de prueba: se aparta para usar los reales.
        Plan::where('codigo', 'minimarket')->update(['codigo' => 'prueba']);
        $this->seed(PlanesSeeder::class);
    }

    /** Pone a la empresa en un plan real (copia sus límites a la suscripción, como al contratar). */
    private function enPlan(string $codigo): Plan
    {
        $plan = Plan::where('codigo', $codigo)->firstOrFail();
        Suscripcion::where('empresa_id', $this->empresa->id)->update([
            'plan_id' => $plan->id,
            'max_sucursales' => $plan->max_sucursales,
            'max_usuarios' => $plan->max_usuarios,
            'max_productos' => $plan->max_productos,
            'features' => json_encode($plan->features),
        ]);

        return $plan;
    }

    private function datosProducto(string $sku): array
    {
        return ['sku' => $sku, 'nombre' => "Producto {$sku}", 'precio_venta_usd' => 1, 'tipo_iva' => 'general'];
    }

    public function test_los_planes_publicos_dicen_lo_que_la_landing_muestra(): void
    {
        $planes = collect($this->getJson('/api/planes')->assertOk()->json())->keyBy('codigo');

        $this->assertSame(100, $planes['basico']['max_productos']);
        $this->assertSame(1, $planes['basico']['max_sucursales']);
        $this->assertSame(2, $planes['basico']['max_usuarios']);
        $this->assertFalse($planes['basico']['features']['monitor']);
        $this->assertFalse($planes['basico']['features']['analisis']);
        $this->assertTrue($planes['basico']['features']['escaner_remoto']);
        $this->assertSame(0, $planes['minimarket']['max_productos']);
        $this->assertSame(5, $planes['minimarket']['max_usuarios']);
        $this->assertSame(0, $planes['franquicia']['max_sucursales']);
    }

    public function test_basico_no_pasa_de_100_productos_activos(): void
    {
        $this->enPlan('basico');
        // El escenario ya tiene 3 productos: se completan 100.
        for ($i = 4; $i <= 100; $i++) {
            Producto::create(['empresa_id' => $this->empresa->id, ...$this->datosProducto("P{$i}")]);
        }

        $this->como($this->admin)->postJson('/api/productos', $this->datosProducto('EXTRA'))
            ->assertStatus(422)->assertJsonPath('limite_plan', 'productos')->assertJsonPath('maximo', 100);

        // Desactivar uno libera el cupo
        $this->deleteJson("/api/productos/{$this->pan->id}")->assertOk();
        $this->postJson('/api/productos', $this->datosProducto('EXTRA'))->assertCreated();

        // …y reactivar el desactivado ya no cabe
        $this->putJson("/api/productos/{$this->pan->id}", [...$this->datosProducto('PAN-1'), 'nombre' => 'Pan especial', 'precio_venta_usd' => 10, 'activo' => true])
            ->assertStatus(422)->assertJsonPath('limite_plan', 'productos');
    }

    public function test_la_importacion_respeta_el_limite_y_actualiza_sin_gastar_cupo(): void
    {
        $this->enPlan('basico');
        for ($i = 4; $i <= 98; $i++) {
            Producto::create(['empresa_id' => $this->empresa->id, ...$this->datosProducto("P{$i}")]);
        }

        $r = $this->como($this->admin)->postJson('/api/productos/importar', ['productos' => [
            ['sku' => 'HAR-1', 'nombre' => 'Harina 1Kg', 'precio_venta_usd' => 1.2], // ya existe: actualiza
            ['sku' => 'N1', 'nombre' => 'Nuevo 1', 'precio_venta_usd' => 1],
            ['sku' => 'N2', 'nombre' => 'Nuevo 2', 'precio_venta_usd' => 1],
            ['sku' => 'N3', 'nombre' => 'Nuevo 3', 'precio_venta_usd' => 1], // pasa del límite
        ]])->assertOk();

        $r->assertJsonPath('creados', 2)->assertJsonPath('actualizados', 1);
        $this->assertCount(1, $r->json('errores'));
        $this->assertSame(4, $r->json('errores.0.fila'));
        $this->assertSame(100, Producto::where('empresa_id', $this->empresa->id)->where('activo', true)->count());
    }

    public function test_un_excel_sin_sku_entra_igual_y_no_duplica_al_reimportar(): void
    {
        $filas = [
            ['nombre' => 'Arroz 1kg', 'precio_venta_usd' => 1.3, 'stock_inicial' => 20],
            ['nombre' => 'Azúcar 1kg', 'precio_venta_usd' => 1.5, 'codigo_barra' => '7590000000017'],
        ];
        $this->como($this->admin)->postJson('/api/productos/importar', ['productos' => $filas])
            ->assertOk()->assertJsonPath('creados', 2)->assertJsonPath('errores', []);

        $this->postJson('/api/productos/importar', ['productos' => $filas])
            ->assertOk()->assertJsonPath('creados', 0)->assertJsonPath('actualizados', 2);

        $arroz = Producto::where('nombre', 'Arroz 1kg')->firstOrFail();
        $this->assertNotEmpty($arroz->sku);
        $this->assertSame('7590000000017', Producto::where('nombre', 'Azúcar 1kg')->value('sku'));
        $this->assertEquals(20, $this->stock($arroz));
    }

    public function test_basico_no_tiene_monitor_ni_analisis_pero_si_escaner(): void
    {
        $this->enPlan('basico');
        $this->como($this->admin);

        $this->getJson('/api/monitor')->assertForbidden()->assertJsonPath('funcion_plan', 'monitor');
        $this->getJson('/api/monitor/recomendaciones')->assertForbidden();
        $this->getJson('/api/productos/metricas')->assertForbidden()->assertJsonPath('funcion_plan', 'analisis');
        $this->postJson('/api/scanner/emparejar')->assertSuccessful();
        $this->getJson('/api/dashboard')->assertOk(); // el panel principal es de todos los planes

        $this->getJson('/api/empresa')->assertOk()
            ->assertJsonPath('plan.funciones.monitor', false)
            ->assertJsonPath('plan.limites.productos.maximo', 100)
            ->assertJsonPath('plan.limites.productos.uso', 3);
    }

    public function test_minimarket_y_franquicia_tienen_monitor_y_analisis(): void
    {
        foreach (['minimarket', 'franquicia'] as $codigo) {
            $this->enPlan($codigo);
            $this->como($this->admin);
            $this->getJson('/api/monitor')->assertOk();
            $this->getJson('/api/monitor/recomendaciones')->assertOk();
            $this->getJson('/api/productos/metricas')->assertOk();
        }
    }

    public function test_usuarios_segun_el_plan_y_reactivar_no_salta_el_limite(): void
    {
        $this->enPlan('basico'); // 2 usuarios; el escenario ya tiene 3 activos
        $this->como($this->admin)->postJson('/api/usuarios', [
            'name' => 'Otro', 'email' => 'otro@uno.test', 'password' => 'Clave1234', 'rol' => 'cajero', 'sucursal_id' => $this->sucursal->id,
        ])->assertStatus(422)->assertJsonPath('limite_plan', 'usuarios');

        $this->enPlan('minimarket'); // 5 usuarios
        $nuevo = $this->postJson('/api/usuarios', [
            'name' => 'Otro', 'email' => 'otro@uno.test', 'password' => 'Clave1234', 'rol' => 'cajero', 'sucursal_id' => $this->sucursal->id,
        ])->assertCreated()->json('id');
        $this->postJson('/api/usuarios', [
            'name' => 'Otro 2', 'email' => 'otro2@uno.test', 'password' => 'Clave1234', 'rol' => 'cajero', 'sucursal_id' => $this->sucursal->id,
        ])->assertCreated();
        $this->postJson('/api/usuarios', [
            'name' => 'Sexto', 'email' => 'sexto@uno.test', 'password' => 'Clave1234', 'rol' => 'cajero', 'sucursal_id' => $this->sucursal->id,
        ])->assertStatus(422);

        // Desactivar uno y crear otro: se llena de nuevo. Reactivar al primero ya no cabe.
        $this->deleteJson("/api/usuarios/{$nuevo}")->assertOk();
        $this->postJson('/api/usuarios', [
            'name' => 'Sexto', 'email' => 'sexto@uno.test', 'password' => 'Clave1234', 'rol' => 'cajero', 'sucursal_id' => $this->sucursal->id,
        ])->assertCreated();
        $this->putJson("/api/usuarios/{$nuevo}", [
            'name' => 'Otro', 'email' => 'otro@uno.test', 'rol' => 'cajero', 'sucursal_id' => $this->sucursal->id, 'activo' => true,
        ])->assertStatus(422)->assertJsonPath('limite_plan', 'usuarios');
    }

    public function test_sucursales_una_en_basico_y_minimarket_ilimitadas_en_franquicia(): void
    {
        foreach (['basico', 'minimarket'] as $codigo) {
            $this->enPlan($codigo);
            $this->como($this->admin)->postJson('/api/sucursales', ['nombre' => 'Sucursal Este'])
                ->assertStatus(422)->assertJsonPath('limite_plan', 'sucursales');
        }

        $this->enPlan('franquicia');
        foreach (['Este', 'Oeste', 'Centro'] as $nombre) {
            $this->postJson('/api/sucursales', ['nombre' => "Sucursal {$nombre}"])->assertCreated();
        }
        $this->assertCount(4, $this->getJson('/api/sucursales')->assertOk()->json());

        // El cajero no crea sucursales
        $this->como($this->cajero)->postJson('/api/sucursales', ['nombre' => 'X'])->assertForbidden();
    }

    public function test_el_inventario_de_cada_sucursal_va_por_separado_y_el_dueno_ve_todas(): void
    {
        $this->enPlan('franquicia');
        $otra = $this->como($this->admin)->postJson('/api/sucursales', ['nombre' => 'Sucursal Este'])->assertCreated()->json('id');

        // En la sucursal nueva todo sale con stock 0, incluso sin movimientos.
        $inv = collect($this->getJson("/api/inventario?sucursal_id={$otra}")->assertOk()->json())->keyBy('producto_id');
        $this->assertCount(3, $inv);
        $this->assertEquals(0, $inv[$this->harina->id]['cantidad']);

        // En la principal sigue el stock de siempre
        $inv = collect($this->getJson('/api/inventario')->assertOk()->json())->keyBy('producto_id');
        $this->assertEquals(100, $inv[$this->harina->id]['cantidad']);

        // El cajero solo ve su sucursal
        $this->como($this->cajero)->getJson("/api/inventario?sucursal_id={$otra}")->assertForbidden();
    }

    public function test_un_producto_recien_creado_aparece_en_el_inventario(): void
    {
        $id = $this->como($this->admin)->postJson('/api/productos', $this->datosProducto('NUEVO'))->assertCreated()->json('id');

        $fila = collect($this->getJson('/api/inventario')->assertOk()->json())->firstWhere('producto_id', $id);
        $this->assertNotNull($fila);
        $this->assertEquals(0, $fila['cantidad']);
    }

    public function test_el_kardex_dice_quien_hizo_cada_movimiento(): void
    {
        $this->como($this->gerente)->postJson('/api/inventario/movimiento', [
            'producto_id' => $this->harina->id, 'tipo' => 'entrada', 'cantidad' => 5,
        ])->assertSuccessful();

        $this->getJson("/api/inventario/kardex/{$this->harina->id}")->assertOk()
            ->assertJsonPath('data.0.user.name', 'Gerente');
    }

    public function test_se_cobra_con_usdt_y_paga_igtf_como_divisa(): void
    {
        $this->abrirCaja($this->cajero);

        $venta = $this->postJson('/api/ventas', [
            'items' => [['producto_id' => $this->pan->id, 'cantidad' => 1]], // 10 $ exento
            'pagos' => [['metodo' => 'usdt', 'monto' => 10.3]],
        ])->assertCreated()->json();

        $this->assertEquals(10.30, $venta['total_usd']);
        $this->assertSame('usdt', $venta['pagos'][0]['metodo']);
        $this->assertSame('USD', $venta['pagos'][0]['moneda']);
    }

    public function test_la_licencia_se_puede_reportar_pagada_por_binance(): void
    {
        $this->enPlan('basico');
        $this->como($this->admin)->postJson('/api/suscripcion/pago', [
            'metodo' => 'binance', 'moneda' => 'USD', 'monto' => 29, 'monto_usd' => 29, 'referencia' => '123456789',
        ])->assertCreated()->assertJsonPath('metodo', 'binance');
    }
}
