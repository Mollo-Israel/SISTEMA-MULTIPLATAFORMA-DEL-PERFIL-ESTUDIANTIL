# Guion de demostración — 60 %

Sistema Multiplataforma para la Construcción del Perfil Estudiantil Dinámico (Afinia)
Ingeniería en Sistemas Informáticos — Univalle

**Parte A** repasa en 3 minutos que el 50 % sigue en pie. **Parte B** demuestra
el motor de afinidad en 6 – 8 minutos.

---

## Preparación (antes de entrar a la sala)

```bash
npm run db:up          # PostgreSQL en Docker
npm run db:reset       # base limpia
npm run api:migrate    # 11 migraciones
npm run seed:populate  # datos de demostración
npm run api:dev        # backend
npm run web:dev        # panel web
npm run mobile:start   # app móvil
```

Deje abiertas dos ventanas del navegador (docente en alcance y docente fuera de
alcance) y el móvil con sesión de estudiante.

**Cuentas de demostración**

| Rol | Correo | Contraseña |
|---|---|---|
| Estudiante (semestre 1) | `ana.quispe@est.univalle.edu` | `Univalle2026*` |
| Estudiante (semestre 6) | `diego.mendoza@est.univalle.edu` | `Univalle2026*` |
| Docente **en alcance** (semestres 1–4) | `carlos.perez@univalle.edu` | `Univalle2026*` |
| Docente **fuera de alcance** (semestres 5–8) | `maria.gutierrez@univalle.edu` | `Univalle2026*` |
| Director de carrera | `jorge.vargas@univalle.edu` | `Univalle2026*` |
| Administrador | `admin@univalle.edu` | `Admin123*` |

**Plan B.** Si algo falla en vivo, ejecute `npm run test:60`: las 82
verificaciones recorren exactamente lo que iba a mostrar.

---

# PARTE A — El 50 % sigue funcionando (3 min)

| # | Acción | Qué demuestra |
|---|---|---|
| 1 | Administrador → **Usuarios** → alcance de Carlos Pérez (1–4) y María Gutiérrez (5–8) | RF1 – RF4 |
| 2 | Móvil, Ana → **Perfil** | RF5, RF6 |
| 3 | **Actividades**, filtre por categoría y fecha; inscríbase | RF7, RF8, RF10 |
| 4 | Docente web → **Asistencia** → confirme | RF11 |
| 5 | Móvil → descargue la **constancia** | RF12 |
| 6 | Móvil → **Portafolio** → invite a un integrante; muestre que queda **pendiente** y no es integrante | RF13, RF14 |
| 7 | Docente web → **Proyectos estudiantiles** → detalle y retroalimentación | RF15, RF16 |

**Cierre:** «Los cinco primeros objetivos siguen verificados por 411
comprobaciones automatizadas.»

---

# PARTE B — Objetivo 6: Motor de afinidad (6 – 8 min)

## Paso 1 · La pantalla que nombra RF17 (1 min)

**Móvil, sesión de Diego Mendoza** → pestaña **Afinidad**.

El encabezado dice **«Mis afinidades»**, que es el medio exacto que fija RF17.

Se ve el ranking:

```
#1 Ingeniería de Software      8   Alta     100%
#2 Redes                       6   Alta      75%
#3 Bases de Datos              5   Media     63%
#4 Gestión de Proyectos        5   Media     63%
#5 Inteligencia Artificial     4   Media     50%
#6 Desarrollo Web              2   Baja      25%
#7 Desarrollo Móvil            1   Baja      13%
```

> **Diga esto:** «La barra no es el puntaje absoluto: es el peso de cada área
> **respecto a la más fuerte de este mismo estudiante**. Y ese es el criterio con
> el que se clasifica el nivel.»

**El dato que conviene tener a mano:** con la regla anterior, de umbrales
absolutos, Diego no habría tenido **ninguna** área en nivel alto — 8, 6, 5, 5 y
4 puntos caían todos en «medio» o «bajo». El motor calculaba su orientación y no
se la mostraba. Medido sobre la base completa: **13 de 28 estudiantes no tenían
ni un área alta**; con la regla nueva son 5, y son perfiles genuinamente vacíos.

## Paso 2 · «Ver por qué» — el corazón de la defensa (1 min 30 s)

Toque el área **#1**. Se despliega el desglose:

```
Ingeniería de Software (total 8)
  +3   Habilidad declarada: UML (nivel 5)          declarada por ti
  +3   Habilidad declarada: Patrones de Diseño     declarada por ti
  +2   Interes declarado: Ingeniería de Software   declarada por ti
  ─────
   8
```

> **Diga esto:** «La suma del desglose es exactamente el puntaje. No por
> casualidad: el motor produce primero la lista completa de contribuciones y solo
> después agrega, así que el número y su explicación salen de la misma pasada y
> no pueden discrepar. Está verificado en tres puntos distintos de la suite.»

Señale la tercera columna: cada línea dice **cómo se asoció el área** —
declarada por el estudiante, deducida por coincidencia con las etiquetas del
área, deducida por texto, o heredada de la actividad o proyecto. Son las
«reglas, etiquetas y coincidencias» que nombra RN-14, hechas visibles.

## Paso 3 · «Cómo se calcula mi afinidad» (1 min)

Al final de la pantalla, despliegue **Cómo se calcula mi afinidad**. Aparecen
las 13 ponderaciones con su justificación.

> **Diga esto:** «RN-14 exige que el cálculo use *mecanismos de ponderación
> definidos para el sistema*. Antes eran una constante dentro del código fuente:
> nadie fuera del repositorio podía saber qué regla se había aplicado. Ahora son
> filas de una tabla, cada cálculo registra con qué versión de reglas se hizo, y
> el estudiante las tiene delante.»

Si preguntan por qué no hay pantalla de administración de pesos:

> «Porque ningún requerimiento funcional la concede. Son configuración del
> sistema, no un catálogo administrable como los de RF4. Añadirla habría sido
> inventar alcance.»

## Paso 4 · La salida de fallo de RF17 (1 min)

Registre un estudiante nuevo desde el móvil, cree su perfil y abra **Mis
afinidades**:

```
Todavia no podemos orientarte

Todavia no hay informacion suficiente para orientarte. Declara intereses y
habilidades, registra proyectos o participa en actividades y vuelve a consultar.

Lo que mas aporta:
 · Registrar un proyecto en tu portafolio
 · Adjuntar un certificado externo
 · Participar en una actividad y que te confirmen
 · Declarar tus intereses y habilidades
```

> **Diga esto:** «La Tabla 2.26 define un flujo alternativo 3a: *si todavía no
> existe información suficiente, el sistema informa al Estudiante*. Una lista
> vacía no dice eso. Este era uno de los requisitos que el documento ya exigía y
> el software no cumplía.»

## Paso 5 · Evolución (45 s)

Vuelva a Diego, pestaña **Evolución**. Cada cálculo registrado con su fecha,
totales, área más afín y la variación contra el anterior.

> **Diga esto:** «RF17 pide *calcular, actualizar y consultar*. Sin historial,
> actualizar es indistinguible de sobrescribir. Y es historial, no predicción:
> RN-15 prohíbe usar esto para anticipar resultados académicos, y las
> estimaciones de tendencias son el décimo objetivo.»

Si preguntan por la columna de versión de reglas:

> «Es la huella de las ponderaciones vigentes al calcular. Permite distinguir
> después una variación de puntaje causada por la actividad del estudiante de una
> causada por un ajuste de las reglas.»

## Paso 6 · El docente, dentro de su alcance (1 min 30 s)

**Web, Carlos Pérez** (semestres 1–4) → **Estudiantes** → seleccione a **Ana
Quispe** (semestre 1) → baje hasta **Áreas de afinidad**.

Ve el mismo ranking, y puede abrir el desglose:

```
Bases de Datos = 18
  +5   Proyecto propio: Sistema de monitoreo IoT para laboratorios
  +3   Habilidad declarada: SQL (nivel 4)
  +3   Habilidad declarada: PostgreSQL (nivel 5)
  +2   Evidencia: Demostración desplegada
  +2   Interes declarado: Bases de Datos
  +2   Evidencia: Repositorio del proyecto
  +1   Interes en actividad: Reto de Bases de Datos
```

> **Diga esto:** «El documento dice que el docente consulta afinidades para
> orientar actividades y conformar equipos. Para eso el número solo no sirve: la
> conversación con el estudiante se apoyaría en un dato que nadie puede
> justificar. Por eso el docente ve exactamente el mismo desglose.»

**Ahora la demostración de control**, que convence más que cualquier pantalla:

1. Copie el identificador del perfil de la URL.
2. Inicie sesión como **María Gutiérrez**, habilitada solo en semestres 5 a 8.
3. Pegue la misma URL.

**403.** Y también 403 al pedir el desglose directamente.

> «Cerramos el desglose y no solo el resumen: dejarlo abierto habría sido una
> puerta trasera al mismo dato. La verificación usa el mismo servicio de alcance
> académico que ya gobierna actividades, perfiles y portafolio: una sola fuente
> de verdad en todo el sistema.»

## Paso 7 · RN-15, el límite del sistema (30 s)

Señale lo que **no** hay: ningún campo de nota, puntaje de evaluación, rúbrica
ni estado de aprobación. Ni forma de fijar una afinidad a mano.

> **Diga esto:** «RN-15 dice que los resultados son orientativos y no deben
> usarse para evaluar rendimiento ni tomar decisiones institucionales formales.
> Y la Tabla 2.26 añade, en sus condiciones posteriores, que el estudiante
> visualiza las afinidades *sin modificar directamente los resultados*. No es que
> falte la pantalla: no existe el endpoint, y hay una prueba que lo comprueba.»

---

## Cierre — la evidencia (30 s)

```bash
npm run test:60
```

**82 verificaciones OK · 0 fallos.**

> «Los seis objetivos suman 493 comprobaciones automatizadas sin un solo fallo,
> ejecutadas dos veces sobre base recreada desde cero. La suite de este objetivo
> construye el perfil de un estudiante señal por señal y comprueba el puntaje
> tras cada una: un interés suma 2, una habilidad de nivel 5 suma 3, un proyecto
> propio suma 5. Eso demuestra que cada ponderación se aplica de verdad, no solo
> que sale un número.»

---

## Preguntas probables del tribunal

**¿Por qué el nivel es relativo y no una escala fija de la carrera?**
Porque la pregunta que responde la afinidad es «hacia dónde se inclina este
estudiante», y esa pregunta es relativa a su propio perfil. Con umbrales
absolutos, un estudiante de octavo semestre acumula puntos en todo y termina con
todo en alto: si todo es alto, nada lo es. Aun así exigimos un piso absoluto,
para que un perfil de dos puntos no genere un área alta sin trayectoria detrás.

**¿Quién decidió que un proyecto vale 5 y un interés 2?**
Son ponderaciones definidas para el sistema, como pide RN-14, y cada una lleva
su justificación escrita en la propia tabla: un proyecto implica trabajo
sostenido y verificable, un interés declarado es solo una declaración. Están a
la vista del estudiante y de cualquiera que consulte `/affinity/weights`.

**¿Se puede manipular la afinidad?**
No. No existe ningún endpoint para fijar una afinidad ni para editar las
ponderaciones por API. La Tabla 2.26 lo pide expresamente en sus condiciones
posteriores, y hay dos pruebas que lo verifican.

**¿Esto predice el rendimiento del estudiante?**
No, y está excluido por RN-15. El historial es historial de lo ya ocurrido. Las
estimaciones de tendencias son el décimo objetivo específico, y ni siquiera ese
predice calificaciones: el propio alcance del documento lo prohíbe.

**¿Cambiaron los puntajes al reescribir el motor?**
No. Se capturaron las 77 filas calculadas por el motor anterior, se migró, se
recalculó a los 16 estudiantes y se compararon las capturas: cero diferencias.
Los cambios de nivel llegaron después y son deliberados.

**¿El documento y el software coinciden?**
En este objetivo, la Figura 2.5 y la Tabla 2.26 son correctas y se implementaron
al pie de la letra. De hecho el documento era más exigente que la
implementación anterior: el estado de información insuficiente y la organización
por niveles ya estaban escritos y no estaban hechos. Quedan cinco correcciones
documentadas; la relevante es que la Figura 2.29 coloca el camino de éxito
dentro del fragmento etiquetado como información insuficiente, contradiciendo a
su propio texto explicativo.
