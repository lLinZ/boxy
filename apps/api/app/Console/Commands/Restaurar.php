<?php

namespace App\Console\Commands;

use App\Services\RespaldoService;
use App\Support\Auditoria;
use Illuminate\Console\Command;

class Restaurar extends Command
{
    protected $signature = 'boxy:restaurar {archivo? : Nombre del respaldo (boxy-AAAAMMDD-HHMMSS.sql.gz)}';

    protected $description = 'Restaura un respaldo. REEMPLAZA todos los datos actuales.';

    public function handle(RespaldoService $respaldos): int
    {
        $lista = $respaldos->listar();
        if (! $lista) {
            $this->error('No hay respaldos en '.$respaldos->carpeta());

            return self::FAILURE;
        }

        $archivo = $this->argument('archivo')
            ?? $this->choice('¿Qué respaldo quieres restaurar?', array_column($lista, 'archivo'), 0);

        $this->warn("Se van a REEMPLAZAR todos los datos actuales con {$archivo}.");
        if (! $this->confirm('¿Continuar?', false)) {
            return self::FAILURE;
        }

        // Antes de pisar nada, un respaldo de lo que hay ahora
        $previo = $respaldos->crear();
        $this->line("Respaldo previo guardado: {$previo['archivo']}");

        $respaldos->restaurar($archivo);
        Auditoria::registrar('respaldo.restaurado', ['archivo' => $archivo, 'previo' => $previo['archivo']]);
        $this->info('Restauración terminada.');

        return self::SUCCESS;
    }
}
