import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { CLIENT_HEADER, tokenStore } from './api/client';
import { API_URL } from './config';

/**
 * Abrir un archivo subido (evidencia, certificado). `/api/files/:key` exige
 * sesión con el token en la cabecera: abrirlo con el navegador del teléfono
 * daba 401. Se descarga con el token a la caché de la app y se ofrece con el
 * visor del sistema (PDF, imagen); nunca queda en una carpeta pública.
 */
export async function abrirArchivo(relativa: string, nombre = 'archivo'): Promise<void> {
  const token = await tokenStore.get();
  if (!token) throw new Error('Tu sesión terminó. Vuelve a ingresar.');
  const url = /^https?:\/\//.test(relativa) ? relativa : `${API_URL.replace(/\/api$/, '')}${relativa}`;
  const destino = `${FileSystem.cacheDirectory}${Date.now()}-${nombre.replace(/[^\w.-]+/g, '_')}`;
  const r = await FileSystem.downloadAsync(url, destino, {
    headers: { ...CLIENT_HEADER, Authorization: `Bearer ${token}` },
  });
  if (r.status !== 200) {
    await FileSystem.deleteAsync(destino, { idempotent: true }).catch(() => undefined);
    throw new Error(r.status === 404 ? 'El archivo ya no existe o no tienes acceso.' : 'No se pudo abrir el archivo.');
  }
  if (!(await Sharing.isAvailableAsync())) throw new Error('Este teléfono no puede abrir el archivo.');
  const tipo = r.headers['Content-Type'] ?? r.headers['content-type'];
  await Sharing.shareAsync(r.uri, { mimeType: tipo, dialogTitle: 'Abrir archivo' });
}
