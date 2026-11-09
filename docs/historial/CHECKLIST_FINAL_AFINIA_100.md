# Checklist final — AFINIA 100 (§145)

**Especificación:** `AFINIA_100_ESPECIFICACION_DEFINITIVA.md` §138, §144, §145
**Rama:** `feat/afinia-100` · último commit del plan: BATCH 12
**Verificación total:** 1139 comprobaciones automatizadas en 15 suites, 0 fallos

Cada punto de §145 se marca aquí con **dónde vive** y **qué lo demuestra**. La
segunda columna importa más que la primera: §138 abre diciendo que *no basta
compilar*, y una casilla marcada sin una prueba detrás es exactamente lo que esa
frase prohíbe.

---

## Identidad y acceso

| §145 | Dónde vive | Qué lo demuestra |
|---|---|---|
| ☑ Sin registro público | `auth.controller.ts` no expone `register`; las cuentas nacen en `users` o en `imports` | `test:b1` |
| ☑ Importación idempotente | `imports.service.ts` | `test:b1` |
| ☑ Activación segura | `identity/activation.*`, solo hash del token en base | `test:b1` |
| ☑ Recuperación segura | `POST /forgot-password`, `POST /reset-password` | `test:b1` |
| ☑ Sesiones revocables | `sessions.service.ts`; cerrar sesión invalida el refresco de verdad | `test:b1`, `test:b11` |
| ☑ Datos institucionales protegidos | El semestre lo fija la institución; el estudiante no lo cambia | `test:b1`, `test:b2` |

## Perfil

| §145 | Dónde vive | Qué lo demuestra |
|---|---|---|
| ☑ Onboarding | `onboarding/` | `test:b2` |
| ☑ Perfil dinámico | `profiles/`, completitud derivada de hechos | `test:b2` |
| ☑ Habilidades diferenciadas | Lo autodeclarado se muestra como autodeclarado (§139) | `test:b2` |
| ☑ Áreas de mejora sin afinidad | `affinity.engine.ts` las excluye con motivo explícito | `test:b2`, `test:b6` |

## Actividades y participación

| §145 | Dónde vive | Qué lo demuestra |
|---|---|---|
| ☑ Actividades por responsabilidad | Dirección publica las académicas; sociedad, las extracurriculares | `test:b4` |
| ☑ Participación confirmada | Solo el responsable confirma; el estudiante no confirma la suya | `test:b4` |

## Evidencia y respaldo

| §145 | Dónde vive | Qué lo demuestra |
|---|---|---|
| ☑ Storage privado | `FilesController` autoriza sobre la entidad; no hay servidor de estáticos | `test:b3`, `test:b11` |
| ☑ Hash de evidencia | `stored_files.sha256`, duplicado detectado y no contado dos veces | `test:b3` |
| ☑ Extracción/OCR | `document-extraction.service.ts`, `ocr.port.ts`, `pdf-text.ts` | `test:b3` |
| ☑ Link checking seguro | `link-checker.service.ts`: resuelve DNS **antes** de conectar y rechaza IP privada, también tras redirección | `test:b3` |
| ☑ Certificados con backing tier | `validation.service.ts` | `test:b3` |

## Proyectos

| §145 | Dónde vive | Qué lo demuestra |
|---|---|---|
| ☑ Proyectos con backing tier | `projects.service.ts` | `test:b5` |
| ☑ Contribuciones por integrante | `project-member-skill.entity.ts`; la pertenencia nace de una invitación aceptada | `test:b5` |
| ☑ GitHub opcional | `repository-inspector.service.ts`; sin repositorio el proyecto funciona igual | `test:b5` |
| ☑ Feedback docente | `project-feedback/`: orientativo, sin nota ni aprobación | `test:b5` |
| ☑ Bitácora | `audit/` | `test:b1`, `test:b4`, `test:b5` |

## Afinidad y recomendaciones

| §145 | Dónde vive | Qué lo demuestra |
|---|---|---|
| ☑ Afinidad V2 | `affinity.engine.ts`: rendimientos decrecientes, topes por familia, desglose que suma exactamente el puntaje | `test:b6` |
| ☑ Support score | Junto a cada afinidad, cuánto está demostrado | `test:b6` |
| ☑ Snapshots | `affinity_snapshots` + `affinity_snapshot_items` | `test:b6` |
| ☑ Recomendaciones | `recommendations.engine.ts`: cada sugerencia explica por qué y su puntaje es la suma de sus motivos | `test:b7` |

## Colaboración

| §145 | Dónde vive | Qué lo demuestra |
|---|---|---|
| ☑ QR | `qr-encoder.ts`, escrito aquí y verificado decodificándolo con `jsqr` | `test:b8` |
| ☑ Contactos | `contacts.service.ts` | `test:b8` |
| ☑ Equipos complementarios | `teams.service.ts`, a partir de una necesidad declarada | `test:b8` |
| ☑ Mensajería contextual | `messaging.service.ts`: solo se abre entre quienes tienen una relación que la justifique | `test:b8` |

## Trayectoria

| §145 | Dónde vive | Qué lo demuestra |
|---|---|---|
| ☑ Gamificación real | `gamification.service.ts`: los puntos se derivan de hechos y se recalculan por suma, nunca se incrementan a ciegas | `test:b9` |
| ☑ Export trayectoria | `pdf-writer.ts`, verificado extrayendo el texto del PDF generado | `test:b9` |

## Reportes

| §145 | Dónde vive | Qué lo demuestra |
|---|---|---|
| ☑ Teacher scope completo | `TeacherScopeService`, única fuente del alcance (§108) | `test:b10`, `test:70` |
| ☑ Analítica descriptiva | `analytics.service.ts` + `analytics-privacy.service.ts`, con umbral de grupo pequeño | `test:b10` |

## Cierre

| §145 | Dónde vive | Qué lo demuestra |
|---|---|---|
| ☑ Seguridad/hardening | CORS, cabeceras, límites, formato de error, huérfanos, baja de usuarios | `test:b11` · [`BATCH_11_HARDENING.md`](BATCH_11_HARDENING.md) |
| ☑ Regresión | Las 15 suites, corridas al cerrar cada batch | `npm run test:all` |
| ☑ README final | Reescrito: ya no anuncia el 70 %, ni autorregistro, ni funciones ya entregadas como pendientes | [`BATCH_12_REGRESION_Y_LIMPIEZA.md`](BATCH_12_REGRESION_Y_LIMPIEZA.md) §7 |
| ☑ Cero comportamiento obsoleto contradictorio | «Próximamente» retirado, catálogos unificados, rutas duplicadas consolidadas, jerarquía sin uso eliminada | [`BATCH_12_REGRESION_Y_LIMPIEZA.md`](BATCH_12_REGRESION_Y_LIMPIEZA.md) |

---

## Lo que queda abierto, dicho sin adornos

§138 exige no declarar «completado» con pruebas relevantes fallando. No las hay:
las 1139 comprobaciones pasan. Pero hay tres cosas pendientes que conviene no
esconder debajo de las casillas:

1. **El documento de grado.** §144 pide que documento, especificación y software
   describan el mismo sistema. El software y la especificación ya coinciden; el
   Word **no se tocó**. Si su diagrama de clases muestra la jerarquía de actores
   por herencia, §96 pide quitarla, porque el runtime no la usa.
2. **NestJS 10 → 12.** Cuatro advertencias de severidad alta en dependencias de
   producción se resuelven solo con ese salto, que son dos versiones mayores.
   Es una decisión de alcance, no una tarea de un batch.
3. **El bundle web supera 500 kB.** Conviene dividirlo por rutas. Es rendimiento,
   no corrección.
