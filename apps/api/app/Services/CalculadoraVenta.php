<?php

namespace App\Services;

/**
 * Cálculo puro de una venta (sin base de datos):
 *  - líneas con promociones automáticas y descuento manual (nunca mayor que la línea),
 *  - IVA por línea (16 / 8 / 0 %),
 *  - IGTF 3 % solo sobre lo que las divisas cancelan de la cuenta (no sobre el vuelto),
 *  - vuelto y faltante.
 *
 * La web tiene una copia exacta en apps/web/src/lib/calculo.ts. Ambas se prueban
 * con los mismos casos: tests/fixtures/calculo_casos.json. Si cambias una, cambia la otra.
 */
class CalculadoraVenta
{
    public const ALICUOTA_IGTF = 3.0;

    public const ALICUOTAS = ['general' => 16.0, 'reducido' => 8.0, 'exento' => 0.0];

    /** Métodos en USD que no son divisas entregadas: no generan IGTF ni vuelto. */
    public const METODOS_SIN_IGTF = ['credito', 'puntos'];

    /** Diferencia máxima (USD) que se considera "cubierto". */
    public const TOLERANCIA = 0.01;

    /**
     * @param  array  $lineas  [{producto_id?, categoria_id?, descripcion, cantidad, precio_unitario_usd, tipo_iva, descuento_usd?}]
     * @param  array  $promociones  [{id, tipo, producto_id?, categoria_id?, valor, lleva?, paga?, cantidad_minima?}]
     * @param  array  $pagos  [{metodo, moneda, monto}]
     */
    public static function calcular(array $lineas, array $promociones, array $pagos, float $tasa, bool $cobraIgtf): array
    {
        // 1) Líneas
        $resLineas = [];
        $subtotal = $descuentos = $promos = $base = $iva = 0.0;

        foreach ($lineas as $linea) {
            $r = self::calcularLinea($linea, $promociones);
            $resLineas[] = $r;
            $subtotal += $r['bruto_usd'];
            $descuentos += $r['descuento_total_usd'];
            $promos += $r['promocion_usd'];
            $base += $r['base_usd'];
            $iva += $r['iva_usd'];
        }

        $totalSinIgtf = self::r($base + $iva);

        // 2) Pagos: primero se aplican los que no pagan IGTF (Bs, fiado, puntos);
        //    las divisas cubren el resto y pagan 3 % solo sobre lo que cancelan.
        $resPagos = [];
        $sinIgtf = 0.0;
        foreach ($pagos as $i => $pago) {
            $moneda = $pago['moneda'] ?? 'VES';
            $monto = (float) ($pago['monto'] ?? 0);
            $montoUsd = $moneda === 'USD' ? self::r($monto) : ($tasa > 0 ? self::r($monto / $tasa) : 0.0);
            $aplicaIgtf = $cobraIgtf && $moneda === 'USD' && ! in_array($pago['metodo'] ?? '', self::METODOS_SIN_IGTF, true);

            $resPagos[$i] = $pago + [
                'moneda' => $moneda,
                'monto_usd' => $montoUsd,
                'aplica_igtf' => $aplicaIgtf,
                'aplicado_usd' => 0.0,
                'igtf_usd' => 0.0,
            ];

            if (! $aplicaIgtf) {
                $sinIgtf += $montoUsd;
            }
        }

        $restante = max(0.0, self::r($totalSinIgtf - $sinIgtf));
        $igtf = 0.0;
        $factor = 1 + self::ALICUOTA_IGTF / 100;

        foreach ($resPagos as $i => $pago) {
            if (! $pago['aplica_igtf']) {
                // Lo que no paga IGTF se aplica completo hasta cubrir (el exceso es vuelto)
                continue;
            }
            $aplicado = self::r(min($pago['monto_usd'] / $factor, $restante));
            $igtfPago = self::r($aplicado * self::ALICUOTA_IGTF / 100);
            $resPagos[$i]['aplicado_usd'] = $aplicado;
            $resPagos[$i]['igtf_usd'] = $igtfPago;
            $restante = self::r($restante - $aplicado);
            $igtf += $igtfPago;
        }

        // Reparte lo aplicado de los pagos sin IGTF (para el registro de cada pago)
        $porCubrirSinIgtf = $totalSinIgtf;
        foreach ($resPagos as $i => $pago) {
            if ($pago['aplica_igtf']) {
                continue;
            }
            $aplicado = self::r(min($pago['monto_usd'], max(0.0, $porCubrirSinIgtf)));
            $resPagos[$i]['aplicado_usd'] = $aplicado;
            $porCubrirSinIgtf = self::r($porCubrirSinIgtf - $aplicado);
        }

        $igtf = self::r($igtf);
        $total = self::r($totalSinIgtf + $igtf);
        $pagado = self::r(array_sum(array_column($resPagos, 'monto_usd')));
        $diferencia = self::r($pagado - $total);

        return [
            'lineas' => $resLineas,
            'subtotal_usd' => self::r($subtotal),
            'descuento_usd' => self::r($descuentos),
            'promocion_usd' => self::r($promos),
            'base_imponible_usd' => self::r($base),
            'iva_usd' => self::r($iva),
            'total_sin_igtf_usd' => $totalSinIgtf,
            'pagos' => array_values($resPagos),
            'igtf_usd' => $igtf,
            'total_usd' => $total,
            'total_bs' => self::r($total * $tasa),
            'pagado_usd' => $pagado,
            'vuelto_usd' => $diferencia > self::TOLERANCIA ? $diferencia : 0.0,
            // Parte de la cuenta (antes de IGTF) que falta por cubrir. En Bs = × tasa;
            // en divisas = × 1,03 si se cobra IGTF.
            'faltante_usd' => $restante > self::TOLERANCIA ? $restante : 0.0,
            'cubierto' => $restante <= self::TOLERANCIA,
        ];
    }

    /** Calcula una línea: bruto, mejor promoción, descuento manual, base, IVA y total. */
    public static function calcularLinea(array $linea, array $promociones): array
    {
        $cantidad = (float) $linea['cantidad'];
        $precio = (float) $linea['precio_unitario_usd'];
        $tipoIva = $linea['tipo_iva'] ?? 'general';
        $alicuota = self::ALICUOTAS[$tipoIva] ?? 16.0;

        $bruto = self::r($cantidad * $precio);
        [$promo, $promoId] = self::mejorPromocion($linea, $promociones, $bruto);

        $manual = self::r(max(0.0, (float) ($linea['descuento_usd'] ?? 0)));
        $manual = min($manual, self::r($bruto - $promo)); // el descuento nunca deja la línea en negativo

        $descuento = self::r($promo + $manual);
        $base = self::r($bruto - $descuento);
        $iva = self::r($base * $alicuota / 100);

        return $linea + [
            'tipo_iva' => $tipoIva,
            'alicuota_iva' => $alicuota,
            'bruto_usd' => $bruto,
            'promocion_usd' => $promo,
            'promocion_id' => $promoId,
            'descuento_manual_usd' => $manual,
            'descuento_total_usd' => $descuento,
            'base_usd' => $base,
            'iva_usd' => $iva,
            'total_usd' => self::r($base + $iva),
        ];
    }

    /**
     * La promoción que más descuenta a la línea (no se acumulan).
     *
     * @return array{0: float, 1: int|null}
     */
    public static function mejorPromocion(array $linea, array $promociones, float $bruto): array
    {
        if (empty($linea['producto_id'])) {
            return [0.0, null]; // los ítems libres no tienen promociones
        }

        $cantidad = (float) $linea['cantidad'];
        $precio = (float) $linea['precio_unitario_usd'];
        $mejor = 0.0;
        $mejorId = null;

        foreach ($promociones as $p) {
            if (! empty($p['producto_id']) && (int) $p['producto_id'] !== (int) $linea['producto_id']) {
                continue;
            }
            if (empty($p['producto_id']) && ! empty($p['categoria_id'])
                && (int) $p['categoria_id'] !== (int) ($linea['categoria_id'] ?? 0)) {
                continue;
            }
            if ($cantidad + 1e-9 < (float) ($p['cantidad_minima'] ?? 1)) {
                continue;
            }

            $valor = (float) ($p['valor'] ?? 0);
            $descuento = match ($p['tipo']) {
                'porcentaje' => $bruto * min(max($valor, 0), 100) / 100,
                'nxm' => self::descuentoNxM($cantidad, $precio, (int) ($p['lleva'] ?? 0), (int) ($p['paga'] ?? 0)),
                'precio_cantidad' => $precio > $valor && $valor >= 0 ? $cantidad * ($precio - $valor) : 0,
                default => 0,
            };
            $descuento = min(self::r($descuento), $bruto);

            if ($descuento > $mejor) {
                $mejor = $descuento;
                $mejorId = isset($p['id']) ? (int) $p['id'] : null;
            }
        }

        return [$mejor, $mejorId];
    }

    private static function descuentoNxM(float $cantidad, float $precio, int $lleva, int $paga): float
    {
        if ($lleva <= 0 || $paga < 0 || $paga >= $lleva) {
            return 0.0;
        }
        $grupos = floor($cantidad / $lleva + 1e-9);

        return $grupos * ($lleva - $paga) * $precio;
    }

    /** Redondeo a 2 decimales (mitad hacia arriba, como round() de PHP). */
    public static function r(float $valor): float
    {
        return round($valor, 2);
    }
}
