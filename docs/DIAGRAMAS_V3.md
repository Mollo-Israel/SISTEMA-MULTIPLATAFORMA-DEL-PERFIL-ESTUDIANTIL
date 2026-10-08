# Afinia V3 — Diagramas

Diagramas en Mermaid (los renderizan GitHub, VS Code y la mayoría de los visores de Markdown). Describen el sistema tal como está en el código al cerrar la V3.1.

## 1. Arquitectura

```mermaid
flowchart LR
  subgraph Clientes
    W[Web React + Vite<br/>5 actores]
    M[App Expo<br/>solo Estudiante]
  end
  subgraph API["API NestJS (monolito modular)"]
    AUTH[auth · identity · users · access]
    ACT[activities · constancies · certificates]
    PRJ[projects · project-feedback · evidences]
    VAL[validation<br/>URL · QR · Open Badge]
    AFF[affinity-recalc V4 · backed-skills]
    REC[recommendations]
    COL[collaboration<br/>contactos · necesidades · postulaciones]
    NOT[notifications<br/>bandeja · recordatorios]
    TRA[trajectory · gamification]
    REP[reports · analytics]
  end
  DB[(PostgreSQL 16<br/>migraciones up/down)]
  GH[GitHub API<br/>caché ETag]
  SMTP[SMTP o simulado]
  IA[IA opcional<br/>no autoritativa]
  W -->|JWT + cookie refresh| API
  M -->|JWT| API
  API --> DB
  PRJ --> GH
  AUTH --> SMTP
  TRA --> IA
  REP --> IA
```

## 2. Estados de una actividad

```mermaid
stateDiagram-v2
  [*] --> draft
  draft --> published
  draft --> open
  draft --> cancelled
  published --> draft: sin participaciones confirmadas
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
  cancelled --> [*]
```

Las propuestas de Docente y Sociedad pasan además por la revisión de Dirección (`pending → approved | observed | rejected`) antes de publicarse. Las 36 combinaciones de estado están probadas en UNIT.

## 3. Proyecto: de borrador a revisado

```mermaid
stateDiagram-v2
  [*] --> DRAFT: se guarda sin requisitos
  DRAFT --> ACTIVE: áreas + tecnología del catálogo + repositorio público + evidencia + integrantes confirmados
  state ACTIVE {
    [*] --> DECLARED
    DECLARED --> SUPPORTED: una fuente adicional
    SUPPORTED --> CORROBORATED: dos señales independientes + corroboración técnica
    SUPPORTED --> REVIEWED: retroalimentación docente
    CORROBORATED --> REVIEWED: retroalimentación docente
  }
  ACTIVE --> ARCHIVED
```

Solo `CORROBORATED` y `REVIEWED` suman a la afinidad y pueden ir al currículo verificado. Un borrador no suma ni da puntos.

## 4. Postulación a una necesidad de equipo

```mermaid
sequenceDiagram
  actor E as Estudiante
  participant API
  actor R as Responsable
  E->>API: GET /team-needs (solo su semestre)
  E->>API: POST /team-needs/:id/applications
  API-->>R: aviso TEAM_APPLICATION
  R->>API: GET /team-needs/:id/applications
  alt acepta
    R->>API: PATCH /team-applications/:id {accept}
    API->>API: constituye el equipo si no existía
    API-->>E: aviso TEAM_APPLICATION_ACCEPTED
    opt se llenan los cupos
      API->>API: cierra la necesidad y responde «equipo completo» a las pendientes
    end
  else rechaza
    R->>API: PATCH {reject, motivo predefinido, comentario breve}
    API-->>E: aviso TEAM_APPLICATION_REJECTED con el motivo
  end
```

## 5. Currículo en dos niveles

```mermaid
flowchart TD
  A[Paso 1: secciones §43.1] --> B[GET /trajectory-summary/items]
  B --> C{¿Elegible?}
  C -->|proyecto ACTIVE + CORROBORATED/REVIEWED| D[se ofrece]
  C -->|participación CONFIRMED| D
  C -->|credencial CORROBORATED| D
  C -->|no| E[queda en «Mi trayectoria», con el motivo]
  D --> F[Paso 2: marcar ítems y ordenarlos]
  F --> G[vista previa = PDF<br/>con el descargo de V3]
```

## 6. Modelo de datos agregado en V3 (resumen)

```mermaid
erDiagram
  users ||--o{ notifications : recibe
  student_profiles ||--o{ team_applications : postula
  team_needs ||--o{ team_applications : recibe
  team_needs ||--o| teams : constituye
  teams ||--o{ team_members : tiene
  projects ||--o{ project_areas : "multiárea"
  projects ||--o{ project_skills : "skills con estado"
  projects }o--o| teams : "usa un equipo"
  activities ||--o| external_opportunity_validation_references : "referencia de validación"
  external_certificates }o--o| activities : "de una oportunidad"
  validation_records ||--|| external_certificates : valida
  github_api_cache }o--|| projects : "consultas con ETag"
  notifications {
    uuid recipient_user_id
    varchar type
    varchar dedupe_key "único por destinatario"
    timestamptz read_at
    timestamptz delivered_at
  }
  team_applications {
    uuid team_need_id
    uuid applicant_profile_id "único por necesidad"
    enum status
    varchar rejection_reason "predefinido"
  }
  team_needs {
    smallint_array target_semesters
  }
```

Migraciones de la especificación V3 (14): de `1780470000000-V3AcademicScopeAndTeacherImport` a `1780590000000-V3TeamApplications` (más `1780390100000-V3AffinityWeights`, del motor V3 de la V2), todas con `up` y `down`.
