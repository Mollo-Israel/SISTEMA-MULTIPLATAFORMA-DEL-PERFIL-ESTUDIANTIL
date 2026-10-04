/**
 * Video explicativo configurable del centro de ayuda (V2 §65, `HELP_VIDEO_URL`).
 *
 * Solo enlaces `https`. Para YouTube se deriva la dirección de inserción
 * (`youtube-nocookie.com/embed/…`); para cualquier otro proveedor —Stream,
 * Drive, Vimeo— la pantalla muestra un enlace en lugar de insertarlo, porque
 * cada uno tiene su propia forma de permitirlo y no se adivina.
 */
export interface HelpVideo {
  url: string;
  embedUrl: string | null;
}

export function helpVideo(raw: string | undefined | null): HelpVideo | null {
  const valor = (raw ?? '').trim();
  if (!valor) return null;
  let u: URL;
  try {
    u = new URL(valor);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || u.username || u.password) return null;

  const host = u.hostname.replace(/^www\./, '');
  let id: string | null = null;
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    id = u.pathname === '/watch' ? u.searchParams.get('v') : (/^\/(embed|shorts)\/([\w-]{6,})/.exec(u.pathname)?.[2] ?? null);
  } else if (host === 'youtu.be') {
    id = /^\/([\w-]{6,})/.exec(u.pathname)?.[1] ?? null;
  }
  const embedUrl = id && /^[\w-]{6,20}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  return { url: u.toString(), embedUrl };
}
