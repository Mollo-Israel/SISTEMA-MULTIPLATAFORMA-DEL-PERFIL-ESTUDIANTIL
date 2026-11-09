# Guion de demostración — 40 % del Proyecto de Grado

**Duración: 10–15 minutos.** Está escrito para que lo ejecute alguien que no
conoce el código. Cada paso indica **rol → cuenta → pantalla → acción →
resultado esperado → objetivo que demuestra**.

---

## Antes de empezar (5 minutos, una sola vez)

```bash
npm run db:up            # PostgreSQL en Docker (Docker Desktop debe estar abierto)
npm run shared:build     # tipos compartidos — va primero
npm run api:migrate      # 9 migraciones, 19 tablas
npm run seed:populate    # 21 usuarios y datos institucionales
```

Tres terminales, una para cada servicio:

```bash
npm run api:dev          # http://localhost:3000/api   (Swagger en /api/docs)
npm run web:dev          # http://localhost:5173
npm run mobile:start     # Expo — escanear el QR con Expo Go
```

> **Móvil:** edite `mobile/.env` con `EXPO_PUBLIC_API_URL`.
> Emulador Android: `http://10.0.2.2:3000/api` · Celular físico: `http://SU_IP_LAN:3000/api`.
> Si el cortafuegos bloquea: `cd mobile && npx expo start --tunnel`.

**Comprobación rápida antes de la defensa** (API corriendo, en otra terminal):

```bash
npm run test:40          # 235 verificaciones de los 4 objetivos → 0 fallos
```

### Cuentas

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | `admin@univalle.edu` | `Admin123*` |
| Director de carrera | `jorge.vargas@univalle.edu` | `Univalle2026*` |
| Sociedad científica | `lucia.fernandez@univalle.edu` | `Univalle2026*` |
| Docente (semestres 1–4) | `carlos.perez@univalle.edu` | `Univalle2026*` |
| Docente (semestres 5–8) | `maria.gutierrez@univalle.edu` | `Univalle2026*` |
| Estudiante | `ana.quispe@est.univalle.edu` | `Univalle2026*` |

---

## Bloque 1 · Administración y control de acceso — **Objetivo 1** (3 min)

| # | Rol | Pantalla | Acción | Resultado esperado |
|---|---|---|---|---|
| 1.1 | **Admin** (web) | Login | Entrar con `admin@univalle.edu` | Aterriza directamente en *Gestión de usuarios* |
| 1.2 | Admin | Gestión de usuarios | Crear un docente: nombres, apellidos, correo `@univalle.edu`, contraseña con mayúscula, minúscula, número y símbolo | Aparece en la lista como **Activo**. El desplegable de rol **solo ofrece Docente, Director y Sociedad**: el estudiante se registra solo y el admin es único |
| 1.3 | Admin | Gestión de usuarios | En el docente recién creado, pulsar **Configurar** en «Semestres habilitados» y marcar 3.º y 4.º | La tabla muestra las etiquetas `3º 4º` |
| 1.4 | Admin | Gestión de usuarios | Buscar por apellido | La lista se filtra en el servidor |
| 1.5 | Admin | Áreas académicas | Dar de baja un área | Queda como **De baja** y en gris; deja de ofrecerse al resto de roles pero conserva su historial |
| 1.5b | Admin | **Categorías de actividad** | Crear «Mesa redonda», aplicable solo a académicas | Aparece en la lista. **Decir en voz alta:** antes las categorías estaban fijas en el código; ahora son un catálogo administrable, como exige RF4 |
| 1.5c | Admin | Categorías de actividad | Dar de baja una categoría en uso | Avisa cuántas actividades la usan; las existentes la conservan, pero deja de ofrecerse para nuevas |
| 1.6 | Admin | Criterios de gamificación | Abrir la pantalla | Se ven los 6 criterios administrables. **Decir en voz alta:** están definidos y persistidos, pero el motor que los aplica es de una fase posterior; el sistema no inventa puntos |

### El punto fuerte del Objetivo 1

| # | Rol | Pantalla | Acción | Resultado esperado |
|---|---|---|---|---|
| 1.7 | **Docente** (web, otra pestaña) | Login | Entrar con `carlos.perez@univalle.edu` | Entra normalmente |
| 1.8 | **Admin** | Gestión de usuarios | Desactivar a Carlos Pérez (pide confirmación) | Queda **Inactivo** |
| 1.9 | **Docente** | Cualquier pantalla | Recargar o navegar | **Queda fuera de inmediato**, aunque su sesión estuviera abierta. El backend verifica rol y estado en cada petición, no confía en el token |
| 1.10 | Admin | Gestión de usuarios | Reactivar a Carlos Pérez | El docente vuelve a entrar |

---

## Bloque 2 · Perfil estudiantil dinámico — **Objetivos 1 y 2** (3 min)

| # | Rol | Pantalla | Acción | Resultado esperado |
|---|---|---|---|---|
| 2.1 | **Estudiante** (móvil) | Login → «¿Eres estudiante nuevo?» | Registrarse con un correo `@est.univalle.edu` | Entra directamente; **el rol STUDENT lo asigna el servidor**, no se puede elegir |
| 2.2 | Estudiante | Perfil | Semestre, biografía y áreas donde desea mejorar → Guardar | La barra de completitud sube en tramos de 20 % |
| 2.3 | Estudiante | Perfil → Intereses | Escribir dos **intereses en texto libre** («Desarrollo de videojuegos», «Automatización de procesos») | Se guardan tal como se escriben. **Decir en voz alta:** el documento distingue los intereses de las áreas de preferencia, y el software los trata como conceptos distintos (RF5) |
| 2.3b | Estudiante | Perfil → Intereses | En la misma pantalla, elegir dos **áreas de preferencia** del catálogo con prioridad | Se guardan aparte de los intereses; la completitud avanza |
| 2.4 | Estudiante | Perfil → Habilidades | Elegir habilidades con nivel 1–5 | La completitud llega a **100 %** |
| 2.5 | Estudiante | Inicio | Mirar el resumen | Muestra afinidades ya calculadas y contadores reales. Las secciones sin datos dicen «sin registros», **no muestran datos inventados** |

### Privacidad y alcance (el punto fuerte del Objetivo 2)

| # | Rol | Pantalla | Acción | Resultado esperado |
|---|---|---|---|---|
| 2.6 | **Docente** `carlos.perez` (semestres 1–4) | Perfil de estudiante | Abrir la pantalla | Aviso: «Está viendo únicamente los semestres que tiene habilitados: 1º, 2º, 3º, 4º». **La lista solo trae esos semestres** |
| 2.7 | **Docente** `maria.gutierrez` (semestres 5–8) | Perfil de estudiante | Abrir la pantalla | Ve un conjunto **distinto** de estudiantes |
| 2.8 | Docente | Perfil de estudiante | Abrir un perfil | Intereses, habilidades, proyectos, actividades, certificados y afinidades. **Sin correo, sin notas y sin constancias internas** |

---

## Bloque 3 · Actividades — **Objetivo 3** (3 min)

| # | Rol | Pantalla | Acción | Resultado esperado |
|---|---|---|---|---|
| 3.1 | **Director** (web) | Actividades académicas | «Nueva actividad»: título, categoría, fecha futura, área, ubicación, **cupo 2**, estado **Borrador** | Se guarda como borrador |
| 3.2 | **Estudiante** (móvil) | Actividades | Refrescar | **La actividad en borrador no aparece** |
| 3.3 | Director | Actividades académicas | Cambiar el estado a **Abierta** en el selector de la tabla | Cambia en el acto |
| 3.4 | Estudiante | Actividades | Refrescar y aplicar los **cuatro filtros del RF8**: categoría, área, modalidad y rango de fechas | La lista se reduce en el servidor. «Limpiar filtros» devuelve la oferta completa. Con un rango invertido, el sistema lo rechaza con un mensaje claro |
| 3.4b | Estudiante | Actividades → detalle | Abrir el detalle | Ve fecha, lugar, responsable, cupos restantes y el botón habilitado |
| 3.5 | Estudiante | Actividades → detalle | «Inscribirme» | «Inscripción enviada». El estado propio pasa a **inscrito, pendiente de registro** |
| 3.6 | Estudiante | Actividades → detalle | Pulsar «Inscribirme» otra vez | **Rechazo con mensaje claro**: ya está inscrito |
| 3.7 | **Sociedad científica** (web) | Actividades extracurriculares | Crear un hackathon en estado **Abierta** | Se publica |
| 3.8 | Sociedad | Actividades extracurriculares | Intentar crear una **académica** | El formulario solo ofrece categorías extracurriculares. *(En Swagger, forzarlo devuelve **403**: «Las actividades académicas las gestiona el director de carrera».)* |
| 3.9 | **Docente** (web) | Actividades del programa | Abrir la pantalla | **Solo consulta, con filtros. No tiene botón de publicar**: según el documento vigente, el docente ya no gestiona actividades |

---

## Bloque 4 · Participación, evidencias y constancias — **Objetivo 4** (4 min)

| # | Rol | Pantalla | Acción | Resultado esperado |
|---|---|---|---|---|
| 4.1 | **Director** (web) | Actividades académicas → **Participación** | Ver la lista de inscritos | Aparece el estudiante con su semestre |
| 4.2 | Director | Participación | **Confirmar participación** | Pasa a **Participación confirmada** y el contador de confirmados sube |
| 4.3 | **Estudiante** (móvil) | Mis actividades | Refrescar | La actividad aparece bajo **«Participación confirmada»**, con la explicación de que ya cuenta en su perfil |
| 4.4 | Estudiante | Inicio | Refrescar | **Las áreas de afinidad cambiaron**: la participación confirmada alimentó el motor |

### Evidencia con archivo real (el punto fuerte del Objetivo 4)

| # | Rol | Pantalla | Acción | Resultado esperado |
|---|---|---|---|---|
| 4.5 | **Estudiante** (móvil o web) | Evidencias y certificados | Pestaña **Evidencia** → tipo **Archivo** → seleccionar un **PDF real** | Se sube de verdad; muestra el nombre y el tamaño |
| 4.6 | Estudiante | Evidencias | Asociarla a la actividad y guardar | Aparece en «Mis evidencias». **Abrir** descarga el archivo desde el servidor |
| 4.7 | Estudiante | Evidencias | Intentar subir un `.exe` o un archivo de más de 5 MB | **Rechazado con mensaje claro** |
| 4.8 | Estudiante | Evidencias | Pestaña **Certificado**: nombre, emisor, fecha, área y archivo adjunto | Queda registrado. **Decir en voz alta:** el sistema lo guarda como *evidencia externa*; no lo certifica ni lo valida oficialmente |

### Constancia interna

| # | Rol | Pantalla | Acción | Resultado esperado |
|---|---|---|---|---|
| 4.9 | **Director** (web) | Constancias internas | Elegir la actividad | Lista **solo a los participantes confirmados** |
| 4.10 | Director | Constancias internas | «Emitir constancia», revisar el texto y confirmar | Se emite y pasa a «Constancias emitidas» |
| 4.11 | Director | Constancias internas | Intentar emitirla otra vez al mismo estudiante | Ya no aparece en la lista de pendientes. *(En Swagger devuelve **409**: constancia duplicada.)* |
| 4.11b | Director | Constancias internas | Elegir una actividad que quedó **en borrador** | El sistema responde que **no está autorizada** para emitir constancias. **Decir en voz alta:** RN-11 exige actividad autorizada; aquí «autorizada» significa publicada y gestionada por el actor institucional de su tipo (RF12) |
| 4.12 | **Sociedad científica** | — | Intentar emitir una constancia | **403.** Según el documento vigente, **solo el director de carrera** las emite |
| 4.13 | **Estudiante** (móvil) | Evidencias y certificados | Bajar a «Constancias internas» | Ve su constancia como **Autorizada**, con la aclaración de que no sustituye a un certificado oficial |

---

## Cierre (1 min)

| # | Rol | Pantalla | Acción | Resultado esperado |
|---|---|---|---|---|
| 5.1 | **Estudiante** | Inicio / Perfil | Mostrar el resumen completo | Un solo lugar reúne **lo declarado** (semestre, intereses, habilidades, áreas de mejora) y **lo hecho** (proyectos, participación confirmada, evidencias con archivo, certificado externo, constancia interna), con las **áreas de afinidad** recalculadas a partir de todo ello |
| 5.2 | Cualquiera | Terminal | `npm run test:40` | **179 verificaciones, 0 fallos** — camino de éxito y rechazos, de punta a punta |

**Frase de cierre sugerida:** el perfil no se edita, se acumula. El estudiante no
puede inflarlo escribiendo: necesita que un responsable confirme su participación
o que exista un artefacto adjunto.

---

## Si algo falla en vivo

| Síntoma | Causa habitual | Solución |
|---|---|---|
| La web no carga datos | La API no está levantada | `npm run api:dev` |
| `EADDRINUSE` en el puerto 3000 | Otro proyecto ocupa el puerto | Cerrarlo, o `API_PORT=3010 npm run api:dev` y ajustar `web/.env` y `mobile/.env` |
| La app móvil no conecta | `EXPO_PUBLIC_API_URL` apunta a `localhost` | Poner la IP LAN del equipo, o `npx expo start --tunnel` |
| «No tiene semestres habilitados» | El docente no tiene asignación | Admin → Gestión de usuarios → Configurar |
| Datos raros tras muchas pruebas | Las suites acumulan cuentas efímeras | `npm run db:reset && npm run api:migrate && npm run seed:populate` |
