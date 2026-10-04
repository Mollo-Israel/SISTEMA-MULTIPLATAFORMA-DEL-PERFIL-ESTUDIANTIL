import { ContactChannelType } from '@perfil/shared';

/**
 * Canales de contacto externos (especificación V2 §59). Afinia no tiene chat
 * (§57): enlaza al canal que el estudiante eligió compartir.
 *
 * Cada canal se valida y se normaliza, y de cada valor se deriva un único
 * enlace seguro (`https:` o `mailto:`). Funciones puras.
 */

export type ChannelCheck =
  | { ok: true; value: string; href: string }
  | { ok: false; message: string };

const EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

function urlSegura(raw: string): URL | null {
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`);
    if (u.protocol !== 'https:' || !u.hostname.includes('.') || u.username || u.password) return null;
    return u;
  } catch {
    return null;
  }
}

export function checkContactChannel(channel: ContactChannelType, raw: string): ChannelCheck {
  const v = (raw ?? '').trim();
  if (!v) return { ok: false, message: 'Escribe el dato del canal o quítalo.' };
  if (v.length > 300) return { ok: false, message: 'El dato del canal es demasiado largo.' };

  switch (channel) {
    case ContactChannelType.TEAMS: {
      // La cuenta de Teams es un correo (UPN) o un enlace de teams.microsoft.com.
      if (EMAIL.test(v)) {
        const email = v.toLowerCase();
        return { ok: true, value: email, href: `https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(email)}` };
      }
      const u = urlSegura(v);
      if (u && (u.hostname === 'teams.microsoft.com' || u.hostname === 'teams.live.com')) {
        return { ok: true, value: u.toString(), href: u.toString() };
      }
      return { ok: false, message: 'Para Teams, escribe tu cuenta (correo) o un enlace de teams.microsoft.com.' };
    }
    case ContactChannelType.WHATSAPP: {
      const digitos = v.replace(/[\s().-]/g, '');
      if (!/^\+\d{8,15}$/.test(digitos)) {
        return { ok: false, message: 'Escribe el número con código de país, por ejemplo +591 71234567.' };
      }
      return { ok: true, value: digitos, href: `https://wa.me/${digitos.slice(1)}` };
    }
    case ContactChannelType.LINKEDIN: {
      const u = urlSegura(v);
      const m = u && /^(www\.)?linkedin\.com$/.test(u.hostname) ? /^\/in\/([A-Za-z0-9\-_%]{3,100})\/?$/.exec(u.pathname) : null;
      if (!m) return { ok: false, message: 'Escribe el enlace de tu perfil: linkedin.com/in/tu-nombre.' };
      const limpio = `https://www.linkedin.com/in/${m[1]}`;
      return { ok: true, value: limpio, href: limpio };
    }
    case ContactChannelType.EMAIL: {
      if (!EMAIL.test(v)) return { ok: false, message: 'Escribe un correo válido.' };
      const email = v.toLowerCase();
      return { ok: true, value: email, href: `mailto:${email}` };
    }
    case ContactChannelType.LINK: {
      const u = urlSegura(v);
      if (!u) return { ok: false, message: 'Solo se aceptan enlaces https.' };
      return { ok: true, value: u.toString(), href: u.toString() };
    }
    default:
      return { ok: false, message: 'Canal no válido.' };
  }
}

/** El enlace de un valor ya guardado (guardado = ya validado). */
export function channelHref(channel: ContactChannelType, value: string): string | null {
  const r = checkContactChannel(channel, value);
  return r.ok ? r.href : null;
}
