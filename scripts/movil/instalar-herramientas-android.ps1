# Instala Java 17 y el Android SDK que necesita `npm run mobile:apk`.
#
#   powershell -ExecutionPolicy Bypass -File scripts/movil/instalar-herramientas-android.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/movil/instalar-herramientas-android.ps1 -ConEmulador
#
# Todo queda en %LOCALAPPDATA%\Android (jdk-17 y Sdk), unos 4 GB; con -ConEmulador, unos 2 GB más.
# No pide permisos de administrador ni cambia variables de entorno del sistema: el script de
# compilación busca las herramientas en esa carpeta. Para desinstalar, basta borrarla.
# Al instalar el SDK se aceptan las licencias de Android SDK de Google.
param([switch]$ConEmulador)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$base = Join-Path $env:LOCALAPPDATA 'Android'
$sdk = Join-Path $base 'Sdk'
$jdk = Join-Path $base 'jdk-17'
$tmp = Join-Path $base 'descargas'
$sdkm = Join-Path $sdk 'cmdline-tools\latest\bin\sdkmanager.bat'
New-Item -ItemType Directory -Force $sdk, $tmp | Out-Null

function Paso($texto) { Write-Output ("[{0:HH:mm:ss}] {1}" -f (Get-Date), $texto) }

function Descargar($url, $zip, $destino) {
  & curl.exe -sSL --fail -o $zip $url
  if ($LASTEXITCODE -ne 0) { throw "No se pudo descargar $url" }
  if (Test-Path $destino) { Remove-Item -Recurse -Force $destino }
  New-Item -ItemType Directory -Force $destino | Out-Null
  & tar.exe -xf $zip -C $destino
  if ($LASTEXITCODE -ne 0) { throw "No se pudo descomprimir $zip" }
}

if (-not (Test-Path (Join-Path $jdk 'bin\java.exe'))) {
  Paso 'Descargando Java 17 (Eclipse Temurin)'
  Descargar 'https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse?project=jdk' "$tmp\jdk17.zip" "$tmp\jdk17"
  Move-Item (Get-ChildItem "$tmp\jdk17" -Directory | Select-Object -First 1).FullName $jdk
}
Paso ('Java: ' + ((Get-Content (Join-Path $jdk 'release') | Select-String 'JAVA_VERSION=') -replace '"', ''))

if (-not (Test-Path $sdkm)) {
  Paso 'Descargando Android command-line tools'
  Descargar 'https://dl.google.com/android/repository/commandlinetools-win-16111833_latest.zip' "$tmp\clt.zip" "$tmp\clt"
  New-Item -ItemType Directory -Force (Join-Path $sdk 'cmdline-tools') | Out-Null
  Move-Item "$tmp\clt\cmdline-tools" (Join-Path $sdk 'cmdline-tools\latest')
}

$env:JAVA_HOME = $jdk
$env:ANDROID_HOME = $sdk

# sdkmanager escribe avisos por stderr: se juntan en cmd para que PowerShell no los tome como errores.
$ErrorActionPreference = 'Continue'
function Sdk([string]$argumentos) {
  $lineas = & cmd.exe /d /c "`"$sdkm`" $argumentos 2>&1"
  $codigo = $LASTEXITCODE
  $lineas | Where-Object { $_ -and $_ -notmatch '^\s*\[[=# .]*\]|Unzipping|Downloading' } | Select-Object -Last 10
  if ($codigo -ne 0) { throw "sdkmanager $argumentos terminó con código $codigo" }
}

Paso 'Aceptando las licencias del Android SDK'
$respuestas = Join-Path $tmp 'respuestas.txt'
Set-Content -Path $respuestas -Value ((1..40 | ForEach-Object { 'y' }) -join "`r`n") -Encoding ascii
& cmd.exe /d /c "`"$sdkm`" --licenses < `"$respuestas`" 2>&1" | Select-Object -Last 2

# Versiones que pide React Native 0.81 (Expo SDK 54): Android 36, build-tools 36.0.0 y NDK 27.1.
Paso 'Instalando Android 36, build-tools, NDK y CMake'
Sdk '--install "platform-tools" "platforms;android-36" "build-tools;36.0.0" "ndk;27.1.12297006" "cmake;3.22.1"'

if ($ConEmulador) {
  Paso 'Instalando el emulador y un teléfono virtual (Android 15, x86_64)'
  Sdk '--install "emulator" "system-images;android-35;google_apis;x86_64"'
  $avdm = Join-Path $sdk 'cmdline-tools\latest\bin\avdmanager.bat'
  & cmd.exe /d /c "echo no| `"$avdm`" create avd -n afinia -k `"system-images;android-35;google_apis;x86_64`" -d pixel_6 --force 2>&1" | Select-Object -Last 2
}

Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
Paso "Listo. Herramientas en $base"
Paso 'Siguiente paso: npm run mobile:apk'
