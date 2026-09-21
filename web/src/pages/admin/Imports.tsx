import { useMemo, useRef, useState } from 'react';
import {
  FiAlertTriangle, FiCheckCircle, FiDownload, FiFileText, FiMinusCircle, FiPlusCircle,
  FiRefreshCw, FiTrash2, FiUploadCloud, FiXCircle,
} from 'react-icons/fi';
import { apiError } from '../../api/client';
import { importsService } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import {
  AsyncView, Badge, Button, Card, EmptyState, Modal, PageHeader, ResultCount, SkeletonTable,
} from '../../components/ui';
import { useConfirm, useToast } from '../../components/feedback';
import type {
  ImportBatchDetail, ImportPreview, ImportRow, ImportRowStatus,
} from '../../services/types';

/** Columnas mínimas que exige el servidor (§10). */
const PLANTILLA = 'university_code,first_name,last_name,institutional_email,semester';

const EJEMPLO = [
  PLANTILLA,
  '202100123,Ana,Rojas Vargas,ana.rojas@est.univalle.edu,5',
  '202100124,Luis,Mamani Quispe,luis.mamani@est.univalle.edu,3',
].join('\n');

const VERDICTO: Record<ImportRowStatus, { label: string; tone: string; icon: JSX.Element; help: string }> = {
  NEW: {
    label: 'Nueva',
    tone: 'green',
    icon: <FiPlusCircle />,
    help: 'Se creará la cuenta en estado pendiente y recibirá su enlace de activación.',
  },
  UPDATE: {
    label: 'Actualiza',
    tone: 'bordo',
    icon: <FiRefreshCw />,
    help: 'La cuenta ya existe: solo se corregirán sus datos institucionales.',
  },
  UNCHANGED: {
    label: 'Sin cambios',
    tone: 'gray',
    icon: <FiMinusCircle />,
    help: 'Los datos del archivo coinciden con los del sistema. No se tocará nada.',
  },
  CONFLICT: {
    label: 'Conflicto',
    tone: 'amber',
    icon: <FiAlertTriangle />,
    help: 'El código y el correo apuntan a personas distintas, o se repiten dentro del archivo.',
  },
  INVALID: {
    label: 'Inválida',
    tone: 'red',
    icon: <FiXCircle />,
    help: 'La fila no cumple el formato exigido y se descarta.',
  },
};

const ORDEN: ImportRowStatus[] = ['NEW', 'UPDATE', 'UNCHANGED', 'CONFLICT', 'INVALID'];

const ESTADO_LOTE: Record<string, { label: string; tone: string }> = {
  PREVIEWED: { label: 'Previsualizado', tone: 'amber' },
  APPLIED: { label: 'Aplicado', tone: 'green' },
  DISCARDED: { label: 'Descartado', tone: 'gray' },
};

/**
 * Importación de padrón institucional (§10).
 *
 * Son dos pasos separados a propósito: primero se ve exactamente qué va a
 * pasar con cada fila y después se confirma. Nunca una subida que escribe sin
 * que nadie haya revisado el resultado.
 */
export default function AdminImportsPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [filename, setFilename] = useState('');
  const [uploading, setUploading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [filtro, setFiltro] = useState<ImportRowStatus | 'ALL'>('ALL');
  const [detalle, setDetalle] = useState<ImportBatchDetail | null>(null);

  const historial = useAsync(() => importsService.list(), []);

  const subir = async (file: File) => {
    setUploading(true);
    setPreview(null);
    try {
      const result = await importsService.preview(file);
      setPreview(result);
      setFilename(file.name);
      setFiltro('ALL');
      toast.success(
        'Archivo analizado.',
        `${result.totalRows} fila(s) leída(s). Revisa el resultado antes de aplicarlo.`,
      );
      historial.reload();
    } catch (e) {
      toast.error(apiError(e, 'No se pudo analizar el archivo.'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const aplicar = async () => {
    if (!preview) return;
    const nuevas = preview.counts.NEW ?? 0;
    const actualiza = preview.counts.UPDATE ?? 0;
    const ok = await confirm({
      title: 'Aplicar la importación',
      message:
        `Se crearán ${nuevas} cuenta(s) y se actualizarán ${actualiza}. `
        + 'Las cuentas nuevas recibirán su enlace de activación. '
        + 'Nadie se desactiva por no aparecer en el archivo.',
      confirmLabel: 'Aplicar ahora',
    });
    if (!ok) return;

    setApplying(true);
    try {
      const res = await importsService.apply(preview.batchId);
      toast.success('Importación aplicada.', res.message);
      setPreview(null);
      setFilename('');
      historial.reload();
    } catch (e) {
      toast.error(apiError(e, 'No se pudo aplicar la importación.'));
    } finally {
      setApplying(false);
    }
  };

  const descartar = async () => {
    if (!preview) return;
    const ok = await confirm({
      title: 'Descartar la previsualización',
      message: 'El archivo no se aplicará y tendrás que subirlo otra vez si cambias de opinión.',
      confirmLabel: 'Descartar',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await importsService.discard(preview.batchId);
      setPreview(null);
      setFilename('');
      toast.success('Previsualización descartada.');
      historial.reload();
    } catch (e) {
      toast.error(apiError(e, 'No se pudo descartar.'));
    }
  };

  const verDetalle = async (batchId: string) => {
    try {
      setDetalle(await importsService.detail(batchId));
    } catch (e) {
      toast.error(apiError(e, 'No se pudo abrir el lote.'));
    }
  };

  const descargarPlantilla = () => {
    // BOM para que Excel abra el archivo en UTF-8 sin romper las tildes.
    const blob = new Blob([`﻿${EJEMPLO}\n`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla-padron-afinia.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const filas = useMemo(() => {
    if (!preview) return [];
    return filtro === 'ALL' ? preview.rows : preview.rows.filter((r) => r.status === filtro);
  }, [preview, filtro]);

  const aplicables = preview ? (preview.counts.NEW ?? 0) + (preview.counts.UPDATE ?? 0) : 0;

  return (
    <div>
      <PageHeader
        title="Importar padrón"
        description="Alta masiva de estudiantes desde el padrón institucional. Primero se previsualiza fila por fila y solo después se aplica."
      />

      <Card
        title="Subir archivo CSV"
        actions={
          <Button variant="ghost" size="sm" onClick={descargarPlantilla} icon={<FiDownload size={14} />}>
            Descargar plantilla
          </Button>
        }
      >
        <p className="muted" style={{ marginTop: 0 }}>
          El archivo debe tener estas columnas en la primera fila:{' '}
          <code>{PLANTILLA}</code>
        </p>

        <label className="import-drop">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) subir(file);
            }}
          />
          <span className="ic"><FiUploadCloud size={26} /></span>
          <strong>{uploading ? 'Analizando el archivo…' : 'Elige un archivo CSV'}</strong>
          <span className="muted">Máximo 5 MB. Nada se escribe hasta que confirmes.</span>
        </label>

        <ul className="import-notas">
          <li>Las cuentas nuevas nacen pendientes de activación: su titular define la contraseña.</li>
          <li>Una cuenta que no aparezca en el archivo <strong>no</strong> se desactiva.</li>
          <li>Aplicar dos veces el mismo lote no duplica nada.</li>
        </ul>
      </Card>

      {preview && (
        <Card
          title={`Previsualización · ${filename}`}
          actions={
            <div className="flex" style={{ gap: '0.4rem' }}>
              <Button variant="ghost" size="sm" onClick={descartar} icon={<FiTrash2 size={14} />}>
                Descartar
              </Button>
              <Button
                size="sm"
                onClick={aplicar}
                loading={applying}
                disabled={aplicables === 0}
                icon={<FiCheckCircle size={15} />}
              >
                Aplicar ({aplicables})
              </Button>
            </div>
          }
        >
          <div className="import-counts">
            <button
              type="button"
              className={`import-count ${filtro === 'ALL' ? 'on' : ''}`}
              onClick={() => setFiltro('ALL')}
            >
              <span className="n">{preview.totalRows}</span>
              <span className="l">Todas</span>
            </button>
            {ORDEN.map((s) => (
              <button
                type="button"
                key={s}
                className={`import-count t-${VERDICTO[s].tone} ${filtro === s ? 'on' : ''}`}
                onClick={() => setFiltro(filtro === s ? 'ALL' : s)}
                title={VERDICTO[s].help}
              >
                <span className="n">{preview.counts[s] ?? 0}</span>
                <span className="l">{VERDICTO[s].icon} {VERDICTO[s].label}</span>
              </button>
            ))}
          </div>

          {aplicables === 0 && (
            <p className="muted" style={{ marginTop: '0.4rem' }}>
              Ninguna fila introduce cambios, así que no hay nada que aplicar.
            </p>
          )}

          <div style={{ margin: '0.7rem 0 0.4rem' }}>
            <ResultCount shown={filas.length} total={preview.totalRows} noun="filas" />
          </div>

          {filas.length === 0 ? (
            <EmptyState
              icon={<FiFileText size={22} />}
              message="Ninguna fila con ese veredicto."
              action={
                <Button variant="secondary" size="sm" onClick={() => setFiltro('ALL')}>
                  Ver todas
                </Button>
              }
            />
          ) : (
            <TablaFilas rows={filas} />
          )}
        </Card>
      )}

      <Card
        title="Historial de importaciones"
        actions={
          <Button variant="ghost" size="sm" onClick={historial.reload} icon={<FiRefreshCw size={14} />}>
            Actualizar
          </Button>
        }
      >
        <AsyncView
          loading={historial.loading}
          error={historial.error}
          data={historial.data}
          skeleton={<SkeletonTable rows={4} columns={6} />}
          isEmpty={(d) => d.length === 0}
          emptyMessage="Todavía no se ha importado ningún padrón."
        >
          {(lotes) => (
            <table>
              <thead>
                <tr>
                  <th>Archivo</th>
                  <th>Estado</th>
                  <th>Filas</th>
                  <th>Nuevas / Actualiza</th>
                  <th>Importado por</th>
                  <th>Fecha</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lotes.map((b) => (
                  <tr key={b.id}>
                    <td>{b.filename}</td>
                    <td>
                      <Badge tone={ESTADO_LOTE[b.status]?.tone ?? 'gray'}>
                        {ESTADO_LOTE[b.status]?.label ?? b.status}
                      </Badge>
                    </td>
                    <td>{b.totalRows}</td>
                    <td>
                      {b.counts?.NEW ?? 0} / {b.counts?.UPDATE ?? 0}
                    </td>
                    <td className="muted">{b.importedBy ?? '—'}</td>
                    <td className="muted">
                      {new Date(b.appliedAt ?? b.createdAt).toLocaleString('es-BO')}
                    </td>
                    <td>
                      <Button variant="secondary" size="sm" onClick={() => verDetalle(b.id)}>
                        Ver filas
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </AsyncView>
      </Card>

      {detalle && (
        <Modal
          title={detalle.filename}
          subtitle={`${ESTADO_LOTE[detalle.status]?.label ?? detalle.status} · ${detalle.totalRows} fila(s)`}
          onClose={() => setDetalle(null)}
          width={980}
        >
          <TablaFilas rows={detalle.rows} />
        </Modal>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function TablaFilas({ rows }: { rows: ImportRow[] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Código</th>
            <th>Nombre</th>
            <th>Correo institucional</th>
            <th>Sem.</th>
            <th>Veredicto</th>
            <th>Observación</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.rowNumber}>
              <td className="muted">{r.rowNumber}</td>
              <td>{r.universityCode ?? '—'}</td>
              <td>{[r.firstName, r.lastName].filter(Boolean).join(' ') || '—'}</td>
              <td className="muted">{r.institutionalEmail ?? '—'}</td>
              <td>{r.semester ?? '—'}</td>
              <td>
                <Badge tone={VERDICTO[r.status]?.tone ?? 'gray'}>
                  {VERDICTO[r.status]?.label ?? r.status}
                </Badge>
              </td>
              <td className="muted" style={{ maxWidth: 320 }}>{r.message ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
