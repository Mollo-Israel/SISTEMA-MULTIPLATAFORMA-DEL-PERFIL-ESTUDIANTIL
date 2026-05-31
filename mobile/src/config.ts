// En emulador Android usa http://10.0.2.2:3000/api
// En dispositivo físico usa http://<IP-LAN-del-equipo>:3000/api
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api';
