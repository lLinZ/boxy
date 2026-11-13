<?php

namespace Tests\Feature;

use App\Models\Cliente;
use App\Models\Promocion;
use App\Models\Venta;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/** Motor de ventas: precios, pagos, vuelto, IGTF, caja, anulaciones, devoluciones y fiado. */
class VentasTest extends TestCase
{
    use Escenario, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->crearEscenario(40.0);
    }

    public function test_no_se_vende_sin_abrir_caja(): void
    {
        $this->como($this->cajero)->postJson('/api/ventas', [
            'items' => [['producto_id' => $this->pan->id, 'cantidad' => 1]],
            'pagos' => [['metodo' => 'efectivo_usd', 'monto' => 20]],
        ])->assertStatus(422)->assertJsonPath('requiere_turno', true);
    }

    public function test_el_precio_y_el_iva_salen_del_catalogo(): void
    {
        $this->abrirCaja($this->cajero);

        $venta = $this->postJson('/api/ventas', [
            'items' => [['producto_id' => $this->harina->id, 'cantidad' => 2, 'precio_unitario_usd' => 0.01, 'tipo_iva' => 'exento']],
            'pagos' => [['metodo' => 'efectivo_bs', 'monto' => 95.2]],
        ])->assertCreated()->json();

        $this->assertEquals(2.38, $venta['total_usd']); // 2 × 1,10 + 8 %
        $this->assertEquals('reducido', $venta['items'][0]['tipo_iva']);
        $this->assertEquals(98, $this->stock($this->harina));
    }

    public function test_rechaza_un_pago_que_no_cubre_el_total(): void
    {
        $this->abrirCaja($this->cajero);

        $this->postJson('/api/ventas', [
            'items' => [['producto_id' => $this->pan->id, 'cantidad' => 1]],
            'pagos' => [['metodo' => 'efectivo_usd', 'monto' => 1]],
        ])->assertStatus(422)->assertJsonFragment(['faltante_usd' => 9.03]);

        $this->assertSame(0, Venta::count());
        $this->assertEquals(100, $this->stock($this->pan));
    }

    public function test_billete_grande_igtf_sobre_lo_aplicado_y_vuelto_en_bolivares(): void
    {
        $this->abrirCaja($this->cajero);

        $venta = $this->postJson('/api/ventas', [
            'items' => [['producto_id' => $this->pan->id, 'cantidad' => 1]],
            'pagos' => [['metodo' => 'efectivo_usd', 'monto' => 20]],
            'vuelto_metodo' => 'efectivo_bs',
        ])->assertCreated()->json();

        $this->assertEquals(0.30, $venta['igtf_usd']);
        $this->assertEquals(10.30, $venta['total_usd']);
        $this->assertEquals(9.70, $venta['vuelto_usd']);
        $this->assertEquals(388.00, $venta['vuelto_monto']); // 9,70 × 40
        $this->assertEquals('VES', $venta['vuelto_moneda']);
    }

    public function test_el_cajero_necesita_pin_de_supervisor_para_descontar(): void
    {
        $this->abrirCaja($this->cajero);
        $datos = [
            'items' => [['producto_id' => $this->pan->id, 'cantidad' => 1, 'descuento_usd' => 2]],
            'pagos' => [['metodo' => 'efectivo_usd', 'monto' => 20]],
        ];

        $this->postJson('/api/ventas', $datos)->assertStatus(403)->assertJsonPath('requiere_supervisor', true);

        $this->postJson('/api/ventas', $datos + ['autorizacion' => ['email' => 'gerente@uno.test', 'pin' => '0000']])
            ->assertStatus(403);

        $venta = $this->postJson('/api/ventas', $datos + ['autorizacion' => ['email' => 'gerente@uno.test', 'pin' => '4321']])
            ->assertCreated()->json();

        $this->assertEquals(2, $venta['descuento_usd']);
        $this->assertEquals($this->gerente->id, $venta['autorizada_por']);
    }

    public function test_no_acepta_clientes_de_otra_empresa(): void
    {
        $otra = $this->nuevaEmpresa('Tienda Dos', '400000002', \App\Models\Plan::first());
        $ajeno = Cliente::create(['empresa_id' => $otra->id, 'tipo_documento' => 'V', 'documento' => '22222222', 'nombre' => 'Ajeno']);

        $this->abrirCaja($this->cajero);
        $this->postJson('/api/ventas', [
            'cliente_id' => $ajeno->id,
            'items' => [['producto_id' => $this->pan->id, 'cantidad' => 1]],
            'pagos' => [['metodo' => 'efectivo_usd', 'monto' => 20]],
        ])->assertStatus(422);

        $this->getJson("/api/clientes/{$ajeno->id}")->assertNotFound();
    }

    public function test_anular_exige_supervisor_y_devuelve_el_stock(): void
    {
        $this->abrirCaja($this->cajero);
        $venta = $this->postJson('/api/ventas', [
            'items' => [['producto_id' => $this->refresco->id, 'cantidad' => 3]],
            'pagos' => [['metodo' => 'efectivo_usd', 'monto' => 10]],
        ])->assertCreated()->json();
        $this->assertEquals(97, $this->stock($this->refresco));

        $this->postJson("/api/ventas/{$venta['id']}/anular", ['motivo' => 'Error de cobro'])->assertStatus(403);

        $this->postJson("/api/ventas/{$venta['id']}/anular", [
            'motivo' => 'Error de cobro',
            'autorizacion' => ['email' => 'gerente@uno.test', 'pin' => '4321'],
        ])->assertOk()->assertJsonPath('estado', 'anulada');

        $this->assertEquals(100, $this->stock($this->refresco));
        $this->postJson("/api/ventas/{$venta['id']}/anular", ['motivo' => 'otra vez'])->assertStatus(403);
    }

    public function test_devolucion_parcial_y_cierre_de_caja_cuadran(): void
    {
        $turno = $this->abrirCaja($this->gerente, 100, 20);

        // Venta: 2 panes = $20 exento, pagan $30 en efectivo → IGTF 0,60, vuelto 9,40 en dólares
        $venta = $this->como($this->gerente)->postJson('/api/ventas', [
            'items' => [['producto_id' => $this->pan->id, 'cantidad' => 2]],
            'pagos' => [['metodo' => 'efectivo_usd', 'monto' => 30]],
            'vuelto_metodo' => 'efectivo_usd',
        ])->assertCreated()->json();
        $this->assertEquals(9.40, $venta['vuelto_usd']);

        // Devuelve 1 pan ($10) en bolívares (400 Bs a tasa 40)
        $item = $venta['items'][0]['id'];
        $this->postJson("/api/ventas/{$venta['id']}/devoluciones", [
            'motivo' => 'Vencido', 'metodo' => 'efectivo_bs',
            'items' => [['venta_item_id' => $item, 'cantidad' => 1, 'reintegra_stock' => false]],
        ])->assertCreated()->assertJsonPath('reintegro_monto', '400.00');

        $this->assertEquals(98, $this->stock($this->pan)); // dañado: no vuelve al stock
        $this->postJson("/api/ventas/{$venta['id']}/devoluciones", [
            'motivo' => 'x', 'metodo' => 'efectivo_bs',
            'items' => [['venta_item_id' => $item, 'cantidad' => 2]],
        ])->assertStatus(422); // ya solo queda 1

        // Esperado: USD 20 + 30 − 9,40 = 40,60 · Bs 100 − 400 = −300
        $cierre = $this->postJson("/api/caja/turnos/{$turno}/cerrar", ['contado_bs' => 0, 'contado_usd' => 40.60])
            ->assertOk()->json();

        $this->assertEquals(40.60, $cierre['turno']['esperado_usd']);
        $this->assertEquals(-300, $cierre['turno']['esperado_bs']);
        $this->assertEquals(0, $cierre['turno']['diferencia_usd']);
        $this->assertEquals(1, $cierre['resumen']['devoluciones']['cantidad']);
    }

    public function test_el_cajero_no_ve_el_efectivo_esperado_antes_de_cerrar(): void
    {
        $this->abrirCaja($this->cajero, 50);
        $this->getJson('/api/caja/actual')->assertOk()->assertJsonMissingPath('resumen.efectivo');
    }

    public function test_fiado_respeta_el_limite_y_los_abonos_bajan_la_deuda(): void
    {
        $this->abrirCaja($this->cajero);
        $fiar = fn (float $monto, ?array $aut = null) => $this->postJson('/api/ventas', array_filter([
            'cliente_id' => $this->cliente->id,
            'items' => [['producto_id' => $this->pan->id, 'cantidad' => 1]],
            'pagos' => [['metodo' => 'credito', 'monto' => $monto]],
            'autorizacion' => $aut,
        ]));

        $fiar(10)->assertCreated();
        $fiar(10)->assertCreated();
        $fiar(10)->assertStatus(403); // superaría el límite de $20
        $fiar(10, ['email' => 'gerente@uno.test', 'pin' => '4321'])->assertCreated();

        $this->assertEquals(30, Cliente::find($this->cliente->id)->saldo_usd);

        $this->postJson("/api/clientes/{$this->cliente->id}/abonos", ['metodo' => 'efectivo_bs', 'monto' => 400])
            ->assertCreated()->assertJsonPath('cliente.saldo_usd', '20.00');
        $this->postJson("/api/clientes/{$this->cliente->id}/abonos", ['metodo' => 'efectivo_usd', 'monto' => 50])
            ->assertStatus(422); // más que la deuda

        $cuenta = $this->getJson("/api/clientes/{$this->cliente->id}/cuenta")->assertOk()->json();
        $this->assertCount(4, $cuenta['movimientos']['data']);
    }

    public function test_la_misma_venta_sin_conexion_no_se_cobra_dos_veces(): void
    {
        $this->abrirCaja($this->cajero);
        $datos = [
            'uuid' => (string) Str::uuid(), 'origen' => 'offline',
            'items' => [['producto_id' => $this->pan->id, 'cantidad' => 1]],
            'pagos' => [['metodo' => 'efectivo_usd', 'monto' => 10.30]],
        ];

        $a = $this->postJson('/api/ventas', $datos)->assertCreated()->json('id');
        $b = $this->postJson('/api/ventas', $datos)->assertOk()->json('id');

        $this->assertSame($a, $b);
        $this->assertSame(1, Venta::count());
        $this->assertEquals(99, $this->stock($this->pan));
    }

    public function test_las_promociones_las_aplica_el_servidor(): void
    {
        Promocion::create([
            'empresa_id' => $this->empresa->id, 'nombre' => '3x2 pan', 'tipo' => 'nxm',
            'producto_id' => $this->pan->id, 'lleva' => 3, 'paga' => 2, 'activo' => true,
        ]);
        $this->abrirCaja($this->cajero);

        $venta = $this->postJson('/api/ventas', [
            'items' => [['producto_id' => $this->pan->id, 'cantidad' => 3]],
            'pagos' => [['metodo' => 'efectivo_bs', 'monto' => 800]],
            'total_esperado_usd' => 20,
        ])->assertCreated()->json();

        $this->assertEquals(20, $venta['total_usd']);
        $this->assertEquals(10, $venta['items'][0]['promocion_usd']);
    }

    public function test_avisa_si_el_total_cambio_antes_de_cobrar(): void
    {
        $this->abrirCaja($this->cajero);

        $this->postJson('/api/ventas', [
            'items' => [['producto_id' => $this->pan->id, 'cantidad' => 1]],
            'pagos' => [['metodo' => 'efectivo_bs', 'monto' => 400]],
            'total_esperado_usd' => 9.5,
        ])->assertStatus(409)->assertJsonPath('total_usd', 10);
    }
}
