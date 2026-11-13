<?php

namespace Tests\Unit;

use App\Services\CalculadoraVenta;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * Casos del cálculo de la venta. Los mismos casos los corre la web
 * (apps/web/scripts/probar-calculo.mjs) contra src/lib/calculo.ts.
 */
class CalculadoraVentaTest extends TestCase
{
    public static function casos(): array
    {
        $casos = json_decode(file_get_contents(__DIR__.'/../fixtures/calculo_casos.json'), true);

        return array_combine(array_column($casos, 'nombre'), array_map(fn ($c) => [$c], $casos));
    }

    #[DataProvider('casos')]
    public function test_caso(array $caso): void
    {
        $r = CalculadoraVenta::calcular($caso['lineas'], $caso['promociones'], $caso['pagos'], $caso['tasa'], $caso['cobra_igtf']);

        $this->comparar($caso['esperado'], $r, '');
    }

    private function comparar(array $esperado, array $real, string $ruta): void
    {
        foreach ($esperado as $clave => $valor) {
            $donde = $ruta.'.'.$clave;
            $this->assertArrayHasKey($clave, $real, "Falta {$donde}");
            if (is_array($valor)) {
                $this->comparar($valor, $real[$clave], $donde);
            } elseif (is_bool($valor) || $valor === null) {
                $this->assertSame($valor, $real[$clave], $donde);
            } else {
                $this->assertEqualsWithDelta((float) $valor, (float) $real[$clave], 0.0001, $donde);
            }
        }
    }
}
