# Mejoras de experiencia de usuario

Rama `feat/mejoras-ux` · 57 archivos de interfaz modificados · 7 confirmaciones
(commits) en seis fases.

Este documento describe **qué cambió en la interfaz y por qué**. Es un trabajo
transversal: no implementa ningún requerimiento funcional nuevo, sino que
mejora cómo se usan los que ya existen. Ninguna llamada a la API, ningún
payload y ninguna regla de autorización cambiaron; las cuatro suites de
regresión lo verifican.

---

## 1. Por qué se hizo

El sistema funcionaba, pero se comportaba de forma desigual según la pantalla:

| Problema observado | Dónde ocurría |
|---|---|
| Listas sin buscador que crecían sin límite | 18 pantallas web, 13 móviles |
| Mensajes de éxito colgados dentro de la pantalla | prácticamente todas |
| Confirmaciones con el diálogo gris del navegador | panel web |
| Acciones destructivas **sin ninguna confirmación** | habilidades, áreas, gamificación, evidencias |
| Un `<Loading />` girando sobre una pantalla en blanco | toda la aplicación |
| Botones que cambiaban su texto a «Guardando…» | toda la aplicación |
| Estilos de pastilla reescritos a mano | 6 archivos distintos |

Nada de esto impide usar el sistema. Todo junto, sí hace que se sienta como
seis aplicaciones pegadas en lugar de una sola.

---

## 2. Base compartida

En lugar de retocar pantalla por pantalla, primero se construyó una base común.
Todo lo anterior conservó su firma: las pantallas que aún no se habían migrado
siguieron funcionando durante todo el proceso.

### Panel web

`web/src/components/feedback.tsx` (nuevo)

| Pieza | Qué hace |
|---|---|
| `ToastProvider` / `useToast` | Avisos flotantes apilados (máx. 4). Duración según el tipo: 3,6 s un éxito, 6,5 s un error — un error se lee más despacio que una confirmación. |
| `ConfirmProvider` / `useConfirm` | Confirmación centrada, animada, basada en promesa. `Escape` cancela. `tone: 'danger'` para lo que borra o da de baja. |
| `TopProgress` | Barra de progreso superior conectada a las peticiones reales del cliente HTTP. Espera 180 ms antes de aparecer, para que una petición rápida no produzca un parpadeo. |

`web/src/components/ui.tsx` (ampliado)

`SearchInput`, `ResultCount`, `PageHeader`, `Tabs` (con indicador animado),
`ProgressBar`, `Stagger`, `Skeleton` / `SkeletonText` / `SkeletonTable` /
`SkeletonCards`, `CopyButton`, `Modal`, y un `Button` con estado de carga que
**bloquea el doble envío** mientras dura la petición.

`web/src/api/client.ts` expone `requestActivity`, una suscripción a la que se
conecta `TopProgress`; los interceptores marcan inicio y fin de cada petición.

### Aplicación móvil

`mobile/src/components/feedback.tsx` (nuevo) — el equivalente construido **solo
con la API de React Native** (`Animated`, `Modal`), sin librerías nuevas:

- `ToastProvider` / `useToast`: aviso deslizante desde arriba, respetando el
  área segura del dispositivo. Se toca para descartarlo.
- `ConfirmProvider` / `useConfirm`: ventana centrada. Reemplaza al diálogo del
  sistema, de modo que Android e iOS muestran exactamente lo mismo.

`mobile/src/components/ui.tsx` (ampliado) — `SearchInput`, `ResultCount`,
`PageHeader`, `ProgressBar`, `FadeIn`, `Chip`, `Skeleton` / `SkeletonCards`, y
el mismo `Button` con estado de carga.

---

## 3. Qué recibió cada pantalla

Las seis fases aplicaron el mismo tratamiento:

1. **Buscador** con contador de resultados en toda lista que pueda crecer.
2. **Esqueleto** de carga en lugar del indicador giratorio.
3. **Encabezado de página** uniforme.
4. **Entrada escalonada** de las tarjetas de una lista.
5. **Avisos flotantes** en lugar de texto colgado en la pantalla.
6. **Vacío distinto** según la causa: «todavía no hay nada» no es lo mismo que
   «nada coincide con tu búsqueda», y este último ofrece limpiar el filtro.

| Fase | Alcance |
|---|---|
| 1 | Base compartida del panel web |
| — | Menú lateral fijo, menú de sesión arriba a la derecha, confirmaciones con estilo |
| 2 | 9 pantallas del estudiante (web) |
| 3 | Docente, dirección de carrera y sociedad científica (web) |
| 4 | Administración: usuarios, áreas, habilidades, categorías, gamificación, roles |
| 5 | Aplicación móvil completa |
| 6 | Verificación y esta documentación |

---

## 4. Confirmaciones: dónde y por qué

Se añadió confirmación **solo donde la acción es difícil de deshacer o alcanza
a otra persona**. Confirmar todo educa al usuario a aceptar sin leer.

| Acción | Motivo |
|---|---|
| Desactivar una cuenta | pierde el acceso de inmediato |
| Dar de baja un área, habilidad, categoría o criterio | deja de ofrecerse en los formularios |
| Eliminar una evidencia o un certificado | no se puede deshacer |
| Quitar un interés declarado | no se puede deshacer |
| Retirar a un integrante de un proyecto | afecta a otro estudiante |
| Cancelar una actividad o devolverla a borrador | desaparece para quienes ya se inscribieron |
| Registrar una ausencia | retira participación que ya cuenta en el perfil (RN-9) |
| Emitir una constancia interna | solo puede emitirse una vez por estudiante y actividad (RF12) |
| Publicar retroalimentación docente | el estudiante y sus integrantes la verán |
| Solicitar inscripción a una actividad | compromete un cupo |
| Descartar una recomendación | sale de la vista (recuperable desde «Descartadas») |
| Recalcular la afinidad | reescribe el resultado vigente |

Cuatro de estas pantallas —habilidades, áreas, gamificación y evidencias— **no
tenían ninguna confirmación** antes de este trabajo.

---

## 5. Defectos encontrados y corregidos

El repaso pantalla por pantalla dejó a la vista tres problemas reales que no
eran cosméticos:

1. **Dos accesos del panel del estudiante rotulados «Subir evidencia» llevaban
   a Proyectos**, no a Evidencias. Corregido; además la cuadrícula de accesos
   rápidos ganó la entrada «Recomendaciones», que faltaba desde el objetivo 7.

2. **El cupo de una actividad se medía sobre los participantes filtrados.**
   Al añadir el buscador de participantes, el cálculo de «cupo lleno» habría
   usado la lista visible; se corrigió para que siempre mida sobre el total
   confirmado. Filtrar no puede hacer que una actividad llena parezca abierta.

3. **El menú lateral se desplazaba con la rueda del ratón** y el bloque de
   sesión, al pie, se ensanchaba según la cantidad de registros. El menú pasó a
   ser fijo y la sesión se movió a un menú en la esquina superior derecha, con
   «Mi perfil» y «Cerrar sesión».

---

## 6. Verificación

Ejecutado sobre la API en `http://localhost:3010/api` con la base sembrada:

| Suite | Resultado |
|---|---|
| `test:40` — objetivos 1 a 4 | **235 verificaciones OK · 0 fallos** |
| `test:50` — objetivo 5 | **112 verificaciones OK · 0 fallos** |
| `test:60` — objetivo 6 | **82 verificaciones OK · 0 fallos** |
| `test:70` — objetivo 7 | **84 verificaciones OK · 0 fallos** |
| **Total** | **513 verificaciones · 0 fallos** |

Compilación:

- `web`: `tsc --noEmit` y `vite build` sin errores.
- `mobile`: `tsc --noEmit` sin errores.
- `api`: `tsc --noEmit` sin errores.

Comprobaciones adicionales:

- No queda ningún `window.confirm` ni `window.alert` en el panel web, salvo el
  respaldo deliberado de `useConfirm` cuando se lo usa fuera de su proveedor.
- No queda ningún `Alert.alert` en la aplicación móvil.
- No queda ningún banner `alert alert-success` incrustado en una pantalla web.

Que las cuatro suites pasen sin cambios es el punto: **este trabajo no tocó el
comportamiento del sistema**, solo la forma en que se presenta.

---

## 7. Lo que deliberadamente no se tocó

- **La landing page**, por indicación expresa.
- **Los textos de encabezado** de las pantallas del estudiante, que el usuario
  pidió conservar.
- **El error de inicio de sesión**, que sigue mostrándose junto al formulario:
  un aviso flotante se aleja del campo que hay que corregir.
- **Cualquier regla de negocio, permiso o consulta.** La autorización sigue
  siendo del backend; ocultar un botón nunca fue autorización y este trabajo no
  cambió eso.
