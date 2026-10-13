import { useEffect, useState, type ReactNode } from 'react';
import { Image, type ImageStyle, type StyleProp } from 'react-native';
import { CLIENT_HEADER, tokenStore } from '../api/client';
import { API_URL } from '../config';

/**
 * Imagen de una actividad o de un recurso (V3.2 §18.3, §35). `/api/files/:key`
 * exige sesión, así que se pide con el token en la cabecera; la ruta que da la
 * API es relativa a su origen.
 */
export function ImagenProtegida({
  src, style, fallback = null,
}: { src: string; style?: StyleProp<ImageStyle>; fallback?: ReactNode }) {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    let vivo = true;
    tokenStore.get().then((t) => vivo && setToken(t)).catch(() => vivo && setToken(null));
    return () => { vivo = false; };
  }, [src]);

  if (fallo || token === null) return <>{fallback}</>;
  if (token === undefined) return null;
  const uri = /^https?:\/\//.test(src) ? src : `${API_URL.replace(/\/api$/, '')}${src}`;
  return (
    <Image
      source={{ uri, headers: { ...CLIENT_HEADER, Authorization: `Bearer ${token}` } }}
      style={style}
      resizeMode="cover"
      accessibilityIgnoresInvertColors
      onError={() => setFallo(true)}
    />
  );
}
