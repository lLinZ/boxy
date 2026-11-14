<?php

namespace App\Services;

use App\Exceptions\ReglaNegocioException;
use App\Models\Cliente;
use App\Models\Empresa;
use App\Models\Pago;
use App\Models\Producto;
use App\Models\Sucursal;
use App\Models\TasaCambio;
use App\Models\User;
use App\Models\Venta;
use App\Models\VentaItem;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Registro de ventas de Boxy (comprobante NO fiscal; la factura fiscal la emite
 * la impresora fiscal, ver docs/IMPRESORA-FISCAL.md).
 *
 * Reglas que el servidor impone, sin importar lo que envíe el navegador:
 *  - El precio y el IVA salen del catálogo. Solo admin/gerente pueden vender ítems libres.
 *  - Descuentos manuales: con permiso o PIN de supervisor, con tope por línea.
 *  - Las promociones se calculan aquí (CalculadoraVenta).
 *  - Los pagos deben cubrir el total; el exceso es vuelto (IGTF solo sobre lo aplicado).
 *  - Se exige caja abierta (turno) si la empresa lo configura.
 *  - Fiado (método "credito") solo a clientes habilitados y dentro de su límite.
 *  - Montos canónicos en USD; el total en Bs se calcula a la tasa BCV vigente.
 */
class FacturacionService
{
    public const ALICUOTA_IGTF = CalculadoraVenta::ALICUOTA_IGTF;

    public const METODOS = [
        'efectivo_bs' => 'VES', 'pago_movil' => 'VES', 'transferencia' => 'VES', 'tarjeta' => 'VES',
        'efectivo_usd' => 'USD', 'zelle' => 'USD', 'usdt' => 'USD', 'credito' => 'USD', 'puntos' => 'USD', 'otro' => null,
    ];

    public const METODOS_VUELTO = ['efectivo_bs' => 'VES', 'efectivo_usd' => 'USD', 'pago_movil' => 'VES'];

    public function __construct(
        private readonly CajaService $caja,
        private readonly StockService $stock,
        private readonly AutorizacionService $autorizacion,
        private readonly CuentaClienteService $cuentas,
        private readonly FidelizacionService $puntos,
        private readonly PromocionService $promociones,
    ) {}

    /**
     * Emite una venta.
     *
     * @param  array  $datos  {
     *     cliente_id?, observacion?, uuid?, origen?, total_esperado_usd?, vuelto_metodo?,
     *     autorizacion?: {email, pin},
     *     items: [ { producto_id?, descripcion?, cantidad, precio_unitario_usd?, tipo_iva?, descuento_usd? } ],
     *     pagos: [ { metodo, moneda, monto, referencia? } ]
     * }
     */
    public function emitir(array $datos, User $user): Venta
    {
        // Idempotencia: una venta sin conexión que se reintenta no se cobra dos veces
        if (! empty($datos['uuid'])) {
            $existente = Venta::where('uuid', $datos['uuid'])->where('empresa_id', $user->empresa_id)->first();
            if ($existente) {
                return $existente->load(['items', 'pagos', 'cliente']);
            }
        }

        if (! $user->sucursal_id) {
            throw new ReglaNegocioException('El usuario no tiene una sucursal asignada.');
        }

        return DB::transaction(function () use ($datos, $user) {
            /** @var Sucursal $sucursal */
            $sucursal = Sucursal::lockForUpdate()->findOrFail($user->sucursal_id);
            $empresa = Empresa::findOrFail($sucursal->empresa_id);
            $origen = ($datos['origen'] ?? 'pos') === 'offline' ? 'offline' : 'pos';

            $tasaModel = TasaCambio::vigente();
            $tasa = (float) ($tasaModel?->tasa ?? 0);
            if ($tasa <= 0) {
                throw new ReglaNegocioException('No hay una tasa BCV válida registrada. Cárgala antes de vender.');
            }

            // Caja abierta
            $turno = $this->caja->abierto($user, true);
            if (! $turno && $empresa->ajuste('exigir_turno') && $origen !== 'offline') {
                throw new ReglaNegocioException('Abre la caja (turno) antes de vender.', 422, ['requiere_turno' => true]);
            }

            // Cliente (siempre de la misma empresa)
            $cliente = null;
            if (! empty($datos['cliente_id'])) {
                $cliente = Cliente::where('empresa_id', $empresa->id)->find($datos['cliente_id']);
                if (! $cliente) {
                    throw new ReglaNegocioException('Cliente no encontrado.');
                }
            }

            // 1) Líneas con precio e IVA del catálogo
            [$lineas, $productos, $hayDescuento] = $this->resolverLineas($datos['items'], $empresa, $user);

            $supervisor = null;
            if ($hayDescuento) {
                $supervisor = $this->autorizacion->exigir($user, 'ventas.descuento', $datos['autorizacion'] ?? null, 'aplicar descuentos');
            }

            // 2) Pagos
            $pagos = $this->normalizarPagos($datos['pagos'] ?? []);
            $montoCredito = round(array_sum(array_map(fn ($p) => $p['metodo'] === 'credito' ? $p['monto'] : 0, $pagos)), 2);
            $montoPuntos = round(array_sum(array_map(fn ($p) => $p['metodo'] === 'puntos' ? $p['monto'] : 0, $pagos)), 2);

            if (($montoCredito > 0 || $montoPuntos > 0) && ! $cliente) {
                throw new ReglaNegocioException('Para fiar o pagar con puntos hay que asignar un cliente.');
            }

            // 3) Cálculo (promociones, IVA, IGTF, vuelto)
            $calculo = CalculadoraVenta::calcular(
                $lineas,
                $this->promociones->vigentes($empresa->id),
                $pagos,
                $tasa,
                (bool) $empresa->ajuste('cobra_igtf'),
            );

            if (! $calculo['cubierto']) {
                $falta = $calculo['faltante_usd'];
                throw new ReglaNegocioException(
                    'El pago no cubre el total. Faltan $'.number_format($falta, 2).' (Bs '.number_format($falta * $tasa, 2, ',', '.').').',
                    422,
                    ['faltante_usd' => $falta],
                );
            }
            if ($calculo['vuelto_usd'] > 0 && ($montoCredito > 0 || $montoPuntos > 0)) {
                throw new ReglaNegocioException('El fiado y los puntos no pueden generar vuelto: ajusta los montos.');
            }
            if (isset($datos['total_esperado_usd']) && abs((float) $datos['total_esperado_usd'] - $calculo['total_usd']) > CalculadoraVenta::TOLERANCIA) {
                throw new ReglaNegocioException(
                    'El total cambió (precio, promoción o tasa actualizados): ahora es $'.number_format($calculo['total_usd'], 2).'. Revisa antes de cobrar.',
                    409,
                    ['total_usd' => $calculo['total_usd']],
                );
            }

            // Fiado: cliente habilitado y dentro de su límite
            if ($montoCredito > 0) {
                $cliente = Cliente::whereKey($cliente->id)->lockForUpdate()->first();
                if (! $cliente->credito_habilitado) {
                    throw new ReglaNegocioException('Este cliente no tiene fiado habilitado.');
                }
                $nuevoSaldo = (float) $cliente->saldo_usd + $montoCredito;
                if ($nuevoSaldo > (float) $cliente->limite_credito_usd + CalculadoraVenta::TOLERANCIA) {
                    $supervisor = $this->autorizacion->exigir(
                        $user, 'fiado.exceder_limite', $datos['autorizacion'] ?? null,
                        'fiar por encima del límite ($'.number_format((float) $cliente->limite_credito_usd, 2).')',
                    ) ?? $supervisor;
                }
            }

            // 4) Vuelto
            $vueltoUsd = $calculo['vuelto_usd'];
            $vueltoMetodo = null;
            $vueltoMoneda = null;
            $vueltoMonto = 0.0;
            if ($vueltoUsd > 0) {
                $vueltoMetodo = $datos['vuelto_metodo']
                    ?? ($empresa->ajuste('vuelto_moneda') === 'USD' ? 'efectivo_usd' : 'efectivo_bs');
                $vueltoMoneda = self::METODOS_VUELTO[$vueltoMetodo] ?? throw new ReglaNegocioException('Método de vuelto no válido.');
                $vueltoMonto = $vueltoMoneda === 'USD' ? $vueltoUsd : round($vueltoUsd * $tasa, 2);
            }

            // 5) Correlativos (comprobante interno por sucursal)
            $numeroFactura = str_pad((string) $sucursal->proximo_numero_factura, 8, '0', STR_PAD_LEFT);
            $numeroControl = $sucursal->serie_control.'-'.str_pad((string) $sucursal->proximo_numero_control, 8, '0', STR_PAD_LEFT);
            $sucursal->increment('proximo_numero_factura');
            $sucursal->increment('proximo_numero_control');

            $venta = Venta::create([
                'uuid' => $datos['uuid'] ?? null,
                'empresa_id' => $empresa->id,
                'sucursal_id' => $sucursal->id,
                'user_id' => $user->id,
                'turno_id' => $turno?->id,
                'cliente_id' => $cliente?->id,
                'tasa_cambio_id' => $tasaModel->id,
                'tipo_documento' => 'nota_entrega',
                'numero_factura' => $numeroFactura,
                'numero_control' => $numeroControl,
                'fecha' => Carbon::now(),
                'tasa' => $tasa,
                'subtotal_usd' => $calculo['subtotal_usd'],
                'descuento_usd' => $calculo['descuento_usd'],
                'base_imponible_usd' => $calculo['base_imponible_usd'],
                'iva_usd' => $calculo['iva_usd'],
                'igtf_usd' => $calculo['igtf_usd'],
                'total_usd' => $calculo['total_usd'],
                'total_bs' => $calculo['total_bs'],
                'vuelto_usd' => $vueltoUsd,
                'vuelto_metodo' => $vueltoMetodo,
                'vuelto_moneda' => $vueltoMoneda,
                'vuelto_monto' => $vueltoMonto,
                'estado' => 'emitida',
                'origen' => $origen,
                'autorizada_por' => $supervisor?->id,
                'observacion' => $datos['observacion'] ?? null,
                'estado_fiscal' => $empresa->ajuste('fiscal_activa') ? 'pendiente' : null,
            ]);

            // 6) Ítems y stock
            foreach ($calculo['lineas'] as $i => $linea) {
                VentaItem::create([
                    'venta_id' => $venta->id,
                    'producto_id' => $linea['producto_id'] ?? null,
                    'descripcion' => $linea['descripcion'],
                    'cantidad' => $linea['cantidad'],
                    'precio_unitario_usd' => $linea['precio_unitario_usd'],
                    'tipo_iva' => $linea['tipo_iva'],
                    'alicuota_iva' => $linea['alicuota_iva'],
                    'descuento_usd' => $linea['descuento_total_usd'],
                    'promocion_usd' => $linea['promocion_usd'],
                    'promocion_id' => $linea['promocion_id'],
                    'base_usd' => $linea['base_usd'],
                    'iva_usd' => $linea['iva_usd'],
                    'total_usd' => $linea['total_usd'],
                ]);

                $producto = $productos[$i] ?? null;
                if ($producto && $producto->controla_stock) {
                    $this->stock->mover($sucursal->id, $producto, -(float) $linea['cantidad'], 'venta',
                        $user->id, "Venta {$numeroFactura}", $venta);
                }
            }

            // 7) Pagos
            foreach ($calculo['pagos'] as $pago) {
                Pago::create([
                    'venta_id' => $venta->id,
                    'metodo' => $pago['metodo'],
                    'moneda' => $pago['moneda'],
                    'monto' => round((float) $pago['monto'], 2),
                    'monto_usd' => $pago['monto_usd'],
                    'aplicado_usd' => $pago['aplicado_usd'],
                    'aplica_igtf' => $pago['aplica_igtf'],
                    'igtf_usd' => $pago['igtf_usd'],
                    'referencia' => $pago['referencia'] ?? null,
                ]);
            }

            // 8) Fiado y puntos
            if ($montoCredito > 0) {
                $this->cuentas->cargo($cliente, $montoCredito, $venta, $turno?->id, $user->id);
            }
            if ($montoPuntos > 0) {
                $this->puntos->canjear($cliente, $empresa, $montoPuntos, $venta);
            }
            if ($cliente) {
                $this->puntos->otorgar($cliente, $empresa, $venta, $montoPuntos);
            }

            return $venta->load(['items', 'pagos', 'cliente']);
        });
    }

    /**
     * Resuelve cada línea contra el catálogo (precio e IVA del servidor).
     *
     * @return array{0: array, 1: array<int, Producto|null>, 2: bool}
     */
    private function resolverLineas(array $items, Empresa $empresa, User $user): array
    {
        $lineas = [];
        $productos = [];
        $hayDescuento = false;
        $topePct = (float) $empresa->ajuste('descuento_maximo_pct', 100);

        foreach ($items as $i => $item) {
            $cantidad = round((float) $item['cantidad'], 3);
            if ($cantidad <= 0) {
                throw new ReglaNegocioException('Cantidad inválida en la línea '.($i + 1).'.');
            }

            if (! empty($item['producto_id'])) {
                $producto = Producto::where('empresa_id', $empresa->id)->where('activo', true)->find($item['producto_id']);
                if (! $producto) {
                    throw new ReglaNegocioException('Producto no disponible en la línea '.($i + 1).'.');
                }
                if (! $producto->pesable && floor($cantidad) != $cantidad) {
                    throw new ReglaNegocioException("{$producto->nombre} se vende por unidad: la cantidad debe ser entera.");
                }
                $linea = [
                    'producto_id' => $producto->id,
                    'categoria_id' => $producto->categoria_id,
                    'descripcion' => $producto->nombre,
                    'cantidad' => $cantidad,
                    'precio_unitario_usd' => (float) $producto->precio_venta_usd,
                    'tipo_iva' => $producto->tipo_iva,
                ];
            } else {
                // Ítem libre (sin catálogo): solo con permiso, y el precio debe ser positivo
                if (! $user->puede('ventas.item_libre')) {
                    throw new ReglaNegocioException('No puedes vender artículos fuera del catálogo.', 403);
                }
                $precio = (float) ($item['precio_unitario_usd'] ?? 0);
                if ($precio <= 0 || empty($item['descripcion'])) {
                    throw new ReglaNegocioException('El artículo libre necesita descripción y precio.');
                }
                $producto = null;
                $linea = [
                    'producto_id' => null,
                    'categoria_id' => null,
                    'descripcion' => $item['descripcion'],
                    'cantidad' => $cantidad,
                    'precio_unitario_usd' => $precio,
                    'tipo_iva' => $item['tipo_iva'] ?? 'general',
                ];
            }

            $descuento = round(max(0.0, (float) ($item['descuento_usd'] ?? 0)), 2);
            if ($descuento > 0) {
                $bruto = round($cantidad * $linea['precio_unitario_usd'], 2);
                if ($descuento > round($bruto * $topePct / 100, 2) + 0.001) {
                    throw new ReglaNegocioException("El descuento de {$linea['descripcion']} supera el máximo permitido ({$topePct} %).");
                }
                $hayDescuento = true;
            }
            $linea['descuento_usd'] = $descuento;

            $lineas[] = $linea;
            $productos[] = $producto;
        }

        return [$lineas, $productos, $hayDescuento];
    }

    /** Valida métodos y monedas de pago (la moneda la fija el método). */
    private function normalizarPagos(array $pagos): array
    {
        $resultado = [];
        foreach ($pagos as $pago) {
            $metodo = $pago['metodo'] ?? '';
            if (! array_key_exists($metodo, self::METODOS)) {
                throw new ReglaNegocioException("Método de pago no válido: {$metodo}.");
            }
            $moneda = self::METODOS[$metodo] ?? (($pago['moneda'] ?? 'VES') === 'USD' ? 'USD' : 'VES');
            $monto = round((float) ($pago['monto'] ?? 0), 2);
            if ($monto <= 0) {
                continue;
            }
            $resultado[] = [
                'metodo' => $metodo,
                'moneda' => $moneda,
                'monto' => $monto,
                'referencia' => $pago['referencia'] ?? null,
            ];
        }

        if (! $resultado) {
            throw new ReglaNegocioException('Registra al menos un pago.');
        }

        return $resultado;
    }
}
