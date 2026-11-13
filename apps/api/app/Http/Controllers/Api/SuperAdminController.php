<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Empresa;
use App\Models\PagoLicencia;
use App\Models\Plan;
use App\Models\Suscripcion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Panel del dueño del SaaS: métricas, empresas/licencias, planes y
 * confirmación de pagos (extiende la vigencia de la suscripción).
 */
class SuperAdminController extends Controller
{
    public function metricas(): JsonResponse
    {
        $porEstado = Suscripcion::select('estado', DB::raw('COUNT(*) c'))
            ->groupBy('estado')->pluck('c', 'estado');

        // MRR aproximado: suma del precio de las suscripciones que están al día
        $mrr = (float) Suscripcion::whereIn('estado', ['activa', 'gracia'])->sum('precio_usd');
        $alDia = (int) (($porEstado['activa'] ?? 0) + ($porEstado['gracia'] ?? 0));

        // Ingresos confirmados del mes en curso
        $ingresosMes = (float) PagoLicencia::where('estado', 'confirmado')
            ->whereYear('confirmado_el', Carbon::now()->year)
            ->whereMonth('confirmado_el', Carbon::now()->month)
            ->sum('monto_usd');

        return response()->json([
            'empresas' => Empresa::count(),
            'activas' => (int) ($porEstado['activa'] ?? 0),
            'trial' => (int) ($porEstado['trialing'] ?? 0),
            'gracia' => (int) ($porEstado['gracia'] ?? 0),
            'suspendidas' => (int) ($porEstado['suspendida'] ?? 0),
            'vencidas' => (int) (($porEstado['vencida'] ?? 0) + ($porEstado['cancelada'] ?? 0)),
            'mrr_usd' => round($mrr, 2),
            'arr_usd' => round($mrr * 12, 2),
            'arpu_usd' => $alDia > 0 ? round($mrr / $alDia, 2) : 0,
            'ingresos_mes_usd' => round($ingresosMes, 2),
            'pagos_pendientes' => PagoLicencia::where('estado', 'reportado')->count(),
        ]);
    }

    /** Serie de ingresos confirmados (últimos 6 meses) + ingresos por plan. */
    public function ingresos(): JsonResponse
    {
        $desde = Carbon::now()->startOfMonth()->subMonths(5);

        $porMes = PagoLicencia::where('estado', 'confirmado')
            ->where('confirmado_el', '>=', $desde)
            ->selectRaw("DATE_FORMAT(confirmado_el, '%Y-%m') ym, SUM(monto_usd) total, COUNT(*) pagos")
            ->groupBy('ym')->pluck('total', 'ym');

        $serie = [];
        for ($i = 0; $i < 6; $i++) {
            $m = $desde->copy()->addMonths($i);
            $serie[] = [
                'mes' => $m->translatedFormat('M Y'),
                'ym' => $m->format('Y-m'),
                'total_usd' => round((float) ($porMes[$m->format('Y-m')] ?? 0), 2),
            ];
        }

        // MRR y nº de empresas por plan (suscripciones al día)
        $porPlan = Suscripcion::whereIn('estado', ['activa', 'gracia'])
            ->selectRaw('plan_id, COUNT(*) empresas, SUM(precio_usd) mrr')
            ->groupBy('plan_id')->get()->keyBy('plan_id');

        $planes = Plan::orderBy('orden')->get()->map(fn (Plan $p) => [
            'plan' => $p->nombre,
            'empresas' => (int) ($porPlan[$p->id]->empresas ?? 0),
            'mrr_usd' => round((float) ($porPlan[$p->id]->mrr ?? 0), 2),
        ]);

        return response()->json([
            'serie' => $serie,
            'por_plan' => $planes,
            'total_confirmado_usd' => round((float) PagoLicencia::where('estado', 'confirmado')->sum('monto_usd'), 2),
        ]);
    }

    /** Suscripciones en riesgo: trials por terminar, en gracia y por vencer. */
    public function riesgo(): JsonResponse
    {
        $limite = Carbon::now()->addDays(7);
        $hoy = Carbon::now();

        $subs = Suscripcion::with('empresa:id,nombre')
            ->where(function ($q) use ($limite, $hoy) {
                $q->where('estado', 'gracia')
                    ->orWhere(fn ($x) => $x->where('estado', 'trialing')->whereBetween('trial_termina_el', [$hoy, $limite]))
                    ->orWhere(fn ($x) => $x->where('estado', 'activa')->whereBetween('vence_el', [$hoy, $limite]));
            })
            ->get()
            ->map(fn (Suscripcion $s) => [
                'empresa_id' => $s->empresa_id,
                'empresa' => $s->empresa?->nombre,
                'estado' => $s->estado,
                'dias_restantes' => $s->diasRestantes(),
                'fecha_limite' => $s->fechaLimite(),
            ])
            ->sortBy('dias_restantes')
            ->values();

        return response()->json($subs);
    }

    public function empresas(): JsonResponse
    {
        $empresas = Empresa::with(['suscripcion.plan:id,nombre'])
            ->withCount(['sucursales', 'usuarios'])
            ->orderBy('nombre')
            ->get()
            ->map(fn (Empresa $e) => [
                'id' => $e->id,
                'nombre' => $e->nombre,
                'rif' => $e->tipo_rif.'-'.$e->rif,
                'sucursales' => $e->sucursales_count,
                'usuarios' => $e->usuarios_count,
                'plan' => $e->suscripcion?->plan?->nombre,
                'estado' => $e->suscripcion?->estado ?? 'sin_suscripcion',
                'dias_restantes' => $e->suscripcion?->diasRestantes() ?? 0,
                'vence_el' => $e->suscripcion?->fechaLimite(),
            ]);

        return response()->json($empresas);
    }

    public function planes(): JsonResponse
    {
        // Conteo de empresas y MRR por plan (suscripciones al día), en una consulta
        $agg = Suscripcion::selectRaw("plan_id, COUNT(*) empresas,
                SUM(estado IN ('activa','gracia')) al_dia,
                SUM(estado = 'trialing') en_trial,
                SUM(CASE WHEN estado IN ('activa','gracia') THEN precio_usd ELSE 0 END) mrr")
            ->groupBy('plan_id')->get()->keyBy('plan_id');

        $planes = Plan::orderBy('orden')->get()->map(function (Plan $p) use ($agg) {
            $a = $agg[$p->id] ?? null;
            $p->setAttribute('empresas', (int) ($a->empresas ?? 0));
            $p->setAttribute('al_dia', (int) ($a->al_dia ?? 0));
            $p->setAttribute('en_trial', (int) ($a->en_trial ?? 0));
            $p->setAttribute('mrr_plan', round((float) ($a->mrr ?? 0), 2));

            return $p;
        });

        return response()->json($planes);
    }

    /** Pagos de licencia, filtrables por estado (?estado=reportado|confirmado|rechazado). */
    public function pagos(Request $request): JsonResponse
    {
        $query = PagoLicencia::with(['empresa:id,nombre', 'plan:id,nombre'])->latest();

        if ($estado = $request->query('estado')) {
            $query->where('estado', $estado);
        }

        return response()->json($query->limit(100)->get()->each(function (PagoLicencia $p) {
            $p->tiene_comprobante = (bool) $p->comprobante_path;
            $p->makeHidden('comprobante_path');
        }));
    }

    /** Comprobante de un pago (disco privado; solo el super-admin y la empresa dueña). */
    public function comprobante(PagoLicencia $pago)
    {
        return \App\Support\Archivos::servirPrivado($pago->comprobante_path, "comprobante-{$pago->id}");
    }

    /** Detalle completo de una empresa (para el modal del panel). */
    public function empresaDetalle(Empresa $empresa): JsonResponse
    {
        $empresa->load([
            'suscripcion.plan',
            'sucursales:id,empresa_id,nombre,codigo',
            'usuarios:id,empresa_id,name,email,rol,activo',
        ]);

        $pagos = PagoLicencia::with('plan:id,nombre')
            ->where('empresa_id', $empresa->id)->latest()->get();

        return response()->json([
            'empresa' => [
                'id' => $empresa->id,
                'nombre' => $empresa->nombre,
                'razon_social' => $empresa->razon_social,
                'rif' => $empresa->tipo_rif.'-'.$empresa->rif,
                'telefono' => $empresa->telefono,
                'email' => $empresa->email,
            ],
            'suscripcion' => $empresa->suscripcion,
            'dias_restantes' => $empresa->suscripcion?->diasRestantes() ?? 0,
            'usuarios' => $empresa->usuarios,
            'sucursales' => $empresa->sucursales,
            'pagos' => $pagos,
            'uso' => [
                'ventas' => DB::table('ventas')->where('empresa_id', $empresa->id)->count(),
                'productos' => DB::table('productos')->where('empresa_id', $empresa->id)->count(),
                'clientes' => DB::table('clientes')->where('empresa_id', $empresa->id)->count(),
            ],
        ]);
    }

    /** Extiende manualmente la vigencia (regalo/ajuste del dueño del SaaS). */
    public function extenderVigencia(Request $request, Empresa $empresa): JsonResponse
    {
        $datos = $request->validate(['meses' => ['required', 'integer', 'min:1', 'max:24']]);
        $sus = $empresa->suscripcion;
        abort_if(! $sus, 404, 'Sin suscripción.');

        $base = $sus->vence_el && $sus->vence_el->isFuture() ? $sus->vence_el : Carbon::now();
        $venceEl = $base->copy()->addMonths($datos['meses']);
        $diasGracia = $sus->plan?->dias_gracia ?? 5;

        $sus->update([
            'estado' => 'activa',
            'vence_el' => $venceEl,
            'gracia_hasta' => $venceEl->copy()->addDays($diasGracia),
            'suspendida_el' => null,
            'motivo_suspension' => null,
        ]);

        // Deja rastro contable (aparece en el historial de pagos, sin sumar ingresos reales)
        PagoLicencia::create([
            'empresa_id' => $empresa->id,
            'suscripcion_id' => $sus->id,
            'plan_id' => $sus->plan_id,
            'metodo' => 'otro',
            'moneda' => 'USD',
            'monto' => 0,
            'monto_usd' => 0,
            'meses' => $datos['meses'],
            'estado' => 'confirmado',
            'confirmado_por' => $request->user()->id,
            'confirmado_el' => Carbon::now(),
            'periodo_desde' => $base->toDateString(),
            'periodo_hasta' => $venceEl->toDateString(),
            'nota' => 'Extensión manual por el administrador del SaaS',
        ]);

        return response()->json(['message' => "Vigencia extendida {$datos['meses']} mes(es).", 'vence_el' => $venceEl]);
    }

    /** Cambia el plan de una empresa (actualiza el snapshot de la suscripción). */
    public function cambiarPlan(Request $request, Empresa $empresa): JsonResponse
    {
        $datos = $request->validate(['plan_id' => ['required', 'exists:planes,id']]);
        $sus = $empresa->suscripcion;
        abort_if(! $sus, 404, 'Sin suscripción.');

        $plan = Plan::findOrFail($datos['plan_id']);
        $sus->update([
            'plan_id' => $plan->id,
            'precio_usd' => $plan->precio_mensual_usd,
            'max_sucursales' => $plan->max_sucursales,
            'max_usuarios' => $plan->max_usuarios,
            'max_productos' => $plan->max_productos,
            'features' => $plan->features,
        ]);

        return response()->json(['message' => "Plan cambiado a {$plan->nombre}."]);
    }

    /** Crea una empresa manualmente (onboarding por el dueño del SaaS). */
    public function crearEmpresa(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'empresa_nombre' => ['required', 'string', 'max:255'],
            'rif' => ['nullable', 'string', 'max:20'],
            'admin_nombre' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'unique:users,email'],
            'password' => ['required', 'string', \Illuminate\Validation\Rules\Password::defaults()],
            'plan_id' => ['required', 'exists:planes,id'],
            'estado' => ['nullable', 'in:trialing,activa'],
            'meses' => ['nullable', 'integer', 'min:1', 'max:24'],
        ]);

        $plan = Plan::findOrFail($datos['plan_id']);

        $empresa = DB::transaction(function () use ($datos, $plan) {
            $empresa = Empresa::create([
                'nombre' => $datos['empresa_nombre'],
                'razon_social' => $datos['empresa_nombre'],
                'tipo_rif' => 'J',
                'rif' => $datos['rif'] ?? ('TEMP-'.uniqid()),
            ]);
            $sucursal = \App\Models\Sucursal::create([
                'empresa_id' => $empresa->id, 'codigo' => 'PRINCIPAL',
                'nombre' => 'Sucursal principal', 'serie_control' => '00',
            ]);
            \App\Models\User::create([
                'name' => $datos['admin_nombre'], 'email' => $datos['email'],
                'password' => \Illuminate\Support\Facades\Hash::make($datos['password']),
                'empresa_id' => $empresa->id, 'sucursal_id' => $sucursal->id, 'rol' => 'admin',
                'debe_cambiar_clave' => true, // la clave la eligió el dueño del SaaS: se cambia al entrar
            ]);

            $estado = $datos['estado'] ?? 'trialing';
            $attrs = [
                'empresa_id' => $empresa->id, 'plan_id' => $plan->id, 'estado' => $estado,
                'precio_usd' => $plan->precio_mensual_usd, 'max_sucursales' => $plan->max_sucursales,
                'max_usuarios' => $plan->max_usuarios, 'max_productos' => $plan->max_productos,
                'features' => $plan->features,
            ];
            if ($estado === 'trialing') {
                $attrs['trial_termina_el'] = Carbon::now()->addDays($plan->dias_trial);
            } else {
                $vence = Carbon::now()->addMonths($datos['meses'] ?? 1);
                $attrs['vence_el'] = $vence;
                $attrs['gracia_hasta'] = $vence->copy()->addDays($plan->dias_gracia);
            }
            Suscripcion::create($attrs);

            return $empresa;
        });

        return response()->json(['message' => 'Empresa creada.', 'empresa_id' => $empresa->id], 201);
    }

    /** Crea un plan. */
    public function crearPlan(Request $request): JsonResponse
    {
        $datos = $this->validarPlan($request);

        return response()->json(Plan::create($datos), 201);
    }

    /** Actualiza un plan. */
    public function actualizarPlan(Request $request, Plan $plan): JsonResponse
    {
        $plan->update($this->validarPlan($request, $plan->id));

        return response()->json($plan);
    }

    private function validarPlan(Request $request, ?int $id = null): array
    {
        return $request->validate([
            'codigo' => ['required', 'string', 'max:50', "unique:planes,codigo,{$id}"],
            'nombre' => ['required', 'string', 'max:255'],
            'descripcion' => ['nullable', 'string', 'max:255'],
            'precio_mensual_usd' => ['required', 'numeric', 'min:0'],
            'max_sucursales' => ['nullable', 'integer', 'min:0'],
            'max_usuarios' => ['nullable', 'integer', 'min:0'],
            'max_productos' => ['nullable', 'integer', 'min:0'],
            'dias_trial' => ['nullable', 'integer', 'min:0'],
            'dias_gracia' => ['nullable', 'integer', 'min:0'],
            'orden' => ['nullable', 'integer'],
            'visible' => ['boolean'],
            'activo' => ['boolean'],
        ]);
    }

    /** Confirma un pago y extiende la vigencia de la suscripción. */
    public function confirmarPago(Request $request, PagoLicencia $pago): JsonResponse
    {
        abort_if($pago->estado !== 'reportado', 422, 'El pago ya fue procesado.');

        DB::transaction(function () use ($request, $pago) {
            $sus = $pago->suscripcion()->lockForUpdate()->first();
            $plan = $pago->plan ?? $sus->plan;

            // La nueva vigencia parte de hoy o de lo que quede, lo que sea mayor
            $base = $sus->vence_el && $sus->vence_el->isFuture() ? $sus->vence_el : Carbon::now();
            $venceEl = $base->copy()->addMonths($pago->meses);
            $diasGracia = $plan?->dias_gracia ?? 5;

            $sus->update([
                'estado' => 'activa',
                'plan_id' => $plan?->id ?? $sus->plan_id,
                'precio_usd' => $plan?->precio_mensual_usd ?? $sus->precio_usd,
                'max_sucursales' => $plan?->max_sucursales ?? $sus->max_sucursales,
                'max_usuarios' => $plan?->max_usuarios ?? $sus->max_usuarios,
                'max_productos' => $plan?->max_productos ?? $sus->max_productos,
                'features' => $plan?->features ?? $sus->features,
                'vence_el' => $venceEl,
                'gracia_hasta' => $venceEl->copy()->addDays($diasGracia),
                'suspendida_el' => null,
                'motivo_suspension' => null,
            ]);

            $pago->update([
                'estado' => 'confirmado',
                'confirmado_por' => $request->user()->id,
                'confirmado_el' => Carbon::now(),
                'periodo_desde' => $base->toDateString(),
                'periodo_hasta' => $venceEl->toDateString(),
            ]);
        });

        return response()->json(['message' => 'Pago confirmado, licencia extendida.']);
    }

    public function rechazarPago(Request $request, PagoLicencia $pago): JsonResponse
    {
        abort_if($pago->estado !== 'reportado', 422, 'El pago ya fue procesado.');

        $datos = $request->validate(['motivo' => ['nullable', 'string', 'max:255']]);

        $pago->update([
            'estado' => 'rechazado',
            'confirmado_por' => $request->user()->id,
            'confirmado_el' => Carbon::now(),
            'motivo_rechazo' => $datos['motivo'] ?? 'Sin especificar',
        ]);

        return response()->json(['message' => 'Pago rechazado.']);
    }

    public function suspender(Request $request, Empresa $empresa): JsonResponse
    {
        $datos = $request->validate(['motivo' => ['nullable', 'string', 'max:255']]);

        $empresa->suscripcion()->update([
            'estado' => 'suspendida',
            'suspendida_el' => Carbon::now(),
            'motivo_suspension' => $datos['motivo'] ?? 'Suspendida por el administrador',
        ]);

        return response()->json(['message' => 'Empresa suspendida.']);
    }

    public function activar(Empresa $empresa): JsonResponse
    {
        $sus = $empresa->suscripcion;
        abort_if(! $sus, 404, 'Sin suscripción.');

        // Reactivar según vigencia: si aún tiene tiempo pagado, vuelve a activa
        $estado = $sus->vence_el && $sus->vence_el->isFuture() ? 'activa'
            : ($sus->trial_termina_el && $sus->trial_termina_el->isFuture() ? 'trialing' : 'vencida');

        $sus->update(['estado' => $estado, 'suspendida_el' => null, 'motivo_suspension' => null]);

        return response()->json(['message' => 'Empresa reactivada.', 'estado' => $estado]);
    }
}
