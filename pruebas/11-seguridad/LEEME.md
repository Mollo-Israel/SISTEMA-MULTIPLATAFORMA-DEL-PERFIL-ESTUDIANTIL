# Pruebas de seguridad — evidencia (17/11/2026)

Evidencia de la sección 3.4 «Seguridad del sistema» del capítulo III. Se genera con:

```bash
node scripts/pruebas/entorno.mjs reconstruir   # base afinia_test desde cero
npm run pruebas:seguridad                      # --sin-gitleaks para omitir la búsqueda de secretos
```

El comando levanta la API compilada con `NODE_ENV=production` en el puerto 3030, contra `afinia_test`. Usa los límites de peticiones de producción, secretos de firma aleatorios de un solo uso y el correo apagado: sin cola y con un servidor SMTP local inexistente. Después ejecuta las suites, detiene la API, corre npm audit y Gitleaks y hace las verificaciones estáticas.

## Archivos

| Archivo | Contenido |
|---|---|
| `salida-consola.txt` | Salida detallada de Jest: los 79 casos, con su código PS-… |
| `salida-consola-color.txt` | La misma salida con colores (fuente de las figuras) |
| `reporte/reporte-seguridad.html` | Reporte HTML de Jest |
| `resumen-consola.txt` | Resumen de toda la ejecución (Figura 3.10 del PGT) |
| `resumen.json` | Resultados en formato JSON: Jest, npm audit, Gitleaks y verificaciones estáticas |
| `cabeceras-produccion.json` | Cabeceras, CORS, cookie y respuestas 429 observadas con el perfil de producción. La cookie lleva su valor omitido |
| `api-produccion.log` | Registro de la API de producción durante la prueba. Se ve que no pudo conectarse al SMTP falso, como se pretendía |
| `npm-audit-<paquete>-<todas\|ejecucion>.json` | Salida completa de npm audit de la raíz (API y shared), la web y la app móvil |
| `gitleaks.json` · `gitleaks-resumen.json` · `gitleaks-salida.txt` | Búsqueda de secretos en el historial, con los valores enmascarados |
| `verificaciones-estaticas.json` | PS-EST-01 a 07 y observaciones OBS-01 y 02 |

## Resultado

- **Jest + SuperTest:** 79 de 79.
  - `reglas.spec.ts`: 24.
  - `api.spec.ts`: 47.
  - `http.spec.ts`: 8.
- **Verificaciones estáticas:** 7 de 7, más 2 observaciones (CSP del hosting web y HTTP del APK local).
- **npm audit:** ninguna vulnerabilidad crítica en las dependencias de ejecución. Las altas vienen de NestJS 10 y de Expo SDK 54, y requieren una actualización mayor (riesgo R1 del PGT).
- **Gitleaks:** 196 commits y 0 secretos reales. Las 2 coincidencias de la regla `square-access-token` son identificadores `_lastExecutionId` de los resultados de Newman que empiezan por «eaaa».

Ningún archivo de esta carpeta contiene contraseñas, tokens ni secretos. La salida se filtra antes de escribirse y se revisó al terminar.
