<?php

namespace App\Console\Commands;

use App\Services\RespaldoService;
use Illuminate\Console\Command;

class Respaldar extends Command
{
    protected $signature = 'boxy:respaldar {--sin-limpiar : No borra los respaldos viejos}';

    protected $description = 'Respalda la base de datos en storage/app/private/respaldos (y la copia extra si está configurada)';

    public function handle(RespaldoService $respaldos): int
    {
        try {
            $r = $respaldos->crear();
        } catch (\Throwable $e) {
            $this->error('Falló el respaldo: '.$e->getMessage());

            return self::FAILURE;
        }

        $this->info(sprintf('Respaldo creado: %s (%s KB, %s)', $r['archivo'], number_format($r['bytes'] / 1024, 0), $r['metodo']));
        if ($r['copia']) {
            $this->line('Copia en: '.$r['copia']);
        }

        if (! $this->option('sin-limpiar')) {
            $borrados = $respaldos->limpiar();
            if ($borrados) {
                $this->line("Respaldos viejos borrados: {$borrados}");
            }
        }

        return self::SUCCESS;
    }
}
