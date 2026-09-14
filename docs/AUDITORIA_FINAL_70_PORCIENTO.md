# Auditoría final del 70 %

Sistema Multiplataforma para la Construcción del Perfil Estudiantil Dinámico (Afinia)
Ingeniería en Sistemas Informáticos — Univalle

Auditoría estricta de los objetivos específicos **1 a 7** (RF1 – RF18) sobre la
rama `feat/avance-70-porciento`.

**Criterio.** Un requisito se aprueba solo si cumple **todo** esto:

1. modelo de datos y migración reversible;
2. backend con validaciones y control de acceso real;
3. endpoint expuesto y documentado;
4. pantalla que consume la API verdadera, no datos de ejemplo;
5. persistencia comprobada tras recargar;
6. flujo de éxito **y** flujos de rechazo verificados;
7. prueba automatizada que pasa.

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
| 7 — Recomendaciones académicas ligeras | RF18 | 84 | **APROBADO** |

**7 de 10 objetivos específicos · 18 de 25 requerimientos funcionales → 70 % de
avance funcional.**

---

## 2. Evidencia de ejecución

Base de datos **recreada desde cero** y suites ejecutadas **dos veces
consecutivas**, con resultado idéntico:

| Suite | Cobertura | 1.ª | 2.ª |
|---|---|---|---|
| `npm run test:40` | Objetivos 1 – 4 | 235 OK · 0 fallos | 235 OK · 0 fallos |
| `npm run test:50` | Objetivo 5 | 109 OK · 0 fallos | 109 OK · 0 fallos |
| `npm run test:60` | Objetivo 6 | 82 OK · 0 fallos | 82 OK · 0 fallos |
| `npm run test:70` | Objetivo 7 | 84 OK · 0 fallos | 84 OK · 0 fallos |
| `npm run test:api` | Validaciones y permisos | 42 OK · 0 fallos | 42 OK · 0 fallos |
| `npm run demo:e2e` | Flujo completo de 14 pasos | 25 OK · 0 fallos | 25 OK · 0 fallos |
| **Total** | | **577 · 0 fallos** | **577 · 0 fallos** |

**Compilación:** `shared` OK · `api` OK · `web` OK · `mobile typecheck` OK.

---

## 3. Objetivo 7 — verificación contra la Tabla 2.27

### RF18 · Consultar recomendaciones académicas — **APROBADO**

| Criterio | Evidencia |
|---|---|
| Modelo y migración | `recommendations`, columna `peer_discoverable` y categoría nueva, con `down` |
| Backend | Motor con seis generadores, servicio de consulta y decisiones |
| Endpoints | 5 rutas de recomendaciones más el directorio entre estudiantes |
| Interfaz | Móvil «Recomendaciones» (nombre exacto de RF18) y panel web |
| Persistencia | Las decisiones sobreviven a un nuevo cálculo (18.36, 18.37) |
| Rechazos | 18.45 – 18.55 y 18.69 – 18.73 |
| Prueba | 18.1 – 18.76 · **84 OK** |

### El invariante auditado

**El puntaje de una recomendación es exactamente la suma de sus motivos.**
Verificado en la prueba 18.5 sobre todas las recomendaciones generadas, y
comprobado durante el desarrollo con una consulta SQL sobre la tabla completa,
que devolvió cero discrepancias.

### Concurrencia y rendimiento

Las recomendaciones se generan al consultarlas, como describe la Tabla 2.27. Se
auditó lo que eso implica:

| Comprobación | Resultado |
|---|---|
| Latencia de generación | 34 a 137 ms |
| 60 consultas simultáneas | Todas 200, con el mismo total |
| Filas duplicadas tras la concurrencia | 0 |
| Errores de base en el registro de la API | 0 |

---

## 4. Objetivos 1 a 6 — sin regresiones

Las **493 verificaciones** anteriores siguen pasando íntegras.

Dos cambios alcanzaron a código anterior, y ninguno alteró comportamiento
existente:

| Cambio | Naturaleza |
|---|---|
| `profiles`: búsqueda entre estudiantes y preferencia de aparecer en sugerencias | Adición. El directorio institucional de RF3 no cambió |
| Catálogo de RF4: categoría «Recurso de apoyo» | Adición. Las 14 categorías originales quedaron intactas |

### Un defecto real del Objetivo 5, corregido

La pantalla de invitar integrantes pedía el directorio institucional y un
estudiante recibía **403**. El error se tragaba en silencio y la lista de
candidatos salía siempre vacía: **desde la app no se podía invitar a nadie**.

`test:50` no lo detectaba porque invita por identificador contra la API. Es un
recordatorio útil: una suite que prueba la API no prueba la interfaz.

---

## 5. Preservación de datos, comprobada

| Verificación | Antes | Después |
|---|---|---|
| Perfiles tras la migración | 46 | **46** |
| Afinidades tras la migración | 115 | **115** |
| Actividades tras la migración | 37 | **37** |
| Categorías del catálogo | 16 | **17**, ninguna modificada |
| Perfiles con la preferencia activa | — | **46 de 46**, por defecto |

**Migración reversible, comprobada:** el `down` deja cero tabla, tipos y
columna; conserva la categoría si alguna actividad la usa, porque borrarla
destruiría datos; y al reaplicar el `up` no se duplica.

---

## 6. Control de acceso

| Regla | Prueba |
|---|---|
| Solo el estudiante consulta sus recomendaciones | 18.53, 18.54, 18.55 |
| Una recomendación ajena responde 404, no 403 | 18.51, 18.52 |
| El puntaje no se puede fijar a mano | 18.47 |
| El estado «nueva» no se puede restablecer | 18.45 |
| El directorio entre estudiantes no lista a todos | 18.69 – 18.71 |
| Un docente no usa el directorio entre estudiantes | 18.73 |

**Ninguna autorización depende de ocultar un botón.**

---

## 7. Conformidad con RN-16

RN-16 dice que las recomendaciones **no serán obligatorias y que el estudiante
conservará la decisión sobre su utilización**.

| Comprobación | Resultado |
|---|---|
| Puede guardar y descartar | 18.34, 18.35 |
| Lo descartado no vuelve tras un nuevo cálculo | 18.36 |
| Lo guardado sigue guardado | 18.37 |
| Puede deshacer cualquier decisión | 18.41, 18.42 |
| Sin nota, aprobación ni obligación de ningún tipo | Modelo de datos y respuesta |

---

## 8. Hallazgos abiertos

| # | Hallazgo | Gravedad | Situación |
|---|---|---|---|
| 1 | Las 17 correcciones documentales del 40 % siguen sin aplicarse | Media | `CORRECCIONES_DOCUMENTO_FINAL_40.md` |
| 2 | Las 6 del 50 % siguen sin aplicarse | Media | `CORRECCIONES_DOCUMENTO_FINAL_50.md` |
| 3 | Las 5 del 60 % siguen sin aplicarse | Media | `CORRECCIONES_DOCUMENTO_FINAL_60.md` |
| 4 | Las 6 del 70 % siguen sin aplicarse | Media | `CORRECCIONES_DOCUMENTO_FINAL_70.md` |
| 5 | **Figura 2.30**: la rama `alt` contiene el camino de éxito bajo la etiqueta de fallo | Media | Corrección n.º 2 del Objetivo 7 |
| 6 | Figura 2.29 tiene el mismo error | Media | Hallazgo del 60 %, abierto |
| 7 | Figura 2.12 contradice a la Tabla 2.23 sobre la invitación | Media | Hallazgo del 50 %, abierto |
| 8 | Figuras 2.3 y 2.11 incluyen elementos sin ningún RF que los respalde | Media | Hallazgos del 40 %, abiertos |

**Todos son documentales.** No hay ningún hallazgo abierto de código, seguridad
o datos dentro de RF1 – RF18.

---

## 9. Deuda técnica no bloqueante

- Las reglas de recomendación son constantes documentadas con huella de versión,
  no filas de configuración como las ponderaciones de afinidad. RN-14 exigía
  «mecanismos de ponderación definidos para el sistema» y RN-16 no pide nada
  equivalente, pero la asimetría entre los dos motores conviene conocerla.
- Las recomendaciones se regeneran en cada consulta. Es lo más fiel a la Tabla
  2.27 y hoy cuesta menos de 140 ms, pero con un catálogo mucho mayor habría que
  revisarlo.
- Las suites son scripts contra la API real. Verifican el comportamiento de
  extremo a extremo, pero no aíslan capas, y el defecto del Objetivo 5 demuestra
  que tampoco cubren la interfaz.

---

## 10. Lo que este 70 % no incluye

Objetivos 8 a 10 (RF19 – RF25): contactos por código QR, chat privado, equipos y
chat grupal; gamificación aplicada; paneles avanzados, mapa de afinidad ampliado
y estimación de tendencias.

Aparecen como **«Próximamente»** en la navegación, sin pantallas vacías ni datos
de ejemplo.

---

## 11. Conclusión

Los siete primeros objetivos específicos están **implementados, integrados y
demostrables de extremo a extremo**, verificados por 577 comprobaciones
automatizadas sin un solo fallo, sobre base recreada desde cero y en dos
corridas consecutivas.

El Objetivo 7 construyó desde cero un módulo que no existía, y lo hizo de forma
que cada sugerencia puede justificarse: el puntaje es la suma de sus motivos, y
los motivos están escritos en el idioma del estudiante. Además cerró un defecto
real del Objetivo 5 que impedía invitar integrantes desde la aplicación móvil.

**Avance funcional: 7 de 10 objetivos = 70 %.**
