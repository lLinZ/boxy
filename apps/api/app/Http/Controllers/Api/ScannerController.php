<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ScannerEscaneo;
use App\Models\User;
use App\Support\Auditoria;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * Escáner remoto: el teléfono se empareja con la caja mediante un código
 * temporal (mostrado como QR en la PC) y envía cada lectura a una cola
 * que el POS consume por sondeo.
 *
 * El token del teléfono solo tiene la habilidad "scanner": puede encolar
 * lecturas y nada más, y vence a las 12 horas.
 */
class ScannerController extends Controller
{
    public const HABILIDAD = 'scanner';

    /** (PC, auth) Genera un código de emparejamiento de un solo uso (10 min). */
    public function emparejar(Request $request): JsonResponse
    {
        // Sin caracteres ambiguos (0/O, 1/I) para poder teclearlo a mano si hace falta
        $codigo = strtoupper(Str::password(6, letters: true, numbers: true, symbols: false));
        $codigo = strtr($codigo, ['0' => '2', 'O' => '3', '1' => '4', 'I' => '5', 'L' => '6']);

        Cache::put("scanner:{$codigo}", $request->user()->id, now()->addMinutes(10));

        return response()->json([
            'codigo' => $codigo,
            'ips' => $this->ipsLan(),
            'expira_min' => 10,
        ]);
    }

    /** (Teléfono, público) Canjea el código por un token que solo sirve para escanear. */
    public function canjear(Request $request): JsonResponse
    {
        $datos = $request->validate(['codigo' => ['required', 'string', 'max:10']]);

        // pull = un solo uso
        $userId = Cache::pull('scanner:'.strtoupper($datos['codigo']));
        abort_if(! $userId, 422, 'Código inválido o vencido. Genera uno nuevo en la caja.');

        $user = User::findOrFail($userId);
        abort_unless($user->activo, 422, 'Código inválido o vencido. Genera uno nuevo en la caja.');

        $token = $user->createToken('scanner-telefono', [self::HABILIDAD], now()->addHours(12))->plainTextToken;
        Auditoria::registrar('scanner.emparejado', ['usuario_id' => $user->id, 'empresa_id' => $user->empresa_id]);

        return response()->json([
            'token' => $token,
            'usuario' => $user->name,
            'sucursal' => $user->sucursal?->nombre,
        ]);
    }

    /** (Teléfono, token de escáner) Encola una lectura de código de barras / QR. */
    public function scan(Request $request): JsonResponse
    {
        $datos = $request->validate(['codigo' => ['required', 'string', 'max:100']]);

        $escaneo = ScannerEscaneo::create([
            'user_id' => $request->user()->id,
            'codigo' => $datos['codigo'],
        ]);

        return response()->json($escaneo, 201);
    }

    /** (PC, auth) Entrega los escaneos pendientes y los marca procesados. */
    public function cola(Request $request): JsonResponse
    {
        $base = ScannerEscaneo::where('user_id', $request->user()->id)->where('procesado', false);
        $hasta = (clone $base)->max('id');
        if (! $hasta) {
            return response()->json([]);
        }

        $pendientes = (clone $base)->where('id', '<=', $hasta)
            ->where('created_at', '>=', now()->subMinutes(5)) // lecturas viejas no entran al carrito
            ->orderBy('id')
            ->get();

        (clone $base)->where('id', '<=', $hasta)->update(['procesado' => true]);

        return response()->json($pendientes);
    }

    /** IPs LAN de esta PC (para que el QR apunte a una URL alcanzable por el teléfono). */
    private function ipsLan(): array
    {
        $ips = [];
        $hostname = gethostname();

        if ($hostname) {
            foreach (gethostbynamel($hostname) ?: [] as $ip) {
                if (preg_match('/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/', $ip)) {
                    $ips[] = $ip;
                }
            }
        }

        return array_values(array_unique($ips));
    }
}
