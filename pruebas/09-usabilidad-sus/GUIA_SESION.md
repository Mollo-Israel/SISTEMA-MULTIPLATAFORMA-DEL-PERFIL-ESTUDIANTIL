# Prueba de usabilidad con SUS: guía de la sesión

Responde al §3.8 de la investigación: tareas reales con usuarios representativos, y después el System Usability Scale (SUS).

**Estado:** el material está listo. **La sesión la conducen ustedes**, porque necesita personas reales. Después, `calcular-sus.mjs` saca los resultados.

## Preparación

- **Entorno:** el de pruebas (`node scripts/pruebas/entorno.mjs api` y `… web`), con la web en http://localhost:5180. **Nunca la base de desarrollo.**
- **Participantes:** 5 a 8 estudiantes (con 5 ya aparecen la mayoría de los problemas). Si es posible, sumen un docente.
- **Cuentas:** cada participante usa una cuenta sembrada distinta (contraseña `Univalle2026*`):
  - estudiantes: `andres.villca`, `daniela.rojas`, `marco.salazar`, `paola.condori`, `pedro.choque` y `gabriela.cruz` (todas `@est.univalle.edu`);
  - docente: `maria.gutierrez@univalle.edu`.
- **Para la tarea 1 (activar):** crea antes una cuenta pendiente por participante desde *Administración → Usuarios*. El correo de activación sale por la consola de la API de pruebas (`MAIL_TRANSPORT=console`).
- **Durante la sesión:** el moderador **no ayuda** salvo que el participante quede bloqueado más de 2 minutos; en ese caso se anota como «ayuda».

## Tareas (las del §3.8)

| # | Tarea que se lee al participante | Se considera lograda si… |
|---|---|---|
| T1 | «Activa tu cuenta con el enlace que te llegó y entra a Afinia». O la variante: «Olvidaste tu contraseña: recupérala». | Llega a su panel de inicio. |
| T2 | «Encuentra una actividad que te interese y regístrate». | Ve su inscripción confirmada en la actividad. |
| T3 | «Registra un proyecto tuyo como borrador» (o «consulta uno de tus proyectos»). | El proyecto aparece en «Proyectos». |
| T4 | «Mira en qué área tienes más afinidad y explica qué la respalda». | Nombra el área y una fuente de su respaldo. |
| T5 | «Abre una recomendación y dinos por qué te la sugieren». | Lee el motivo («Coincide con…»). |
| T6 | «Comparte tu perfil con un compañero mediante el QR». | Muestra el QR en Mi perfil → Visibilidad. |

**Por cada tarea se registra:** éxito (sí, parcial o no), tiempo en segundos, errores (clics equivocados, caminos sin salida), si necesitó ayuda y observaciones. Usa `registro-tareas.csv`.

## Cuestionario SUS (después de las tareas)

Cada ítem se responde de 1 a 5 (1 = totalmente en desacuerdo, 5 = totalmente de acuerdo):

1. Creo que me gustaría usar Afinia con frecuencia.
2. Encontré Afinia innecesariamente compleja.
3. Pensé que Afinia era fácil de usar.
4. Creo que necesitaría el apoyo de una persona técnica para poder usar Afinia.
5. Encontré que las distintas funciones de Afinia estaban bien integradas.
6. Pensé que había demasiada inconsistencia en Afinia.
7. Imagino que la mayoría de las personas aprendería a usar Afinia muy rápidamente.
8. Encontré Afinia muy incómoda de usar.
9. Me sentí muy seguro/a usando Afinia.
10. Necesité aprender muchas cosas antes de poder empezar a usar Afinia.

Las respuestas se anotan en `respuestas-sus.csv`, una fila por participante.

## Cálculo

```
node pruebas/09-usabilidad-sus/calcular-sus.mjs
```

- **Fórmula del SUS:**
  - ítems impares: respuesta − 1;
  - ítems pares: 5 − respuesta;
  - la suma se multiplica por 2,5.
- El resultado va de 0 a 100. **No es un porcentaje** (Brooke, 2013).
- Como referencia, ≈ 68 es el promedio de la industria (Lewis y Sauro, 2018).
- El script también resume `registro-tareas.csv`: tasa de éxito, tiempo medio, errores y ayudas por tarea. Escribe `resultados-usabilidad.md`.
