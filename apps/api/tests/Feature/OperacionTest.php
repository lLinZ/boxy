<?php

namespace Tests\Feature;

use App\Models\Producto;
use App\Services\RespaldoService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Operación diaria y ampliaciones: compras, precios, balanza, vencimientos, respaldos y fiscal. */
class OperacionTest extends TestCase
{
    use Escenario, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->crearEscenario(40.0);
    }

    public function test_la_compra_suma_stock_y_calcula_el_costo_promedio(): void
    {
        // Harina: 100 unidades a costo 0,77. Entran 50 a 1,00 → (100×0,77 + 50×1) / 150 = 0,8467
        $this->como($this->admin)->postJson('/api/proveedores', ['tipo_documento' => 'J', 'nombre' => 'Alimentos CA'])->assertCreated();

        $compra = $this->postJson('/api/compras', [
            'moneda' => 'VES', 'tasa' => 40, 'condicion' => 'credito', 'vence_el' => now()->addDays(15)->toDateString(),
            'items' => [['producto_id' => $this->harina->id, 'cantidad' => 50, 'costo_unitario' => 40, 'iva_pct' => 8,
                'lote' => 'L-1', 'vence_el' => now()->addDays(10)->toDateString(), 'precio_venta_usd' => 1.25]],
        ])->assertCreated()->json();

        $this->assertEquals(150, $this->stock($this->harina));
        $this->assertEquals(0.8467, (float) Producto::find($this->harina->id)->precio_costo_usd);
        $this->assertEquals(1.25, (float) Producto::find($this->harina->id)->precio_venta_usd);
        $this->assertEquals(54, $compra['total_usd']); // 50 × 1 + 8 %
        $this->assertFalse($compra['pagada']);

        // Anular la saca del stock
        $this->postJson("/api/compras/{$compra['id']}/anular")->assertOk()->assertJsonPath('estado', 'anulada');
        $this->assertEquals(100, $this->stock($this->harina));
    }

    public function test_cambio_masivo_de_precios_con_vista_previa(): void
    {
        $this->como($this->admin);
        $vista = $this->postJson('/api/productos/precios-masivos', [
            'alcance' => 'todos', 'operacion' => 'porcentaje', 'valor' => 10, 'redondeo' => '0.05',
        ])->assertOk()->json();

        $this->assertFalse($vista['aplicado']);
        $harina = collect($vista['cambios'])->firstWhere('id', $this->harina->id);
        $this->assertEquals(1.25, $harina['precio_nuevo_usd']); // 1,21 → redondeado arriba a 1,25
        $this->assertEquals(1.10, (float) Producto::find($this->harina->id)->precio_venta_usd);

        $this->postJson('/api/productos/precios-masivos', [
            'alcance' => 'todos', 'operacion' => 'porcentaje', 'valor' => 10, 'redondeo' => '0.05', 'aplicar' => true,
        ])->assertOk();
        $this->assertEquals(1.25, (float) Producto::find($this->harina->id)->precio_venta_usd);
        $this->getJson("/api/productos/{$this->harina->id}/precios")->assertOk()->assertJsonPath('0.motivo', 'masivo');

        $this->como($this->cajero)->postJson('/api/productos/precios-masivos', [
            'alcance' => 'todos', 'operacion' => 'porcentaje', 'valor' => -50,
        ])->assertForbidden();
    }

    public function test_etiqueta_de_balanza_trae_el_peso(): void
    {
        $this->empresa->update(['config' => ['balanza_activa' => true]]);
        $queso = $this->producto('QUE-1', 'Queso blanco', 6.40, 'exento');
        $queso->update(['pesable' => true, 'codigo_balanza' => '123', 'unidad' => 'KG']);

        // 20 + PLU 00123 + 00350 g + dígito verificador
        $base = '200012300350';
        $suma = 0;
        for ($i = 0; $i < 12; $i++) {
            $suma += (int) $base[$i] * ($i % 2 === 0 ? 1 : 3);
        }
        $codigo = $base.((10 - $suma % 10) % 10);

        $this->como($this->cajero)->getJson("/api/productos/codigo-barra/{$codigo}")
            ->assertOk()->assertJsonPath('id', $queso->id)->assertJsonPath('cantidad_balanza', 0.35);

        $this->getJson('/api/productos/codigo-barra/2000123003509')->assertNotFound(); // verificador errado
    }

    public function test_vencimientos_estima_lo_que_queda_de_cada_lote(): void
    {
        $this->como($this->admin);
        // Stock 100 sin lote; entran dos lotes: 20 que vencen en 5 días y 30 en 60 días → stock 150
        $this->postJson('/api/inventario/movimiento', ['producto_id' => $this->refresco->id, 'tipo' => 'entrada', 'cantidad' => 20,
            'vence_el' => now()->addDays(5)->toDateString()])->assertCreated();
        $this->postJson('/api/inventario/movimiento', ['producto_id' => $this->refresco->id, 'tipo' => 'entrada', 'cantidad' => 30,
            'vence_el' => now()->addDays(60)->toDateString()])->assertCreated();
        // Se venden/sacan 135 → quedan 15: están en el lote que vence más tarde (primero en vencer, primero en salir)
        $this->postJson('/api/inventario/movimiento', ['producto_id' => $this->refresco->id, 'tipo' => 'salida', 'cantidad' => 135])->assertCreated();

        $lotes = $this->getJson('/api/inventario/vencimientos?dias=90')->assertOk()->json('lotes');
        $this->assertCount(1, $lotes);
        $this->assertEquals(15, $lotes[0]['cantidad_estimada']);

        $this->postJson('/api/inventario/movimiento', ['producto_id' => $this->refresco->id, 'tipo' => 'ajuste', 'cantidad' => 45])->assertCreated();
        $lotes = $this->getJson('/api/inventario/vencimientos?dias=30')->assertOk()->json('lotes');
        $this->assertEquals(15, $lotes[0]['cantidad_estimada']); // el lote de 5 días conserva 15 de 20
    }

    public function test_puntos_se_ganan_y_se_canjean(): void
    {
        $this->empresa->update(['config' => ['puntos_activo' => true, 'puntos_por_usd' => 10, 'puntos_valor_usd' => 0.01, 'puntos_minimo_canje' => 100]]);
        $this->abrirCaja($this->cajero);

        $this->postJson('/api/ventas', [
            'cliente_id' => $this->cliente->id,
            'items' => [['producto_id' => $this->pan->id, 'cantidad' => 2]],
            'pagos' => [['metodo' => 'efectivo_bs', 'monto' => 800]],
        ])->assertCreated()->assertJsonPath('puntos_ganados', 200);

        // Canjea $1 (100 puntos) en la siguiente compra
        $this->postJson('/api/ventas', [
            'cliente_id' => $this->cliente->id,
            'items' => [['producto_id' => $this->pan->id, 'cantidad' => 1]],
            'pagos' => [['metodo' => 'puntos', 'monto' => 1], ['metodo' => 'efectivo_bs', 'monto' => 360]],
        ])->assertCreated();

        $this->assertEquals(200 - 100 + 90, $this->cliente->fresh()->puntos);
    }

    public function test_respaldo_crea_un_archivo_restaurable(): void
    {
        $servicio = app(RespaldoService::class);
        $r = $servicio->crear();

        $this->assertMatchesRegularExpression(RespaldoService::PATRON, $r['archivo']);
        $this->assertGreaterThan(1000, $r['bytes']);
        $contenido = gzdecode(file_get_contents($servicio->ruta($r['archivo'])));
        $this->assertStringContainsString('CREATE TABLE `ventas`', $contenido);

        unlink($servicio->ruta($r['archivo']));
    }

    public function test_cola_fiscal_para_el_puente(): void
    {
        $this->empresa->update(['config' => ['fiscal_activa' => true]]);
        $this->abrirCaja($this->admin);
        $venta = $this->postJson('/api/ventas', [
            'cliente_id' => $this->cliente->id,
            'items' => [['producto_id' => $this->harina->id, 'cantidad' => 2]],
            'pagos' => [['metodo' => 'efectivo_bs', 'monto' => 95.2]],
        ])->assertCreated()->assertJsonPath('estado_fiscal', 'pendiente')->json();

        $clave = $this->postJson('/api/fiscal/clave')->assertCreated()->json('clave');

        $this->app['auth']->forgetGuards();
        $pendientes = $this->withToken($clave)->getJson('/api/fiscal/puente/pendientes')->assertOk()->json();
        $this->assertCount(1, $pendientes);
        $comandos = $pendientes[0]['comandos'];
        $this->assertSame('iR*V11111111', $comandos[0]);
        $this->assertContains('"000000440000002000Harina 1Kg', $comandos); // 8 %: 44,00 Bs × 2
        $this->assertSame('101', end($comandos));

        $this->withToken($clave)->postJson("/api/fiscal/puente/ventas/{$venta['id']}/resultado", [
            'ok' => true, 'numero_fiscal' => '00000123', 'serial' => 'Z1A2B3',
        ])->assertOk();
        $this->withToken($clave)->getJson('/api/productos')->assertForbidden(); // la clave del puente no sirve para más
        $this->assertSame('impresa', \App\Models\Venta::find($venta['id'])->estado_fiscal);
    }
}
