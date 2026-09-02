# Guion de demostración — 50 %

Sistema Multiplataforma para la Construcción del Perfil Estudiantil Dinámico (Afinia)
Ingeniería en Sistemas Informáticos — Univalle

Guion para la defensa. **Parte A** repasa en 2 – 3 minutos que el 40 % sigue en
pie; **Parte B** demuestra el quinto objetivo en 5 – 8 minutos.

---

## Preparación (antes de entrar a la sala)

```bash
npm run db:up          # PostgreSQL en Docker
npm run db:reset       # base limpia
npm run api:migrate    # 10 migraciones
npm run seed:populate  # datos de demostración
npm run api:dev        # backend
npm run web:dev        # panel web
npm run mobile:start   # app móvil
```

Deje abiertas dos ventanas del navegador (docente y director) y el móvil con
sesión de estudiante iniciada. Tenga a mano un PDF pequeño para la evidencia.

**Cuentas de demostración**

| Rol | Correo | Contraseña |
|---|---|---|
| Estudiante | `ana.quispe@est.univalle.edu` | `Univalle2026*` |
| Estudiante (invitado) | `luis.mamani@est.univalle.edu` | `Univalle2026*` |
| Docente **en alcance** (semestres 1-4) | `carlos.perez@univalle.edu` | `Univalle2026*` |
| Docente **fuera de alcance** (semestres 5-8) | `maria.gutierrez@univalle.edu` | `Univalle2026*` |
| Director de carrera | `jorge.vargas@univalle.edu` | `Univalle2026*` |
| Administrador | `admin@univalle.edu` | `Admin123*` |

**Plan B.** Si algo falla en vivo, ejecute `npm run test:50` en la terminal: las
109 verificaciones recorren exactamente lo que iba a mostrar, y la salida indica
el requerimiento de cada una.

---

# PARTE A — El 40 % sigue funcionando (2 – 3 min)

Rápido, sin detenerse: es un repaso, no la demostración.

| # | Acción | Qué demuestra |
|---|---|---|
| 1 | Inicie sesión como administrador → **Usuarios** | RF1 – RF3 · gestión y roles |
| 2 | **Alcance docente**: muestre los semestres habilitados del docente Carlos Pérez | RF4 · alcance académico |
| 3 | Salga y entre como estudiante en el móvil → **Perfil** | RF5, RF6 · perfil dinámico |
| 4 | Abra **Actividades** y filtre por categoría y por fechas | RF7, RF8 |
| 5 | Inscríbase en una actividad publicada | RF10 |
| 6 | Como docente en la web: **Asistencia** → confirme la participación | RF11 |
| 7 | Vuelva al móvil: descargue la **constancia** de una participación confirmada | RF12 |

**Frase de cierre de la Parte A:** «Los cuatro primeros objetivos siguen
verificados por 235 comprobaciones automatizadas que se ejecutan sobre base
limpia.»

---

# PARTE B — Objetivo 5: Portafolio de proyectos (5 – 8 min)

## Paso 1 · RF13 — Crear el proyecto (1 min)

**Móvil, sesión de Ana Quispe.**

1. Abra **Portafolio**. Se ven tres secciones: *Mis proyectos*, *Participo* e
   *Invitaciones*.
2. Pulse **Nuevo proyecto** y registre:
   - Título: `Sistema de riego inteligente`
   - Descripción: propósito y alcance
   - Área académica: *Desarrollo Móvil*
   - Estado: *En desarrollo*
   - Tecnologías: `Arduino`, `Node.js`, `React Native`
   - Repositorio y demostración
   - **Visibilidad: Visible para docentes**
3. Guarde y abra el proyecto.

> **Diga esto:** «La visibilidad es del estudiante. Él decide si su proyecto se
> queda privado, aparece en su perfil, o además queda disponible para que un
> docente lo consulte y lo comente.»

## Paso 2 · RF13 — Evidencia real (30 s)

Dentro del proyecto → **Evidencias** → adjunte el PDF.

> **Diga esto:** «El archivo se sube de verdad: el backend valida tipo y tamaño
> y genera el nombre en disco. Es el mismo almacenamiento del cuarto objetivo,
> no un enlace escrito a mano.»

## Paso 3 · RF14 — Invitar, sin dar de alta a nadie (1 min 30 s)

1. En el proyecto → **Integrantes** → **Invitar**.
2. Elija a **Luis Mamani**, rol propuesto `Backend`. Envíe.
3. Muestre la sección **Invitaciones enviadas**: aparece **Pendiente**.
4. Abra **Integrantes**: **Luis todavía no está**.

> **Este es el punto clave de la defensa.** «Invitar no da de alta. Mientras la
> invitación está pendiente no existe la pertenencia: el proyecto no aparece en
> el portafolio de Luis, no cuenta en su perfil y no influye en su afinidad.»

**Muestre un rechazo en vivo:** intente invitar otra vez a Luis. El sistema
responde que ya existe una invitación pendiente.

## Paso 4 · RF14 — Aceptar (1 min)

**Móvil, cambie a la sesión de Luis Mamani.**

1. **Portafolio** → pestaña **Invitaciones**: aparece la invitación con el
   proyecto, quién invita y el rol propuesto.
2. Pulse **Aceptar**.
3. Vaya a **Participo**: el proyecto ya está, con la etiqueta de su rol.
4. Abra el proyecto: **no** ve editar, **no** ve invitar, **no** ve cambiar la
   visibilidad. Es integrante, no responsable.

> **Diga esto:** «La pertenencia nace en el momento de aceptar, tal como
> especifica la Tabla 2.23 del documento. Y la diferencia entre responsable e
> integrante no es que se oculten botones: el backend la verifica.»

## Paso 5 · RF15 — El docente consulta el portafolio (1 min 30 s)

**Web, sesión del docente Carlos Pérez** → **Proyectos estudiantiles**.

1. Señale el aviso de alcance en la parte superior.
2. Aparece el proyecto de Ana, porque cumple **las dos condiciones**: está
   marcado como visible para docentes **y** Ana está en un semestre habilitado
   para este docente.
3. Use los filtros: estado, área, semestre, tecnología, búsqueda.
4. Abra el detalle: descripción, tecnologías, enlaces e integrantes.

> **Diga esto:** «Son dos condiciones simultáneas, no una. Si el estudiante no
> habilitó el proyecto, el docente no lo ve aunque el estudiante sea de su
> semestre. Y si el estudiante lo habilitó pero está fuera de su alcance,
> tampoco.»

**Demuestre el control real** (esto convence más que cualquier pantalla):

1. Copie el identificador del proyecto de la URL.
2. Inicie sesión como **María Gutiérrez**, habilitada solo en los semestres 5 a 8,
   y pegue esa misma URL.
3. **403.** El sistema responde que el proyecto está fuera de su alcance
   académico.

> «Ocultar un botón no es autorización. La verificación está en el backend, y
> usa el mismo servicio de alcance académico que ya gobierna las actividades y
> los perfiles: una sola fuente de verdad para todo el sistema.»

## Paso 6 · RF16 — Retroalimentación docente (1 min)

**Web, docente Carlos Pérez**, en el detalle del proyecto.

1. Escriba: `Buen avance en la integración de sensores. Documenten el protocolo
   de comunicación y agreguen pruebas de la lectura de humedad.`
2. Guarde. Aparece con su nombre y la fecha.
3. Edítela: se marca como editada.
4. Señale que **no hay campo de nota, puntaje ni aprobación**.

> **Diga esto:** «La regla RN-13 dice que esto es orientación complementaria, no
> una evaluación. Por eso la tabla `project_feedback` no tiene nota ni estado de
> aprobación: no es que falte la pantalla, es que el modelo de datos no lo
> permite.»

**Cierre en el móvil:** vuelva a la sesión de Ana, abra el proyecto y muestre la
retroalimentación del docente, en solo lectura, con el nombre de quien la
escribió.

## Paso 7 · Integración con el perfil (30 s)

**Móvil, Ana** → **Perfil**.

El proyecto aparece en el resumen. En el de Luis aparece también, marcado como
participación colaborativa.

> **Diga esto:** «El portafolio no es un módulo suelto: alimenta el perfil
> dinámico, y el motor de afinidad ahora considera también los proyectos en los
> que el estudiante participa como integrante, no solo los que creó.»

---

## Cierre — la evidencia (30 s)

Ejecute delante del tribunal:

```bash
npm run test:50
```

**109 verificaciones OK · 0 fallos.**

> «Los cinco objetivos suman 411 comprobaciones automatizadas sin un solo fallo,
> ejecutadas dos veces sobre base recreada desde cero. Cubren los flujos de éxito
> y, sobre todo, los de rechazo: invitarse a uno mismo, responder una invitación
> ajena, comentar fuera de alcance, abrir un proyecto privado.»

---

## Preguntas probables del tribunal

**¿Qué pasa si el invitado nunca responde?**
La invitación se queda pendiente y no produce ningún efecto. El responsable
puede cancelarla; tras un rechazo o una cancelación puede volver a invitar,
porque el índice único es parcial: solo impide duplicar invitaciones
*pendientes*.

**¿Puede un docente ver cualquier proyecto?**
No. Hacen falta dos condiciones a la vez: visibilidad habilitada por el
estudiante y estudiante dentro de sus semestres. Puedo demostrarlo pegando el
identificador directamente: responde 403.

**¿Por qué la retroalimentación no lleva nota?**
Porque RN-13 lo excluye: es orientación complementaria, no evaluación académica
formal. Si el sistema pusiera notas, invadiría el sistema oficial de
calificaciones de la universidad.

**¿Se perdieron los proyectos que ya existían?**
No, y se verificó midiéndolo: 12 proyectos antes de migrar, 12 después. La
visibilidad por defecto es «perfil» precisamente para que conserven el
comportamiento que tenían. Los integrantes anteriores también se conservan, como
pertenencias aceptadas heredadas.

**¿Por qué el director de carrera no abre el detalle de un proyecto?**
Porque ningún requerimiento se lo concede: RF15 nombra como actores al
Estudiante y al Docente. Sus reportes agregados siguen intactos. Está anotado
como corrección al documento por si se decide otra cosa.

**¿El documento y el software coinciden?**
En el quinto objetivo, la Figura 2.4 y las Tablas 2.22 – 2.25 son correctas y se
implementaron tal cual. Quedan seis correcciones de modelo y nomenclatura
documentadas en `CORRECCIONES_DOCUMENTO_FINAL_50.md`; la relevante es que el
diagrama de clases pone el estado de la invitación dentro de `ProjectMember`, lo
que contradice a su propia Tabla 2.23.
