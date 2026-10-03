/**
 * Plantillas de los correos de cuenta.
 *
 * Están escritas para el cliente más exigente del entorno: el Outlook de
 * escritorio que usan las cuentas institucionales, que dibuja el HTML con el
 * motor de Word. De ahí las tablas en lugar de `div`, los estilos en línea,
 * el botón hecho con una celda de color y la ausencia de degradados y de
 * imágenes —que además suelen llegar bloqueadas y suben la puntuación de spam—.
 *
 * Cada correo va también en texto plano con el mismo contenido. No es un
 * detalle: un mensaje solo en HTML puntúa peor en los filtros, y hay clientes
 * que muestran el texto.
 */

const BORDO = '#7a1424';
const TINTA = '#2b1d20';
const GRIS = '#6b5b5f';
const FONDO = '#f6f1f2';

export interface RenderedMail {
  subject: string;
  text: string;
  html: string;
}

function esc(valor: string): string {
  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 482913 → 482 913, más fácil de leer y de dictar. */
function codigoLegible(code: string): string {
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}

export function formatearFecha(fecha: Date, zona: string): string {
  try {
    // 24 horas: «22:15» no deja un «p. m.» que choque con el punto final de
    // la frase, y es como se escriben las horas en un aviso formal.
    return fecha.toLocaleString('es-BO', {
      timeZone: zona,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
  } catch {
    return fecha.toISOString();
  }
}

function duracion(horas: number): string {
  if (horas < 1) return `${Math.round(horas * 60)} minutos`;
  if (horas % 24 === 0) {
    const dias = horas / 24;
    return dias === 1 ? '1 día' : `${dias} días`;
  }
  return horas === 1 ? '1 hora' : `${horas} horas`;
}

interface Envoltorio {
  /** Texto que algunos clientes muestran junto al asunto, antes de abrir. */
  preheader: string;
  titulo: string;
  cuerpo: string;
}

function envolver({ preheader, titulo, cuerpo }: Envoltorio): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${esc(titulo)}</title>
</head>
<body style="margin:0;padding:0;background:${FONDO};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${FONDO};">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${FONDO};">
  <tr><td align="center" style="padding:28px 12px;">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;background:#ffffff;border-radius:14px;">
      <tr><td style="padding:26px 32px 6px 32px;font-family:'Segoe UI',Arial,sans-serif;">
        <span style="font-size:20px;font-weight:700;color:${BORDO};letter-spacing:0.2px;">Afinia</span>
        <span style="font-size:12px;color:${GRIS};">&nbsp;·&nbsp;Universidad Privada del Valle</span>
      </td></tr>
      <tr><td style="padding:10px 32px 28px 32px;font-family:'Segoe UI',Arial,sans-serif;font-size:15px;line-height:1.6;color:${TINTA};">
        ${cuerpo}
      </td></tr>
    </table>
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;">
      <tr><td style="padding:16px 32px;font-family:'Segoe UI',Arial,sans-serif;font-size:12px;line-height:1.5;color:${GRIS};text-align:center;">
        Este es un mensaje automático de Afinia: no hace falta responderlo.
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function boton(url: string, texto: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 8px 0;">
  <tr><td bgcolor="${BORDO}" style="border-radius:10px;">
    <a href="${esc(url)}" style="display:inline-block;padding:13px 26px;font-family:'Segoe UI',Arial,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">${esc(texto)}</a>
  </td></tr>
</table>`;
}

function cajaCodigo(code: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 4px 0;">
  <tr><td style="background:${FONDO};border-radius:10px;padding:12px 22px;font-family:Consolas,'Courier New',monospace;font-size:26px;font-weight:700;letter-spacing:6px;color:${TINTA};">
    ${esc(codigoLegible(code))}
  </td></tr>
</table>`;
}

function enlaceDeRespaldo(url: string): string {
  return `<p style="margin:18px 0 0 0;font-size:12px;color:${GRIS};">
  Si el botón no funciona, copia esta dirección en tu navegador:<br>
  <a href="${esc(url)}" style="color:${BORDO};word-break:break-all;">${esc(url)}</a>
</p>`;
}

// ===========================================================================

export interface CuentaParams {
  firstName: string;
  /** Enlace completo, con el token. */
  link: string;
  /** Código de seis dígitos. */
  code: string;
  expiresAt: Date;
  /** Vigencia en horas, para decirla en palabras. */
  hours: number;
  timezone: string;
}

export function activationMail(p: CuentaParams): RenderedMail {
  const vence = formatearFecha(p.expiresAt, p.timezone);
  const vigencia = duracion(p.hours);
  const subject = 'Activa tu cuenta de Afinia';

  const text = [
    `Hola ${p.firstName}:`,
    '',
    'La universidad creó tu cuenta en Afinia, la plataforma donde vas construyendo tu perfil',
    'académico: tus intereses, tus proyectos y las actividades en las que participas.',
    '',
    'Para empezar a usarla solo tienes que elegir tu contraseña. Abre este enlace:',
    '',
    p.link,
    '',
    `O, si prefieres, escribe este código en la pantalla de activación: ${codigoLegible(p.code)}`,
    '',
    `El enlace y el código sirven durante ${vigencia}, hasta el ${vence}.`,
    'Si vencen, puedes pedir otros desde la misma pantalla.',
    '',
    'Si no esperabas este correo, ignóralo: sin activarla, la cuenta no se puede usar.',
    '',
    '— Afinia · Universidad Privada del Valle',
  ].join('\n');

  const html = envolver({
    preheader: `Elige tu contraseña para empezar. El enlace sirve ${vigencia}.`,
    titulo: subject,
    cuerpo: `
<h1 style="margin:6px 0 12px 0;font-size:22px;line-height:1.3;color:${TINTA};">Hola ${esc(p.firstName)}, tu cuenta te espera</h1>
<p style="margin:0 0 6px 0;">La universidad creó tu cuenta en <strong>Afinia</strong>, la plataforma donde vas construyendo tu perfil académico: tus intereses, tus proyectos y las actividades en las que participas.</p>
<p style="margin:0;">Para empezar, solo tienes que elegir tu contraseña.</p>
${boton(p.link, 'Activar mi cuenta')}
<p style="margin:18px 0 4px 0;">¿Lo estás leyendo en el teléfono y vas a activar en otro equipo? Usa este código:</p>
${cajaCodigo(p.code)}
<p style="margin:14px 0 0 0;font-size:13px;color:${GRIS};">El enlace y el código sirven durante <strong>${esc(vigencia)}</strong>, hasta el ${esc(vence)}. Si vencen, puedes pedir otros desde la pantalla de activación.</p>
${enlaceDeRespaldo(p.link)}
<p style="margin:18px 0 0 0;font-size:12px;color:${GRIS};">Si no esperabas este correo, ignóralo: sin activarla, la cuenta no se puede usar.</p>`,
  });

  return { subject, text, html };
}

export function passwordResetMail(p: CuentaParams): RenderedMail {
  const vence = formatearFecha(p.expiresAt, p.timezone);
  const vigencia = duracion(p.hours);
  const subject = 'Restablece tu contraseña de Afinia';

  const text = [
    `Hola ${p.firstName}:`,
    '',
    'Recibimos una solicitud para restablecer la contraseña de tu cuenta de Afinia.',
    'Para elegir una nueva, abre este enlace:',
    '',
    p.link,
    '',
    `O escribe este código en la pantalla de recuperación: ${codigoLegible(p.code)}`,
    '',
    `Sirven durante ${vigencia}, hasta el ${vence}.`,
    'Al cambiarla se cerrarán las sesiones abiertas de tu cuenta.',
    '',
    'Si no lo pediste tú, ignora este mensaje: tu contraseña no ha cambiado.',
    '',
    '— Afinia · Universidad Privada del Valle',
  ].join('\n');

  const html = envolver({
    preheader: `Elige una contraseña nueva. El enlace sirve ${vigencia}.`,
    titulo: subject,
    cuerpo: `
<h1 style="margin:6px 0 12px 0;font-size:22px;line-height:1.3;color:${TINTA};">Hola ${esc(p.firstName)}, elige una contraseña nueva</h1>
<p style="margin:0;">Recibimos una solicitud para restablecer la contraseña de tu cuenta de Afinia.</p>
${boton(p.link, 'Elegir contraseña nueva')}
<p style="margin:18px 0 4px 0;">O escribe este código en la pantalla de recuperación:</p>
${cajaCodigo(p.code)}
<p style="margin:14px 0 0 0;font-size:13px;color:${GRIS};">Sirven durante <strong>${esc(vigencia)}</strong>, hasta el ${esc(vence)}. Al cambiarla se cerrarán las sesiones abiertas de tu cuenta.</p>
${enlaceDeRespaldo(p.link)}
<p style="margin:18px 0 0 0;font-size:12px;color:${GRIS};">Si no lo pediste tú, ignora este mensaje: tu contraseña no ha cambiado.</p>`,
  });

  return { subject, text, html };
}

export interface PruebaParams {
  host: string;
  port: number;
  from: string;
  sentAt: Date;
  timezone: string;
}

export function testMail(p: PruebaParams): RenderedMail {
  const cuando = formatearFecha(p.sentAt, p.timezone);
  const subject = 'Prueba de correo de Afinia';
  const text = [
    'Si estás leyendo esto, el envío de correo de Afinia funciona.',
    '',
    `Servidor: ${p.host}:${p.port}`,
    `Remitente: ${p.from}`,
    `Enviado: ${cuando}`,
    '',
    'Revisa también la carpeta de correo no deseado: si este mensaje llegó ahí,',
    'conviene marcarlo como «No es spam» y revisar la guía docs/CORREO_REAL.md.',
  ].join('\n');

  const html = envolver({
    preheader: 'Si lees esto, el correo de Afinia está bien configurado.',
    titulo: subject,
    cuerpo: `
<h1 style="margin:6px 0 12px 0;font-size:22px;line-height:1.3;color:${TINTA};">El correo funciona</h1>
<p style="margin:0 0 14px 0;">Si estás leyendo esto, Afinia ya puede enviar correos reales: activaciones de cuenta y recuperaciones de contraseña.</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="font-size:13px;color:${GRIS};">
  <tr><td style="padding:2px 12px 2px 0;">Servidor</td><td style="color:${TINTA};">${esc(p.host)}:${p.port}</td></tr>
  <tr><td style="padding:2px 12px 2px 0;">Remitente</td><td style="color:${TINTA};">${esc(p.from)}</td></tr>
  <tr><td style="padding:2px 12px 2px 0;">Enviado</td><td style="color:${TINTA};">${esc(cuando)}</td></tr>
</table>
<p style="margin:16px 0 0 0;font-size:13px;color:${GRIS};">Revisa también la carpeta de correo no deseado: si llegó ahí, márcalo como «No es spam».</p>`,
  });

  return { subject, text, html };
}
