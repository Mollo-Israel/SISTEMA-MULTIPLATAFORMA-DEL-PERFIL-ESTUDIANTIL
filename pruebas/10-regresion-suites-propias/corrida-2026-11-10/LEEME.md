# Regresión del 10/11/2026 (después de las correcciones de SonarQube)

Resultado: **26 suites, 2.606 verificaciones correctas, 0 fallos** (`resumen.txt`).

Las 25 suites anteriores corrieron contra la API compilada en :3010 con la cobertura de V8 activada
(`scripts/pruebas/cobertura.mjs api`), correo simulado y servicios externos simulados.

La suite nueva, `e2e-web-gestion` (Web de gestión), se agregó el mismo día: recorre con un navegador real
los formularios web que ninguna otra prueba recorría (portada, pedidos de tecnologías, autonomía docente,
recursos, puntos, pantallas del docente y del estudiante, galería de proyectos y constancias) y comprueba su
efecto en la API. Corrió contra la API compilada en :3010 sin instrumentar, con correo simulado, y con la
cobertura de la web activada (`PRUEBAS_COBERTURA=1`, `web/dist` compilada con mapas «hidden»).

Los registros de esta carpeta son el intento válido de cada suite. Hubo cuatro repeticiones:

| Suite | Primer intento (`primeros-intentos/`) | Causa | Intento válido |
|---|---|---|---|
| V3.2 | 142 correctas, 7 fallos (401) | El equipo se suspendió durante la suite (7,4 h): vencieron los tokens de sesión de la propia prueba. | Repetida sin cambios: 206/0. |
| Web | 104 correctas, 2 fallos | Corrió contra el servidor de desarrollo de Vite, recién reanudado el equipo. Al repetirla sobre la compilación de producción quedó un fallo (WEB.44.2): el listado de gestión de Dirección, que no está paginado, tardó de 8 a 12 s con 14.492 actividades acumuladas en la base de desarrollo y la API instrumentada, y la prueba espera 10 s. | Repetida con la API sin instrumentar y la compilación de producción: 106/0 (`verificacion-sin-instrumentar/`). El listado tardó una mediana de 5,1 s. |
| Web V6 | 61 correctas, 2 fallos | Servidor de desarrollo de Vite recién reanudado el equipo. | Repetida sobre la compilación de producción con la API instrumentada: 63/0 (`cobertura-web/`). |
| Web de gestión | 44 correctas, 1 fallo: la parte «estudiante» se interrumpió | Defecto de la prueba. Tras descargar el resumen en PDF, Edge abrió por su cuenta su panel interno de descargas (`edge://downloads-hub/`) como otra pestaña y dejó la de la prueba en segundo plano, donde Playwright no avanza. | La suite cierra ese panel y vuelve a la página de la prueba: 47/0. |

`cobertura-web/` contiene la ejecución de las dos suites de navegador anteriores con la cobertura de la web
activada (`PRUEBAS_COBERTURA=1`, API sin instrumentar): Web 106/0 y Web V6 63/0. Ninguna repetición cambió
código de Afinia.

Observación para una versión posterior: `GET /activities/managed` devuelve todas las actividades sin
paginar; con volúmenes grandes conviene paginarlo.
