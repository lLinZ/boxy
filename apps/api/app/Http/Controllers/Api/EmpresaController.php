<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Empresa;
use App\Models\Sucursal;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

/**
 * Datos de la empresa (encabezado de tickets y comprobantes) y sus
 * preferencias de operación. Lectura para todos; edición solo el admin.
 */
class EmpresaController extends Controller
{
    /** Reglas de cada preferencia guardada en empresas.config. */
    private const REGLAS_CONFIG = [
        'ticket_ancho' => ['in:58,80'],
        'ticket_pie' => ['nullable', 'string', 'max:200'],
        'ticket_mostrar_logo' => ['boolean'],
        'impresion_automatica' => ['boolean'],
        'cobra_igtf' => ['boolean'],
        'vuelto_moneda' => ['in:VES,USD'],
        'exigir_turno' => ['boolean'],
        'descuento_maximo_pct' => ['numeric', 'min:0', 'max:100'],
        'whatsapp_codigo_pais' => ['regex:/^\d{1,4}$/'],
        'fiado_limite_defecto_usd' => ['numeric', 'min:0', 'max:1000000'],
        'puntos_activo' => ['boolean'],
        'puntos_por_usd' => ['numeric', 'min:0', 'max:1000'],
        'puntos_valor_usd' => ['numeric', 'min:0', 'max:100'],
        'puntos_minimo_canje' => ['integer', 'min:0', 'max:1000000'],
        'balanza_activa' => ['boolean'],
        'balanza_prefijos' => ['regex:/^\s*\d{2}(\s*,\s*\d{2})*\s*$/'],
        'balanza_digitos_plu' => ['integer', 'min:4', 'max:6'],
        'balanza_tipo' => ['in:peso,precio'],
        'fiscal_activa' => ['boolean'],
        'vencimiento_alerta_dias' => ['integer', 'min:1', 'max:365'],
    ];

    public function show(Request $request): JsonResponse
    {
        $empresa = Empresa::with('sucursales:id,empresa_id,codigo,nombre,direccion,telefono,serie_control,activo')
            ->findOrFail($request->user()->empresa_id);

        return response()->json([
            'empresa' => $empresa->makeHidden('config'),
            'ajustes' => $empresa->ajustes(),
            'modo' => config('boxy.modo'),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $empresa = Empresa::findOrFail($request->user()->empresa_id);

        $reglas = [
            'nombre' => ['required', 'string', 'max:255'],
            'razon_social' => ['required', 'string', 'max:255'],
            'tipo_rif' => ['required', 'in:V,E,J,G,P'],
            'rif' => ['required', 'string', 'max:20', 'regex:/^[0-9-]{5,20}$/', Rule::unique('empresas', 'rif')->ignore($empresa->id)],
            'direccion_fiscal' => ['nullable', 'string', 'max:255'],
            'telefono' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:255'],
            'ajustes' => ['nullable', 'array'],
        ];
        foreach (self::REGLAS_CONFIG as $clave => $r) {
            $reglas["ajustes.{$clave}"] = ['sometimes', ...$r];
        }

        $datos = $request->validate($reglas, ['rif.regex' => 'El RIF solo lleva números (y guiones).']);

        $ajustes = array_intersect_key($datos['ajustes'] ?? [], self::REGLAS_CONFIG);
        $empresa->update([
            ...collect($datos)->except('ajustes')->all(),
            'config' => array_merge($empresa->config ?? [], $ajustes),
        ]);

        return $this->show($request);
    }

    public function subirLogo(Request $request): JsonResponse
    {
        $request->validate(['logo' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048']]);
        $empresa = Empresa::findOrFail($request->user()->empresa_id);

        if ($empresa->logo_path && str_starts_with($empresa->logo_path, '/storage/')) {
            Storage::disk('public')->delete(str_replace('/storage/', '', $empresa->logo_path));
        }
        $ruta = $request->file('logo')->store("logos/{$empresa->id}", 'public');
        $empresa->update(['logo_path' => '/storage/'.$ruta]);

        return response()->json(['logo_path' => $empresa->logo_path]);
    }

    public function actualizarSucursal(Request $request, Sucursal $sucursal): JsonResponse
    {
        abort_unless($sucursal->empresa_id === $request->user()->empresa_id, 404);

        $sucursal->update($request->validate([
            'nombre' => ['required', 'string', 'max:255'],
            'direccion' => ['nullable', 'string', 'max:255'],
            'telefono' => ['nullable', 'string', 'max:30'],
        ]));

        return response()->json($sucursal);
    }
}
