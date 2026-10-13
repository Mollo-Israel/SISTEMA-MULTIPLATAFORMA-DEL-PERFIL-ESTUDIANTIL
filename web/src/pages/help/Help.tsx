import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiHelpCircle, FiPlayCircle, FiRefreshCw } from 'react-icons/fi';
import { useAuth } from '../../auth/AuthContext';
import { helpService } from '../../services';
import { HELP, TEMA_LABEL, TUTORIAL, type HelpEntry, type HelpTema } from '../../help/content';
import { openTutorial } from '../../components/Tutorial';
import { Button, Card, PageHeader } from '../../components/ui';

/**
 * Centro de ayuda (V2 §65): preguntas frecuentes del actor, los pasos del
 * tutorial (que se puede volver a ver) y el video explicativo si la
 * institución configuró `HELP_VIDEO_URL`. V3.2 §61: las preguntas se agrupan
 * por tema (cuenta, perfil, actividades, proyectos, evidencias, afinidad,
 * currículo, privacidad) y pueden traer una ilustración.
 */
export default function HelpPage() {
  const { user } = useAuth();
  const [video, setVideo] = useState<{ url: string; embedUrl: string | null } | null>(null);
  const rol = user?.role ?? '';
  const porTema = (HELP[rol] ?? []).reduce<Partial<Record<HelpTema, HelpEntry[]>>>((acc, t) => {
    (acc[t.tema] ??= []).push(t);
    return acc;
  }, {});
  const temas = (Object.keys(TEMA_LABEL) as HelpTema[]).filter((t) => porTema[t]?.length);

  useEffect(() => {
    helpService.get().then((r) => setVideo(r.video)).catch(() => setVideo(null));
  }, []);

  return (
    <div>
      <PageHeader
        title="Ayuda"
        description="Respuestas cortas a lo que más se pregunta, y el recorrido por lo que puedes hacer."
      />
      <div style={{ marginBottom: '1rem' }}>
        <Button variant="secondary" icon={<FiRefreshCw size={14} />} onClick={openTutorial}>
          Ver el tutorial otra vez
        </Button>
      </div>

      {video && (
        <Card title="Video explicativo">
          {video.embedUrl ? (
            <div className="help-video">
              <iframe
                src={video.embedUrl}
                title="Video explicativo de Afinia"
                loading="lazy"
                allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
          ) : (
            <a className="btn btn-secondary" href={video.url} target="_blank" rel="noopener noreferrer">
              <FiPlayCircle size={15} /> Abrir el video
            </a>
          )}
        </Card>
      )}

      <Card title="Preguntas frecuentes">
        {temas.map((tema) => (
          <section key={tema} className="help-tema" aria-labelledby={`ayuda-${tema}`}>
            <h3 id={`ayuda-${tema}`}>{TEMA_LABEL[tema]}</h3>
            {porTema[tema]!.map((t) => (
              <details key={t.question} className="help-topic">
                <summary><FiHelpCircle size={14} /> {t.question}</summary>
                <p>{t.answer}</p>
                {t.image && (
                  <img className="help-image" src={t.image.src} alt={t.image.alt} loading="lazy" />
                )}
                {t.to && <Link to={t.to} className="link-button">Ir a la pantalla</Link>}
              </details>
            ))}
          </section>
        ))}
      </Card>

      <Card title="Lo que puedes hacer">
        <ol className="help-steps">
          {(TUTORIAL[rol] ?? []).map((p) => (
            <li key={p.title}>
              <strong>{p.title}.</strong> {p.text}{' '}
              {p.to && <Link to={p.to} className="link-button">Abrir</Link>}
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
