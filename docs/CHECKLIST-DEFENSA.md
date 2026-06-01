# Checklist de defensa — 30% inicial

Sistema Multiplataforma para la Construcción del Perfil Estudiantil Dinámico
(Ingeniería en Sistemas Informáticos – Univalle).

---

## 1. Preparación (antes de la defensa)

```bash
# 1) Base de datos
npm run db:up

# 2) Dependencias
npm install
npm install --prefix web
npm install --prefix mobile

# 3) Esquema + datos
npm run shared:build
npm run api:migrate         # crea las 15 tablas
npm run seed:populate       # pobla con cuentas institucionales y datos amplios (afinidad alta/media/baja)

# 4) Levantar servicios
npm run api:dev             # API:   http://localhost:3000/api  (Swagger /api/docs)
npm run web:dev             # Web:   http://localhost:5173
npm run mobile:start        # Móvil: Expo Go / emulador
```

## 2. Validación automática

```bash
npm run api:dev             # en una terminal
npm run test:api            # en otra: 39 validaciones de backend (debe dar 0 fallos)
npm run demo:e2e            # flujo completo de 14 pasos de punta a punta
```

`npm run test:api` cubre los 13 puntos de backend + reglas de roles. Resultado esperado: **39 OK, 0 fallos**.

---

## 3. Checklist de Backend (automatizado en `test:api`)

- [x] 1. Registro / Login (registro STUDENT, login, /auth/me, credenciales inválidas → 401)
- [x] 2. Roles y permisos (admin lista roles; estudiante → 403 en /users y reportes; sin token → 401)
- [x] 3. Crear perfil (201; duplicado → 409)
- [x] 4. Registrar intereses (200; prioridad inválida → 400; área inexistente → 400)
- [x] 5. Registrar habilidades (200; nivel inválido → 400)
- [x] 6. Crear actividad (docente académica 201; docente extracurricular → 403; sociedad 201; estudiante → 403)
- [x] 7. Inscribirse / registrar interés (interés 201; inscripción → registered)
- [x] 8. Confirmar participación (docente confirma; estudiante NO confirma la suya → 403)
- [x] 9. Crear proyecto (201; sin perfil → 400)
- [x] 10. Adjuntar evidencia (enlace 201; file sin fileUrl → 400)
- [x] 11. Registrar certificado externo (201; listar; docente → 403)
- [x] 12. Recalcular afinidad (200; nivel alto/medio/bajo)
- [x] 13. Consultar reportes básicos (docente y director; docente NO ve reporte director → 403)

---

## 4. Checklist de Web (QA manual)

Entrar a `http://localhost:5173`.

- [ ] 1. Login por rol (estudiante, docente, director, sociedad, admin).
- [ ] 2. Redirección correcta al panel del rol tras login; un rol no entra a rutas de otro.
- [ ] 3. Formularios principales: crear/editar perfil, intereses/habilidades, publicar actividad, crear proyecto.
- [ ] 4. Listados: actividades, usuarios (admin), participantes.
- [ ] 5. Perfil dinámico: completitud, intereses, habilidades, resumen.
- [ ] 6. Actividades: consultar, marcar interés, inscribirse.
- [ ] 7. Proyectos: crear, agregar evidencia por enlace, ver detalle.
- [ ] 8. Afinidades: ver áreas y botón "Recalcular".
- [ ] 9. Reportes básicos: docente (overview/afinidad) y director (mapa, participación por semestre).
- [ ] Módulos futuros (Chat/QR/Equipos) aparecen como "Próximamente" y están deshabilitados.

## 5. Checklist de Móvil (QA manual)

Abrir con Expo Go (configurar `EXPO_PUBLIC_API_URL`, ver `mobile/README.md`).

- [ ] 1. Login (y registro de estudiante).
- [ ] 2. Perfil: completar/editar, ver completitud.
- [ ] 3. Intereses y habilidades (selector de prioridad/nivel).
- [ ] 4. Actividades: consultar.
- [ ] 5. Inscripción: marcar interés / inscribirse; "Mis actividades".
- [ ] 6. Proyectos: registrar.
- [ ] 7. Evidencias: adjuntar enlace; resumen de evidencias y certificados.
- [ ] 8. Afinidades: ver y recalcular (cálculo en backend).

---

## 6. Endpoints principales (API, prefijo `/api`)

| Dominio | Método y ruta | Rol |
|---|---|---|
| Auth | `POST /auth/register` · `POST /auth/login` · `GET /auth/me` | público / autenticado |
| Usuarios | `GET/POST /users` · `PATCH /users/:id` · `PATCH /users/:id/status` | ADMIN |
| Roles | `GET /roles` | ADMIN |
| Catálogos | `GET /academic-areas` · `GET /skills` · `POST` (ADMIN) | autenticado |
| Perfil | `GET/POST/PATCH /profiles/me` · `PUT /profiles/me/interests` · `PUT /profiles/me/skills` · `GET /profiles/me/summary` · `GET /profiles/:id/allowed` | STUDENT / docente-director |
| Actividades | `GET/POST /activities` · `PATCH /activities/:id` · `POST /:id/register-interest` · `POST /:id/register` · `PATCH /:id/confirm-participation` · `GET /:id/participants` | según rol |
| Proyectos | `GET /projects/my` · `POST /projects` · `GET /projects/:id` · `PATCH /projects/:id` · `POST /:id/members` · `POST /:id/evidences` · `DELETE /:id/evidences/:eid` | STUDENT |
| Certificados | `POST/GET/PATCH/DELETE /certificates/external` | STUDENT |
| Constancias | `POST /constancies/internal` · `GET /constancies/internal/my` · `GET /constancies/internal/student/:id` | autorizadores / estudiante |
| Afinidad | `POST /affinity/recalculate/me` · `GET /affinity/me` · `GET /affinity/student/:id` · `GET /affinity/map/basic` | según rol |
| Reportes | `GET /reports/teacher/*` · `GET /reports/director/*` | docente / director |

Documentación interactiva: **Swagger en `/api/docs`**.

---

## 7. Cuentas para iniciar sesión (tras `seed:populate`)

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador (único) | `admin@univalle.edu` | `Admin123*` |
| Docente | `carlos.perez@univalle.edu` | `Univalle2026*` |
| Docente | `maria.gutierrez@univalle.edu` | `Univalle2026*` |
| Director de carrera | `jorge.vargas@univalle.edu` | `Univalle2026*` |
| Sociedad científica | `lucia.fernandez@univalle.edu` | `Univalle2026*` |
| Estudiante (ejemplo) | `ana.quispe@est.univalle.edu` | `Univalle2026*` |

Hay **16 estudiantes** `nombre.apellido@est.univalle.edu` (contraseña `Univalle2026*`).
Las afinidades se calculan con el motor real y muestran niveles **alta/media/baja**.

---

## 8. Errores conocidos / limitaciones del 30%

- **Evidencias por archivo:** hoy se registran por **URL/enlace**; la subida real de archivos
  (Cloudinary o almacenamiento local) está prevista por configuración pero no activada.
- **Eliminar usuario con perfil:** bloqueado por integridad (FK). Para dar de baja se usa
  `PATCH /users/:id/status` (desactivar), no DELETE.
- **Vista "perfil permitido" por `studentId`:** el parámetro es el `studentProfileId` (no el userId).
- **Reporte de curso/grupo:** no hay entidad de curso en el 30%; el reporte docente usa la cohorte completa.
- **Las pruebas acumulan filas:** `test:api` crea cuentas efímeras; para un estado limpio:
  `npm run db:reset && npm run api:migrate && npm run seed:populate`.
- **`npm audit`:** hay vulnerabilidades transitivas del toolchain (no bloqueantes en desarrollo);
  revisar antes de desplegar.
- **Web/Móvil:** validados por build/typecheck e integración de datos; el QA de interacción
  (clics) se realiza con los checklists de las secciones 4 y 5.

---

## 9. Próximos pasos (fuera del 30%)

- Chat privado y grupal · contactos por QR · equipos avanzados.
- Recomendación completa y gamificación completa.
- Analítica avanzada y predicción de rendimiento académico.
- Certificados oficiales emitidos por el sistema.
- Integración real con SIU Univalle y Microsoft Teams.
- Subida real de archivos de evidencia; pruebas unitarias/e2e formales (Jest) y CI;
  paginación y filtros avanzados en listados.
