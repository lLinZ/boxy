<?php

namespace Tests\Feature;

use App\Models\Categoria;
use App\Models\PagoLicencia;
use App\Models\Plan;
use App\Models\TasaCambio;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/** Hallazgos de la auditoría: cada prueba cubre uno. */
class SeguridadTest extends TestCase
{
    use Escenario, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->crearEscenario(40.0);
    }

    private function login(string $email, string $clave = 'Clave1234'): TestResponse
    {
        return $this->postJson('/api/login', ['email' => $email, 'password' => $clave]);
    }

    /** C1: la tasa es global; solo el super-admin la carga y nunca en cero. */
    public function test_c1_solo_el_super_admin_carga_la_tasa_y_no_acepta_cero(): void
    {
        $this->como($this->admin)->postJson('/api/tasas', ['fecha' => now()->toDateString(), 'tasa' => 1])->assertForbidden();

        $super = User::create(['name' => 'Super', 'email' => 'super@boxy.test', 'password' => 'Clave1234', 'rol' => 'super_admin']);
        $this->como($super)->postJson('/api/tasas', ['fecha' => now()->toDateString(), 'tasa' => 0])->assertStatus(422);
        $this->postJson('/api/tasas', ['fecha' => now()->toDateString(), 'tasa' => 41])->assertCreated();
        $this->assertEquals(41, TasaCambio::vigente()->tasa);
    }

    /** C1: en una instalación dedicada el admin de la tienda sí puede cargarla. */
    public function test_c1_en_modo_dedicado_el_admin_carga_la_tasa(): void
    {
        config(['boxy.modo' => 'dedicado']);
        $this->como($this->admin)->postJson('/api/tasas', ['fecha' => now()->toDateString(), 'tasa' => 42])->assertCreated();
    }

    /** C1: un salto brusco de tasa pide confirmación. */
    public function test_c1_salto_brusco_de_tasa_pide_confirmacion(): void
    {
        TasaCambio::where('fuente', 'BCV')->update(['fecha' => now()->subDay()->toDateString()]);
        $super = User::create(['name' => 'Super', 'email' => 'super@boxy.test', 'password' => 'Clave1234', 'rol' => 'super_admin']);

        $this->como($super)->postJson('/api/tasas', ['fecha' => now()->toDateString(), 'tasa' => 400])->assertStatus(422);
        $this->postJson('/api/tasas', ['fecha' => now()->toDateString(), 'tasa' => 400, 'confirmar' => true])->assertCreated();
    }

    /** C2 y M3: el comprobante no admite SVG y se guarda fuera de la carpeta pública. */
    public function test_c2_comprobante_sin_svg_y_en_disco_privado(): void
    {
        Storage::fake('local');
        Storage::fake('public');
        $this->como($this->admin);

        $svg = UploadedFile::fake()->createWithContent('pago.svg', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
        $this->post('/api/suscripcion/pago', [
            'metodo' => 'pago_movil', 'moneda' => 'VES', 'monto' => 1000, 'monto_usd' => 29, 'comprobante' => $svg,
        ], ['Accept' => 'application/json'])->assertStatus(422);

        // PNG real de 1×1 (sin depender de la extensión GD)
        $png = UploadedFile::fake()->createWithContent('pago.png', base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
        ));
        $id = $this->post('/api/suscripcion/pago', [
            'metodo' => 'pago_movil', 'moneda' => 'VES', 'monto' => 1000, 'monto_usd' => 29, 'comprobante' => $png,
        ], ['Accept' => 'application/json'])->assertCreated()->json('id');

        $ruta = PagoLicencia::find($id)->comprobante_path;
        Storage::disk('local')->assertExists($ruta);
        $this->assertEmpty(Storage::disk('public')->allFiles());

        $this->get("/api/suscripcion/pagos/{$id}/comprobante")->assertOk()->assertHeader('Content-Type', 'image/png');
        $this->como($this->cajero)->getJson("/api/suscripcion/pagos/{$id}/comprobante")->assertForbidden();
    }

    /** A2: límite de intentos de login y mismo mensaje para cuenta desactivada (B1). */
    public function test_a2_b1_login_con_limite_y_mensaje_generico(): void
    {
        $this->cajero->update(['activo' => false]);
        $mensajeInactivo = $this->login('caja@uno.test')->assertStatus(422)->json('errors.email.0');
        $mensajeClave = $this->login('admin@uno.test', 'mala')->assertStatus(422)->json('errors.email.0');
        $this->assertSame($mensajeClave, $mensajeInactivo);

        for ($i = 0; $i < 4; $i++) {
            $this->login('admin@uno.test', 'mala');
        }
        $this->login('admin@uno.test', 'mala')->assertStatus(429);
    }

    /** A3: el token vence y un usuario desactivado pierde el acceso de inmediato. */
    public function test_a3_token_vence_y_desactivar_corta_la_sesion(): void
    {
        $token = $this->login('caja@uno.test')->assertOk()->json('token');
        $this->assertNotNull($this->cajero->tokens()->first()->expires_at);

        $this->withToken($token)->getJson('/api/me')->assertOk();

        $this->como($this->admin)->putJson("/api/usuarios/{$this->cajero->id}", [
            'name' => 'Cajero', 'email' => 'caja@uno.test', 'rol' => 'cajero',
            'sucursal_id' => $this->sucursal->id, 'activo' => false,
        ])->assertOk();

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/me')->assertUnauthorized();
    }

    /** A4: el token del teléfono-escáner solo sirve para escanear. */
    public function test_a4_token_del_escaner_solo_escanea(): void
    {
        $this->como($this->cajero);
        $codigo = $this->postJson('/api/scanner/emparejar')->assertOk()->json('codigo');

        $this->app['auth']->forgetGuards();
        $token = $this->postJson('/api/scanner/canjear', ['codigo' => $codigo])->assertOk()->json('token');

        $this->withToken($token)->postJson('/api/scanner/scan', ['codigo' => '759100'])->assertCreated();
        $this->withToken($token)->getJson('/api/me')->assertForbidden();
        $this->withToken($token)->getJson('/api/productos')->assertForbidden();
        $this->withToken($token)->postJson('/api/usuarios', [])->assertForbidden();
    }

    /** A5: los roles se exigen en el servidor. */
    public function test_a5_el_cajero_no_cambia_precios_ni_stock_ni_ve_costos(): void
    {
        $this->como($this->cajero);
        $this->putJson("/api/productos/{$this->pan->id}", [
            'sku' => 'PAN-1', 'nombre' => 'Pan', 'precio_venta_usd' => 0.01, 'tipo_iva' => 'exento',
        ])->assertForbidden();
        $this->postJson('/api/inventario/movimiento', ['producto_id' => $this->pan->id, 'tipo' => 'ajuste', 'cantidad' => 500])->assertForbidden();
        $this->getJson('/api/productos/metricas')->assertForbidden();
        $this->getJson('/api/monitor')->assertForbidden();
        $this->postJson('/api/usuarios', [])->assertForbidden();

        $producto = $this->getJson('/api/productos')->assertOk()->json('data.0');
        $this->assertArrayNotHasKey('precio_costo_usd', $producto);
    }

    /** A5: el encargado de inventario gestiona productos pero no vende. */
    public function test_a5_inventario_no_vende(): void
    {
        $almacen = $this->usuario('inventario', 'almacen@uno.test');
        $this->como($almacen)->postJson('/api/ventas', [
            'items' => [['producto_id' => $this->pan->id, 'cantidad' => 1]],
            'pagos' => [['metodo' => 'efectivo_usd', 'monto' => 20]],
        ])->assertForbidden();
        $this->postJson('/api/inventario/movimiento', ['producto_id' => $this->pan->id, 'tipo' => 'entrada', 'cantidad' => 5])->assertCreated();
    }

    /** A1: una categoría de otra empresa no se puede asignar. */
    public function test_a1_categoria_de_otra_empresa(): void
    {
        $otra = $this->nuevaEmpresa('Tienda Dos', '400000002', Plan::first());
        $categoria = Categoria::create(['empresa_id' => $otra->id, 'nombre' => 'Ajena', 'slug' => 'ajena']);

        $this->como($this->admin)->postJson('/api/productos', [
            'sku' => 'X-1', 'nombre' => 'X', 'precio_venta_usd' => 1, 'tipo_iva' => 'general', 'categoria_id' => $categoria->id,
        ])->assertStatus(422)->assertJsonValidationErrors('categoria_id');
    }

    /** M2: per_page acotado. */
    public function test_m2_per_page_tiene_tope(): void
    {
        $this->como($this->admin)->getJson('/api/productos?per_page=1000000')->assertOk()->assertJsonPath('per_page', 100);
    }

    /** M6: en una instalación dedicada no hay registro público. */
    public function test_m6_registro_cerrado_en_modo_dedicado(): void
    {
        config(['boxy.registro_publico' => false]);
        $this->postJson('/api/registro', [])->assertNotFound();
    }

    /** B2: el super-admin no rompe las pantallas de empresa (403, no 500). */
    public function test_b2_super_admin_recibe_403_en_pantallas_de_empresa(): void
    {
        $super = User::create(['name' => 'Super', 'email' => 'super@boxy.test', 'password' => 'Clave1234', 'rol' => 'super_admin']);
        $this->como($super);
        $this->getJson('/api/monitor')->assertForbidden();
        $this->getJson('/api/productos')->assertForbidden();
        $this->getJson('/api/tasas/vigentes')->assertOk();
    }

    /** B3: cabeceras de seguridad en la API. */
    public function test_b3_cabeceras_de_seguridad(): void
    {
        $this->getJson('/api/config')->assertOk()
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('X-Frame-Options', 'DENY');
    }

    /** A6: contraseñas débiles rechazadas y cambio obligatorio al primer ingreso. */
    public function test_a6_clave_debil_rechazada_y_cambio_obligatorio(): void
    {
        $this->como($this->admin)->postJson('/api/usuarios', [
            'name' => 'Nuevo', 'email' => 'nuevo@uno.test', 'password' => 'password',
            'rol' => 'cajero', 'sucursal_id' => $this->sucursal->id,
        ])->assertStatus(422)->assertJsonValidationErrors('password');

        $this->postJson('/api/usuarios', [
            'name' => 'Nuevo', 'email' => 'nuevo@uno.test', 'password' => 'Segura2026',
            'rol' => 'cajero', 'sucursal_id' => $this->sucursal->id,
        ])->assertCreated()->assertJsonPath('debe_cambiar_clave', true);
    }

    /** Bitácora de seguridad: ingresos fallidos, PIN rechazado y cambio de rol, sin claves ni PIN. */
    public function test_bitacora_de_seguridad_sin_secretos(): void
    {
        $ruta = storage_path('logs/seguridad-prueba.log');
        @unlink($ruta);
        config(['logging.channels.seguridad' => ['driver' => 'single', 'path' => $ruta, 'level' => 'info']]);

        $this->login('admin@uno.test', 'ClaveSecreta77')->assertStatus(422);
        $this->login('nadie@uno.test', 'OtraClave88')->assertStatus(422);

        $this->abrirCaja($this->cajero);
        $this->postJson('/api/ventas', [
            'items' => [['producto_id' => $this->pan->id, 'cantidad' => 1, 'descuento_usd' => 1]],
            'pagos' => [['metodo' => 'efectivo_usd', 'monto' => 20]],
            'autorizacion' => ['email' => 'gerente@uno.test', 'pin' => '9876'],
        ])->assertStatus(403);

        $this->como($this->admin)->putJson("/api/usuarios/{$this->cajero->id}", [
            'name' => $this->cajero->name, 'email' => $this->cajero->email,
            'rol' => 'inventario', 'sucursal_id' => $this->sucursal->id,
        ])->assertOk();

        $log = (string) file_get_contents($ruta);
        @unlink($ruta);

        $this->assertStringContainsString('login.fallido', $log);
        $this->assertStringContainsString('"motivo":"no_existe"', $log);
        $this->assertStringContainsString('pin.rechazado', $log);
        $this->assertStringContainsString('usuario.modificado', $log);
        $this->assertStringContainsString('inventario', $log);
        // Nunca las claves ni el PIN probado
        $this->assertStringNotContainsString('ClaveSecreta77', $log);
        $this->assertStringNotContainsString('OtraClave88', $log);
        $this->assertStringNotContainsString('"pin":', $log);
    }

    /** PIN de supervisor: tope de fallos por día que un PIN correcto no reinicia. */
    public function test_pin_de_supervisor_con_tope_diario(): void
    {
        config(['boxy.pin_intentos' => 100, 'boxy.pin_intentos_dia' => 3]);
        $this->abrirCaja($this->cajero);
        $vender = fn (string $pin) => $this->postJson('/api/ventas', [
            'items' => [['producto_id' => $this->pan->id, 'cantidad' => 1, 'descuento_usd' => 1]],
            'pagos' => [['metodo' => 'efectivo_usd', 'monto' => 20]],
            'autorizacion' => ['email' => 'gerente@uno.test', 'pin' => $pin],
        ]);

        $vender('1111')->assertStatus(403);
        $vender('2222')->assertStatus(403);
        $vender('4321')->assertCreated();   // el correcto no borra los fallos del día
        $vender('3333')->assertStatus(403); // tercer fallo del día
        $vender('4321')->assertStatus(429); // bloqueado aunque ahora acierte
    }

    /** CORS: solo el dominio propio (APP_URL); otra página no puede leer la API. */
    public function test_cors_solo_el_dominio_propio(): void
    {
        $this->assertNotContains('*', config('cors.allowed_origins'));

        // Con un solo origen permitido la librería siempre lo anuncia a él: el navegador
        // de la página ajena ve que no coincide con su origen y bloquea la lectura.
        $propio = rtrim(config('app.url'), '/');
        $ajena = $this->withHeader('Origin', 'https://pagina-ajena.example')->getJson('/api/config')->assertOk();
        $this->assertNotContains($ajena->headers->get('Access-Control-Allow-Origin'), ['*', 'https://pagina-ajena.example']);

        $this->withHeader('Origin', $propio)->getJson('/api/config')
            ->assertOk()->assertHeader('Access-Control-Allow-Origin', $propio);
    }

    /** Cambiar la clave cierra las otras sesiones. */
    public function test_cambiar_clave_cierra_otras_sesiones(): void
    {
        $otra = $this->login('caja@uno.test')->json('token');
        $actual = $this->login('caja@uno.test')->json('token');

        $this->withToken($actual)->postJson('/api/cuenta/clave', [
            'actual' => 'Clave1234', 'nueva' => 'NuevaClave99', 'nueva_confirmation' => 'NuevaClave99',
        ])->assertOk();

        $this->app['auth']->forgetGuards();
        $this->withToken($otra)->getJson('/api/me')->assertUnauthorized();
        $this->app['auth']->forgetGuards();
        $this->withToken($actual)->getJson('/api/me')->assertOk();
    }
}
