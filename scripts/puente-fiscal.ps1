# ─────────────────────────────────────────────────────────────────────────────
# Puente de la impresora fiscal para Boxy (protocolo The Factory HKA).
#
# Corre en la PC de la caja, junto al programa del fabricante IntTFHKA.exe.
# Pide a Boxy las ventas pendientes, las imprime en la impresora fiscal y
# reporta el número de factura (o el error). Ver docs/IMPRESORA-FISCAL.md.
#
# SIN PROBAR CON EQUIPO REAL: ajusta la configuración y pruébalo con la
# impresora (idealmente en modo entrenamiento) antes de usarlo con clientes.
#
# Uso:  powershell -ExecutionPolicy Bypass -File puente-fiscal.ps1
# ─────────────────────────────────────────────────────────────────────────────

# ── Configuración ──
$Api      = 'https://boxy.midominio.com/api'   # dirección de la API de Boxy
$Clave    = 'PEGAR-AQUI-LA-CLAVE-DEL-PUENTE'   # Mi empresa → Generar clave del puente
$IntTfhka = Join-Path $PSScriptRoot 'IntTFHKA.exe'
$Carpeta  = $PSScriptRoot                      # donde IntTFHKA escribe Retorno.txt / Status.txt
$Espera   = 5                                  # segundos entre consultas

# Posición del número de la última factura dentro del estado S1 (depende del modelo:
# revísalo en el manual del protocolo de tu impresora).
$S1Inicio = 21
$S1Largo  = 8

# ─────────────────────────────────────────────────────────────────────────────
$ErrorActionPreference = 'Stop'
$Cabeceras = @{ Authorization = "Bearer $Clave"; Accept = 'application/json' }

function Escribir-Log([string]$texto) {
    $linea = "{0:yyyy-MM-dd HH:mm:ss}  {1}" -f (Get-Date), $texto
    Write-Host $linea
    Add-Content -Path (Join-Path $Carpeta 'puente-fiscal.log') -Value $linea -Encoding UTF8
}

function Ejecutar-Tfhka([string]$argumentos) {
    $proceso = Start-Process -FilePath $IntTfhka -ArgumentList $argumentos -WorkingDirectory $Carpeta -Wait -PassThru -WindowStyle Hidden
    return $proceso.ExitCode
}

function Leer-Retorno() {
    $ruta = Join-Path $Carpeta 'Retorno.txt'
    if (Test-Path $ruta) { return (Get-Content $ruta -Raw) }
    return ''
}

function Numero-Ultima-Factura() {
    $estado = Join-Path $Carpeta 'Status.txt'
    if (Test-Path $estado) { Remove-Item $estado -Force }
    Ejecutar-Tfhka "UploadStatusCmd(S1,$estado)" | Out-Null
    if (-not (Test-Path $estado)) { return $null }
    $s1 = (Get-Content $estado -Raw).Trim()
    if ($s1.Length -lt ($S1Inicio + $S1Largo)) { return $null }
    return $s1.Substring($S1Inicio, $S1Largo)
}

function Reportar([int]$ventaId, [hashtable]$cuerpo) {
    $json = $cuerpo | ConvertTo-Json -Compress
    Invoke-RestMethod -Method Post -Uri "$Api/fiscal/puente/ventas/$ventaId/resultado" -Headers $Cabeceras `
        -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($json)) | Out-Null
}

Escribir-Log "Puente fiscal iniciado. API: $Api"
if (-not (Test-Path $IntTfhka)) { Escribir-Log "No se encontró $IntTfhka"; exit 1 }

while ($true) {
    try {
        $pendientes = Invoke-RestMethod -Method Get -Uri "$Api/fiscal/puente/pendientes" -Headers $Cabeceras
        foreach ($venta in $pendientes) {
            Escribir-Log "Imprimiendo venta $($venta.numero) (Bs $($venta.total_bs))"
            $archivo = Join-Path $Carpeta 'Factura.txt'
            # La impresora espera texto ANSI (sin acentos; Boxy ya los quita)
            [IO.File]::WriteAllLines($archivo, [string[]]$venta.comandos, [Text.Encoding]::GetEncoding(1252))

            $codigo = Ejecutar-Tfhka "SendFileCmd($archivo)"
            $retorno = Leer-Retorno
            $ok = ($codigo -eq 0) -and ($retorno -notmatch 'FALSE|Error:\s*[1-9]')

            if ($ok) {
                $numero = Numero-Ultima-Factura
                if (-not $numero) { $numero = 'VER-IMPRESORA' }
                Reportar $venta.id @{ ok = $true; numero_fiscal = $numero }
                Escribir-Log "  OK · factura fiscal $numero"
            } else {
                $detalle = ($retorno -replace '\s+', ' ').Trim()
                if (-not $detalle) { $detalle = "IntTFHKA terminó con código $codigo" }
                Reportar $venta.id @{ ok = $false; error = $detalle.Substring(0, [Math]::Min(250, $detalle.Length)) }
                Escribir-Log "  ERROR · $detalle"
            }
        }
    } catch {
        Escribir-Log "Sin conexión con Boxy o error: $($_.Exception.Message)"
    }
    Start-Sleep -Seconds $Espera
}
