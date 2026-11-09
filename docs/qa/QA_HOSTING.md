# QA de la preparación para el hosteo

Fecha: 09/11/2026 · Rama: `feature/afinia-r2-hosting`.

## Resultado

| Comprobación | Resultado |
|---|---|
| 25 suites E2E en modo normal (disco local), incluidas `e2e-web` y `e2e-v6-web` | **2559 correctas, 0 fallos** |
| Unitarias (`test:unit`) | 157/157 |
| Jest | 69/69 |
| `tsc` de API, web y móvil | Sin errores |
| `e2e-batch-3` y `e2e-v6` con `STORAGE_DRIVER=r2` contra el simulador | 58/58 y 98/98 |

## Prueba de la imagen de producción

Se construyó el `Dockerfile` y se ejecutó con `NODE_ENV=production`, sobre una base vacía creada para la prueba:

| Paso | Resultado |
|---|---|
| `npm run migration:run:prod` | 90 tablas creadas |
| `npm run seed:prod` | Cuenta de Administración creada |
| Arranque con `DATABASE_URL` y `PORT=8080` | `/api/health` responde `ok` |
| Swagger | Cerrado (404) |
| Inicio de sesión | Correcto |
| Subida a R2 (simulado) | Correcta |
| Comprobación de Brevo (simulado) al arrancar | Correcta |

## Hallazgos corregidos

- **WEB.44.2** esperaba 1,5 segundos fijos tras corregir una participación y fallaba con la base de desarrollo tan grande. Ahora espera el resultado. No había fallo del sistema.
- **`rules.test.ts`** seguía esperando el peso 5 % de clics que V6 §9.1 retiró. Se alineó con la V6. El reparto actual suma 95.

## Observación: tamaño de `notifications`

En la base de desarrollo pesa 1,8 GB: 3,3 millones de filas, de las cuales 3,29 millones son `ACTIVITY_REVIEW_SUBMITTED`. Cada actividad de prueba avisó a los directores de prueba acumulados por las suites. No se borró nada. En producción, con pocos directores, no se repite.

## Lo que no se ejecutó

- Cuentas reales de Cloudflare R2, Brevo y Railway: requieren las credenciales de producción.
- Entrega real de correo a un buzón `@univalle.edu`.
- Build de la app móvil con EAS.
- Playwright en 3 navegadores, k6, ZAP y SonarQube. La web solo cambió en la pantalla de correo de Administración, y `e2e-web` y `e2e-v6-web` corrieron completas.
