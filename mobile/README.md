# App móvil — Perfil Estudiantil Dinámico (Expo)

App React Native (Expo) del 30% inicial. Consume la **misma API** que la web; no duplica lógica de negocio. La afinidad se calcula siempre en el backend.

## Estructura

```
mobile/
├── App.tsx                 Punto de entrada (NavigationContainer + AuthProvider)
├── app.json                Configuración de Expo
├── src/
│   ├── config.ts           URL de la API (EXPO_PUBLIC_API_URL)
│   ├── theme.ts            Paleta bordó
│   ├── api/client.ts       Axios + JWT (expo-secure-store) + manejo de 401
│   ├── services/           Servicios API por dominio
│   ├── auth/AuthContext    Sesión y JWT
│   ├── components/         UI reutilizable + ManageActivities + LevelPicker
│   ├── hooks/useAsync      Carga/estado/error
│   ├── navigation/         Navegación por rol (tabs + stacks)
│   └── screens/            Pantallas por rol
└── ...
```

## Requisitos previos

1. La API debe estar corriendo: `npm run db:up` y `npm run api:dev` (en la raíz).
2. Node 18+ y la app **Expo Go** en el teléfono, o un emulador Android/iOS.

## Configurar la URL de la API

La app necesita alcanzar la API por red. Crea `mobile/.env` (copia de `.env.example`):

```
# Emulador Android:
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000/api
# Dispositivo físico (misma red Wi-Fi): usa la IP LAN del equipo
# EXPO_PUBLIC_API_URL=http://192.168.x.x:3000/api
# Emulador iOS / web:
# EXPO_PUBLIC_API_URL=http://localhost:3000/api
```

> La API ya tiene CORS habilitado.

## Ejecutar

```bash
npm install            # dentro de mobile/ (o: npm install --prefix mobile)
npm run start          # abre Expo; escanea el QR con Expo Go
# o directamente:
npm run android
npm run ios
```

Credenciales de prueba (seed): `admin@univalle.edu` / `Admin123*`. Los estudiantes pueden registrarse desde la pantalla de login.

## Alcance (30%)

- **Estudiante:** login, inicio/resumen, completar perfil, intereses, habilidades, actividades (interés/inscripción), mis actividades, proyectos + evidencias por enlace, áreas de afinidad, resumen de evidencias y certificados.
- **Docente:** actividades + confirmar participación, resumen permitido del estudiante, reporte básico.
- **Sociedad científica:** crear actividad extracurricular, ver inscritos, confirmar participación.
- **Director:** dashboard básico, mapa de afinidad, participación por semestre.
- **Administrador:** vista básica de usuarios y áreas (la gestión completa se hace en la web).

Chat, contactos QR y equipos avanzados aparecen como **Próximamente** y no son funcionales.
