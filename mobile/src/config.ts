import Constants from 'expo-constants';
import { NativeModules, Platform } from 'react-native';

/** Puerto de la API. Coincide con API_PORT del .env de la raiz. */
const API_PORT = 3010;

/**
 * Direccion de la API.
 *
 * Antes estaba escrita a mano como `http://localhost:3000/api`, lo que fallaba
 * por dos motivos a la vez: el puerto era el viejo, y `localhost` desde un
 * telefono es el propio telefono, no el equipo donde corre la API.
 *
 * Ahora se deduce del host que sirvio la aplicacion, que ya es el correcto en
 * cada caso: la IP de la red en un telefono real, 10.0.2.2 en el emulador de
 * Android y localhost en el simulador de iOS. Asi no hay que editar nada al
 * cambiar de red.
 */

/** Host del servidor de desarrollo, segun Expo. Es la via que siempre existe. */
function expoHost(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri
    ?? (Constants as { expoGoConfig?: { debuggerHost?: string } }).expoGoConfig?.debuggerHost;
  if (!hostUri) return null;
  const host = hostUri.split(':')[0];
  return host || null;
}

/**
 * Host segun el propio React Native. Se conserva como respaldo porque no
 * depende de Expo, aunque con la Nueva Arquitectura puede no estar disponible.
 */
function packagerHost(): string | null {
  const url: string | undefined = NativeModules?.SourceCode?.scriptURL;
  if (!url) return null;
  const match = url.match(/^https?:\/\/([^/:]+)/);
  return match ? match[1] : null;
}

function resolveApiUrl(): string {
  // 1. La variable de entorno manda: sirve para apuntar a un servidor remoto.
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv;

  // 2. En desarrollo, el mismo equipo que sirvio la aplicacion.
  const host = expoHost() ?? packagerHost();
  if (host) return `http://${host}:${API_PORT}/api`;

  // 3. Compilacion de produccion: lo que declare app.json.
  const fromConfig = Constants.expoConfig?.extra?.apiUrl as string | undefined;
  if (fromConfig) return fromConfig;

  // 4. Ultimo recurso.
  return Platform.OS === 'android'
    ? `http://10.0.2.2:${API_PORT}/api`
    : `http://localhost:${API_PORT}/api`;
}

export const API_URL = resolveApiUrl();
