# BATCH 10 — Reportes y analítica

**Especificación:** `AFINIA_100_ESPECIFICACION_DEFINITIVA.md` §63, §64, §65, §68, §69, §135
**Rama:** `feat/afinia-100`
**Estado:** completo · 1093 verificaciones automatizadas, 0 fallos

---

## 1. Qué pedía §135

> TeacherScope en todos los reportes docentes; dashboard docente; mapa
> Dirección; evolución descriptiva; privacy threshold; métricas agregadas.

Los seis están. Tres ya existían del 40 % y se auditaron; tres son nuevos.

---

## 2. §65 · El umbral de privacidad, que es lo que faltaba

Es la pieza central del batch y la que no existía en absoluto.

**Una analítica agregada deja de ser agregada cuando el grupo es diminuto.** «El
100 % de los estudiantes de octavo semestre tiene afinidad baja con Redes» es
una estadística si son cuarenta y es una ficha personal si son dos, y quien la
lee sabe perfectamente de quién habla.

`ANALYTICS_MIN_GROUP_SIZE` —5 por omisión, como sugiere §65— gobierna cada
desglose por grupo. Lo que se suprime es **la distribución, no la existencia del
grupo**: la dirección necesita saber que octavo semestre tiene dos estudiantes,
eso es gestión; lo que no necesita es cómo se reparten sus afinidades.

Y la fila suprimida lleva su motivo escrito. Un hueco sin explicar parece un
error del sistema; esto es una decisión, y se dice.

El umbral no protege de quien ya tiene acceso individual legítimo —un docente
puede ver el perfil de sus estudiantes uno por uno, y eso lo gobierna §68—.
Protege de deducir a una persona a partir de un número que se presentó como
colectivo.

---

## 3. §63 · Evolución descriptiva

Sale de las instantáneas de afinidad y devuelve exactamente lo que §63 enumera:
periodo, área, `affinity_score`, `support_score` y `support_level`. Dos vistas
de lo mismo — por periodo y por área—, porque una evolución se lee de las dos
maneras.

**Las instantáneas del motor V1 se marcan aparte.** Guardaban puntos crudos sin
techo y las de V2 un porcentaje sobre 100; ponerlas en la misma línea mostraría
una caída enorme donde solo hubo un cambio de escala. Cada periodo lleva su
`engineVersion` y una marca de si es comparable con el resto.

**Sin lenguaje predictivo**, que §63 prohíbe. Eso no es solo una regla de
redacción: condiciona qué se calcula. No hay proyecciones, ni tendencias
extrapoladas, ni comparación con una media que invitaría a leer el número como
una nota. La suite lo comprueba buscando once palabras —predicción, proyección,
abandono, deserción, éxito profesional…— en toda la respuesta.

El acceso ajeno pasa por `TeacherScopeService`: un docente ve la evolución de
sus estudiantes y de nadie más.

---

## 4. §64 · Las cinco tendencias

Las cinco que §64 enumera, todas descriptivas:

| Tendencia | Qué responde |
|---|---|
| Interés declarado por área | Cuántos la declaran, y cuántos en los últimos 90 días |
| Participación por mes | Inscripciones, confirmadas y estudiantes distintos |
| Áreas predominantes por semestre | Qué se trabaja en cada cohorte |
| Tecnologías en proyectos | Cuáles aparecen y en cuántos |
| Actividades con mayor participación | Cuáles convocan |

«Evolución» aquí significa **comparar dos momentos de lo registrado, no
proyectar el tercero**. La diferencia importa: un delta dice qué cambió, una
proyección afirma qué va a pasar, y §64 admite lo primero y prohíbe lo segundo
con nombre y apellido —notas, abandono, aprobación, éxito profesional,
rendimiento—.

El desglose por semestre es el que más pide el umbral: con dos estudiantes en un
semestre, decir cuál es su área predominante es decir a qué se dedica cada uno.

---

## 5. §65 · Qué ve cada rol

§65 reparte en tres líneas y el código las respeta:

- **Docente** — solo su alcance. Auditado: el panel, el resumen de respaldo y la
  evolución de un estudiante resuelven el alcance *antes* de consultar. Sin
  semestres asignados la respuesta es vacía, no la carrera entera.
- **Dirección** — agregados de carrera, con el umbral aplicado.
- **Sociedad científica** — métricas de **sus** actividades. El filtro es por
  responsable, no por rol: proteger el endpoint por rol dejaría ver las
  actividades de toda la carrera a quien solo organizó dos. Y no incluye
  perfiles, afinidades ni proyectos, porque §65 no se los concede.

---

## 6. §68 · Auditoría del alcance

> No basta con proteger endpoint por rol: debe restringirse el contenido.

Se revisaron los catorce endpoints con rol docente. El alcance ya se aplicaba en
perfiles, proyectos, afinidad, participación, constancias, archivos y reportes;
la retroalimentación lo hereda de `ProjectsService.findOneForUser`, que es donde
vive la regla de visibilidad. Los dos endpoints nuevos de este batch —evolución
de un estudiante y resumen de respaldo— lo aplican desde el principio.

Los módulos de colaboración y gamificación no tienen rutas docentes: contactos,
equipos, mensajería y puntos son relaciones entre pares y del propio estudiante.

---

## 7. Un fallo que las pruebas destaparon

La consulta de tecnologías construía un `unnest` con el constructor de consultas
y acababa con dos alias llamados `p` — el de la tabla y el de la subconsulta—,
que PostgreSQL rechaza. Reescrita en SQL directo, que para un `unnest` sobre un
arreglo se lee mucho mejor.

Dos comprobaciones de la suite estaban mal planteadas por mi parte: una miraba
el primer periodo, que puede no tener áreas todavía, y la otra buscaba palabras
predictivas **incluida la nota** —que es justo donde la palabra «predicen» tiene
que aparecer, porque su trabajo es decir que esto no predice nada—.

---

## 8. Lo que conviene saber

**El umbral se aplica a los desgloses, no a los totales.** «La carrera tiene 869
estudiantes» no identifica a nadie; «los dos de octavo tienen afinidad alta con
Redes» sí. Si en el futuro se añade un reporte nuevo con desglose por grupo, hay
que pasarlo por `AnalyticsPrivacyService.protect`.

**El mapa de Dirección anterior sigue existiendo.** El nuevo
(`director/affinity-map-v2`) añade el respaldo de V2 y el umbral; el viejo se
mantiene porque la pantalla actual lo consume y retirarlo era trabajo de §137,
en el BATCH 12.

**La evolución del estudiante no tiene pantalla propia.** La pestaña «Evolución»
de afinidad ya muestra el historial con respaldo desde el BATCH 6; el endpoint
de §63 existe y está probado, y unificarlos es cosmética que no cambia lo que se
ve.

---

## 9. Verificación

| Suite | Verificaciones |
|---|---|
| `e2e-objectives-40` | 248 |
| `e2e-objective-5` | 116 |
| `e2e-objective-6` | 86 |
| `e2e-objective-7` | 89 |
| `e2e-batch-1` … `e2e-batch-9` | 463 |
| `e2e-batch-10` | 42 |
| **Total** | **1093 · 0 fallos** |

`npm run web:build` y `npx tsc --noEmit` en `mobile/` pasan limpios. Este batch
no lleva migración: no añade tablas, solo lectura de las que ya existen.

Ninguna comprobación anterior tuvo que reescribirse.

---

## 10. Siguiente

**BATCH 11 (§136)** — hardening final: autorización de archivos, cabeceras,
CORS, Swagger, registros y límites.
