# Informe BATCH V7-6 — Retirar los registros verificables propios de Afinia

Formato del contrato V7.1 §17.

## BATCH / rama / commit base / commit resultante

V7-6 · `feature/afinia-v7-cierre-final`. Base: `0ea5753` (V7-5). El commit resultante es el que contiene este informe.

## Requisitos y páginas

- **Contrato:** §7 (pp. 16, 28–29).
- **Matriz:** V01–V05.
- **Hallazgos GAP:** VER-01…10, ADM-09 y DIR-03.

## Decisiones Dxx confirmadas

- **Decisión firme del contrato (§7):**
  - se retira el módulo visible para estudiante, Dirección y Administración, con la landing, el menú y `/verificar`;
  - se deshabilitan la emisión y la verificación propias;
  - se conservan tablas, claves, migraciones y datos como histórico interno restringido.
- **Enlaces ya compartidos (§15.5 / GAP #5):** respuesta **410 neutra**, sin datos personales y sin confirmar ni negar la vigencia de nada. No se redirige al perfil.

## Estado previo y reproducción

`e2e-v7.mjs batch6` y `e2e-v7-web.mjs batch6` contra V7-5 (módulo activo):

| Escenario | Antes (V7-5) |
|---|---|
| V03 | `GET /credentials/mine` 200. Emitir y la política respondían 403 o 400 por permisos, no porque el servicio no existiera |
| V02 | `GET /public/credentials/:code`, `/issuer` y `/keys`: **200 con datos** |
| V01 | La landing enlazaba «Verificar»; Dirección y Administración tenían «Registros verificables» en el menú, y la página abría por URL directa |

Inventario de desarrollo (solo lectura, 26/11): **2** registros, **4** entradas de la bitácora y **1** política. Se conservan.

## Ya estaba correcto (sin cambios)

- **VER-09:**
  - el QR y el enlace del perfil, los tokens de activación y la lectura de QR externos (V9) no dependen del módulo;
  - el Motor de Validación crea su propia instancia de `ProofVerifierService` para las insignias de **otros** emisores.
- Los certificados institucionales ya emitidos no se tocan.

## Cambios exactos y archivos

**API**
- `verifiable-credentials.module.ts`: el módulo ya no registra emisión, política, registro, descargas, verificador público, ni la preparación de la clave de firma al arrancar. Conserva las entidades.
- `retired-credentials.controller.ts` (nuevo): **todas** las rutas anteriores responden **410** `SERVICE_RETIRED` con un texto neutro:
  - autenticadas: `credentials/*`;
  - públicas: `public/credentials/*`.
- Se conservan en el código `crypto/` y `proof-verifier.service.ts` (los usa V9 para insignias externas) y los servicios antiguos como referencia histórica, sin registrarse.

**Web**
- Se retiran:
  - las rutas `/director/credentials` y `/admin/verifiable-credentials`;
  - los enlaces de la landing («Verificar», «Verificar un registro»);
  - las entradas de menú de Dirección y Administración;
  - la pestaña «Registros verificables» del estudiante.
- `/verificar` y `/verificar/:code` muestran `ServicioRetirado`: un aviso neutro que dice que Afinia no emite ni verifica certificados y remite a la institución o al proveedor.
- Archivos borrados: `pages/VerifyCredential.tsx`, `pages/director/VerifiableCredentials.tsx`, `components/RegistrosVerificables.tsx`, `components/InformeVerificacion.tsx` y `services/credentials.ts`.

**Móvil**
- Se quita la sección de la pantalla de Evidencias, el componente `RegistrosVerificables.tsx` y el servicio `credentialService`.

## Migraciones / datos preservados / compatibilidad web-móvil

- **Sin migraciones.** Las tablas `verifiable_credentials`, `credential_ledger`, `credential_signing_keys` y `credential_issuance_policies`, con sus filas, se conservan.
- La política queda sin efecto: no hay ruta que emita.
- Ninguna trayectoria, participación ni punto dependía del módulo.
- **Móvil:** una versión vieja de la app que pida `/credentials/mine` recibe 410 y no muestra la sección.

## Pruebas ejecutadas (comando, resultado, evidencia)

| Comando | Resultado |
|---|---|
| `e2e-v7.mjs batch6` / `e2e-v7-web.mjs batch6` contra V7-5 | 2 / 4 y 1 / 4 (reproducción) |
| `e2e-v7.mjs batch6` | **4 / 4** |
| `e2e-v7-web.mjs batch6` | **4 / 4** |
| Jest `registros-verificables-retirados.spec.ts` (reemplaza a `credenciales-verificables.spec.ts`) | **4 / 4** |
| `afinia-no-certifica.spec.ts` | En verde |

## PASS / FAIL / BLOCKED / NE

| Escenario | Resultado | Evidencia |
|---|---|---|
| V01 Landing y menús sin enlaces | **PASS** | W7.6.1 · W7.6.2 · W7.6.4 |
| V02 `/verificar` directo | **PASS** (web: aviso neutro; API: 410 neutro, también con un código real) | W7.6.1 · V7.6.2 · Jest |
| V03 Emisión propia | **PASS** (410; no se crea nada; sin bypass por permisos) | V7.6.1 · Jest |
| V04 QR del perfil y QR externo | **PASS** | V7.6.4 · `e2e-v3` batch9 (QR externos) |
| V05 Histórico preservado y restringido | **PASS** | V7.6.3 · Jest |

## Regresiones verificadas

- `e2e-v7` completo **92 / 0**, después de ajustar V7.3.14. Esa prueba fallaba por tiempos: el worker reclamaba el trabajo antes de la lectura. Ahora acepta cualquier estado posterior a encolar; el hash nuevo y el intento archivado se siguen exigiendo.
- Jest **197 / 197**: se retiraron las 21 pruebas de V8 y entraron las 4 del retiro.
- Unitarias **220 / 220**, incluida la librería criptográfica que sigue en uso.
- Web: `e2e-web` **106 / 0** · `e2e-v6-web` **63 / 0** · `e2e-v7-web` **38 / 0** · `e2e-web-gestion` **47 / 0**.
- `tsc` sin errores en API, web y móvil.
- Las suites anteriores de API no usaban el módulo; sus resultados son los de V7-5.

## Riesgos o limitaciones

- En `api/dist` pueden quedar archivos compilados de los controladores retirados. No se cargan porque el módulo no los registra.
- Si alguien necesita consultar el histórico, se hace por la base, con acceso restringido. No hay pantalla.

## Pendientes y siguiente batch propuesto

- **Decisiones del usuario:** migrar la base de desarrollo y autorizar o no el recálculo D04.
- **Siguiente batch: V7-7**, proyectos: activación y coherencia de tecnologías (§8).
