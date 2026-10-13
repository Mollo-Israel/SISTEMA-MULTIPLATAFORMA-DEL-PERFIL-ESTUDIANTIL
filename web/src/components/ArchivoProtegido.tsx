import { useEffect, useState, type ReactNode } from 'react';
import { api } from '../api/client';
import { uploadService } from '../services';
import { useToast } from './feedback';

/**
 * Archivos protegidos (§27.1, §83): `/api/files/:key` exige sesión con el
 * token en la cabecera, y vive en el origen de la API, no en el de la web.
 * Un `<img src>` o un `<a href>` directos no llevan el token: el navegador
 * recibía 401 y la imagen o el documento no aparecían. Aquí se piden con el
 * cliente autenticado y se muestran desde una URL local (`blob:`).
 */

const yaLocal = (src: string) => /^(blob:|data:)/.test(src);
const absoluta = (src: string) => (/^https?:\/\//.test(src) ? src : uploadService.fileUrl(src));

async function pedir(src: string): Promise<Blob> {
  const r = await api.get<Blob>(absoluta(src), { responseType: 'blob' });
  return r.data;
}

/** Imagen de una actividad o un recurso, pedida con la sesión. */
export function ImagenProtegida({
  src, alt = '', className, loading, fallback = null,
}: { src: string; alt?: string; className?: string; loading?: 'lazy' | 'eager'; fallback?: ReactNode }) {
  const [url, setUrl] = useState<string | null>(yaLocal(src) ? src : null);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    if (yaLocal(src)) {
      setUrl(src);
      return undefined;
    }
    let vivo = true;
    let creada: string | null = null;
    setUrl(null);
    setFallo(false);
    pedir(src)
      .then((b) => {
        creada = URL.createObjectURL(b);
        if (vivo) setUrl(creada);
        else URL.revokeObjectURL(creada);
      })
      .catch(() => vivo && setFallo(true));
    return () => {
      vivo = false;
      if (creada) URL.revokeObjectURL(creada);
    };
  }, [src]);

  if (fallo) return <>{fallback}</>;
  if (!url) return <span className={`img-cargando ${className ?? ''}`} aria-hidden="true" />;
  return <img src={url} alt={alt} className={className} loading={loading} />;
}

/**
 * Botón para ver un documento subido. PDF e imágenes se abren en otra
 * pestaña; cualquier otro tipo se descarga (nunca se interpreta en la web).
 */
export function BotonArchivo({
  src, nombre = 'documento', className = 'btn btn-secondary btn-sm', children,
}: { src: string; nombre?: string; className?: string; children: ReactNode }) {
  const toast = useToast();
  const [ocupado, setOcupado] = useState(false);

  const abrir = async () => {
    // La pestaña se abre en el clic (si no, el navegador la bloquea) y se
    // completa cuando llega el archivo.
    const ventana = window.open('', '_blank');
    setOcupado(true);
    try {
      const blob = await pedir(src);
      const url = URL.createObjectURL(blob);
      const mostrable = blob.type === 'application/pdf' || /^image\/(png|jpe?g|gif|webp)$/.test(blob.type);
      if (mostrable && ventana) {
        ventana.opener = null;
        ventana.location.href = url;
      } else {
        ventana?.close();
        const a = document.createElement('a');
        a.href = url;
        a.download = nombre;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      ventana?.close();
      toast.error('No se pudo abrir el archivo.', 'Puede que ya no exista o que no tengas acceso.');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <button type="button" className={className} onClick={abrir} disabled={ocupado} aria-busy={ocupado}>
      {children}
    </button>
  );
}
