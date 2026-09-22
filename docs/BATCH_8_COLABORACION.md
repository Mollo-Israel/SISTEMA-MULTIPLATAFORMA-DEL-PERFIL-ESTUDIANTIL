# BATCH 8 — Colaboración

**Especificación:** `AFINIA_100_ESPECIFICACION_DEFINITIVA.md` §42 a §47, §73.6, §73.7, §93, §106, §107, §133
**Rama:** `feat/afinia-100`
**Estado:** completo · 1002 verificaciones automatizadas, 0 fallos

---

## 1. Qué pedía §133

> perfil público; slug; QR; contactos; necesidades de equipo; sugerencias;
> invitaciones; equipos; mensajería contextual. **No analizar mensajes.**

Los nueve puntos están implementados, sobre once tablas nuevas y el
identificador público del perfil.

---

## 2. Una regla atraviesa todo el batch: nada ocurre sin consentimiento

Es la frase que la especificación repite de tres formas distintas, y las tres
están implementadas como comprobaciones del servidor, no como botones ocultos:

- **§45** — *«El QR no establece contacto automáticamente»*. Escanear lleva al
  perfil compartible y nada más; el contacto nace de una solicitud que la otra
  persona responde.
- **§47** — *«No enviar invitaciones automáticamente»*. El motor sugiere
  candidatos; invitar es otra llamada, que hace una persona.
- **§42** — una conversación existe **porque hay una relación detrás**. Directa
  entre contactos aceptados, grupal entre integrantes aceptados de un equipo. No
  hay una tercera forma, porque sería un canal para escribirle a cualquiera.

---

## 3. §43 · El QR, escrito y verificado

§43 pide que el código contenga **únicamente** una URL al perfil compartible.
Eso es una propiedad del contenido, no del dibujo, así que el código se genera
en el servidor: en un solo sitio, comprobable, y sin que la web y el móvil
tengan que ponerse de acuerdo sobre qué meten dentro.

**Por qué escrito y no una dependencia.** La API ya traía `jsqr` —un
*decodificador*, del lector de certificados del BATCH 3—, así que el codificador
se puede verificar de verdad: la suite genera el código, lo dibuja y lo vuelve a
leer. Un codificador que no se puede releer produce códigos que nadie escanea y
que ninguna prueba detecta; con el decodificador ya disponible, ese riesgo
desaparece y la dependencia deja de pagarse sola.

Modo byte, corrección M, versiones 1 a 10 —hasta 213 bytes—. Una URL de perfil
ronda los 60 caracteres.

**El fallo que la verificación destapó.** Los primeros códigos salían perfectos
a la vista y no los leía nadie. Los valores de formato y los de Reed-Solomon
coincidían con los del estándar, así que el error estaba en la colocación: hay
dos convenciones de numeración de los quince bits de formato dando vueltas, y
con la equivocada el código es indistinguible de uno bueno salvo por el detalle
de que no funciona. Se reescribió con las posiciones explícitas. El octavo
módulo de la segunda copia tampoco es de formato: es el módulo oscuro fijo, y
escribirlo ahí lo borraba.

El identificador es opaco —doce símbolos de un alfabeto sin vocales ni
caracteres que se confundan al leerlos— y **se puede rotar**: es la única
defensa cuando un QR acabó donde no debía, porque el papel impreso deja de
llevar a ninguna parte.

---

## 4. §44 · Nada se expone por omisión

El perfil compartible nace apagado y cada campo nace oculto. Lo que se publica
es lo que el estudiante activó, uno por uno.

Lo que §44 prohíbe exponer —correo, archivos, certificados completos, chats,
tokens, identificadores internos— **no aparece en el servicio en absoluto**. No
hay una bandera que pudiera encenderse por error: sencillamente no se lee.

Dos detalles que conviene señalar:

- «Áreas», «afinidades» y «nivel de respaldo» son casillas **distintas**. Quien
  quiera enseñar en qué trabaja sin enseñar sus números, puede.
- §106 se aplica aquí: un proyecto privado no sale por activar la casilla de
  proyectos, y «visible para docentes» tampoco —es otra decisión, no un permiso
  para publicarlo en un enlace que abre cualquiera—.

Un perfil sin publicar responde **404**, no 403. Decir «existe pero está
cerrado» ya es contar algo de alguien que decidió no contarlo.

---

## 5. §46 y §47 · Los equipos se forman cubriendo huecos

§46 abre con el objetivo —*«priorizar complementariedad»*— y §47 lo convierte en
una ponderación concreta, que está implementada tal cual:

| Factor | Peso |
|---|---|
| Cobertura de las habilidades que **faltan** | 50 % |
| Afinidad con el área del equipo | 20 % |
| Disponibilidad declarada | 15 % |
| Respaldo de trayectoria relacionado | 15 % |

Lo que el equipo ya cubre deja de ser un hueco: un candidato que repite lo que
ya hay no puntúa por ello. Y quien no cumple el requisito de disponibilidad que
el responsable pidió queda fuera, porque ese filtro lo pidió expresamente.

La pantalla muestra lo que §93 enumera —objetivo, requeridas, cubiertas,
vacantes, candidatos y su motivo— y **no** un «ranking de mejores estudiantes».

El cupo se comprueba al **aceptar** y no solo al invitar: entre una cosa y la
otra pueden haber entrado otros, y un equipo que se pasa de su máximo declarado
deja de responder a lo que su responsable pidió.

---

## 6. §42 · Lo que la mensajería no hace

§42 fija cuatro prohibiciones y las cuatro se cumplen **por ausencia**, que es la
única forma de cumplirlas de verdad:

- no alimenta afinidad — no llama al recálculo por ningún camino;
- no puntúa por cantidad de mensajes — no hay contadores por persona;
- no se analiza el contenido — el texto se guarda y se devuelve, y nada más lo
  lee;
- no sirve como prueba de contribución — la bitácora del proyecto (§41) es la
  fuente de auditoría, y nada de aquí llega a ella.

La suite lo comprueba enviando ocho mensajes y verificando que la afinidad no se
mueve ni aparece ninguna señal nueva en el desglose.

**§107 · `canAccessConversation`.** Pertenecer a la conversación no basta: la
relación que la justifica tiene que seguir existiendo. Si dos personas deshacen
su contacto, el canal se cierra; que la fila de pertenencia siga ahí no es
permiso. Quien no participa recibe 404, no 403.

---

## 7. Dos cosas que salieron mal y cómo

**La migración le puso el mismo identificador a los 869 perfiles.** Un `UPDATE`
con una subconsulta sin correlación se evalúa una vez, no una por fila. El
desempate posterior acabó derivando medio slug del UUID interno, que es
exactamente lo que §43 prohíbe. Se reescribió como un bucle explícito con
reintento ante colisión: más largo de leer y sin lugar a dudas sobre lo que hace.

**Los perfiles nuevos nacían sin identificador** y la columna es `NOT NULL`.
Ponerlo en el servicio que crea perfiles habría dejado fuera los otros caminos
—el padrón, la siembra—, así que va en un `@BeforeInsert` de la entidad: uno
solo que se olvidara dejaría una fila que la base rechaza.

---

## 8. Lo que conviene saber

**Los perfiles existentes tienen identificador pero siguen sin publicar.** Tener
identificador y estar publicado son cosas distintas: `public_profile_enabled`
sigue en `false` desde el BATCH 2, como manda §44.

**El QR se imprime desde la web.** El móvil muestra el enlace y permite
seleccionarlo, pero no dibuja el código: hacerlo pediría una librería de SVG que
el proyecto no tiene, y el teléfono es donde se piden y se responden contactos,
no donde se imprime un cartel.

**La mensajería no tiene tiempo real.** Los mensajes se cargan al abrir la
conversación. §42 la llama «apoyo contextual» y no pide más; añadir websockets
sería infraestructura que nada en la especificación justifica.

---

## 9. Verificación

| Suite | Verificaciones |
|---|---|
| `e2e-objectives-40` | 248 |
| `e2e-objective-5` | 116 |
| `e2e-objective-6` | 86 |
| `e2e-objective-7` | 89 |
| `e2e-batch-1` | 54 |
| `e2e-batch-2` | 67 |
| `e2e-batch-3` | 58 |
| `e2e-batch-4` | 48 |
| `e2e-batch-5` | 49 |
| `e2e-batch-6` | 60 |
| `e2e-batch-7` | 57 |
| `e2e-batch-8` | 70 |
| **Total** | **1002 · 0 fallos** |

`npm run web:build` y `npx tsc --noEmit` en `mobile/` pasan limpios. La
migración se ejecutó ida y vuelta sobre la base real.

Ninguna comprobación anterior tuvo que reescribirse: este batch añade
funcionalidad, no cambia reglas existentes.

---

## 10. Siguiente

**BATCH 9 (§134)** — gamificación con eventos idempotentes y exportación del
resumen de trayectoria en PDF. Es también donde se engancha la gamificación al
`TrajectoryRecalculationService` de §109, que ya dejó el punto preparado.
