<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use PDO;
use RuntimeException;

/**
 * Respaldos de la base de datos en archivos .sql.gz dentro de
 * storage/app/private/respaldos (y, opcionalmente, una copia en otra carpeta:
 * un disco externo o una carpeta sincronizada con la nube).
 *
 * Usa mysqldump si lo encuentra; si no, hace el volcado en PHP.
 */
class RespaldoService
{
    public const PATRON = '/^boxy-\d{8}-\d{6}\.sql\.gz$/';

    public function carpeta(): string
    {
        $carpeta = Storage::disk('local')->path(config('boxy.respaldos.carpeta', 'respaldos'));
        File::ensureDirectoryExists($carpeta);

        return $carpeta;
    }

    /** @return array{archivo: string, bytes: int, metodo: string, copia: string|null} */
    public function crear(): array
    {
        $nombre = 'boxy-'.now()->format('Ymd-His').'.sql.gz';
        $ruta = $this->carpeta().DIRECTORY_SEPARATOR.$nombre;

        $metodo = $this->conMysqldump($ruta) ? 'mysqldump' : 'php';
        if ($metodo === 'php') {
            $this->conPhp($ruta);
        }

        $copia = null;
        if ($destino = config('boxy.respaldos.copiar_a')) {
            try {
                File::ensureDirectoryExists($destino);
                $copia = rtrim($destino, '\\/').DIRECTORY_SEPARATOR.$nombre;
                File::copy($ruta, $copia);
            } catch (\Throwable $e) {
                logger()->warning('No se pudo copiar el respaldo a '.$destino.': '.$e->getMessage());
                $copia = null;
            }
        }

        return ['archivo' => $nombre, 'bytes' => filesize($ruta), 'metodo' => $metodo, 'copia' => $copia];
    }

    /** Borra los respaldos más viejos que el período configurado. Devuelve cuántos borró. */
    public function limpiar(): int
    {
        $limite = now()->subDays((int) config('boxy.respaldos.conservar_dias', 30))->getTimestamp();
        $borrados = 0;
        foreach ($this->listar() as $r) {
            if ($r['modificado'] < $limite) {
                File::delete($this->carpeta().DIRECTORY_SEPARATOR.$r['archivo']);
                $borrados++;
            }
        }

        return $borrados;
    }

    public function listar(): array
    {
        return collect(File::files($this->carpeta()))
            ->filter(fn ($f) => preg_match(self::PATRON, $f->getFilename()))
            ->map(fn ($f) => [
                'archivo' => $f->getFilename(),
                'bytes' => $f->getSize(),
                'modificado' => $f->getMTime(),
                'fecha' => date('c', $f->getMTime()),
            ])
            ->sortByDesc('modificado')
            ->values()
            ->all();
    }

    public function ruta(string $archivo): string
    {
        if (! preg_match(self::PATRON, $archivo)) {
            throw new RuntimeException('Nombre de respaldo inválido.');
        }
        $ruta = $this->carpeta().DIRECTORY_SEPARATOR.$archivo;
        if (! is_file($ruta)) {
            throw new RuntimeException('El respaldo no existe.');
        }

        return $ruta;
    }

    /** Restaura un respaldo (reemplaza TODOS los datos actuales). */
    public function restaurar(string $archivo): void
    {
        $ruta = $this->ruta($archivo);
        $pdo = DB::connection()->getPdo();
        $gz = gzopen($ruta, 'rb');
        $sentencia = '';

        try {
            while (! gzeof($gz)) {
                $linea = gzgets($gz, 1024 * 1024);
                if ($linea === false) {
                    break;
                }
                $recortada = ltrim($linea);
                if ($sentencia === '' && ($recortada === '' || str_starts_with($recortada, '--'))) {
                    continue;
                }
                $sentencia .= $linea;
                if (str_ends_with(rtrim($linea), ';')) {
                    $pdo->exec($sentencia);
                    $sentencia = '';
                }
            }
            if (trim($sentencia) !== '') {
                $pdo->exec($sentencia);
            }
        } finally {
            gzclose($gz);
        }
    }

    /** Volcado con mysqldump (más rápido y completo). */
    private function conMysqldump(string $destino): bool
    {
        $binario = $this->buscarMysqldump();
        if (! $binario || ! function_exists('proc_open')) {
            return false;
        }

        $db = config('database.connections.'.config('database.default'));
        if (($db['driver'] ?? '') !== 'mysql' && ($db['driver'] ?? '') !== 'mariadb') {
            return false;
        }

        $comando = [
            $binario, '--single-transaction', '--routines', '--no-tablespaces', '--skip-comments',
            '--default-character-set=utf8mb4',
            '-h', (string) $db['host'], '-P', (string) $db['port'], '-u', (string) $db['username'],
            (string) $db['database'],
        ];

        // La clave va por variable de entorno, no en la línea de comandos (no aparece en la lista de procesos)
        $entorno = array_merge(getenv(), ['MYSQL_PWD' => (string) ($db['password'] ?? '')]);
        $proceso = proc_open($comando, [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $tuberias, null, $entorno);
        if (! is_resource($proceso)) {
            return false;
        }

        $gz = gzopen($destino, 'wb6');
        while (! feof($tuberias[1])) {
            $bloque = fread($tuberias[1], 1024 * 1024);
            if ($bloque !== false && $bloque !== '') {
                gzwrite($gz, $bloque);
            }
        }
        gzclose($gz);
        $errores = stream_get_contents($tuberias[2]);
        fclose($tuberias[1]);
        fclose($tuberias[2]);

        if (proc_close($proceso) !== 0) {
            logger()->warning('mysqldump falló, se usa el volcado en PHP: '.$errores);
            @unlink($destino);

            return false;
        }

        return true;
    }

    private function buscarMysqldump(): ?string
    {
        $candidatos = array_filter([
            config('boxy.respaldos.mysqldump'),
            'C:\\xampp\\mysql\\bin\\mysqldump.exe',
            '/usr/bin/mysqldump',
            '/usr/local/bin/mysqldump',
        ]);
        foreach ($candidatos as $c) {
            if (is_file($c)) {
                return $c;
            }
        }

        return null;
    }

    /** Volcado en PHP: estructura + datos, tabla por tabla, sin cargar todo en memoria. */
    private function conPhp(string $destino): void
    {
        $pdo = DB::connection()->getPdo();
        $gz = gzopen($destino, 'wb6');
        gzwrite($gz, "-- Respaldo de Boxy (volcado PHP) ".now()->toDateTimeString()."\n");
        gzwrite($gz, "SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS=0;\n\n");

        $tablas = array_map(fn ($f) => array_values((array) $f)[0],
            DB::select("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'"));

        foreach ($tablas as $tabla) {
            $crear = (array) DB::selectOne("SHOW CREATE TABLE `{$tabla}`");
            gzwrite($gz, "DROP TABLE IF EXISTS `{$tabla}`;\n".array_values($crear)[1].";\n\n");

            $pdo->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY, false);
            $consulta = $pdo->query("SELECT * FROM `{$tabla}`", PDO::FETCH_NUM);
            $lote = [];
            foreach ($consulta as $fila) {
                // Saltos de línea escapados: cada fila queda en una sola línea (la restauración lee por líneas)
                $lote[] = '('.implode(',', array_map(fn ($v) => $v === null ? 'NULL'
                    : str_replace(["\r", "\n"], ['\\r', '\\n'], $pdo->quote((string) $v)), $fila)).')';
                if (count($lote) >= 200) {
                    gzwrite($gz, "INSERT INTO `{$tabla}` VALUES\n".implode(",\n", $lote).";\n");
                    $lote = [];
                }
            }
            if ($lote) {
                gzwrite($gz, "INSERT INTO `{$tabla}` VALUES\n".implode(",\n", $lote).";\n");
            }
            $consulta->closeCursor();
            $pdo->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY, true);
            gzwrite($gz, "\n");
        }

        gzwrite($gz, "SET FOREIGN_KEY_CHECKS=1;\n");
        gzclose($gz);
    }
}
