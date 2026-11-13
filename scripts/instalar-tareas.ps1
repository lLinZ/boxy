# ─────────────────────────────────────────────────────────────────────────────
# Registra en el Programador de tareas de Windows la tarea "Boxy-Programador",
# que corre `php artisan schedule:run` cada minuto. Eso dispara:
#   - sincronización de tasas (9:00 a. m. y 1:00 p. m.),
#   - respaldo diario de la base (11:30 p. m.),
#   - limpieza de sesiones vencidas.
#
# Ejecutar UNA vez, como administrador:
#   powershell -ExecutionPolicy Bypass -File scripts\instalar-tareas.ps1
#
# Reemplaza la tarea antigua "Boxy-SincronizarTasas" si existe.
# ─────────────────────────────────────────────────────────────────────────────
param(
    [string]$Php = 'C:\xampp\php\php.exe',
    [string]$Api = (Resolve-Path (Join-Path $PSScriptRoot '..\apps\api')).Path
)

if (-not (Test-Path $Php)) { Write-Error "No se encontró PHP en $Php (usa -Php para indicar la ruta)."; exit 1 }
if (-not (Test-Path (Join-Path $Api 'artisan'))) { Write-Error "No se encontró artisan en $Api."; exit 1 }

$accion = New-ScheduledTaskAction -Execute $Php -Argument 'artisan schedule:run' -WorkingDirectory $Api
$disparador = New-ScheduledTaskTrigger -Once -At (Get-Date).Date -RepetitionInterval (New-TimeSpan -Minutes 1)
$ajustes = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
    -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 30)

if (Get-ScheduledTask -TaskName 'Boxy-SincronizarTasas' -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName 'Boxy-SincronizarTasas' -Confirm:$false
    Write-Host 'Se quitó la tarea antigua Boxy-SincronizarTasas.'
}

Register-ScheduledTask -TaskName 'Boxy-Programador' -Action $accion -Trigger $disparador -Settings $ajustes `
    -Description 'Boxy: tareas programadas de Laravel (tasas, respaldos, limpieza).' -RunLevel Highest -Force | Out-Null

Write-Host 'Listo: la tarea Boxy-Programador corre cada minuto.'
Write-Host 'Ver:    Get-ScheduledTaskInfo Boxy-Programador'
Write-Host 'Probar: Start-ScheduledTask Boxy-Programador'
