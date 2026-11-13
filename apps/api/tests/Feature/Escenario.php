<?php

namespace Tests\Feature;

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
use Laravel\Sanctum\Sanctum;

/** Arma una tienda de prueba: empresa con licencia, usuarios por rol, productos y tasa. */
trait Escenario
{
    protected Empresa $empresa;

    protected Sucursal $sucursal;

    protected User $admin;

    protected User $gerente;

    protected User $cajero;

    protected Producto $harina;   // 1,10 · IVA 8 %

    protected Producto $refresco; // 1,80 · IVA 16 %

    protected Producto $pan;      // 10,00 · exento

    protected Cliente $cliente;

    protected function crearEscenario(float $tasa = 40.0): void
    {
        $plan = Plan::create([
            'codigo' => 'minimarket', 'nombre' => 'Minimarket', 'precio_mensual_usd' => 29,
            'max_sucursales' => 1, 'max_usuarios' => 0, 'max_productos' => 0,
        ]);

        $this->empresa = $this->nuevaEmpresa('Tienda Uno', '400000001', $plan);
        $this->sucursal = $this->empresa->sucursales()->first();

        $this->admin = $this->usuario('admin', 'admin@uno.test');
        $this->gerente = $this->usuario('gerente', 'gerente@uno.test', '4321');
        $this->cajero = $this->usuario('cajero', 'caja@uno.test');

        TasaCambio::create(['fecha' => now()->toDateString(), 'fuente' => 'BCV', 'tasa' => $tasa]);

        $categoria = Categoria::create(['empresa_id' => $this->empresa->id, 'nombre' => 'Víveres', 'slug' => 'viveres']);
        $this->harina = $this->producto('HAR-1', 'Harina 1Kg', 1.10, 'reducido', $categoria->id);
        $this->refresco = $this->producto('REF-1', 'Refresco 2L', 1.80, 'general', $categoria->id);
        $this->pan = $this->producto('PAN-1', 'Pan especial', 10.00, 'exento', $categoria->id);

        $this->cliente = Cliente::create([
            'empresa_id' => $this->empresa->id, 'tipo_documento' => 'V', 'documento' => '11111111',
            'nombre' => 'Carmen', 'telefono' => '0414-1234567',
            'credito_habilitado' => true, 'limite_credito_usd' => 20,
        ]);
    }

    protected function nuevaEmpresa(string $nombre, string $rif, Plan $plan): Empresa
    {
        $empresa = Empresa::create(['nombre' => $nombre, 'razon_social' => $nombre, 'tipo_rif' => 'J', 'rif' => $rif]);
        Sucursal::create(['empresa_id' => $empresa->id, 'codigo' => 'PRINCIPAL', 'nombre' => 'Principal']);
        Suscripcion::create([
            'empresa_id' => $empresa->id, 'plan_id' => $plan->id, 'estado' => 'activa',
            'vence_el' => now()->addMonth(), 'max_usuarios' => 0,
        ]);

        return $empresa;
    }

    protected function usuario(string $rol, string $email, ?string $pin = null, ?Empresa $empresa = null): User
    {
        $empresa ??= $this->empresa;

        return User::create([
            'name' => ucfirst($rol), 'email' => $email, 'password' => 'Clave1234', 'rol' => $rol,
            'empresa_id' => $empresa->id, 'sucursal_id' => $empresa->sucursales()->first()->id,
            'pin_supervisor' => $pin,
        ]);
    }

    protected function producto(string $sku, string $nombre, float $precio, string $iva, ?int $categoriaId = null, float $stock = 100): Producto
    {
        $producto = Producto::create([
            'empresa_id' => $this->empresa->id, 'categoria_id' => $categoriaId, 'sku' => $sku,
            'nombre' => $nombre, 'precio_venta_usd' => $precio, 'precio_costo_usd' => round($precio * 0.7, 2),
            'tipo_iva' => $iva,
        ]);
        Inventario::create(['sucursal_id' => $this->sucursal->id, 'producto_id' => $producto->id, 'cantidad' => $stock]);

        return $producto;
    }

    protected function como(User $user): static
    {
        Sanctum::actingAs($user, ['*']);

        return $this;
    }

    protected function abrirCaja(User $user, float $fondoBs = 0, float $fondoUsd = 0): int
    {
        return $this->como($user)->postJson('/api/caja/abrir', ['fondo_bs' => $fondoBs, 'fondo_usd' => $fondoUsd])
            ->assertCreated()->json('id');
    }

    protected function stock(Producto $producto): float
    {
        return (float) Inventario::where('producto_id', $producto->id)->where('sucursal_id', $this->sucursal->id)->value('cantidad');
    }
}
