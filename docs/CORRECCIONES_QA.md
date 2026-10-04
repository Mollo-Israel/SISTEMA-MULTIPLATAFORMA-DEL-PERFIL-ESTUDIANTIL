# Correcciones de QA (`corregir.docx`)

Respuesta, punto por punto, a las observaciones del documento `corregir.docx`.
Cada punto dice **qué se cambió**, **dónde** y **cómo se comprueba**. Las
comprobaciones automáticas están en `scripts/e2e-qa.mjs` (`npm run test:qa`,
71 comprobaciones contra la API en marcha) y forman parte de `npm run test:all`.

Los números (§) son los párrafos del documento de QA.

---

## 1. Interfaz

| § | Observación | Qué se hizo |
|---|---|---|
| 1 | Parpadeo al abrir pantallas y ventanas pequeñas | Había **dos animaciones de entrada a la vez** (CSS y framer-motion) en el contenido y en el fondo de los modales, y el esqueleto de carga aparecía y desaparecía en recargas cortas. Se quitó la animación duplicada, la transición entre pantallas es solo de opacidad (0,18 s), y `AsyncView` conserva los datos anteriores mientras recarga y solo muestra el esqueleto si la espera supera un umbral (`useDelayedFlag`). Archivos: `web/src/components/ui.tsx`, `web/src/components/Layout.tsx`, `web/src/index.css`. |
| 2–3 | Interfaz más amigable, con color y animación, sin terminología rara, que no parezca de administrador | Inicio del estudiante rehecho (saludo, «tu siguiente paso», tarjetas de color, accesos rápidos), tarjetas con tinte por tipo, avisos con iconos, chips de etiquetas y códigos. Textos reescritos en lenguaje del estudiante: «Puntos por logros», «Retos y recompensas», «Mi perfil» con pestañas, «¿En qué áreas quieres mejorar?». |

## 2. Correo, activación y recuperación

| § | Observación | Qué se hizo |
|---|---|---|
| 4–7 | El código no puede llegarle al administrador; solo al correo institucional del estudiante | La API **ya no devuelve el token ni el código** al crear o listar usuarios: solo el estado de la invitación (enviada, en cola, fallida, simulada) y el correo enmascarado (`an••••@est.univalle.edu`). El código viaja únicamente en el correo. Comprobado en QA.2–QA.5. |
| 8 | El enlace dura muy poco; la barra de contraseña no llega a verde | La invitación dura **48 horas** (`ACTIVATION_TOKEN_TTL_HOURS`) y la recuperación 30 minutos, valores definitivos de la especificación V2 (§15.3), configurables por entorno. La barra de fuerza contaba mal (se quedaba en 86 %): ahora cumple los 6 requisitos = 100 % y verde. `web/src/pages/auth/passwordPolicy.ts`. |
| 9 | El enlace debe abrir la activación con el token puesto; opción de activar con un código; poder reenviar | El correo trae **un botón** que abre `/activar?token=…` ya preparado y un **código de 6 dígitos**. La pantalla comprueba el enlace antes de pedir la contraseña y explica su estado exacto (válido, usado, vencido, reemplazado, bloqueado). Pestaña «Tengo un código» para activar con correo + código. Botón de reenvío con cuenta atrás. Tras 10 códigos fallidos (V2 §15.3), el código se bloquea y hay que pedir otro. Web y móvil. Comprobado en QA.6–QA.12 y QA.17–QA.19. |
| 10 | Solo a correos `.edu`; tiempo de espera entre reenvíos para no caer en spam (Outlook) | Solo se envía a `@univalle.edu` y `@est.univalle.edu` (`INSTITUTIONAL_EMAIL_DOMAINS`). **2 minutos** entre dos correos a la misma cuenta y **máximo 5 al día**, también para el administrador (responde 429 con el tiempo que falta). Remitente, `Reply-To`, versión en texto plano y ritmo limitado para que los filtros no lo marquen. Comprobado en QA.13–QA.16. |
| 11 | Recuperar contraseña no envía nada | No se enviaba porque **no había transporte de correo real**: todo se simulaba. Ahora hay envío SMTP real (ver §5 de este documento) y la recuperación llega con enlace y código. Comprobado en QA.20–QA.23. |
| 12 | Errores específicos por campo | Las respuestas de validación traen `fields` (un mensaje por campo) y los formularios del administrador muestran cada error bajo su campo. Validación en el navegador con las mismas reglas que el servidor (`web/src/lib/validators.ts`). Comprobado en QA.24–QA.25. |
| 12–13 | Suspensión lógica | Se mantiene tal cual (ya era correcto). |

## 3. Perfil dinámico y bienvenida

| § | Observación | Qué se hizo |
|---|---|---|
| 15, 18 | Al entrar por primera vez: perfil por pasos, luego intereses y habilidades, luego el cuestionario opcional; como un tutorial que no deja usar el resto hasta terminar | **Asistente de bienvenida** (`/student/bienvenida`): Bienvenida → Sobre ti y áreas donde mejorar → Disponibilidad → Intereses → Habilidades → Cuestionario (opcional) → Listo. Va paso a paso, guarda el avance y retoma donde quedó. Mientras no termine, el resto de pantallas del estudiante lo redirigen al asistente (`OnboardingGate`). El servidor no deja darla por terminada sin perfil, un área de mejora y un interés (QA.35–QA.43). En el **móvil** hay la versión corta (perfil → intereses), que también bloquea las pestañas hasta terminarla. |
| 15 | El cuestionario cambia según lo declarado; respuestas parciales; repetirlo | El cuestionario tiene una **pregunta propia por cada área declarada** (hasta 4: «Dijiste que te interesa Desarrollo Web. ¿Qué parte te llama más?») y dice en qué áreas se basa. Con 6 respuestas basta; se puede rehacer cuando quiera. Se corrigió además el fallo de «0 preguntas» (una consulta sin perfil rompía la carga) y que un área parecida a otra del catálogo se quedara sin pregunta. QA.44–QA.49. |
| 17 | Mover «Intereses y habilidades» y «Orientación académica» al perfil | «Mi perfil» tiene tres pestañas: **Mis datos**, **Intereses y habilidades**, **Cuestionario**. Las rutas antiguas redirigen. Se corrigió que un interés **no se pudiera quitar** (el guardado solo añadía; ahora reemplaza la lista). QA.41. |

> **Decisión a confirmar (§17).** El documento dice que lo declarado (intereses,
> habilidades, cuestionario) no debería alimentar la afinidad, solo las
> recomendaciones. La especificación AFINIA 100 (§51.1) sí le da a lo declarado
> un peso **acotado** en la afinidad (como mucho 14 de 60 puntos del componente
> de interés; el respaldo sale solo de evidencias). Se mantuvo la
> especificación porque es la que defiende el documento de grado. Si se prefiere
> el criterio de QA, el cambio es localizado (`api/src/affinity/`): hay que
> decidirlo y reflejarlo en el documento.

## 4. Administración

| § | Observación | Qué se hizo |
|---|---|---|
| 20–21 | El administrador no puede asignar el semestre; por eso el perfil no se completa | Al crear un estudiante, el **semestre es obligatorio** (1 a 8) y el código universitario opcional. Se crea el perfil del estudiante ya con su semestre: al entrar, lo reclama y no queda incompleto. Se puede cambiar al editar. QA.1, QA.4, QA.24, QA.36. |
| 22, 24–25 | Áreas: sin validación de caracteres/números; etiquetas obligatorias; descripción opcional; editar en ventana; código | Nombre solo con letras (rechaza números y símbolos), **etiquetas obligatorias** (al menos una), descripción opcional, **código único** (se sugiere desde el nombre), edición en ventana emergente. QA.26–QA.30. |
| 26–27 | Habilidades: área obligatoria; validaciones | **Área obligatoria**, nombre validado (admite «C#», «Node.js», «C++»), código único. QA.31–QA.32. |
| 28 | Áreas y habilidades en una sola pantalla | «Áreas y habilidades» con dos pestañas. La ruta antigua de habilidades redirige. |
| 28 | Categorías: validaciones, ventana de edición, «Aplica a» obligatorio con «Ambos» por defecto | Nombre y código validados campo por campo, edición en ventana emergente, «Aplica a» siempre con valor y por defecto **Ambos**. QA.33. |
| 28 | Quitar la ventana de roles | Eliminada (pantalla y menú). |

## 5. Gamificación

| § | Observación | Qué se hizo |
|---|---|---|
| 29 | Aclarar qué alimentan los criterios | Los criterios **ahora mandan de verdad**: antes se editaban pero los puntos salían de una tabla fija en el código. Cada hecho verificable (participación confirmada, primer proyecto respaldado, proyecto corroborado, colaboración aceptada, hito de trayectoria) tiene su criterio general; se pueden añadir **extras por área**. La pantalla («Puntos por logros») lo explica en tres pasos y dice que los puntos **no cambian la afinidad**. Los criterios antiguos que premiaban cosas autodeclaradas quedan como historial en gris. QA.50–QA.53. |
| 29 | Que lo definan los docentes para sus estudiantes | Pantalla **«Retos y recompensas»** para docente, dirección y administración: crean **retos** con sus puntos (1 a 100) y los reconocen a sus estudiantes. El docente solo puede premiar a estudiantes de **su alcance**; cambiar el ID en la petición da 403. Un reto no se cobra dos veces. QA.54–QA.59. |
| 29 | Convertir puntos en recompensas | El docente ofrece **recompensas** (costo en puntos, unidades opcionales). El estudiante ve su saldo y canjea en «Mi progreso → Recompensas»; quien la ofrece la marca entregada o la rechaza, y si la rechaza los puntos vuelven. Canje con bloqueo para que dos pulsaciones no gasten dos veces. QA.60–QA.69. |
| 29 | Puntos semanales, mensuales, anuales | El estudiante ve sus puntos de **esta semana, este mes y este año** (web y móvil); el docente ve los de sus estudiantes por periodo. No hay tabla pública. QA.61. |
| 29 | Validaciones numéricas | Puntos y costos solo aceptan enteros en su rango, en el navegador y en el servidor («Los puntos deben ser un número entero, sin letras ni decimales»). QA.34, QA.54. |

> **Extensión a señalar.** §66 de la especificación cierra la lista de hechos
> que dan puntos. El **reto docente** se añadió como hecho nuevo
> (`reconocimiento_docente`) porque lo pide QA: es verificado por una persona
> responsable, no autodeclarado, y no toca la afinidad. Conviene mencionarlo en
> el documento de grado.

---

## 6. Correo real: qué tienes que hacer tú

Todo el código y la configuración están listos. Solo faltan **tus
credenciales**. Guía completa: [`docs/CORREO_REAL.md`](CORREO_REAL.md).

1. Abre el `.env` de la raíz del proyecto y rellena el bloque de correo (en `.env.example` hay
   ejemplos para Gmail, Brevo y Microsoft 365). Con Gmail:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER=tu_cuenta@gmail.com
   SMTP_PASSWORD=tu_contraseña_de_aplicación   # 16 letras, no la contraseña normal
   SMTP_FROM=tu_cuenta@gmail.com
   SMTP_FROM_NAME=Afinia
   WEB_APP_URL=http://localhost:5173           # o la dirección pública de la web
   ```
2. Comprueba credenciales y envía una prueba a tu correo institucional, sin
   arrancar la API: `npm run mail:test -- tu_correo@est.univalle.edu`. Si algo
   falla, dice qué variable revisar.
3. Reinicia la API. En el registro debe decir que el correo es **real**; en
   «Administración → Correo» se ve el estado y hay un botón de prueba.

Para probar sin credenciales con un buzón local que muestra los correos tal
como se verían: `npm run mail:preview` y abre http://localhost:8025.

> **Importante:** las suites de prueba crean cientos de cuentas con correos
> inventados. Si la API tiene SMTP real configurado, las pruebas **se niegan a
> correr** para no generar rebotes ni dañar la reputación del remitente.
> Ejecútalas con la API en modo simulado (sin `SMTP_HOST`).

---

## 7. Verificación

| Prueba | Resultado |
|---|---|
| `npm run test:qa` (nueva) | 71 / 71 |
| `npm run test:all` (16 suites) | 1213 comprobaciones, 0 fallos |
| `npm run web:build` | compila |
| `tsc` de API, web y móvil | sin errores |
| Migraciones nuevas | aplicadas, revertidas y reaplicadas sin pérdida de datos |

Migraciones de esta ronda (todas con `up` y `down`): códigos de activación
(`1780370000000`), cola de correos (`1780370100000`), estado de la bienvenida
(`1780370200000`), códigos de áreas y habilidades (`1780370300000`),
gamificación (`1780370400000`) y fechas con zona horaria (`1780370500000`, que
corrige que las fechas se mostraran 4 horas adelantadas).
