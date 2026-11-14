<?php

namespace App\Services;

use App\Models\Venta;

/**
 * Traduce una venta de Boxy a los comandos de una impresora fiscal con
 * protocolo The Factory HKA (HKA80, SRP-812 y otras de la familia TFHKA).
 *
 * Boxy no habla con la impresora: un "puente" que corre en la PC de la caja
 * (scripts/puente-fiscal.ps1) pide las ventas pendientes, escribe estos
 * comandos en un archivo y se los entrega al programa del fabricante
 * (IntTFHKA.exe). Ver docs/IMPRESORA-FISCAL.md.
 *
 * IMPORTANTE: los formatos (largo de precio/cantidad) y los códigos de medios
 * de pago dependen de cómo el técnico programó la impresora. Se ajustan en
 * FORMATO y MEDIOS_PAGO y deben probarse con el equipo antes de usarlo en tienda.
 */
class FiscalService
{
    /** Carácter de tasa de IVA en el protocolo TFHKA. */
    private const TASAS = ['exento' => ' ', 'general' => '!', 'reducido' => '"'];

    /** Formato estándar: precio 8 enteros + 2 decimales, cantidad 5 enteros + 3 decimales. */
    private const FORMATO = ['precio_enteros' => 8, 'precio_decimales' => 2, 'cantidad_enteros' => 5, 'cantidad_decimales' => 3];

    /** Método de Boxy → código de medio de pago programado en la impresora (01-24). */
    public const MEDIOS_PAGO = [
        'efectivo_bs' => '01', 'tarjeta' => '09', 'pago_movil' => '11', 'transferencia' => '12',
        'efectivo_usd' => '20', 'zelle' => '21', 'usdt' => '22', 'credito' => '16', 'puntos' => '15', 'otro' => '16',
    ];

    /**
     * @return array<int, string> líneas de comando, en orden
     */
    public function comandosFactura(Venta $venta): array
    {
        $venta->loadMissing(['items', 'pagos', 'cliente']);
        $tasa = (float) $venta->tasa;
        $lineas = [];

        // Datos del cliente (RIF/cédula y razón social son obligatorios en la factura)
        $cliente = $venta->cliente;
        $documento = $cliente ? "{$cliente->tipo_documento}{$cliente->documento}" : 'V00000000';
        $lineas[] = 'iR*'.$this->limpiar($documento, 20);
        $lineas[] = 'iS*'.$this->limpiar($cliente?->nombre ?? 'CONSUMIDOR FINAL', 40);
        if ($cliente?->direccion) {
            $lineas[] = 'i00'.$this->limpiar('Direccion: '.$cliente->direccion, 40);
        }
        $lineas[] = 'i01'.$this->limpiar('Ref. Boxy: '.$venta->numero_factura, 40);

        // Ítems: precio unitario en Bs, SIN IVA y con el descuento ya aplicado (la impresora calcula el IVA)
        foreach ($venta->items as $item) {
            $cantidad = (float) $item->cantidad;
            $precioBs = $cantidad > 0 ? (float) $item->base_usd / $cantidad * $tasa : 0;
            $lineas[] = (self::TASAS[$item->tipo_iva] ?? '!')
                .$this->numero($precioBs, self::FORMATO['precio_enteros'], self::FORMATO['precio_decimales'])
                .$this->numero($cantidad, self::FORMATO['cantidad_enteros'], self::FORMATO['cantidad_decimales'])
                .$this->limpiar($item->descripcion, 40);
        }

        $lineas[] = '3'; // subtotal

        // Pagos: parciales con "2" + código + monto; el último cierra la factura con "1" + código.
        $pagos = $venta->pagos->values();
        foreach ($pagos as $i => $pago) {
            $codigo = self::MEDIOS_PAGO[$pago->metodo] ?? '01';
            $esUltimo = $i === $pagos->count() - 1;
            if ($esUltimo) {
                $lineas[] = '1'.$codigo; // pago total con el último medio: la impresora cierra el documento
            } else {
                $montoBs = (float) $pago->monto_usd * $tasa;
                $lineas[] = '2'.$codigo.$this->numero($montoBs, 10, 2);
            }
        }

        return $lineas;
    }

    /** Número sin separador decimal, con ceros a la izquierda (ej. 12,5 → 0000001250). */
    private function numero(float $valor, int $enteros, int $decimales): string
    {
        $entero = (int) round(max(0, $valor) * (10 ** $decimales));
        $largo = $enteros + $decimales;

        return str_pad((string) min($entero, (10 ** $largo) - 1), $largo, '0', STR_PAD_LEFT);
    }

    /** Texto sin acentos ni caracteres que la impresora no imprime. */
    private function limpiar(string $texto, int $largo): string
    {
        $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $texto) ?: $texto;
        $ascii = preg_replace('/[^A-Za-z0-9 .,:;\-\/#()%$*+]/', '', $ascii);

        return mb_substr(trim($ascii), 0, $largo);
    }
}
