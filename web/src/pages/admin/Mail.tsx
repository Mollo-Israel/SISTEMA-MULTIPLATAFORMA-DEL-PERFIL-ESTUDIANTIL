import { useState } from 'react';
import {
  FiAlertTriangle, FiCheckCircle, FiInfo, FiMail, FiRefreshCw, FiSend, FiServer, FiXCircle,
} from 'react-icons/fi';
import { apiError } from '../../api/client';
import { mailService } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { AsyncView, Badge, Button, Card, PageHeader, SkeletonCards } from '../../components/ui';
import { FormField } from '../../components/form';
import { useToast } from '../../components/feedback';
import type { MailStatus } from '../../services/types';

/**
 * Estado del correo y prueba de envío.
 *
 * Cierra el ciclo de configurarlo: se ponen las credenciales en `.env`, se
 * reinicia la API, y aquí se ve si conectó y se manda una prueba, sin tener
 * que crear una cuenta de estudiante para comprobarlo.
 */
export default function AdminMailPage() {
  const { data, loading, error, reload, setData } = useAsync(() => mailService.status(), []);
  const [destino, setDestino] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [comprobando, setComprobando] = useState(false);
  const toast = useToast();

  const probar = async () => {
    setEnviando(true);
    try {
      const r = await mailService.test(destino.trim() || undefined);
      if (r.transport === 'smtp') toast.success('Correo de prueba enviado', r.message);
      else toast.info('Modo simulado', r.message);
      reload();
    } catch (e) {
      toast.error('La prueba falló', apiError(e));
      reload();
    } finally {
      setEnviando(false);
    }
  };

  const comprobar = async () => {
    setComprobando(true);
    try {
      const estado = await mailService.verify();
      setData(estado);
      if (estado.connection === 'ok') toast.success('Conexión correcta', `Afinia puede enviar desde ${estado.from}.`);
      else if (estado.transport === 'console') toast.info('Modo simulado', 'No hay servidor de correo que comprobar.');
      else toast.error('No conecta', estado.lastError ?? 'Revise la configuración.');
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setComprobando(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Correo"
        description="Las invitaciones de activación y las recuperaciones de contraseña salen por aquí. Solo se envían a correos institucionales."
      />
      <AsyncView loading={loading} error={error} data={data} skeleton={<SkeletonCards count={2} />}>
        {(s) => (
          <>
            <EstadoCard s={s} onVerify={comprobar} verifying={comprobando} />

            <Card title="Enviar un correo de prueba">
              <p className="muted" style={{ marginTop: 0 }}>
                Es la forma más rápida de comprobar que las credenciales funcionan. La prueba puede ir
                a cualquier dirección —también a una personal—; las invitaciones, en cambio, solo
                salen a los dominios institucionales.
              </p>
              <div className="row" style={{ alignItems: 'flex-end' }}>
                <FormField
                  label="Enviar a"
                  hint="Vacío: se envía a su propio correo de administrador."
                >
                  <input
                    type="email"
                    value={destino}
                    onChange={(e) => setDestino(e.target.value)}
                    placeholder="tu.correo@est.univalle.edu"
                  />
                </FormField>
                <div className="field">
                  <Button onClick={probar} loading={enviando} icon={<FiSend size={15} />}>
                    Enviar prueba
                  </Button>
                </div>
              </div>
            </Card>

            <Card title="Cómo activar el correo real">
              <ol className="steps">
                <li>
                  Abra el archivo <code>.env</code> en la raíz del proyecto y rellene las variables
                  <code> SMTP_HOST</code>, <code>SMTP_PORT</code>, <code>SMTP_USER</code>,{' '}
                  <code>SMTP_PASSWORD</code> y <code>SMTP_FROM</code>. El archivo{' '}
                  <code>.env.example</code> trae los valores listos para Gmail, Outlook y Brevo.
                </li>
                <li>
                  Escriba en <code>WEB_APP_URL</code> la dirección donde la gente abre Afinia: es la
                  que va dentro del botón del correo.
                </li>
                <li>Reinicie la API. En su registro aparecerá «Correo REAL: conectado a …».</li>
                <li>
                  Vuelva a esta pantalla y pulse <strong>Enviar prueba</strong>. También puede probar
                  desde la terminal con <code>npm run mail:test -- su.correo@dominio.com</code>.
                </li>
              </ol>
              <p className="muted" style={{ fontSize: '0.8rem', marginBottom: 0 }}>
                La guía completa, con los pasos de cada proveedor y qué hacer si los correos llegan a
                «No deseado», está en <code>docs/CORREO_REAL.md</code>.
              </p>
            </Card>
          </>
        )}
      </AsyncView>
    </div>
  );
}

function EstadoCard({
  s,
  onVerify,
  verifying,
}: {
  s: MailStatus;
  onVerify: () => void;
  verifying: boolean;
}) {
  const real = s.transport === 'smtp';
  const conexion =
    s.connection === 'ok'
      ? { tono: 'green', icono: <FiCheckCircle />, texto: 'Conectado' }
      : s.connection === 'checking'
        ? { tono: 'amber', icono: <FiRefreshCw />, texto: 'Comprobando…' }
        : s.connection === 'error'
          ? { tono: 'red', icono: <FiXCircle />, texto: 'Sin conexión' }
          : { tono: 'gray', icono: <FiInfo />, texto: 'No aplica' };

  return (
    <Card
      title="Estado del envío"
      actions={
        real ? (
          <Button variant="secondary" size="sm" onClick={onVerify} loading={verifying} icon={<FiRefreshCw size={13} />}>
            Comprobar conexión
          </Button>
        ) : undefined
      }
    >
      {real ? (
        <div className={`notice ${s.connection === 'error' ? 'notice-warn' : 'notice-ok'}`}>
          <FiMail size={18} />
          <div>
            <strong>Correo real.</strong>{' '}
            {s.realDelivery
              ? 'Las invitaciones llegan a los buzones de los destinatarios.'
              : 'Conectado a un servidor de pruebas local: los correos no salen a internet.'}
          </div>
        </div>
      ) : (
        <div className="notice notice-warn">
          <FiAlertTriangle size={18} />
          <div>
            <strong>Correo simulado.</strong> No hay servidor de correo configurado: los mensajes se
            escriben en el registro de la API y en <code>api/.mail-outbox</code>, pero no llegan a
            ningún buzón. Por eso «no llega nada» al activar o recuperar.
          </div>
        </div>
      )}

      <dl className="kv">
        <dt>Modo</dt>
        <dd>{real ? 'SMTP' : 'Consola (simulado)'}</dd>
        {real && (
          <>
            <dt>Servidor</dt>
            <dd>
              <FiServer size={13} /> {s.host}:{s.port} · {s.secure ? 'TLS directo' : 'STARTTLS'}
            </dd>
            <dt>Cuenta</dt>
            <dd>{s.user ?? 'Sin autenticación'} {s.authType === 'oauth2' && <Badge tone="gray">OAuth2</Badge>}</dd>
            <dt>Conexión</dt>
            <dd>
              <Badge tone={conexion.tono}>
                {conexion.icono} {conexion.texto}
              </Badge>
            </dd>
          </>
        )}
        <dt>Remitente</dt>
        <dd>{s.from}</dd>
        <dt>Destinatarios permitidos</dt>
        <dd>{s.allowedDomains.length ? s.allowedDomains.map((d) => `@${d}`).join(' · ') : 'Sin restricción'}</dd>
      </dl>

      {s.lastError && (
        <div className="form-alert" style={{ marginTop: '0.8rem' }}>
          <FiXCircle size={15} /> <span>{s.lastError}</span>
        </div>
      )}
      {s.problems.map((p) => (
        <div key={p} className="form-alert" style={{ marginTop: '0.5rem' }}>
          <FiXCircle size={15} /> <span>{p}</span>
        </div>
      ))}
      {s.warnings.map((w) => (
        <div key={w} className="notice notice-warn" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
          <FiAlertTriangle size={16} /> <div>{w}</div>
        </div>
      ))}
    </Card>
  );
}
