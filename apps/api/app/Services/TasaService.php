<?php

namespace App\Services;

use App\Models\TasaCambio;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * Sincronización y consulta de tasas de cambio.
 * Usado tanto por el botón manual (TasaCambioController) como por el comando
 * programado (tasas:sincronizar) que corre 9am y 1pm.
 */
class TasaService
{
    // Mapeo: fuente externa (ve.dolarapi.com) → fuente interna
    private const MAPA_FUENTES = ['oficial' => 'BCV', 'paralelo' => 'USDT'];

    /**
     * Trae las tasas del día desde la API externa y las guarda (idempotente).
     * Una tasa que se aleja demasiado de la anterior no se guarda (posible dato
     * manipulado o error de la API): queda en el log y se reporta como omitida.
     *
     * @return array{actualizadas: int, omitidas: array, tasas: array}
     *
     * @throws RuntimeException si la API no responde correctamente
     */
    public function sincronizar(): array
    {
        try {
            $respuesta = $this->cliente()->timeout(10)->get('https://ve.dolarapi.com/v1/dolares');
        } catch (\Throwable $e) {
            throw new RuntimeException('No se pudo contactar la API de tasas: '.$e->getMessage());
        }

        if (! $respuesta->successful() || ! is_array($respuesta->json())) {
            throw new RuntimeException('Respuesta inválida de la API de tasas.');
        }

        $actualizadas = 0;
        $omitidas = [];
        $maxima = (float) config('boxy.tasas.variacion_maxima', 0.5);

        foreach ($respuesta->json() as $dolar) {
            $fuente = self::MAPA_FUENTES[$dolar['fuente'] ?? ''] ?? null;
            $valor = $dolar['promedio'] ?? null;

            if (! $fuente || ! is_numeric($valor) || (float) $valor <= 0) {
                continue;
            }

            $anterior = TasaCambio::where('fuente', $fuente)
                ->whereDate('fecha', '<', Carbon::today())
                ->orderByDesc('fecha')
                ->first();

            if ($anterior && abs((float) $valor / (float) $anterior->tasa - 1) > $maxima) {
                Log::warning("Tasa {$fuente} omitida: {$valor} se aleja demasiado de {$anterior->tasa}.");
                $omitidas[] = ['fuente' => $fuente, 'tasa' => (float) $valor, 'anterior' => (float) $anterior->tasa];

                continue;
            }

            TasaCambio::updateOrCreate(
                ['fecha' => Carbon::today()->toDateString(), 'fuente' => $fuente],
                ['tasa' => $valor],
            );
            $actualizadas++;
        }

        if ($actualizadas === 0 && ! $omitidas) {
            throw new RuntimeException('La API no devolvió tasas reconocibles.');
        }

        return ['actualizadas' => $actualizadas, 'omitidas' => $omitidas, 'tasas' => $this->vigentes()];
    }

    /** Última tasa registrada por cada fuente (BCV, USDT, …), orden alfabético. */
    public function vigentes(): array
    {
        return TasaCambio::orderByDesc('fecha')
            ->orderByDesc('id')
            ->get()
            ->groupBy('fuente')
            ->map(fn ($grupo, $fuente) => [
                'fuente' => $fuente,
                'tasa' => (float) $grupo->first()->tasa,
                'fecha' => $grupo->first()->fecha->toDateString(),
            ])
            ->sortKeys()
            ->values()
            ->all();
    }

    /**
     * Cliente HTTP con verificación del certificado. Si el bundle de PHP está viejo
     * (cURL error 60 en XAMPP), configura TASAS_CA_BUNDLE con un cacert.pem actual;
     * TASAS_VERIFICAR_SSL=false solo para desarrollo.
     */
    private function cliente(): \Illuminate\Http\Client\PendingRequest
    {
        $bundle = config('boxy.tasas.ca_bundle');
        $verificar = config('boxy.tasas.verificar_ssl', true);

        return Http::withOptions(['verify' => $verificar ? ($bundle ?: true) : false]);
    }
}
