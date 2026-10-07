import { useEffect, useState } from 'react';
import { FiEye, FiEyeOff, FiLock, FiShield } from 'react-icons/fi';
import { apiError } from '../../api/client';
import { profileService } from '../../services';
import { useToast } from '../../components/feedback';
import { Badge, Card, Diferido, PageHeader, SkeletonCards } from '../../components/ui';
import { enMemoria, useCachedState } from '../../hooks/viewCache';
import {
  PUBLIC_FIELD_LABEL,
  type PublicProfileField,
  type VisibilitySettings,
} from '../../services/types';

const ORDEN: PublicProfileField[] = [
  'bio', 'areas', 'affinities', 'support_level', 'projects', 'skills', 'availability', 'trajectory',
];

/**
 * Privacidad del perfil compartible (§44).
 *
 * El estudiante decide qué se muestra, dentro de los límites del sistema. La
 * lista de campos es cerrada: lo que nunca es publicable —correo
 * institucional, archivos privados, identificadores internos— no aparece aquí
 * porque no hay forma de activarlo.
 */
export default function StudentPrivacyPage({ embedded = false }: { embedded?: boolean } = {}) {
  const toast = useToast();
  const [settings, setSettings] = useCachedState<VisibilitySettings | null>('visibilidad', null);
  const [loading, setLoading] = useState(() => !enMemoria('visibilidad'));
  const [guardando, setGuardando] = useState<string | null>(null);

  useEffect(() => {
    profileService
      .visibility()
      .then(setSettings)
      .catch((e) => toast.error(apiError(e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activarPerfil = async (valor: boolean) => {
    setGuardando('perfil');
    try {
      setSettings(await profileService.setVisibility({ publicProfileEnabled: valor }));
      toast.success(
        valor ? 'Perfil compartible activado.' : 'Perfil compartible desactivado.',
        valor
          ? 'Solo se verá lo que marques abajo.'
          : 'Nadie puede ver tu perfil compartible mientras esté desactivado.',
      );
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setGuardando(null);
    }
  };

  const cambiarCampo = async (field: PublicProfileField, valor: boolean) => {
    setGuardando(field);
    try {
      setSettings(await profileService.setVisibility({ fields: { [field]: valor } }));
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setGuardando(null);
    }
  };

  if (loading || !settings) {
    return (
      <div>
        {!embedded && <PageHeader title="Privacidad" description="Cargando tu configuración…" />}
        <Diferido><Card><SkeletonCards count={2} /></Card></Diferido>
      </div>
    );
  }

  const activos = ORDEN.filter((f) => settings.fields[f]).length;

  return (
    <div>
      {embedded ? (
        <p className="muted" style={{ marginTop: 0 }}>
          Tú decides qué se muestra de tu perfil cuando lo compartes. Nada se comparte si no lo activas.
        </p>
      ) : (
        <PageHeader
          title="Privacidad"
          description="Tú decides qué se muestra de tu perfil cuando lo compartes. Nada se comparte si no lo activas."
        />
      )}

      <Card
        title="Perfil compartible"
        actions={
          <Badge tone={settings.publicProfileEnabled ? 'green' : 'gray'}>
            {settings.publicProfileEnabled ? 'Activo' : 'Desactivado'}
          </Badge>
        }
      >
        <label className="priv-switch">
          <input
            type="checkbox"
            checked={settings.publicProfileEnabled}
            disabled={guardando === 'perfil'}
            onChange={(e) => activarPerfil(e.target.checked)}
          />
          <span className="track"><span className="thumb" /></span>
          <span>
            <strong>Permitir que mi perfil se vea al compartirlo</strong>
            <span className="muted">
              Mientras esté desactivado, ninguna de las opciones de abajo surte efecto.
            </span>
          </span>
        </label>
      </Card>

      <Card
        title="Qué se muestra"
        actions={<Badge tone={activos ? 'bordo' : 'gray'}>{activos} de {ORDEN.length}</Badge>}
      >
        <p className="muted" style={{ marginTop: 0 }}>
          Los cambios se guardan al momento. Tu nombre siempre aparece cuando el perfil
          compartible está activo: sin él, el perfil no identificaría a nadie.
        </p>

        <div className="priv-campos">
          {ORDEN.map((field) => {
            const on = settings.fields[field];
            return (
              <label
                key={field}
                className={`priv-campo ${on ? 'on' : ''} ${settings.publicProfileEnabled ? '' : 'apagado'}`}
              >
                <input
                  type="checkbox"
                  checked={on}
                  disabled={guardando === field}
                  onChange={(e) => cambiarCampo(field, e.target.checked)}
                />
                <span className="ic">{on ? <FiEye size={15} /> : <FiEyeOff size={15} />}</span>
                <span className="txt">{PUBLIC_FIELD_LABEL[field]}</span>
              </label>
            );
          })}
        </div>
      </Card>

      <Card title="Lo que nunca se comparte">
        <p className="muted" style={{ marginTop: 0 }}>
          Estos datos quedan fuera siempre, configures lo que configures. No hay opción para
          activarlos porque el sistema no la ofrece.
        </p>
        <ul className="priv-nunca">
          {settings.neverShared.map((item) => (
            <li key={item}>
              <span className="ic"><FiLock size={13} /></span> {item}
            </li>
          ))}
        </ul>
        <p className="muted" style={{ fontSize: '0.78rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <FiShield size={13} /> Docentes y dirección acceden a tu perfil por su alcance
          académico, no por esta configuración.
        </p>
      </Card>
    </div>
  );
}
