# Regresión del 12/11/2026 (después de la segunda ronda de correcciones de SonarQube)

Resultado: **26 suites, 2.606 verificaciones correctas, 0 fallos** (`resumen.txt`).

Las suites corrieron contra la API compilada en :3010 con la cobertura de V8 activada
(`scripts/pruebas/cobertura.mjs api`), correo simulado (`MAIL_TRANSPORT=console`) y servicios externos
simulados. Las tres suites de navegador registraron además la cobertura de la web (`PRUEBAS_COBERTURA=1`,
`web/dist` compilada con mapas «hidden»). Los registros auxiliares (compilaciones, Playwright, Jest,
conversión de la cobertura y SonarQube) están en `otros/`.

Los registros de esta carpeta son el intento válido de cada suite. Hubo una repetición:

| Suite | Intentos previos (`primeros-intentos/`) | Causa | Intento válido |
|---|---|---|---|
| Web | 1.º: 105 correctas, 1 fallo (WEB.44.2). Reintento automático: 104 correctas, 2 fallos (WEB.43.3 y WEB.44.2) | Tiempo de espera en el listado de gestión de actividades de Dirección, que no está paginado, con la API instrumentada y unas 14.000 actividades en la base de desarrollo. Es el mismo caso descrito en la corrida del 10/11 (defecto D-12 de la tesis). | Repetida el 13/11 con la API compilada sin instrumentar: 106/0 (`repeticion-web/`, copiada como `e2e-web.log`). |

La batería unitaria de Node.js se ejecutó primero con `MAIL_TRANSPORT=console` exportado por el script de la
corrida; seis pruebas de correo fallaron porque necesitan controlar ellas mismas esa variable
(`otros/unitarias-primer-intento-con-MAIL_TRANSPORT.log`). Repetida sin esa variable: 167/167
(`otros/unitarias.log`).

Ninguna repetición cambió código de Afinia.

Otras evidencias de la misma verificación:

- Playwright: 54/54 (`otros/playwright.log`).
- Jest: 120/120 (`pruebas/02-jest-supertest`).
- Newman: 34 solicitudes, 70 aserciones, 0 fallos (13/11, `pruebas/04-postman-newman`).
- k6: todos los umbrales cumplidos (13/11, `pruebas/05-k6/corrida-2026-11-13`).
- ZAP: 119 reglas superadas, 0 fallos, 0 advertencias (13/11, `pruebas/06-zap/corrida-2026-11-13`).
- SonarQube: Quality Gate aprobado; 24 incidencias, 0 en código nuevo; cobertura del código nuevo 80,1 %
  (`pruebas/07-sonarqube/resumen.json`).
