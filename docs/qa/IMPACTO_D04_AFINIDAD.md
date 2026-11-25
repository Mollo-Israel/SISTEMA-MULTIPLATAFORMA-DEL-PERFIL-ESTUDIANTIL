# Impacto de D04 en la afinidad — antes del recálculo autorizado

- **Contrato:** V7.1 §6.2 y D04 («Sin resultado»: asistencia operativa, sin trayectoria, afinidad ni documento).
- **Batch:** V7-2.
- **Fecha de la medición:** 25/11/2026.
- **Base medida:** `perfil_estudiantil` (desarrollo). Son en gran parte **datos sintéticos** de las suites. Antes de recalcular una base real hay que repetir la medición sobre ella.
- **Herramienta:** `node scripts/v7/impacto-d04.cjs` (solo lectura). Usa `simulate()` del motor: calcula con la regla vigente (motor v6) y lo compara con lo guardado, **sin escribir** resultados, instantáneas ni auditoría. Solo informa cifras agregadas, nunca personas.

## Qué cambia y qué no

- **Cambia la elegibilidad, no la fórmula.** Pesos, topes y rendimientos decrecientes siguen iguales (D06).
- Una participación confirmada en una actividad «Sin resultado» deja de sumar afinidad y respaldo.
- La asistencia **se conserva**: no se borra ninguna fila, ni de la tabla de participaciones ni de la auditoría.
- La versión del motor sube de 5 a 6.
- **No hubo recálculo masivo.** Al arrancar, la API solo migra estructura (versiones menores que 5). Hoy todos los resultados guardados siguen en versión 5. Cada estudiante pasa a la regla nueva solo cuando cambia su propia trayectoria.

## Medición

| Indicador | Valor |
|---|---|
| Estudiantes con alguna participación confirmada en «Sin resultado» | **2.116** |
| Estudiantes cuya afinidad cambiaría | **1.951** |
| Áreas evaluadas (resultados guardados de esos estudiantes) | 2.452 |
| Áreas que bajan | 2.219 |
| Áreas que dejarían de figurar (afinidad y respaldo en 0) | 1.678 |
| Puntos de afinidad que se dejan de contar, en total | 25.738 |
| Bajada media por área que baja | 11,6 puntos |
| Bajada máxima | 25 puntos (tope de la familia de actividades) |

**Bajadas por tramo** (por área): 0 → 233 · 1–5 → 0 · 6–10 → 1.804 · 11–25 → 415 · más de 25 → 0.

**Cambios de nivel:**

| Cambio | Áreas |
|---|---|
| Baja → sin afinidad | 1.637 |
| Media → baja | 147 |
| Media → sin afinidad | 41 |
| Cualquier cambio desde «Alta» | 0 |

**Efectos que ya rigen, porque se calculan al consultar:**
- **Tecnologías respaldadas:** 1.447 pares estudiante–tecnología venían solo de actividades «Sin resultado». Dejan de mostrarse como respaldadas.
- **Resumen exportable:** 3.207 participaciones confirmadas en «Sin resultado» dejan de ser ítems exportables. Siguen visibles como asistencia en la actividad.

## Efecto en la analítica

La pestaña «Evolución» de Dirección compara solo cálculos de la versión vigente, para no mezclar reglas. Hasta que se recalcule, mostrará solo lo que ya pasó a la versión 6.

## Recálculo controlado (necesita autorización)

Si se autoriza, el recálculo es la acción de Administración ya existente:

```
POST /api/affinity/recalculate-all
```

Sin `all=true`, recalcula los resultados de versiones anteriores a la vigente.

- Conserva las instantáneas anteriores (historial con su versión).
- Escribe la auditoría de cada recálculo.
- No borra participaciones.

Antes de ejecutarlo sobre una base real, repetir esta medición sobre esa base.
