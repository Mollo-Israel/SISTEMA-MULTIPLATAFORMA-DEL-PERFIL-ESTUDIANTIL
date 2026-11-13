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
2. Node 18+ y, en el teléfono, **Expo Go para SDK 54** o el APK de la app (ver más abajo).

### Expo Go y la versión del proyecto

Expo Go trae la parte nativa de **una sola versión** de Expo; al escanear el QR solo descarga el
código JavaScript desde la PC. Por eso la versión de Expo Go debe ser la misma del proyecto, que
está en **Expo SDK 54**. La Expo Go de las tiendas se actualiza a la versión más nueva de Expo y
entonces muestra que el proyecto es incompatible.

- **Android:** desinstala Expo Go e instala la versión oficial para SDK 54,
  [Expo-Go-54.0.8.apk](https://github.com/expo/expo-go-releases/releases/download/Expo-Go-54.0.8/Expo-Go-54.0.8.apk)
  (o elígela en [expo.dev/go](https://expo.dev/go)). Desactiva su actualización automática en Play Store.
- **iPhone:** no se pueden instalar versiones anteriores de Expo Go, y la versión actual pide iniciar
  sesión con la misma cuenta de Expo en la PC y en el teléfono. Allí conviene usar la versión web.
- **Sin Expo Go:** genera el APK (sección siguiente).

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

Credenciales (tras `npm run seed:populate`): administrador `admin@univalle.edu` / `Admin123*`;
demás cuentas (docentes, director, sociedad y estudiantes `@est.univalle.edu`) con contraseña
`Univalle2026*` (ej. `ana.quispe@est.univalle.edu`). Los estudiantes también pueden registrarse desde el login.

## Generar el APK (Android, sin Expo Go)

El APK lleva dentro la app completa: no necesita Expo Go ni el servidor de Expo, solo llegar a la API.

```bash
# Una sola vez: Java 17 y Android SDK en %LOCALAPPDATA%\Android (unos 4 GB, sin permisos de administrador)
powershell -ExecutionPolicy Bypass -File scripts/movil/instalar-herramientas-android.ps1

# Desde la raíz del proyecto
npm run mobile:apk                                     # usa la API de esta PC: http://<IP de la red>:3010/api
npm run mobile:apk -- https://api.TU-DOMINIO.com/api   # usa la API publicada
```

- El APK queda en `mobile/apk/Afinia.apk` (git lo ignora). La primera compilación tarda de 10 a 20
  minutos; las siguientes, unos pocos.
- Se compila en una copia de `mobile/` en `C:\afinia-apk`: en Windows, la compilación nativa falla con
  rutas largas o con espacios, como la de este proyecto. Ahí mismo se habilita HTTP para la API local
  (Android lo bloquea en una versión release) y se fija el tema claro de `app.json`.
- **Instalarlo:** pasa el archivo al teléfono (cable, Drive o WhatsApp como documento), ábrelo y permite
  «instalar apps de origen desconocido». Android puede avisar que la app es de un desarrollador
  desconocido: está firmada con la clave de pruebas, no con una de Play Store.
- **Con la API de esta PC:** el teléfono debe estar en la misma red, con la API encendida. Si la IP de la
  PC cambia (otra red, otro lugar), vuelve a generar el APK. Si el teléfono no conecta, revisa que el
  firewall de Windows permita a Node.js recibir conexiones, sobre todo si la red figura como «Pública».

## Alcance (30%)

- **Estudiante:** login, inicio/resumen, completar perfil, intereses, habilidades, actividades (interés/inscripción), mis actividades, proyectos + evidencias por enlace, áreas de afinidad, resumen de evidencias y certificados.
- **Docente:** actividades + confirmar participación, resumen permitido del estudiante, reporte básico.
- **Sociedad científica:** crear actividad extracurricular, ver inscritos, confirmar participación.
- **Director:** dashboard básico, mapa de afinidad, participación por semestre.
- **Administrador:** vista básica de usuarios y áreas (la gestión completa se hace en la web).

Chat, contactos QR y equipos avanzados aparecen como **Próximamente** y no son funcionales.
