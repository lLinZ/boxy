<?php

namespace App\Console\Commands;

use App\Services\TasaService;
use Illuminate\Console\Command;

class SincronizarTasas extends Command
{
    protected $signature = 'tasas:sincronizar';

    protected $description = 'Sincroniza las tasas BCV y USDT del día desde ve.dolarapi.com';

    public function handle(TasaService $tasas): int
    {
        $this->info('Sincronizando tasas…');

        try {
            $resultado = $tasas->sincronizar();
        } catch (\RuntimeException $e) {
            $this->error('Falló la sincronización: '.$e->getMessage());

            return self::FAILURE;
        }

        foreach ($resultado['tasas'] as $t) {
            $this->line("  {$t['fuente']}: {$t['tasa']} (Bs/USD) — {$t['fecha']}");
        }

        foreach ($resultado['omitidas'] as $o) {
            $this->warn("  {$o['fuente']}: {$o['tasa']} omitida (se aleja demasiado de {$o['anterior']}).");
        }

        $this->info("Listo: {$resultado['actualizadas']} tasa(s) actualizada(s).");

        return self::SUCCESS;
    }
}
