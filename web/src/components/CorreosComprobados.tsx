import { useState } from 'react';
import { FiCheckCircle, FiMail, FiTrash2 } from 'react-icons/fi';
import { apiError } from '../api/client';
import { useAsync } from '../hooks/useAsync';
import { verifiedEmailService } from '../services';
import type { VerifiedEmail } from '../services/types';
import { AsyncView, Badge, Button, Card } from './ui';
import { useConfirm, useToast } from './feedback';

/**
 * V9 · Correos personales comprobados.
 *
 * Credly, Coursera o Accredible emiten la insignia al correo con el que el
 * estudiante se inscribió (casi nunca el institucional) y lo guardan cifrado.
 * Para reconocerlo como destinatario, Afinia necesita saber que ese correo es
 * suyo: se comprueba con un código de seis dígitos enviado a ese buzón.
 */
export default function CorreosComprobados() {
  const correos = useAsync(() => verifiedEmailService.list(), []);
  const toast = useToast();
  const confirmar = useConfirm();
  const [nuevo, setNuevo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [codigos, setCodigos] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);

  const agregar = async () => {
    if (!nuevo.trim()) return;
    setEnviando(true);
    try {
      await verifiedEmailService.add(nuevo.trim());
      toast.success('Te enviamos un código de seis dígitos a ese correo.');
      setNuevo('');
      correos.reload();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setEnviando(false);
    }
  };

  const comprobar = async (c: VerifiedEmail) => {
    setOcupado(c.id);
    try {
      await verifiedEmailService.confirm(c.id, codigos[c.id] ?? '');
      toast.success('Correo comprobado. Volvemos a verificar tus credenciales con él.');
      correos.reload();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setOcupado(null);
    }
  };

  const reenviar = async (c: VerifiedEmail) => {
    setOcupado(c.id);
    try {
      await verifiedEmailService.resend(c.id);
      toast.success('Código reenviado.');
      correos.reload();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setOcupado(null);
    }
  };

  const quitar = async (c: VerifiedEmail) => {
    const ok = await confirmar({
      title: 'Quitar correo',
      message: c.verified
        ? `Las insignias recibidas en ${c.email} dejarán de reconocerse como tuyas hasta que lo vuelvas a comprobar.`
        : `Se descarta ${c.email}.`,
      confirmLabel: 'Quitar',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await verifiedEmailService.remove(c.id);
      correos.reload();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <Card title="Correos con los que recibes insignias (Credly, Coursera…)">
      <p className="inline-note">
        Las plataformas de insignias guardan tu correo cifrado. Si recibiste una insignia en tu correo personal, compruébalo aquí
        y Afinia podrá reconocerla como tuya. Solo cuenta un correo comprobado con el código que te enviamos.
      </p>
      <AsyncView loading={correos.loading} error={correos.error} data={correos.data}>
        {(lista: VerifiedEmail[]) => (
          <ul className="correos-comprobados" data-testid="correos-comprobados">
            {lista.map((c) => (
              <li key={c.id}>
                <FiMail aria-hidden />
                <span className="correo">{c.email}</span>
                {c.verified
                  ? <Badge tone="green"><FiCheckCircle aria-hidden /> Comprobado</Badge>
                  : <Badge tone="amber">Falta el código</Badge>}
                {!c.verified && (
                  <span className="correo-codigo">
                    <input
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={7}
                      placeholder="123456"
                      aria-label={`Código enviado a ${c.email}`}
                      value={codigos[c.id] ?? ''}
                      onChange={(e) => setCodigos({ ...codigos, [c.id]: e.target.value })}
                    />
                    <Button size="sm" onClick={() => comprobar(c)} disabled={ocupado === c.id || (codigos[c.id] ?? '').replace(/\D/g, '').length !== 6}>
                      Comprobar
                    </Button>
                    <button type="button" className="link-button" onClick={() => reenviar(c)} disabled={ocupado === c.id}>Reenviar</button>
                  </span>
                )}
                <button type="button" className="icon-button" aria-label={`Quitar ${c.email}`} onClick={() => quitar(c)}>
                  <FiTrash2 aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </AsyncView>
      <form
        className="correo-nuevo"
        onSubmit={(e) => { e.preventDefault(); void agregar(); }}
      >
        <input
          type="email"
          placeholder="tu.correo@gmail.com"
          aria-label="Correo personal"
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          maxLength={254}
        />
        <Button type="submit" disabled={enviando || !nuevo.trim()}>{enviando ? 'Enviando…' : 'Enviar código'}</Button>
      </form>
    </Card>
  );
}
