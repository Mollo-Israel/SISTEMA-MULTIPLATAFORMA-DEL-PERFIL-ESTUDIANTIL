# Auditoría final del 60 %

Sistema Multiplataforma para la Construcción del Perfil Estudiantil Dinámico (Afinia)
Ingeniería en Sistemas Informáticos — Univalle

Auditoría estricta de los objetivos específicos **1 a 6** (RF1 – RF17) sobre la
rama `feat/avance-60-porciento`.

**Criterio.** Un requisito se aprueba solo si cumple **todo** esto:

1. modelo de datos y migración reversible;
2. backend con validaciones y control de acceso real;
3. endpoint expuesto y documentado;
4. pantalla que consume la API verdadera, no datos de ejemplo;
5. persistencia comprobada tras recargar;
6. flujo de éxito **y** flujos de rechazo verificados;
7. prueba automatizada que pasa.

Si falla uno solo, el requisito **no** se aprueba.

---

## 1. Veredicto

| Objetivo | RF | Verificaciones | Veredicto |
|---|---|---|---|
| 1 — Usuarios, autenticación, roles y acceso | RF1 – RF4 | 63 | **APROBADO** |
| 2 — Perfil estudiantil dinámico | RF5, RF6 | 59 | **APROBADO** |
| 3 — Actividades académicas y extracurriculares | RF7 – RF9 | 47 | **APROBADO** |
| 4 — Participación, evidencias y constancias | RF10 – RF12 | 66 | **APROBADO** |
| 5 — Portafolio de proyectos estudiantiles | RF13 – RF16 | 109 | **APROBADO** |
| 6 — Motor de afinidad estudiantil | RF17 | 82 | **APROBADO** |

**6 de 10 objetivos específicos · 17 de 25 requerimientos funcionales → 60 % de
avance funcional.**

---

## 2. Evidencia de ejecución

Base de datos **recreada desde cero** (`db:reset` → `api:migrate` →
`seed:populate`) y suites ejecutadas **dos veces consecutivas**, con resultado
idéntico:

| Suite | Cobertura | 1.ª | 2.ª |
|---|---|---|---|
| `npm run test:40` | Objetivos 1 – 4 | 235 OK · 0 fallos | 235 OK · 0 fallos |
| `npm run test:50` | Objetivo 5 | 109 OK · 0 fallos | 109 OK · 0 fallos |
| `npm run test:60` | Objetivo 6 | 82 OK · 0 fallos | 82 OK · 0 fallos |
| `npm run test:api` | Validaciones y permisos | 42 OK · 0 fallos | 42 OK · 0 fallos |
| `npm run demo:e2e` | Flujo completo de 14 pasos | 25 OK · 0 fallos | 25 OK · 0 fallos |
| **Total** | | **493 · 0 fallos** | **493 · 0 fallos** |

La repetición importa: descarta pruebas que solo pasan sobre base limpia y
descarta dependencias del orden de ejecución.

**Compilación:** `shared` OK · `api` OK · `web` OK · `mobile typecheck` OK.

---

## 3. Objetivo 6 — verificación contra la Tabla 2.26

### RF17 · Consultar afinidades académicas — **APROBADO**

| Criterio | Evidencia |
|---|---|
| Modelo y migración | 4 tablas nuevas en `1780260000000-Objective6AffinityEngine`, con `down` |
| Backend | `AffinityEngineService` con ponderaciones leídas de la base y persistencia transaccional |
| Endpoints | 11 rutas, 6 nuevas |
| Interfaz | Móvil «Mis afinidades» (nombre exacto de RF17) y web para estudiante y docente |
| Persistencia | 17.19 vuelve a leer tras recalcular; 17.47 contrasta la instantánea con el estado vigente |
| Rechazos | 17.50 – 17.57 y 17.61 – 17.70 |
| Prueba | 17.1 – 17.75 · **82 OK** |

**El documento exigía más de lo que estaba hecho.** Tres de los elementos
construidos en este avance ya figuraban en la Tabla 2.26 y no existían en el
software:

| Tabla 2.26 exigía | Estaba | Ahora |
|---|---|---|
| Flujo alternativo 3a: informar si no hay información suficiente | Lista vacía | Estado `insufficient_data` con mensaje accionable |
| Flujo 5: organizar los resultados **por áreas y niveles** | Solo puntaje y nivel absoluto | Ranking con posición, nivel relativo y peso |
| Flujo 4: **criterios de ponderación definidos para el sistema** | Constante en el código | Tabla `affinity_weights`, auditable |
| Condición posterior: **sin modificar directamente los resultados** | Ya se cumplía | Verificado explícitamente (17.74) |

### El invariante auditado

**La suma del desglose de un área es exactamente su puntaje.** Verificado en
tres puntos distintos: sobre un área con área declarada (17.24), sobre un área
deducida por etiquetas (17.31), y desde la vista del docente (17.60).

Es una consecuencia del diseño, no una casualidad: el motor produce la lista
completa de contribuciones y solo después agrega, de modo que el número y su
explicación provienen de la misma pasada.

### Cada ponderación, verificada por separado

La suite construye un perfil señal por señal y comprueba el puntaje tras cada
una (17.5 a 17.16). Eso demuestra que las 13 ponderaciones se aplican de verdad,
en lugar de comprobar solo que «sale un número».

---

## 4. Objetivos 1 a 5 — sin regresiones

Las **411 verificaciones** anteriores siguen pasando íntegras.

Un solo cambio del Objetivo 6 alcanzó a código anterior:

| Cambio | Naturaleza |
|---|---|
| `basicMap()` pasó a agregar en SQL | Rendimiento. **Sin cambio de contrato**: se comparó la respuesta de `/reports/director/affinity-map` campo por campo antes y después, y es idéntica |

**Ningún cambio de comportamiento** en los objetivos 1 a 5.

---

## 5. Preservación de datos, comprobada

No se dio por supuesta: se midió.

| Verificación | Antes | Después |
|---|---|---|
| Afinidades tras la migración | 77 | **77** |
| **Puntajes** tras recalcular con el motor nuevo | 77 filas | **77 filas idénticas, 0 diferencias** |
| Proyectos tras la migración del 50 % | 12 | 12 |
| Actividades tras la migración del 40 % | 32 | 32 |

El paso de ponderaciones en código a ponderaciones en base era un refactor, y se
verificó como tal: se capturaron los resultados del motor anterior, se migró, se
recalculó y se compararon las capturas. **Cero diferencias.**

**Migración reversible, comprobada:** se ejecutó el `down` y se verificó que
quedan **0 tablas** y **0 tipos enumerados** huérfanos, y que `affinity_results`
sale intacta. Después se volvió a aplicar el `up`. `synchronize: false` se
mantiene.

---

## 6. Control de acceso

| Regla | Implementación | Prueba |
|---|---|---|
| El estudiante consulta solo lo suyo | `resolveProfileIdByUser` | 17.65 |
| El docente consulta dentro de su alcance | `TeacherScopeService` | 17.58, 17.59 |
| Fuera de alcance: lista, resumen, desglose y recálculo | 403 en los cuatro | 17.61 – 17.64 |
| El mapa agregado es del director y el administrador | 403 para estudiante y docente | 17.66 – 17.68 |
| Un docente no tiene afinidad propia | 403 | 17.70 |
| Nadie fija una afinidad a mano | El endpoint no existe | 17.74 |
| Las ponderaciones no se editan por API | El endpoint no existe | 17.75 |

**Una sola fuente de verdad.** El alcance académico del docente sigue viviendo
únicamente en `TeacherScopeService`, que ya gobernaba actividades, perfiles y el
portafolio. El motor de afinidad lo reutiliza en lugar de reimplementarlo.

**Se cerró el desglose, no solo el resumen.** Un docente fuera de alcance recibe
403 también al pedir la explicación de un área (17.63). Dejarlo abierto habría
sido una puerta trasera al mismo dato.

---

## 7. Conformidad con RN-15

RN-15 dice que los resultados **no** deben usarse para evaluar rendimiento,
determinar calificaciones, diagnosticar dificultades ni tomar decisiones
institucionales formales.

| Comprobación | Resultado |
|---|---|
| El resumen no expone nota, calificación ni aprobación | 17.71 |
| El desglose tampoco | 17.72 |
| Las ponderaciones son puntajes acotados (`CHECK` 0–100), no escalas de nota | 17.73 |
| El estudiante no puede fijar su afinidad a mano | 17.74 |
| El aviso de carácter orientativo aparece en móvil y en web, y en la vista del docente | Interfaz |

El historial se etiqueta explícitamente como historial y **no** como predicción:
las estimaciones de tendencias son el décimo objetivo específico, y RN-15
prohíbe anticipar resultados académicos.

---

## 8. Hallazgos abiertos

| # | Hallazgo | Gravedad | Situación |
|---|---|---|---|
| 1 | Las 17 correcciones documentales del 40 % siguen sin aplicarse al Word | Media | `CORRECCIONES_DOCUMENTO_FINAL_40.md` |
| 2 | Las 6 correcciones del 50 % siguen sin aplicarse | Media | `CORRECCIONES_DOCUMENTO_FINAL_50.md` |
| 3 | Las 5 correcciones del 60 % siguen sin aplicarse | Media | `CORRECCIONES_DOCUMENTO_FINAL_60.md` |
| 4 | **Figura 2.29:** el fragmento `alt` contiene el camino de éxito bajo la etiqueta de fallo, contradiciendo a su propio texto | Media | Corrección n.º 2 del Objetivo 6 |
| 5 | Figura 2.12 contradice a la Tabla 2.23 sobre la invitación a proyectos | Media | Hallazgo del 50 %, abierto |
| 6 | Figura 2.3 incluye «Validar y aprobar evidencias», sin RF ni mención en el texto | Media | Hallazgo del 40 %, abierto |
| 7 | Figura 2.11 incluye «Servicio de notificaciones», sin RF ni mención | Baja | Hallazgo del 40 %, abierto |
| 8 | El director de carrera no abre el detalle individual de un proyecto | Baja | Decisión deliberada del 50 %, anotada |

**Todos son documentales.** No hay ningún hallazgo abierto de código, seguridad
o datos dentro de RF1 – RF17.

---

## 9. Deuda técnica no bloqueante

- Las suites son scripts contra la API real, no pruebas unitarias: verifican el
  comportamiento de extremo a extremo, pero no aíslan capas.
- Los umbrales de clasificación del nivel son constantes documentadas en el
  motor, no filas de configuración. Se incluyen en la huella de reglas, de modo
  que un cambio queda registrado en el historial, pero cambiarlos requiere
  desplegar.
- La poda del historial conserva las últimas 30 instantáneas por estudiante. Es
  suficiente para ver evolución; si en el futuro el Objetivo 10 necesita series
  más largas, habrá que revisar el límite.

---

## 10. Lo que este 60 % no incluye

Objetivos 7 a 10 (RF18 – RF25), fuera del alcance de este hito:

- Recomendaciones académicas ligeras (RF18)
- Contactos por QR, chat privado, equipos y chat grupal (RF19 – RF22)
- Gamificación aplicada: puntos, insignias y progreso (RF23)
- Paneles avanzados, mapa de afinidad ampliado y estimación de tendencias
  (RF24, RF25)

Aparecen como **«Próximamente»** en la navegación, sin pantallas vacías ni datos
de ejemplo. Dentro de RF1 – RF17 no queda ningún marcador de pendiente.

---

## 11. Conclusión

Los seis primeros objetivos específicos están **implementados, integrados y
demostrables de extremo a extremo**, verificados por 493 comprobaciones
automatizadas sin un solo fallo, sobre base recreada desde cero y en dos
corridas consecutivas.

El Objetivo 6 no añadió un motor: el motor existía. Lo que añadió es lo que
convierte un puntaje en orientación defendible — **poder explicar de dónde sale
cada número**, un nivel que discrimina dentro del propio perfil en lugar de una
escala fija, el estado de información insuficiente que el documento ya exigía, y
un historial que hace del «actualizar» de RF17 algo distinto de sobrescribir.
De paso corrigió un fallo de robustez real: un recálculo interrumpido podía
dejar a un estudiante sin ninguna afinidad.

**Avance funcional: 6 de 10 objetivos = 60 %.**
