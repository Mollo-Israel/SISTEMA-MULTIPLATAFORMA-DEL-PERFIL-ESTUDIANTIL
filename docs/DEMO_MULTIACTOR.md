# Demo con varios actores en una sola computadora (V3.2 §9)

La sesión de Afinia es la del navegador: **un perfil del navegador = una cuenta**.
Abrir otra pestaña del mismo perfil no inicia otra cuenta; reemplaza la sesión
para todas las pestañas. Es el comportamiento normal de cualquier aplicación con
sesión y no se rediseña para la defensa.

## Cómo mostrar varios roles a la vez

| Actor | Dónde abrirlo |
|---|---|
| Administración | Chrome, perfil principal |
| Dirección | Chrome, segundo perfil (*Agregar perfil*) |
| Docente | Edge (o una ventana de incógnito de Chrome) |
| Estudiante | Firefox, o la app móvil |
| Sociedad | Ventana de incógnito de Edge |

Cada perfil, incógnito o navegador distinto guarda su propia sesión. Una ventana
de incógnito comparte sesión con las demás de incógnito del mismo navegador:
para dos actores en incógnito, usar dos navegadores.

## Lo que no depende de la sesión

La propiedad de los datos es del servidor, no de la pestaña: `created_by`,
`updated_by`, responsables, `reviewed_by` y los permisos se calculan con el
usuario autenticado de cada petición. Si una actividad creada por Administración
apareciera «creada por Docente», sería un error de datos y no de la demo.
