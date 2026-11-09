# Afinia V4.1 — Impacto en la app móvil del estudiante

Este informe responde al BATCH V4.1-12 del contrato: «mobile Student impact report».

Revisa cada cambio de V4.1 frente a la app Expo (`mobile/`): qué pantalla toca, qué pasa hoy y qué conviene hacer.

**La API es la misma para la web y el móvil.** Toda regla nueva (autorización, validaciones, respaldo, estados) **ya se aplica al móvil** sin cambiar código: el móvil no puede saltársela. Lo que sigue trata solo de lo que el móvil **muestra** o **ofrece**.

Leyenda:
- ✅ **Sin cambios necesarios.**
- 🔧 **Ajustado en V4.1-12:** un cambio pequeño de texto.
- 📌 **Pendiente recomendado:** no bloquea; la API ya protege.

| Batch | Cambio V4.1 | Pantalla móvil | Qué pasa hoy en el móvil | Estado |
|---|---|---|---|---|
| 1 | Validación del aula o lugar (`IsPlaceName`) | — (el estudiante no crea actividades) | — | ✅ |
| 2 | Hasta 5 imágenes por actividad | `ActivitiesScreen` | Muestra la portada (`imageUrl`); `images[]` llega, pero sin carrusel | 📌 Carrusel opcional |
| 3 | Pestañas por origen (académica / extracurricular / externa) | `ActivityTabs` | Sigue con sus pestañas; el filtro de la API no cambió para el estudiante | ✅ |
| 4 | Asistencia cerrada y corrección excepcional | `MyActivitiesScreen` | Lee el estado de su inscripción; las correcciones las hace Dirección en la web | ✅ |
| 5 | Biblioteca: solo lo publicado; «Para ti» | `LibraryScreen` | La API ya oculta lo pendiente. Se corrigió el texto «Guardar orienta tus recomendaciones», que ahora sería falso | 🔧 · 📌 Pestaña «Para ti» (`forMe=true`) |
| 6 | «Me interesa» en lugar de «Guardar» como señal | `ActivityTabs`, `RecommendationsScreen` | «Guardar» sigue funcionando como acceso rápido y no altera el puntaje (lo decide la API). Los motivos nuevos («Coincide con tus intereses…») llegan solos | ✅ · 📌 Mostrar «N de 100» |
| 7 | Sin retos ni recompensas; saldo en el perfil | `ProgressScreen` | El móvil nunca canjeaba ni creaba retos: solo leía `/gamification/me` y `/me/wallet`, que siguen igual. Se cambió «para canjear» por «saldo de puntos» | 🔧 |
| 8 | Estado de validación de credenciales aparte del respaldo | `EvidencesScreen` | Muestra el respaldo. `validationStatus` llega en el veredicto, pero no se muestra | 📌 Mostrar la etiqueta |
| 9 | Una tecnología por área para activar; reconfirmación | `ProjectsScreen`, `ProjectDetailScreen` | La lista de requisitos de la API incluye `skill_per_area` con su mensaje ya legible. La reconfirmación llega como notificación | ✅ |
| 10 | Sugerencias de GitHub con procedencia; respaldo honesto | `ProjectDetailScreen` | El respaldo y sus razones llegan iguales (hay menos CORROBORATED). Las sugerencias son solo web | 📌 Sugerencias en móvil |
| 11 | Equipo con búsqueda; excluir con motivo | `ProjectsScreen`, `ProjectDetailScreen` | `DELETE /projects/:id/members/:memberId` **exige ahora un motivo** si el integrante viene de un equipo. Sin motivo, la API responde 400 con el mensaje | 📌 Pedir el motivo antes de retirar |
| 12 | Nombres claros de visibilidad; QR en Mi perfil | `ProjectsScreen`, `ProfileScreen`, `CollaborationScreen` | Usa sus propias etiquetas (`VISIBILITY_OPTIONS`), coherentes con las cinco opciones reales. El QR sigue en Colaboración. **Un borrador ya no sale en el perfil público** (corregido en la API) | ✅ · 📌 Copiar las ayudas de §14 |

## Prioridad sugerida (si se trabaja el móvil)

1. **Batch 11:** pedir el motivo al retirar a un integrante que viene de un equipo. Hoy la API lo exige y el móvil mostraría el error 400.
2. **Batch 8:** mostrar el estado de validación junto al respaldo.
3. **Batch 5:** pestaña «Para ti» en la Biblioteca.
4. **Batches 2, 6, 10 y 12:** mejoras de presentación.

## Verificación

- `npx tsc --noEmit` en `mobile/`: sin errores tras los dos ajustes de texto.
- No se tocó la navegación ni la autenticación del móvil.
