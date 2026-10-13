# Diagramas — Cierre V3.2

Este documento muestra solo lo que cambió en la V3.2. La arquitectura general, el modelo de datos base y el resto de los estados siguen en [`DIAGRAMAS_V3.md`](DIAGRAMAS_V3.md).

Los diagramas están en Mermaid. Se ven en GitHub y en VS Code. Para el documento de grado, se exportan con `npx @mermaid-js/mermaid-cli -i DIAGRAMAS_V3_2.md`.

## 1. Revisión de una actividad propuesta (§23–§26)

Las actividades de Docente o Sociedad pasan por Dirección. La que crea Dirección no necesita revisión (`not_required`).

```mermaid
stateDiagram-v2
    [*] --> SinEnviar: Docente o Sociedad crea (borrador privado)
    SinEnviar --> Pendiente: Enviar a revisión (exige el formulario completo)
    Pendiente --> SinEnviar: Retirar el envío (cancel-submission)
    Pendiente --> Observada: Dirección pide cambios
    Observada --> Pendiente: Corrige y reenvía
    Pendiente --> Aprobada: Dirección aprueba
    Pendiente --> Rechazada: Dirección rechaza (queda en la historia)
    Aprobada --> Aprobada: Solo Dirección ajusta (auditado); el creador recibe 409
    Rechazada --> [*]
```

- El borrador lo ven su creador y sus responsables; Dirección y Administración, solo una vez enviado. Para cualquier otro, también al cambiar el id en la URL, responde 404.

## 2. Ciclo de la actividad (`ACTIVITY_TRANSITIONS`, §21–§22)

```mermaid
stateDiagram-v2
    [*] --> draft
    draft --> published
    draft --> open: publicar y abrir inscripciones
    draft --> cancelled
    published --> draft: solo si nadie tiene participación confirmada
    published --> open
    published --> closed
    published --> finished
    published --> cancelled
    open --> closed
    open --> finished
    open --> cancelled
    closed --> open
    closed --> finished
    closed --> cancelled
    finished --> [*]
    cancelled --> [*]: con motivo y fecha (§20)
```

El ciclo automático (`ACTIVITY_LIFECYCLE_INTERVAL_MS`, 60 s por omisión; 0 lo apaga) cierra las inscripciones de lo que ya empezó (`closed`) y da por finalizado lo que ya terminó (`finished`).

## 3. Afinidad V5: el área sale del contexto explícito (§11.5, §12.3)

```mermaid
flowchart LR
    subgraph Experiencias con respaldo
      A[Actividad con participación confirmada]
      P[Proyecto activo y con respaldo]
      C[Credencial corroborada]
    end
    A -->|área de la actividad| CTX
    P -->|project_skills.academic_area_id| CTX
    C -->|external_certificate_areas y contexto por tecnología| CTX
    CTX{¿Hay área explícita?}
    CTX -->|sí| AF[Suma en ESA área]
    CTX -->|no| NADA[No se reparte]
    T[Etiquetas del área] -. solo sugieren al clasificar .-> X[No puntúan]
    I[Intereses declarados] -. orientan recomendaciones .-> X
```

- La habilidad React, con área principal «Desarrollo web» y secundaria «Móvil», suma solo en el área en que se usó en esa experiencia.
- Ya no se infiere un área por las etiquetas de una tecnología ni por coincidencias de texto con el nombre de un área.

## 4. Archivos protegidos en la web y el móvil (§27.1, §83)

```mermaid
sequenceDiagram
    participant UI as Web (ImagenProtegida / BotonArchivo) o Móvil
    participant API as API /api/files/:key
    participant ACL as FileAccessService
    UI->>API: GET con Authorization: Bearer <token>
    API->>ACL: ¿puede este usuario ver la entidad que contiene el archivo?
    alt autorizado
      ACL-->>API: storageKey
      API-->>UI: 200 · attachment · nosniff · no-store
      UI->>UI: web: URL blob: (img) o pestaña nueva (PDF/imagen)<br/>móvil: caché de la app → visor del sistema
    else sin sesión
      API-->>UI: 401
    else sin acceso
      API-->>UI: 404 (no revela que existe)
    end
```

Antes de la V3.2, `<img src="/api/files/…">` y los enlaces «Abrir» no llevaban el token, apuntaban al origen de la web y recibían 401.

## 5. Auditoría legible (§59)

```mermaid
flowchart LR
    E[(audit_events<br/>códigos estables + metadata)] --> L[audit-labels.ts]
    L --> R["GET /audit/log<br/>actor · módulo · acción · fecha · resultado<br/>filtros + 10 por página"]
    L --> K[GET /audit/log/catalog]
    R --> W[Pantalla Auditoría · Admin]
    K --> W
```

- El detalle técnico, como el código del evento, queda dentro del desplegable de cada fila.
- La metadata ya se guarda sin contraseñas, tokens ni códigos.

## 6. Superficie técnica del correo (§60)

```mermaid
flowchart TD
    Q[Petición a /api/mail/*] --> R{¿Rol Admin?}
    R -->|no| F[403]
    R -->|sí| P{¿NODE_ENV = production?}
    P -->|no| OK[Diagnóstico disponible]
    P -->|sí| M{¿MAIL_DIAGNOSTICS_ENABLED = true?}
    M -->|sí| OK
    M -->|no| N[404]
```

En la web, el menú y la ruta existen solo en desarrollo o con `VITE_TECHNICAL_MODE=true`.
