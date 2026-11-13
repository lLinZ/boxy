<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TasaCambio;
use App\Services\TasaService;
use App\Support\Auditoria;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * Tasas de cambio. Son globales (las comparten todas las empresas), así que
 * solo el super-admin puede cargarlas a mano (en modo dedicado, también el admin).
 */
class TasaCambioController extends Controller
{
    public function __construct(private readonly TasaService $tasas) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json(
            TasaCambio::orderByDesc('fecha')->orderBy('fuente')->paginate($this->porPagina($request))
        );
    }

    /** Tasa BCV vigente (la usa el POS para mostrar precios en Bs). */
    public function vigente(): JsonResponse
    {
        $tasa = TasaCambio::vigente();

        abort_if(! $tasa, 404, 'No hay tasa de cambio registrada.');

        return response()->json($tasa);
    }

    /** Última tasa registrada por cada fuente (BCV, USDT, …). */
    public function vigentes(): JsonResponse
    {
        return response()->json($this->tasas->vigentes());
    }

    /**
     * Sincroniza las tasas del día contra la API externa (ve.dolarapi.com).
     * La lógica vive en TasaService (compartida con el comando programado).
     */
    public function sincronizar(): JsonResponse
    {
        try {
            $resultado = $this->tasas->sincronizar();
        } catch (\RuntimeException $e) {
            return response()->json(['message' => 'No se pudo sincronizar: '.$e->getMessage()], 502);
        }

        return response()->json([
            'sincronizado' => true,
            'actualizadas' => $resultado['actualizadas'],
            'omitidas' => $resultado['omitidas'],
            'tasas' => $resultado['tasas'],
        ]);
    }

    /**
     * Carga/actualiza la tasa de un día (idempotente por fecha+fuente).
     * Rechaza tasas en cero y pide confirmar saltos bruscos contra la anterior.
     */
    public function store(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'fecha' => ['required', 'date', 'before_or_equal:tomorrow'],
            'fuente' => ['nullable', 'string', 'regex:/^[A-Z0-9_]{2,20}$/'],
            'tasa' => ['required', 'numeric', 'gt:0', 'max:1000000000'],
            'confirmar' => ['nullable', 'boolean'],
        ]);

        $fuente = $datos['fuente'] ?? 'BCV';
        $anterior = TasaCambio::where('fuente', $fuente)->whereDate('fecha', '<', $datos['fecha'])->orderByDesc('fecha')->first();

        if ($anterior && ! $request->boolean('confirmar')) {
            $variacion = abs((float) $datos['tasa'] / (float) $anterior->tasa - 1);
            if ($variacion > config('boxy.tasas.variacion_maxima')) {
                throw ValidationException::withMessages([
                    'tasa' => [sprintf(
                        'La tasa varía %.0f %% contra la anterior (%s). Revisa el número o confirma.',
                        $variacion * 100,
                        number_format((float) $anterior->tasa, 2, ',', '.'),
                    )],
                ]);
            }
        }

        $tasa = TasaCambio::updateOrCreate(
            ['fecha' => $datos['fecha'], 'fuente' => $fuente],
            ['tasa' => $datos['tasa']],
        );
        Auditoria::registrar('tasa.manual', [
            'fuente' => $fuente, 'fecha' => $datos['fecha'], 'tasa' => (float) $datos['tasa'],
            'anterior' => $anterior ? (float) $anterior->tasa : null, 'confirmada' => $request->boolean('confirmar'),
        ]);

        return response()->json($tasa, 201);
    }
}
