@php
    /** @var \App\Models\Venta $venta */
    $n = fn ($v) => number_format((float) $v, 2, ',', '.');
    $tasa = (float) $venta->tasa;
    $bs = fn ($usd) => 'Bs ' . number_format((float) $usd * $tasa, 2, ',', '.');
    $usd = fn ($v) => '$' . number_format((float) $v, 2, '.', ',');
    $ivaLabel = ['general' => '16%', 'reducido' => '8%', 'exento' => 'Exento'];
@endphp
<!doctype html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <style>
        * { font-family: DejaVu Sans, sans-serif; }
        body { font-size: 11px; color: #1e293b; margin: 0; }
        .wrap { padding: 28px 34px; }
        .brand { font-size: 22px; font-weight: bold; color: #2563eb; }
        .muted { color: #64748b; }
        .right { text-align: right; }
        .center { text-align: center; }
        table { width: 100%; border-collapse: collapse; }
        .head td { vertical-align: top; padding-bottom: 4px; }
        .doc-box { border: 1.5px solid #2563eb; border-radius: 6px; padding: 8px 12px; }
        .doc-box .tit { color: #2563eb; font-weight: bold; font-size: 13px; }
        .sep { border: none; border-top: 1px solid #e2e8f0; margin: 12px 0; }
        .cli td { padding: 2px 0; }
        .items th { background: #2563eb; color: #fff; padding: 6px 8px; font-size: 10px; text-align: left; }
        .items td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
        .items tr:nth-child(even) td { background: #f8fafc; }
        .tot td { padding: 3px 8px; }
        .tot .lbl { color: #64748b; }
        .grand { font-size: 15px; font-weight: bold; color: #2563eb; }
        .pill { display: inline-block; background: #eff6ff; color: #2563eb; border-radius: 4px; padding: 1px 6px; font-size: 9px; }
        .foot { margin-top: 22px; font-size: 9px; color: #94a3b8; text-align: center; }
        .estado { float: right; font-size: 10px; font-weight: bold; }
        .nofiscal { color: #b91c1c; font-weight: bold; font-size: 10px; letter-spacing: .5px; }
        .aviso { margin-top: 14px; border: 1px solid #fecaca; background: #fef2f2; color: #991b1b; border-radius: 6px; padding: 7px 10px; font-size: 9.5px; text-align: center; }
        .anulada { position: fixed; top: 38%; left: 0; right: 0; text-align: center; font-size: 72px; color: rgba(220,38,38,.18); font-weight: bold; transform: rotate(-20deg); }
    </style>
</head>
<body>
@if($venta->estado === 'anulada')<div class="anulada">ANULADA</div>@endif
<div class="wrap">
    {{-- Encabezado: empresa + documento --}}
    <table class="head">
        <tr>
            <td style="width: 60%;">
                <div class="brand">{{ $empresa->nombre ?? 'Boxy' }}</div>
                <div>{{ $empresa->razon_social ?? '' }}</div>
                <div class="muted">RIF: {{ $empresa->tipo_rif ?? 'J' }}-{{ $empresa->rif ?? '' }}</div>
                @if($empresa?->direccion_fiscal)<div class="muted">{{ $empresa->direccion_fiscal }}</div>@endif
                @if($empresa?->telefono)<div class="muted">Tel: {{ $empresa->telefono }}</div>@endif
                <div class="muted">Sucursal: {{ $venta->sucursal->nombre ?? '' }}</div>
            </td>
            <td style="width: 40%;">
                <div class="doc-box">
                    <div class="tit">COMPROBANTE DE VENTA</div>
                    <div class="nofiscal">DOCUMENTO NO FISCAL</div>
                    <div><b>Comprobante N°:</b> {{ $venta->numero_factura }}</div>
                    @if($venta->numero_fiscal)
                    <div><b>Factura fiscal N°:</b> {{ $venta->numero_fiscal }}@if($venta->serial_fiscal) <span class="muted">({{ $venta->serial_fiscal }})</span>@endif</div>
                    @endif
                    <div><b>Fecha:</b> {{ $venta->fecha->format('d/m/Y h:i A') }}</div>
                    <div class="muted">Tasa BCV: Bs {{ $n($tasa) }} / USD</div>
                </div>
            </td>
        </tr>
    </table>

    <hr class="sep">

    {{-- Cliente --}}
    <table class="cli">
        <tr>
            <td style="width: 15%;" class="muted">Cliente:</td>
            <td style="width: 50%;"><b>{{ $venta->cliente->nombre ?? 'Consumidor Final' }}</b></td>
            <td style="width: 15%;" class="muted">C.I./RIF:</td>
            <td>{{ $venta->cliente ? $venta->cliente->tipo_documento.'-'.$venta->cliente->documento : '—' }}</td>
        </tr>
        @if($venta->cliente?->direccion)
        <tr>
            <td class="muted">Dirección:</td>
            <td colspan="3">{{ $venta->cliente->direccion }}</td>
        </tr>
        @endif
    </table>

    <hr class="sep">

    {{-- Items --}}
    <table class="items">
        <thead>
            <tr>
                <th style="width: 44%;">Descripción</th>
                <th class="right" style="width: 10%;">Cant.</th>
                <th class="right" style="width: 16%;">P. Unit.</th>
                <th class="center" style="width: 10%;">IVA</th>
                <th class="right" style="width: 20%;">Total</th>
            </tr>
        </thead>
        <tbody>
            @foreach($venta->items as $item)
            <tr>
                <td>{{ $item->descripcion }}</td>
                <td class="right">{{ rtrim(rtrim(number_format((float)$item->cantidad, 3, ',', '.'), '0'), ',') }}</td>
                <td class="right">{{ $usd($item->precio_unitario_usd) }}</td>
                <td class="center">{{ $ivaLabel[$item->tipo_iva] ?? $item->alicuota_iva.'%' }}</td>
                <td class="right">{{ $usd($item->total_usd) }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>

    <hr class="sep">

    {{-- Totales + desglose IVA --}}
    <table>
        <tr>
            <td style="width: 50%; vertical-align: top;">
                <div class="muted" style="margin-bottom: 4px;"><b>Desglose de IVA</b></div>
                <table>
                    @foreach($desglose as $d)
                    <tr class="tot">
                        <td class="lbl">
                            @if($d['alicuota'] == 0) Base exenta
                            @else Base gravada {{ rtrim(rtrim(number_format($d['alicuota'],2,',',''),'0'),',') }}%
                            @endif
                        </td>
                        <td class="right">{{ $usd($d['base']) }}</td>
                        <td class="lbl">IVA</td>
                        <td class="right">{{ $usd($d['iva']) }}</td>
                    </tr>
                    @endforeach
                </table>
                <div style="margin-top: 10px;" class="muted"><b>Formas de pago</b></div>
                @foreach($venta->pagos as $p)
                    <div><span class="pill">{{ str_replace('_',' ', ucfirst($p->metodo)) }}</span>
                        {{ $p->moneda }} {{ $n($p->monto) }}
                        @if($p->igtf_usd > 0) <span class="muted">(IGTF {{ $usd($p->igtf_usd) }})</span>@endif
                    </div>
                @endforeach
                @if($venta->vuelto_usd > 0)
                    <div class="muted" style="margin-top: 4px;">Vuelto: {{ $venta->vuelto_moneda === 'USD' ? $usd($venta->vuelto_monto) : 'Bs '.$n($venta->vuelto_monto) }}
                        ({{ str_replace('_', ' ', $venta->vuelto_metodo) }})</div>
                @endif
                @if($venta->devuelto_usd > 0)
                    <div style="margin-top: 4px; color: #b45309;">Devoluciones registradas: {{ $usd($venta->devuelto_usd) }}</div>
                @endif
            </td>
            <td style="width: 50%; vertical-align: top;">
                <table>
                    <tr class="tot"><td class="lbl">Subtotal</td><td class="right">{{ $usd($venta->subtotal_usd) }}</td></tr>
                    @if($venta->descuento_usd > 0)
                    <tr class="tot"><td class="lbl">Descuento</td><td class="right">- {{ $usd($venta->descuento_usd) }}</td></tr>
                    @endif
                    <tr class="tot"><td class="lbl">Base imponible</td><td class="right">{{ $usd($venta->base_imponible_usd) }}</td></tr>
                    <tr class="tot"><td class="lbl">IVA</td><td class="right">{{ $usd($venta->iva_usd) }}</td></tr>
                    @if($venta->igtf_usd > 0)
                    <tr class="tot"><td class="lbl">IGTF (3%)</td><td class="right">{{ $usd($venta->igtf_usd) }}</td></tr>
                    @endif
                    <tr><td colspan="2"><hr class="sep" style="margin: 6px 0;"></td></tr>
                    <tr class="tot"><td class="grand">TOTAL USD</td><td class="right grand">{{ $usd($venta->total_usd) }}</td></tr>
                    <tr class="tot"><td class="lbl">TOTAL Bs</td><td class="right"><b>{{ $bs($venta->total_usd) }}</b></td></tr>
                </table>
            </td>
        </tr>
    </table>

    <div class="aviso">
        Documento no fiscal. No sustituye la factura fiscal ni genera crédito fiscal de IVA.
        Los montos de IVA e IGTF se muestran solo como referencia.
    </div>

    <div class="foot">
        Generado por Boxy · Comprobante {{ $venta->numero_factura }} · {{ $venta->fecha->format('d/m/Y H:i') }}
        @if($venta->estado === 'anulada') · <b style="color:#dc2626">ANULADA{{ $venta->motivo_anulacion ? ': '.$venta->motivo_anulacion : '' }}</b> @endif
    </div>
</div>
</body>
</html>
