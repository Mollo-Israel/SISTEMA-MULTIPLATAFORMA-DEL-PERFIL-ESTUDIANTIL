# BATCH 9 — Gamificación y resumen de trayectoria

**Especificación:** `AFINIA_100_ESPECIFICACION_DEFINITIVA.md` §66, §67, §73.8, §105, §109, §134
**Rama:** `feat/afinia-100`
**Estado:** completo · 1051 verificaciones automatizadas, 0 fallos

---

## 1. Qué pedía §134

> eventos idempotentes; puntos; badges; progreso; resumen de trayectoria; PDF.

Los seis están implementados, sobre las cuatro tablas que §73.8 sugiere, y la
gamificación queda colgada del coordinador de §109 que el BATCH 7 dejó
preparado.

---

## 2. §66 · Lo que se puede premiar, y lo que no

§66 abre con la frase que lo gobierna todo: la gamificación **es independiente
de la afinidad**, y nunca `puntos → afinidad`. Son dos sistemas que miran cosas
distintas. La afinidad dice hacia dónde se inclina alguien y cuánto lo sostiene;
los puntos reconocen que hizo algo.

La lista de acciones válidas es cerrada y es literalmente la de §66:

| Acción | Puntos |
|---|---|
| Participación confirmada | 10 |
| Primer proyecto respaldado | 25 |
| Proyecto corroborado | 20 |
| Colaboración aceptada | 8 |
| Hito de trayectoria | 15 |

Lo que §66 excluye lo dice sin rodeos: nada de intereses, autodeclaraciones,
mensajes, archivos repetidos ni proyectos vacíos. Todos son cosas que uno
declara o acumula; ninguno es algo que haya hecho.

**El catálogo del 40 % contradecía esto.** Había criterios activos para
`proyecto_registrado` —un proyecto vacío—, `evidencia_adjunta` —archivos— y
`perfil_completo` —una autodeclaración—. La migración los **desactiva**, no los
borra: perder el registro de lo que la carrera llegó a configurar no es una
decisión que corresponda a una migración.

**«Hito de trayectoria» es el respaldo, no la afinidad.** Premiar la afinidad
sería premiar lo que uno declara; premiar que el *respaldo* de un área cruce un
umbral de §54 es reconocer que lo declarado se puede comprobar.

---

## 3. §66 · Cómo se garantiza la idempotencia

§66 la exige, y aquí está la decisión de diseño del batch.

El sistema **no lleva la cuenta de lo que ya procesó**. Deriva los hechos del
estado actual —las participaciones confirmadas que hay, los proyectos con
respaldo que hay— y los inserta con `ON CONFLICT DO NOTHING` sobre `(perfil,
clave)`. Correr esto una vez o cien da lo mismo, y eso vale también cuando dos
recálculos se solapan o cuando un despliegue repite una operación.

La alternativa habitual —un contador que se incrementa al ocurrir el hecho— es
idempotente solo mientras nadie repita la llamada, que es justo lo que §66
quiere descartar.

La clave es del **hecho**, no del momento: `participacion:<id de la
inscripción>` vale para siempre. Y `primer_proyecto_respaldado` no lleva id de
proyecto a propósito: si lo llevara, el segundo proyecto respaldado volvería a
dar el punto del primero y «primero» dejaría de significar nada.

El total de `student_points` se **recalcula sumando**, nunca incrementando. Un
contador que se incrementa acaba desviándose de lo que explica —basta un evento
borrado o una transacción a medias— y entonces el número que ve el estudiante
deja de corresponder a su propia lista.

---

## 4. §66 · Sin ranking público

§66 dice que no es obligatorio, y no lo hay. No existe ruta para consultar los
puntos de otra persona, ni posición, ni comparación. Publicar una tabla
convertiría un reconocimiento en una competencia entre compañeros, que es lo
contrario de lo que RN-15 permite hacer con estos datos.

La pantalla lo dice en voz alta, además de cumplirlo: *«Los puntos reconocen lo
que hiciste. No influyen en tu afinidad ni en tus recomendaciones, y no se
comparan con los de nadie.»* Si el sistema lo cumple pero no lo dice, el
estudiante seguirá creyendo que acumular puntos le mejora el perfil.

---

## 5. §67 · El resumen, y el PDF

§67 usa la palabra **seleccionablemente**: el estudiante decide qué entra. Por
eso no hay un «resumen completo» que el sistema arme por su cuenta; hay doce
secciones y lo que él marque. Los datos básicos van siempre — un resumen sin
nombre no es de nadie.

La advertencia obligatoria va **dentro del documento**, no en la pantalla desde
la que se descarga. El PDF circula solo, y quien lo reciba tiene que poder leer
qué es y qué no es sin haber visto nunca el sistema.

§105 se aplica aquí: del certificado viaja la metadata, nunca el archivo.

### El escritor de PDF

Escrito, no importado, por la misma razón que el codificador de QR del BATCH 8:
**el BATCH 3 ya escribió un extractor de texto de PDF**, así que este escritor
se puede verificar de verdad. La suite genera el resumen, lo lee con el
extractor y comprueba que el texto está —incluida la advertencia—. Un PDF que no
se puede releer es un archivo que nadie sabe si sirve hasta que alguien intenta
abrirlo.

Las librerías del ramo pesan entre 1 y 3 MB y traen tipografías embebidas que
aquí no hacen falta: un resumen de trayectoria es texto en párrafos. Con las
catorce tipografías estándar del formato —que todo lector tiene— el archivo pesa
unos pocos kilobytes.

Alcance: texto, paginación automática y saltos de línea por ancho. Sin imágenes,
sin colores, sin tablas. Es lo que §67 pide.

---

## 6. §109 · La gamificación, enganchada donde tocaba

El BATCH 7 dejó el punto marcado con un comentario. Ahora está ocupado: el
coordinador recalcula la afinidad, invalida las recomendaciones y pone al día
los puntos, en ese orden y con los dos últimos pasos tolerantes a fallo — no
haber podido sumar unos puntos no puede invalidar el cálculo de una trayectoria.

**La dirección importa y es de un solo sentido.** La gamificación *lee* la
trayectoria para reconocer hechos. §66 prohíbe la contraria, y por eso el motor
de afinidad no conoce este servicio ni por inyección ni por importación.

---

## 7. Lo que conviene saber

**Los puntos de los estudiantes existentes aparecen la primera vez que
consultan su progreso.** La consulta sincroniza antes de responder, así que un
estudiante con quince participaciones confirmadas de meses atrás verá sus
puntos al entrar, sin que haga falta un proceso de carga.

**Los criterios administrables del 40 % quedan desactivados, no borrados.** El
catálogo de `gamification_criteria` sigue ahí y la dirección puede revisarlo;
lo que ya no ocurre es que un proyecto vacío dé puntos.

**La suite del batch lee `api/dist`** para usar el extractor de PDF. Requiere
que la API esté compilada (`npm run build` en `api/`, o el observador del modo
desarrollo, que ya la mantiene al día).

---

## 8. Verificación

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
| `e2e-batch-9` | 49 |
| **Total** | **1051 · 0 fallos** |

`npm run web:build` y `npx tsc --noEmit` en `mobile/` pasan limpios. La
migración se ejecutó ida y vuelta sobre la base real.

Ninguna comprobación anterior tuvo que reescribirse.

**Corregido de paso:** la entrada de menú de *Colaboración* del BATCH 8 nunca
llegó a aplicarse —la ruta existía y el enlace no—, así que la pantalla solo era
alcanzable escribiendo la dirección. Quedan las dos.

---

## 9. Siguiente

**BATCH 10 (§135)** — reportes y analítica: `TeacherScope` en todos los reportes
docentes, dashboard docente, mapa de Dirección, evolución del estudiante y
tendencias descriptivas, sin lenguaje predictivo.
