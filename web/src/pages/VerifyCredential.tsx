import { useCallback, useEffect, useRef, useState } from 'react';
import type { DragEvent, FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FiCode, FiFileText, FiHash, FiList, FiSearch, FiShield, FiUploadCloud } from 'react-icons/fi';
import { apiError } from '../api/client';
import { Button, Card, Tabs } from '../components/ui';
import InformeVerificacion from '../components/InformeVerificacion';
import { publicCredentialService } from '../services/credentials';
import type { BatchResult, VerificationReport } from '../services/credentials';

type Modo = 'codigo' | 'archivo' | 'credencial' | 'lote';

const RESULTADO_LOTE: Record<string, string> = {
  valid: 'Vigente', revoked: 'Revocado', suspended: 'Suspendido', without_effect: 'Sin efecto', not_found: 'No encontrado', invalid: 'No válido',
};

/**
 * Verificador público de registros (V8). Sin sesión, a propósito: lo usa
 * quien recibe un registro (una empresa, otra universidad) y no tiene cuenta.
 *
 * Cuatro formas de verificar, de la más simple a la más técnica: el código,
 * el archivo que le pasaron (PDF, insignia o JSON), la credencial pegada y
 * varios códigos de una vez.
 */
export default function VerifyCredentialPage() {
  const { code: codigoRuta } = useParams();
  const navigate = useNavigate();
  const [modo, setModo] = useState<Modo>('codigo');
  const [codigo, setCodigo] = useState(codigoRuta ?? '');
  const [texto, setTexto] = useState('');
  const [lote, setLote] = useState('');
  const [arrastrando, setArrastrando] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [informe, setInforme] = useState<VerificationReport | null>(null);
  const [resultadoLote, setResultadoLote] = useState<BatchResult | null>(null);
  const entradaArchivo = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    document.title = 'Verificar un registro · Afinia';
  }, []);

  const ejecutar = useCallback(async (fn: () => Promise<void>) => {
    setCargando(true);
    setError(null);
    setInforme(null);
    setResultadoLote(null);
    try {
      await fn();
    } catch (e) {
      setError(apiError(e, 'No se pudo verificar. Intente de nuevo en un momento.'));
    } finally {
      setCargando(false);
    }
  }, []);

  const verificarCodigo = useCallback((c: string) => ejecutar(async () => {
    setInforme(await publicCredentialService.byCode(c.trim()));
  }), [ejecutar]);

  useEffect(() => {
    if (codigoRuta) {
      setCodigo(codigoRuta);
      verificarCodigo(codigoRuta);
    }
  }, [codigoRuta, verificarCodigo]);

  const enviarCodigo = (e: FormEvent) => {
    e.preventDefault();
    if (!codigo.trim()) return;
    // La dirección refleja el código: se puede compartir o recargar.
    navigate(`/verificar/${encodeURIComponent(codigo.trim().toUpperCase())}`, { replace: !!codigoRuta });
    if (codigoRuta?.toUpperCase() === codigo.trim().toUpperCase()) verificarCodigo(codigo);
  };

  const verificarArchivo = (f: File | undefined) => {
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      setError('El archivo supera los 10 MB.');
      return;
    }
    ejecutar(async () => setInforme(await publicCredentialService.file(f)));
  };

  const soltar = (e: DragEvent) => {
    e.preventDefault();
    setArrastrando(false);
    verificarArchivo(e.dataTransfer.files?.[0]);
  };

  const verificarTexto = (e: FormEvent) => {
    e.preventDefault();
    const t = texto.trim();
    if (!t) return;
    let valor: unknown = t;
    if (t.startsWith('{')) {
      try {
        valor = JSON.parse(t);
      } catch {
        setError('El JSON pegado no es válido: revise que esté completo.');
        return;
      }
    }
    ejecutar(async () => setInforme(await publicCredentialService.presented(valor)));
  };

  const verificarLote = (e: FormEvent) => {
    e.preventDefault();
    const codigos = lote.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
    if (!codigos.length) return;
    if (codigos.length > 25) {
      setError('Como máximo 25 códigos por vez.');
      return;
    }
    ejecutar(async () => setResultadoLote(await publicCredentialService.batch(codigos)));
  };

  return (
    <div className="vc-page">
      <div className="vc-marca"><FiShield /> <Link to="/">AFINIA</Link></div>
      <div className="vc-hero">
        <h1>Verificar un registro</h1>
        <p className="muted">
          Compruebe si un registro de participación o un certificado entregado por medio de Afinia es auténtico, está
          íntegro y sigue vigente. No necesita una cuenta. También verifica insignias Open Badges de otros emisores.
        </p>
      </div>

      <Card>
        <Tabs
          items={[
            { key: 'codigo', label: <><FiHash /> Código</> },
            { key: 'archivo', label: <><FiFileText /> Archivo</> },
            { key: 'credencial', label: <><FiCode /> Credencial</> },
            { key: 'lote', label: <><FiList /> Varios códigos</> },
          ]}
          value={modo}
          onChange={(k) => { setModo(k as Modo); setError(null); }}
        />

        {modo === 'codigo' && (
          <form className="vc-codigo-form" onSubmit={enviarCodigo}>
            <input
              aria-label="Código de verificación"
              placeholder="AF-XXXX-XXXX-XXXXX"
              value={codigo}
              maxLength={40}
              onChange={(e) => setCodigo(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            <Button type="submit" loading={cargando} icon={<FiSearch />}>Verificar</Button>
            <p className="muted small" style={{ flexBasis: '100%', margin: 0 }}>
              Está impreso en el PDF, debajo del QR, y en la insignia. El último carácter es de control: un error de tipeo se detecta enseguida.
            </p>
          </form>
        )}

        {modo === 'archivo' && (
          <div
            className={`vc-drop ${arrastrando ? 'activo' : ''}`}
            onClick={() => entradaArchivo.current?.click()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') entradaArchivo.current?.click(); }}
            onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={soltar}
            role="button"
            tabIndex={0}
            aria-label="Elegir un archivo para verificar"
          >
            <input
              ref={entradaArchivo}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.svg,.json,.jwt,application/pdf,image/png,image/jpeg,image/svg+xml,application/json"
              onChange={(e) => { verificarArchivo(e.target.files?.[0]); e.target.value = ''; }}
            />
            <FiUploadCloud size={30} />
            <p style={{ margin: '0.4rem 0 0.2rem', fontWeight: 600 }}>{cargando ? 'Verificando…' : 'Arrastre el archivo aquí o haga clic para elegirlo'}</p>
            <p className="muted small" style={{ margin: 0 }}>
              PDF de Afinia (se detecta cualquier edición), insignia PNG o SVG, JSON de Open Badges, una imagen con el QR o el
              certificado que entregó la institución (se reconoce por su huella). Máximo 10 MB. El archivo no se guarda.
            </p>
          </div>
        )}

        {modo === 'credencial' && (
          <form onSubmit={verificarTexto}>
            <textarea
              aria-label="Credencial a verificar"
              rows={7}
              className="vc-mono"
              placeholder='Pegue el JSON de Open Badges 3.0 o 2.0, un VC-JWT (eyJ…) o la URL de verificación'
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              spellCheck={false}
              style={{ width: '100%', fontSize: '0.8rem' }}
            />
            <div className="flex mt" style={{ justifyContent: 'flex-end' }}>
              <Button type="submit" loading={cargando} icon={<FiShield />}>Verificar firma</Button>
            </div>
          </form>
        )}

        {modo === 'lote' && (
          <form onSubmit={verificarLote}>
            <textarea
              aria-label="Códigos a verificar"
              rows={5}
              className="vc-mono"
              placeholder={'Un código por línea (hasta 25)\nAF-XXXX-XXXX-XXXXX'}
              value={lote}
              onChange={(e) => setLote(e.target.value)}
              spellCheck={false}
              style={{ width: '100%' }}
            />
            <div className="flex mt" style={{ justifyContent: 'flex-end' }}>
              <Button type="submit" loading={cargando} icon={<FiList />}>Verificar todos</Button>
            </div>
          </form>
        )}
      </Card>

      {error && <div className="vc-resultado vc-mal" role="alert"><p>{error}</p></div>}
      {informe && <InformeVerificacion r={informe} />}

      {resultadoLote && (
        <Card title={`${resultadoLote.summary.valid} de ${resultadoLote.summary.total} vigentes`}>
          <div className="table-scroll">
            <table className="vc-lote">
              <thead><tr><th>Código</th><th>Resultado</th><th>Titular</th><th>Logro</th></tr></thead>
              <tbody>
                {resultadoLote.results.map((x) => (
                  <tr key={x.input}>
                    <td className="vc-mono">{x.code ? <Link to={`/verificar/${x.code}`}>{x.code}</Link> : x.input}</td>
                    <td><span className={`badge badge-${x.outcome === 'valid' ? 'green' : x.outcome === 'not_found' ? 'gray' : 'red'}`}>{RESULTADO_LOTE[x.outcome] ?? x.title}</span></td>
                    <td>{x.holderName ?? '—'}</td>
                    <td>{x.achievementName ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <p className="muted small" style={{ textAlign: 'center' }}>
        Afinia firma registros de lo que el sistema registró (participaciones confirmadas y entregas de certificados).
        No emite títulos ni certificados académicos. Firma Ed25519 · Open Badges 3.0 y 2.0 · W3C Bitstring Status List.
      </p>
    </div>
  );
}
