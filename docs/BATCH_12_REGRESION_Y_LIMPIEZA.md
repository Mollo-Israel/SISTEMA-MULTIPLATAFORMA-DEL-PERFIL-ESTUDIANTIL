# BATCH 12 — Regresión y limpieza

**Especificación:** `AFINIA_100_ESPECIFICACION_DEFINITIVA.md` §96, §137, §138, §143, §144
**Rama:** `feat/afinia-100`
**Estado:** completo · 1139 verificaciones automatizadas, 0 fallos

---

## 1. Qué pedía §137

> Eliminar: textos obsoletos 30/70 %; rutas obsoletas; servicios duplicados;
> DTOs muertos; pantallas «Próximamente» ya implementadas; catálogos
> hardcodeados inconsistentes; scaffolding temporal. Conservar pruebas,
> migraciones y documentación útil.

Siete categorías. Todas tenían algo.

§143 marca cómo: *no eliminar funcionalidad existente solo porque esta
especificación la reorganiza; primero comprobar uso, datos, dependencias y
pruebas*. Cada pieza de abajo se retiró después de comprobar quién la usaba, y
lo que se dice de cada una es el resultado de esa comprobación, no una
suposición.

---

## 2. El hallazgo que no era limpieza

Buscando servicios duplicados apareció esto:

`GET /reports/director/affinity-map` devolvía el mapa de áreas **sin el umbral
de privacidad de §65**. A cinco líneas de distancia, en el mismo controlador,
`GET /reports/director/affinity-map-v2` devolvía el mismo reporte **con** el
umbral aplicado.

La pantalla de Dirección leía la primera. La segunda, la protegida, la escribió
BATCH 10 y no la llamaba nadie: estaba definida en la capa de servicios del
cliente web y ninguna página la usaba.

Es decir: la protección que BATCH 10 implementó y documentó **nunca llegó a la
interfaz**, y la puerta de al lado seguía abierta. Un área de dos estudiantes
mostraba su distribución completa a quien abriera el mapa.

Hay una tercera puerta al mismo dato: `GET /affinity/map/basic`, en el módulo de
afinidad, para el mismo público y también sin umbral.

**Queda una sola ruta**, `GET /reports/director/affinity-map`, servida por la
implementación con umbral. Las otras dos se retiraron. Las comprobaciones de
permiso que cubrían `/affinity/map/basic` —estudiante 403, docente 403, director
200— se trasladaron a la ruta que queda: la cobertura no se pierde, cambia de
dirección.

`basicMap` sigue existiendo, pero solo para el resumen del docente, que va
limitado a sus semestres. Ahí el umbral no aplica y el propio BATCH 10 explicó
por qué: **no protege de quien ya tiene acceso individual legítimo**, y un
docente puede abrir uno por uno los perfiles de sus estudiantes.

---

## 3. «Próximamente» prometía lo que ya se entrega

El menú web mostraba una sección «Próximamente» con **Chat**, **Contactos QR** y
**Equipos**. Las tres funcionan desde BATCH 8 y viven en «Colaboración», dos
elementos más arriba en el mismo menú.

Además se mostraba a los cinco roles. A un director de carrera se le anunciaba
como futuro un chat entre estudiantes que ni le corresponde ni le hace falta.

En móvil, `ComingSoonScreen` decía literalmente que esas funciones «aún no están
disponibles en el **30 % inicial**». Dos afirmaciones falsas en una frase.

Retirado en ambos clientes. El `default` del enrutador móvil usaba esa pantalla
para un rol desconocido, que no es una función futura sino un caso que hay que
nombrar: ahora dice que ese rol no tiene pantallas en la aplicación y que entre
por la web.

Consecuencia visible: la barra de la sociedad científica queda con una sola
pestaña. Se deja así. §6.1 orienta el móvil **exclusivamente al estudiante**, y
una pestaña honesta es mejor que dos donde la segunda miente.

---

## 4. El mismo dato con dos nombres distintos

Los dos clientes traían sus catálogos escritos a mano, y habían derivado.

**Lo grave:** el estado `absent` de una inscripción. El enum lo define sin
ambigüedad —*«se inscribió y no asistió; lo marca el responsable»*—. La web lo
mostraba como **«Rechazado»**, que le dice al estudiante que le negaron la
inscripción. El móvil lo mostraba como «Ausente».

El mismo registro, leído por la misma persona en dos pantallas, contaba dos
historias distintas, y la de la web era falsa.

**Lo silencioso:** `cancelled` no estaba en ninguno de los dos mapas, así que una
baja se mostraba con el valor interno en crudo.

Las etiquetas ahora salen del enum `RegistrationStatus` (§23) y coinciden en los
dos clientes.

**Las categorías de actividad** eran el otro caso. Las administra el
administrador (§21) y la web las pide al catálogo real; el móvil las tenía
escritas a mano en dos pantallas. Una categoría nueva salía como `club_estudio`
en el celular y con su nombre en la web. Se retiró la copia del móvil y se
sustituyó por `useCategoryLabel`, que lee el catálogo.

---

## 5. Código que no ejecutaba nadie

**`api/src/domain/` — ocho archivos, cero importaciones.** Una jerarquía
`Usuario` → `Estudiante` / `Docente` / `DirectorCarrera` /
`RepresentanteSociedadCientifica` / `Administrador`, más una factoría. Ningún
módulo la usa: la autorización se resuelve con rol y perfil, como siempre.

No se retira por estar sin usar, sino porque §96 lo dice de frente: **«no
representar actores como herencia si runtime no la usa»**. §94 añade que la
herencia no es obligatoria y que el enfoque rol + perfil puede conservarse. Ese
código existía para sostener un diagrama que la especificación pide no dibujar.

> **Pendiente para el documento de grado:** si el diagrama de clases del Word
> muestra esa jerarquía, §96 pide quitarla de ahí también. El Word **no se
> tocó**: esa corrección se propone, no se aplica.

**`AddMemberDto`** — sin importar. La pertenencia a un proyecto se crea por
invitación aceptada (`InviteMemberDto` + `RespondInvitationDto`), que es lo
correcto: a nadie se le mete en un proyecto sin que acepte. Este DTO es el
resto de cuando sí se podía.

**Tres constantes del cliente web** sin un solo consumidor: `ACTIVITY_TYPES`,
`ACTIVITY_CATEGORIES` y `CONSTANCY_STATUS_LABEL`.

---

## 6. Dos suites que no podían pasar

`scripts/api-tests.mjs` y `scripts/e2e-demo.mjs` empiezan llamando a
`POST /auth/register`. Esa ruta **ya no existe**: §12 sustituyó el autorregistro
por cuenta provisionada con activación, y el sistema lo cumple.

Las dos fallaban enteras desde el primer paso, y seguirían fallando aunque todo
el sistema estuviera perfecto. Una prueba que no puede pasar no avisa de nada:
enseña a ignorar el rojo.

§137 pide conservar pruebas, y por eso conviene decir qué se comprobó antes de
retirarlas: lo que cubrían —roles, permisos, perfil, actividades, proyectos,
certificados, afinidad, reportes— lo cubre `e2e-objectives-40` con 248
verificaciones, por el flujo de cuenta provisionada que sí es el del sistema.
No se pierde cobertura; se pierde una versión rota de ella.

Sus scripts `npm run test:api` y `npm run demo:e2e` se retiraron con ellas.

---

## 7. El README describía otro sistema

Anunciaba «Implementación del **70 %**», decía que los estudiantes nuevos
**pueden registrarse desde la web**, apuntaba la API al puerto **3000**,
prometía **26 tablas en 12 migraciones** (hay 57 en 21) y listaba como fuera de
alcance «chat, contactos por QR, equipos avanzados, gamificación completa, motor
de gamificación, analítica avanzada» —seis cosas que los batches 8, 9 y 10
entregaron—.

§138.19 exige README y configuración coherentes; §144 pide que documento,
especificación y software describan el mismo sistema. Reescrito de punta a
punta: los diez objetivos, el flujo real con cuenta provisionada, las 15 suites
con sus números, y un «fuera de alcance» que ahora dice la verdad —predicción de
rendimiento (que §64 **prohíbe**), certificados oficiales, integración con SIU y
Teams—.

Se añadió `npm run test:all`, que corre las quince suites.

---

## 8. Lo que se comprobó y se deja como está

- **Las pantallas móviles de docente, dirección, sociedad y administración.**
  §6.1 orienta el móvil al estudiante y §6.2 cierra con «no se exige paridad
  administrativa en móvil». *No exigida* no es *prohibida*: son pantallas que
  funcionan, y §143 y la regla de conservación del proyecto mandan dejarlas.
- **Siete constantes de `shared/` sin consumidor** (`EXPERIENCE_STATUSES`,
  `OPERABLE_USER_STATUSES`, `SKILL_LEVELS`, `BACKING_TIER_ORDER`,
  `PROJECT_BACKING_ORDER`, `LEARNING_RESOURCE_TYPE_LABEL`,
  `TEAM_SUGGESTION_REASON_LABEL`). Documentan reglas que el código expresa
  directamente —hay 28 usos de `RegistrationStatus.CONFIRMED` donde cabría
  `EXPERIENCE_STATUSES`—. Unificar esos 28 sitios es un refactor de forma, no
  una limpieza, y no es lo que toca hacer en el último batch.
- **Las matrices de trazabilidad y los informes del 40 % al 70 %.** Son el
  registro de cómo se llegó hasta aquí. §137 manda conservar documentación útil;
  el README ahora dice qué son, para que nadie los lea como descripción del
  sistema actual.
- **Sin mocks, sin `TODO`, sin `FIXME`** en `api/`, `web/`, `mobile/` ni
  `shared/`. §138.20 pedía que no hubiera mocks permanentes sustituyendo
  funciones: no los hay.

---

## 9. Migraciones

Ninguna. El batch no toca el esquema.

---

## 10. Archivos principales

**Eliminados**

- `api/src/domain/` (8 archivos) — jerarquía sin uso (§96).
- `api/src/projects/dto/add-member.dto.ts` — DTO muerto.
- `scripts/api-tests.mjs`, `scripts/e2e-demo.mjs` — suites de una ruta retirada.
- `mobile/src/screens/ComingSoonScreen.tsx` — anunciaba lo ya entregado.

**Nuevos**

- `mobile/src/hooks/useCategoryLabel.ts` — el nombre de una categoría, del
  catálogo real.
- `docs/BATCH_12_REGRESION_Y_LIMPIEZA.md` — este informe.

**Modificados**

- `README.md` — reescrito (§138.19, §144).
- `api/src/reports/reports.controller.ts`, `reports.service.ts` — una sola ruta
  para el mapa, la protegida.
- `api/src/affinity-recalc/affinity.controller.ts` — retirada la tercera puerta.
- `web/src/navigation.ts`, `components/Layout.tsx`, `index.css` — sin
  «Próximamente».
- `web/src/constants.ts`, `mobile/src/constants.ts` — catálogos coherentes.
- `web/src/pages/director/AffinityMap.tsx`,
  `mobile/src/screens/director/AffinityMapScreen.tsx` — leen la ruta protegida y
  muestran el motivo de una fila reservada.
- `web/src/pages/LandingPage.tsx` — sin el «30 % inicial» del pie.
- `mobile/src/navigation/RootNavigator.tsx`, `components/icons.tsx`.
- `scripts/e2e-objective-6.mjs`, `scripts/e2e-batch-10.mjs` — apuntan a la ruta
  consolidada.
- `package.json` — `test:all`; fuera `test:api` y `demo:e2e`.

---

## 11. Pruebas

```bash
npm run test:all
```

| Suite | Verificaciones |
|---|---|
| `e2e-objectives-40` | 248 |
| `e2e-objective-5` | 116 |
| `e2e-objective-6` | 86 |
| `e2e-objective-7` | 89 |
| `e2e-batch-1` … `e2e-batch-11` | 600 |
| **Total** | **1139 · 0 fallos** |

La regresión se corrió **tres veces**: antes de tocar nada, después de
consolidar las rutas del mapa, y al cerrar el batch. Las tres con el mismo
resultado, que es lo que hace creíble que la limpieza no se llevó nada por
delante.

**Compilación limpia** — `tsc --noEmit` en `api/` y en `mobile/`, y
`npm run web:build`: los tres sin errores.

---

## 12. Pendientes

- **El diagrama de clases del documento de grado.** Si muestra la jerarquía de
  actores por herencia, §96 pide quitarla. El Word no se tocó.
- **NestJS 10 → 12**, con las 4 advertencias altas que arrastra. Documentado en
  [`BATCH_11_HARDENING.md`](BATCH_11_HARDENING.md) §9.
- **El bundle web supera 500 kB.** Conviene dividirlo por rutas. Es rendimiento,
  no corrección, y no entra en §137.

---

## 13. Riesgos

- **La ruta del mapa cambió de forma.** Devuelve `{ areas, note }` con niveles de
  **respaldo**, no el arreglo con niveles de afinidad de antes. Web, móvil y las
  dos suites que la tocaban se actualizaron; cualquier consumidor externo que no
  esté en este repositorio se rompería. No consta ninguno.
- **Retirar `/affinity/map/basic` es un cambio de contrato.** Se hizo a
  conciencia: era la vía por la que se podía esquivar §65. Quien la llamara
  recibe ahora 404, que es preferible a recibir datos que no debía ver.
- **`useCategoryLabel` depende de una petición.** Mientras el catálogo no llega,
  muestra el valor interno —lo mismo que se veía antes de forma permanente para
  cualquier categoría nueva—. Es un parpadeo, no una regresión.
