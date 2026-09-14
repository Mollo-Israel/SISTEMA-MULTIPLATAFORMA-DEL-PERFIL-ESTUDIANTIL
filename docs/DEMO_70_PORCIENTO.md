# Guion de demostración — 70 %

Sistema Multiplataforma para la Construcción del Perfil Estudiantil Dinámico (Afinia)
Ingeniería en Sistemas Informáticos — Univalle

**Parte A** repasa en 3 minutos que el 60 % sigue en pie. **Parte B** demuestra
las recomendaciones académicas en 6 – 8 minutos.

---

## Preparación (antes de entrar a la sala)

```bash
npm run db:up
npm run db:reset
npm run api:migrate    # 12 migraciones
npm run seed:populate
npm run api:dev
npm run web:dev
npm run mobile:start
```

**Cuentas de demostración**

| Rol | Correo | Contraseña |
|---|---|---|
| Estudiante | `ana.quispe@est.univalle.edu` | `Univalle2026*` |
| Estudiante (semestre 6) | `diego.mendoza@est.univalle.edu` | `Univalle2026*` |
| Estudiante **que se excluyó de sugerencias** | `tomas.suarez@est.univalle.edu` | `Univalle2026*` |
| Docente en alcance (1–4) | `carlos.perez@univalle.edu` | `Univalle2026*` |
| Director de carrera | `jorge.vargas@univalle.edu` | `Univalle2026*` |
| Administrador | `admin@univalle.edu` | `Admin123*` |

**Plan B.** Si algo falla en vivo, ejecute `npm run test:70`: las 84
verificaciones recorren exactamente lo que iba a mostrar.

---

# PARTE A — El 60 % sigue funcionando (3 min)

| # | Acción | Qué demuestra |
|---|---|---|
| 1 | Administrador → **Usuarios** y alcance docente | RF1 – RF4 |
| 2 | Móvil, Ana → **Perfil** | RF5, RF6 |
| 3 | **Actividades**, filtre e inscríbase | RF7 – RF10 |
| 4 | Docente web → confirme participación | RF11 |
| 5 | Móvil → descargue la **constancia** | RF12 |
| 6 | **Portafolio** → invite a un integrante y muestre que queda pendiente | RF13, RF14 |
| 7 | Docente web → **Proyectos estudiantiles** y retroalimentación | RF15, RF16 |
| 8 | Móvil → **Afinidad** → abra un área y muestre el desglose | RF17 |

**Cierre:** «Los seis primeros objetivos siguen verificados por 493
comprobaciones automatizadas.»

---

# PARTE B — Objetivo 7: Recomendaciones (6 – 8 min)

## Paso 1 · La pantalla que nombra RF18 (1 min)

**Móvil, sesión de Ana Quispe** → pestaña **Sugerencias**. El encabezado dice
**«Recomendaciones»**, que es el nombre exacto del documento.

Aparecen los seis grupos que enumera RN-16: actividades, oportunidades, cursos
externos, recursos de apoyo, áreas de fortalecimiento y posibles compañeros de
equipo.

> **Diga esto:** «RN-16 enumera seis cosas que una recomendación puede incluir.
> Hay un generador por cada una, y ninguno más. No agregamos tipos que el
> documento no nombre.»

## Paso 2 · El porqué de cada recomendación (1 min 30 s)

Toque una tarjeta. Se despliegan todos los motivos con sus puntos.

```
+6   Bases de Datos es un área de tu preferencia
+6   Tienes afinidad alta con Bases de Datos
+3   Coincide con tu interés «...»
+1   Se realiza pronto: ...
```

> **Este es el punto clave.** «El puntaje es exactamente la suma de sus motivos.
> No es una nota: solo ordena la lista. Y nada se recomienda sin al menos un
> motivo de relevancia; la fecha próxima refuerza, pero por sí sola nunca
> alcanza.»

Señale que los cursos externos y los recursos traen su enlace, y ábralo.

> «Los cursos externos y los recursos se publican como actividades del catálogo
> de RF4. No inventamos una entidad nueva: el Objetivo 3 ya incluía los cursos
> externos dentro de la gestión de actividades.»

## Paso 3 · La decisión es del estudiante (1 min 30 s)

1. Pulse **Guardar** en una recomendación.
2. Pulse **No me interesa** en otra.
3. Vuelva a entrar a la pantalla, que **regenera** las recomendaciones.
4. La descartada **no volvió**. La guardada **sigue guardada**.
5. Abra la pestaña **Descartadas** y púlsele **Devolver a mis recomendaciones**.

> **Diga esto:** «RN-16 dice que las recomendaciones no son obligatorias y que el
> estudiante conserva la decisión sobre su utilización. Por eso regenerar
> actualiza el contenido pero nunca el estado, y todo se puede deshacer.»

## Paso 4 · Los dos flujos alternativos (1 min 30 s)

**Registre un estudiante nuevo** desde el móvil, cree su perfil y abra
**Sugerencias**:

> Todavía no se cuenta con datos suficientes para recomendarte. Declara tus
> áreas de preferencia, tus intereses o tus habilidades…

Ahora agréguele **un solo interés en texto libre** que no exista en la
plataforma, por ejemplo «Arqueología submarina», y vuelva a entrar:

> Actualmente no existen recomendaciones disponibles para tu perfil.

> **Diga esto:** «La Tabla 2.27 define dos flujos alternativos distintos. El 2a
> es que falta información en el perfil, y ahí sí se le puede pedir algo. El 3a
> es que hay perfil pero nada disponible coincide, y ahí no hay nada que
> pedirle. Son dos mensajes diferentes porque son dos situaciones diferentes.»

## Paso 5 · Compañeros de equipo y privacidad (1 min)

En el grupo **Posibles compañeros de equipo**, abra una tarjeta.

Solo aparece nombre, semestre y las áreas que justifican la sugerencia.

> **Diga esto:** «Nunca el correo, nunca los puntajes del otro estudiante. Y
> cada estudiante puede desactivar la opción de aparecer en sugerencias.»

**Demuéstrelo:** Tomás Suárez la tiene desactivada en los datos de
demostración, y no aparece en la lista de nadie. Puede mostrarlo entrando como
Tomás y enseñando la preferencia en su perfil.

> «La preferencia solo gobierna lo que el sistema propone por su cuenta. Si
> alguien lo busca por nombre para invitarlo a un proyecto, sigue pudiendo
> encontrarlo, y el invitado siempre tiene que aceptar.»

## Paso 6 · El defecto del Objetivo 5, corregido (1 min)

**Móvil** → **Portafolio** → abra un proyecto propio → **Invitar integrante**.

Escriba dos letras de un apellido y busque.

> **Diga esto:** «Aquí había un defecto real. La pantalla pedía el directorio
> institucional de estudiantes, que solo pueden ver docente, director y
> administrador. Un estudiante recibía 403, el error se tragaba en silencio y la
> lista salía siempre vacía: no se podía invitar a nadie desde la app. La suite
> del 50 % no lo detectaba porque invita por identificador contra la API.»
>
> «Ahora hay una búsqueda entre estudiantes que devuelve solo nombre y semestre,
> exige dos caracteres, escapa los comodines para que nadie liste a toda la
> carrera, y excluye las cuentas inactivas.»

## Paso 7 · Lo mismo en la web (30 s)

**Web, sesión de Ana** → **Recomendaciones**. Muestre que el panel web ofrece lo
mismo que el móvil.

---

## Cierre — la evidencia (30 s)

```bash
npm run test:70
```

**84 verificaciones OK · 0 fallos.**

> «Los siete objetivos suman 577 comprobaciones automatizadas sin un solo fallo,
> ejecutadas dos veces sobre base recreada desde cero. La suite de este objetivo
> construye su propio escenario: tres áreas, ocho actividades con sus casos
> límite y seis estudiantes distintos. Así cada recomendación que aparece, y cada
> una que no aparece, es consecuencia de algo que la prueba hizo.»

---

## Preguntas probables del tribunal

**¿Esto es inteligencia artificial?**
No, y el documento lo excluye expresamente: el motor usa reglas, etiquetas,
coincidencias y ponderación. La ventaja es que cada sugerencia se puede
justificar línea por línea, algo que un modelo entrenado no permite.

**¿Por qué una actividad aparece y otra no?**
Porque toda recomendación necesita al menos un motivo de relevancia. Además se
excluye lo que el estudiante ya conoce, lo que ya pasó, lo que está en borrador y
lo que no tiene plazas confirmables.

**¿El estudiante puede cambiar su puntaje?**
No. Es un campo no declarado y la API lo rechaza. El puntaje solo ordena la
lista, no es una nota.

**¿Qué pasa si alguien no quiere aparecer como compañero sugerido?**
Lo desactiva en su perfil. Deja de aparecer en las sugerencias de todos, pero
sigue siendo encontrable por nombre para una invitación dirigida, que igual tiene
que aceptar.

**¿Las recomendaciones se recalculan o están guardadas?**
Se generan al consultarlas, como describe el flujo básico de la Tabla 2.27, y se
guardan para conservar la decisión del estudiante. Tarda entre 34 y 137
milisegundos, y probamos 60 consultas simultáneas sin duplicados ni errores.

**¿El documento y el software coinciden?**
La Figura 2.5 y la Tabla 2.27 son correctas y se implementaron al pie de la
letra. Quedan seis correcciones documentadas; la relevante es que la Figura 2.30
dibuja el camino de éxito dentro de la rama de fallo, el mismo error que ya
tenía la Figura 2.29.
