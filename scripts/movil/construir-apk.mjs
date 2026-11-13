/**
 * Genera el APK de la app móvil (Android) en esta PC, sin Expo Go ni cuenta de Expo.
 *
 *   npm run mobile:apk                                     # API de esta PC: http://<IP de la red>:3010/api
 *   npm run mobile:apk -- https://api.TU-DOMINIO.com/api   # API publicada
 *
 * Necesita Java 17 y el Android SDK: scripts/movil/instalar-herramientas-android.ps1 los
 * instala en %LOCALAPPDATA%\Android (si ya existen en otra carpeta, se usan JAVA_HOME y
 * ANDROID_HOME).
 *
 * Compila una copia de mobile/ en una ruta corta (C:\afinia-apk, o AFINIA_APK_DIR): en
 * Windows la compilación nativa falla con rutas de más de 260 caracteres, y la del proyecto
 * ya es larga y tiene espacios. El repositorio no cambia. En la copia se genera el proyecto
 * Android (expo prebuild) y solo ahí se ajusta lo que Expo Go hacía por su cuenta:
 *   - permitir HTTP cuando la API no usa HTTPS (Android lo bloquea en una versión release);
 *   - el tema claro que pide app.json (Expo Go lo aplica con expo-system-ui).
 * El APK queda en mobile/apk/Afinia.apk (ignorado por git).
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir, networkInterfaces } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MOVIL = join(RAIZ, 'mobile');
const WIN = process.platform === 'win32';
const COPIA = process.env.AFINIA_APK_DIR || (WIN ? String.raw`C:\afinia-apk` : join(homedir(), 'afinia-apk'));
const HERRAMIENTAS = join(process.env.LOCALAPPDATA || homedir(), 'Android');
const JAVA = process.env.JAVA_HOME || join(HERRAMIENTAS, 'jdk-17');
const SDK = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || join(HERRAMIENTAS, 'Sdk');
// Teléfonos de 64 y 32 bits, y x86_64 para el emulador de Android.
const ABIS = process.env.AFINIA_APK_ABIS || 'arm64-v8a,armeabi-v7a,x86_64';
const API_PORT = 3010;
const NO_SE_COPIAN = new Set(['node_modules', '.expo', 'android', 'ios', 'apk', '.maestro', 'README.md']);
const SALIDA = join(MOVIL, 'apk', 'Afinia.apk');

function fallar(mensaje) {
  console.error(`\n✗ ${mensaje}`);
  process.exit(1);
}

/** Corre un comando y corta si falla. En Windows npm, npx y gradlew son .cmd/.bat y necesitan cmd. */
function correr(titulo, comando, args, opciones = {}) {
  console.log(`\n▸ ${titulo}`);
  const r = WIN
    ? spawnSync([comando, ...args].join(' '), { stdio: 'inherit', shell: true, ...opciones })
    : spawnSync(comando, args, { stdio: 'inherit', ...opciones });
  if (r.status !== 0) fallar(`${titulo}: terminó con código ${r.status ?? r.signal}.`);
}

/** IPv4 de la red local de esta PC, sin los adaptadores virtuales (WSL, Hyper-V, VirtualBox, VMware…). */
function ipLocal() {
  const virtual = /vEthernet|VirtualBox|VMware|WSL|Hyper-V|Loopback|Bluetooth|docker|veth/i;
  for (const [nombre, direcciones] of Object.entries(networkInterfaces())) {
    if (virtual.test(nombre)) continue;
    const ip = direcciones?.find((d) => d.family === 'IPv4' && !d.internal && !d.address.startsWith('169.254.'));
    if (ip) return ip.address;
  }
  return null;
}

function urlDeLaApi() {
  const pedida = process.argv[2];
  if (pedida) {
    if (!/^https?:\/\/[^/\s]+\/api$/.test(pedida)) {
      fallar(`La URL de la API debe terminar en /api, por ejemplo https://api.TU-DOMINIO.com/api (llegó: ${pedida}).`);
    }
    return pedida;
  }
  const ip = ipLocal();
  if (!ip) fallar('No se encontró la IP de la red de esta PC. Pasa la URL de la API como argumento.');
  return `http://${ip}:${API_PORT}/api`;
}

function revisarHerramientas() {
  if (/\s/.test(COPIA)) fallar(`La carpeta de compilación no debe tener espacios: ${COPIA} (cámbiala con AFINIA_APK_DIR).`);
  const java = join(JAVA, 'bin', WIN ? 'java.exe' : 'java');
  if (existsSync(java) && existsSync(join(SDK, 'platforms'))) return;
  fallar([
    'Faltan Java 17 o el Android SDK.',
    `  Java buscado en:        ${JAVA}`,
    `  Android SDK buscado en: ${SDK}`,
    'Instálalos con:  powershell -ExecutionPolicy Bypass -File scripts/movil/instalar-herramientas-android.ps1',
    'o define JAVA_HOME y ANDROID_HOME si ya los tienes en otra carpeta.',
  ].join('\n'));
}

/** Copia mobile/ a la carpeta de compilación, sin dependencias ni carpetas generadas. */
function copiarFuentes() {
  console.log(`\n▸ Copiando mobile/ a ${COPIA}`);
  mkdirSync(COPIA, { recursive: true });
  rmSync(join(COPIA, 'src'), { recursive: true, force: true }); // por si se borró algún archivo
  for (const nombre of readdirSync(MOVIL)) {
    if (!NO_SE_COPIAN.has(nombre)) cpSync(join(MOVIL, nombre), join(COPIA, nombre), { recursive: true, force: true });
  }
}

/** npm ci solo cuando cambió el package-lock.json desde la última compilación. */
function instalarDependencias() {
  const lock = readFileSync(join(MOVIL, 'package-lock.json'), 'utf8');
  const marca = join(COPIA, '.lock-instalado.json');
  if (existsSync(join(COPIA, 'node_modules')) && existsSync(marca) && readFileSync(marca, 'utf8') === lock) {
    console.log('\n▸ Dependencias sin cambios desde la última compilación');
    return;
  }
  correr('Instalando dependencias (npm ci)', 'npm', ['ci', '--no-audit', '--no-fund'], { cwd: COPIA });
  writeFileSync(marca, lock);
}

function reemplazar(archivo, buscado, nuevo) {
  const texto = readFileSync(archivo, 'utf8');
  if (texto.includes(nuevo)) return;
  if (!texto.includes(buscado)) fallar(`No se pudo ajustar ${archivo}: la plantilla de Expo cambió.`);
  writeFileSync(archivo, texto.replace(buscado, nuevo));
}

/** Lo que Expo Go hacía por su cuenta y una compilación release no hace. */
function ajustarProyecto(apiUrl) {
  const main = join(COPIA, 'android', 'app', 'src', 'main');
  if (apiUrl.startsWith('http://')) {
    reemplazar(join(main, 'AndroidManifest.xml'), '<application android:name=".MainApplication"',
      '<application android:name=".MainApplication" android:usesCleartextTraffic="true"');
  }
  const { expo } = JSON.parse(readFileSync(join(MOVIL, 'app.json'), 'utf8'));
  if (expo.userInterfaceStyle === 'light') {
    reemplazar(join(main, 'res', 'values', 'styles.xml'), 'Theme.AppCompat.DayNight.NoActionBar', 'Theme.AppCompat.Light.NoActionBar');
  }
}

function compilar(apiUrl) {
  const android = join(COPIA, 'android');
  const entorno = { ...process.env, CI: '1', EXPO_NO_TELEMETRY: '1' };
  const gradlew = join(android, WIN ? 'gradlew.bat' : 'gradlew');
  // Un Gradle de la compilación anterior deja archivos abiertos y en Windows
  // prebuild --clean no puede borrar la carpeta: se detiene antes.
  if (existsSync(gradlew)) {
    spawnSync(WIN ? `${gradlew} --stop` : gradlew, WIN ? [] : ['--stop'], {
      cwd: android, stdio: 'ignore', shell: WIN, env: { ...entorno, JAVA_HOME: JAVA },
    });
  }
  correr('Generando el proyecto Android (expo prebuild)', 'npx',
    ['expo', 'prebuild', '--platform', 'android', '--clean', '--no-install'], { cwd: COPIA, env: entorno });
  ajustarProyecto(apiUrl);
  correr('Compilando el APK con Gradle (la primera vez tarda varios minutos)', gradlew,
    // Sin servicio de Gradle en segundo plano: en Windows dejaba archivos abiertos.
    ['assembleRelease', `-PreactNativeArchitectures=${ABIS}`, '--console=plain', '--no-daemon', '-Pkotlin.compiler.execution.strategy=in-process'], {
      cwd: android,
      env: { ...entorno, JAVA_HOME: JAVA, ANDROID_HOME: SDK, ANDROID_SDK_ROOT: SDK, EXPO_PUBLIC_API_URL: apiUrl, NODE_ENV: 'production' },
    });
  return join(android, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
}

const apiUrl = urlDeLaApi();
console.log(`API que usará la app: ${apiUrl}`);
revisarHerramientas();
copiarFuentes();
instalarDependencias();
const apk = compilar(apiUrl);
mkdirSync(dirname(SALIDA), { recursive: true });
copyFileSync(apk, SALIDA);
// El código JavaScript va sin comprimir dentro del APK: la URL debe aparecer tal cual.
if (!readFileSync(SALIDA).includes(apiUrl)) fallar(`El APK no contiene la URL ${apiUrl}. Borra ${COPIA} y vuelve a generarlo.`);

const mb = (statSync(SALIDA).size / 1024 / 1024).toFixed(1);
console.log(`
✓ APK listo: ${relative(RAIZ, SALIDA)} (${mb} MB)
  API: ${apiUrl}
  Para instalarlo, pásalo al teléfono Android (cable, Drive o WhatsApp como documento), ábrelo y
  permite «instalar apps de origen desconocido».`);
if (apiUrl.startsWith('http://')) {
  console.log(`  Con la API de esta PC, el teléfono debe estar en la misma red y la API encendida
  (npm run api:dev). Si cambia la IP de la PC, vuelve a generar el APK.`);
}
