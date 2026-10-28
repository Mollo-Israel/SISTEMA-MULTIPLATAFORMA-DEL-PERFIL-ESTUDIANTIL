import { useCallback, useEffect, useState } from 'react';
import { FiArrowLeft, FiArrowRight, FiImage, FiStar, FiTrash2 } from 'react-icons/fi';
import { apiError } from '../api/client';
import { projectService, uploadService } from '../services';
import type { ProjectImageView } from '../services';
import { ImagenProtegida } from './ArchivoProtegido';
import { useConfirm, useToast } from './feedback';

const MAX = 5;

/**
 * Imágenes de muestra de un proyecto (V5 §13.4): de 0 a 5, una de portada.
 *
 * No son evidencias: las evidencias respaldan y son privadas por defecto; esto
 * es lo que el estudiante elige enseñar, y solo se ve donde el proyecto ya se
 * ve (comunidad, docentes, enlace público con sesión).
 */
export default function ProjectImages({ projectId, editable }: { projectId: string; editable: boolean }) {
  const [imagenes, setImagenes] = useState<ProjectImageView[] | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();

  const cargar = useCallback(() => {
    projectService.images(projectId).then(setImagenes).catch(() => setImagenes([]));
  }, [projectId]);
  useEffect(() => { cargar(); }, [cargar]);

  const accion = async (fn: () => Promise<ProjectImageView[]>, ok?: string) => {
    setOcupado(true);
    try {
      setImagenes(await fn());
      if (ok) toast.success(ok);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setOcupado(false);
    }
  };

  const subir = async (archivo: File) => {
    if (!/^image\/(png|jpeg|webp)$/.test(archivo.type)) {
      toast.error('Solo PNG, JPG o WEBP.');
      return;
    }
    await accion(async () => {
      const subido = await uploadService.upload(archivo);
      return projectService.addImage(projectId, subido.id);
    }, 'Imagen agregada.');
  };

  const quitar = async (i: ProjectImageView) => {
    const ok = await confirm({
      title: 'Quitar la imagen',
      message: i.isCover ? 'Es la portada: pasará a serlo la siguiente.' : 'Deja de mostrarse en el proyecto.',
      confirmLabel: 'Quitar',
      tone: 'danger',
    });
    if (ok) await accion(() => projectService.removeImage(projectId, i.id), 'Imagen quitada.');
  };

  if (imagenes === null) return null;
  if (!editable && imagenes.length === 0) return null;

  return (
    <div className="project-images" data-testid="imagenes-proyecto">
      <div className="flex" style={{ gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <strong className="small">Imágenes del proyecto ({imagenes.length}/{MAX})</strong>
        {editable && <span className="muted small">Capturas para mostrar el proyecto. No son evidencias y solo se ven donde el proyecto se ve.</span>}
      </div>
      {imagenes.length > 0 && (
        <ul className="project-images-grid">
          {imagenes.map((i, n) => (
            <li key={i.id} className={i.isCover ? 'is-cover' : undefined}>
              <ImagenProtegida src={i.url} alt={i.isCover ? 'Portada del proyecto' : `Imagen ${n + 1}`} loading="lazy" fallback={<FiImage size={22} />} />
              {i.isCover && <span className="badge badge-bordo project-images-cover">Portada</span>}
              {editable && (
                <div className="project-images-actions">
                  {!i.isCover && (
                    <button type="button" className="icon-button" title="Usar como portada" aria-label="Usar como portada" disabled={ocupado}
                      onClick={() => void accion(() => projectService.updateImage(projectId, i.id, { isCover: true }), 'Portada actualizada.')}>
                      <FiStar size={14} />
                    </button>
                  )}
                  {n > 0 && (
                    <button type="button" className="icon-button" title="Mover a la izquierda" aria-label="Mover a la izquierda" disabled={ocupado}
                      onClick={() => void accion(() => projectService.updateImage(projectId, i.id, { position: n - 1 }))}>
                      <FiArrowLeft size={14} />
                    </button>
                  )}
                  {n < imagenes.length - 1 && (
                    <button type="button" className="icon-button" title="Mover a la derecha" aria-label="Mover a la derecha" disabled={ocupado}
                      onClick={() => void accion(() => projectService.updateImage(projectId, i.id, { position: n + 1 }))}>
                      <FiArrowRight size={14} />
                    </button>
                  )}
                  <button type="button" className="icon-button" title="Quitar" aria-label="Quitar imagen" disabled={ocupado} onClick={() => void quitar(i)}>
                    <FiTrash2 size={14} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {editable && imagenes.length < MAX && (
        <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
          <FiImage size={14} /> Agregar imagen
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            aria-label="Agregar imagen del proyecto"
            disabled={ocupado}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void subir(f);
            }}
          />
        </label>
      )}
      {editable && imagenes.length >= MAX && <span className="muted small">Llegaste a {MAX}: quita una para agregar otra.</span>}
    </div>
  );
}
