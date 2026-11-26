import { useEffect, useState } from 'react';
import { apiError } from '../api/client';
import { uploadService, validationReferenceService } from '../services';
import type { ValidationReference } from '../services/types';
import { FieldError } from './form';
import { Button, Modal } from './ui';
import { useToast } from './feedback';

const ORIGEN: Record<string, string> = {
  responsable: 'Con la oportunidad',
  direccion: 'Dirección',
  previo: 'Anterior al versionado',
};

/**
 * V7.1 D03 · «Adjuntar/actualizar certificado modelo» (solo Dirección).
 *
 * Sirve también con la oportunidad aprobada o finalizada. El modelo es
 * privado: solo se usa para comparar y nunca se entrega al estudiante. No
 * cambia ningún dato de la oportunidad ni reprocesa lo ya enviado; cada
 * cambio queda como una versión con su motivo.
 */
export default function ModeloDeReferencia({ activityId, titulo, onClose }: Readonly<{
  activityId: string;
  titulo: string;
  onClose: () => void;
}>) {
  const toast = useToast();
  const [ref, setRef] = useState<ValidationReference | null>(null);
  const [archivo, setArchivo] = useState<{ id: string; nombre: string } | null>(null);
  const [motivo, setMotivo] = useState('');
  const [errores, setErrores] = useState<{ archivo?: string; motivo?: string; general?: string }>({});
  const [subiendo, setSubiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    validationReferenceService.get(activityId).then(setRef).catch((e) => setErrores({ general: apiError(e) }));
  }, [activityId]);

  const subir = async (f: File | undefined) => {
    if (!f) return;
    setSubiendo(true);
    setErrores((x) => ({ ...x, archivo: undefined }));
    try {
      const s = await uploadService.upload(f);
      setArchivo({ id: s.id, nombre: s.originalFilename ?? f.name });
    } catch (e) {
      setErrores((x) => ({ ...x, archivo: apiError(e) }));
    } finally {
      setSubiendo(false);
    }
  };

  const guardar = async () => {
    const faltan: typeof errores = {};
    if (!archivo) faltan.archivo = 'Elige el archivo del certificado modelo.';
    if (motivo.trim().length < 10) faltan.motivo = 'Explica el motivo (al menos 10 caracteres).';
    setErrores(faltan);
    if (Object.keys(faltan).length) return;
    setGuardando(true);
    try {
      setRef(await validationReferenceService.updateModel(activityId, { storedFileId: archivo!.id, reason: motivo.trim() }));
      toast.success('Certificado modelo actualizado. Los envíos nuevos se comparan con él.');
      setArchivo(null);
      setMotivo('');
    } catch (e) {
      setErrores({ general: apiError(e) });
    } finally {
      setGuardando(false);
    }
  };

  const versiones = ref?.modelVersions ?? [];
  return (
    <Modal title="Certificado modelo" subtitle={titulo} onClose={onClose} width={620}>
      <p className="muted small" style={{ marginTop: 0 }}>
        El modelo es privado: solo sirve para comparar la credencial que envíe el estudiante y nunca se le entrega.
        Cambiarlo no modifica la oportunidad, no reabre nada y no vuelve a comprobar lo ya enviado.
      </p>
      <p data-testid="modelo-vigente">
        <strong>Vigente:</strong> {ref?.sampleFileName ?? 'sin modelo (las credenciales van directo a revisión manual)'}
      </p>
      {versiones.length > 0 && (
        <table className="table" data-testid="versiones-modelo">
          <thead><tr><th>Versión</th><th>Archivo</th><th>Origen</th><th>Motivo</th><th>Fecha</th></tr></thead>
          <tbody>
            {versiones.map((v) => (
              <tr key={v.version}>
                <td>{v.version}{v.current ? ' (vigente)' : ''}</td>
                <td>{v.fileName ?? '—'}</td>
                <td>{ORIGEN[v.origin] ?? v.origin}</td>
                <td>{v.reason ?? '—'}</td>
                <td>{new Date(v.createdAt).toLocaleDateString('es-BO')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className={`field ${errores.archivo ? 'has-error' : ''}`}>
        <label htmlFor="modelo-archivo">Nuevo certificado modelo (PDF o imagen)</label>
        <input id="modelo-archivo" type="file" accept="application/pdf,image/png,image/jpeg,image/webp"
          aria-invalid={!!errores.archivo} onChange={(e) => void subir(e.target.files?.[0])} />
        {archivo && <span className="field-hint">Listo: {archivo.nombre}</span>}
        <FieldError message={errores.archivo ?? null} />
      </div>
      <div className={`field ${errores.motivo ? 'has-error' : ''}`}>
        <label htmlFor="modelo-motivo">Motivo</label>
        <textarea id="modelo-motivo" value={motivo} maxLength={500} aria-invalid={!!errores.motivo}
          placeholder="Ej.: el docente entregó el modelo oficial después de la aprobación."
          onChange={(e) => { setMotivo(e.target.value); setErrores((x) => ({ ...x, motivo: undefined })); }} />
        <FieldError message={errores.motivo ?? null} />
      </div>
      <FieldError message={errores.general ?? null} />
      <div className="form-actions">
        <Button variant="secondary" onClick={onClose}>Cerrar</Button>
        <Button loading={guardando || subiendo} onClick={() => void guardar()}>Adjuntar modelo</Button>
      </div>
    </Modal>
  );
}
