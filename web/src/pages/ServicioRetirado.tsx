import { Link } from 'react-router-dom';

/**
 * V7.1 §7 · Afinia ya no emite ni verifica registros propios.
 *
 * Quien abre un enlace `/verificar` compartido antes ve este aviso neutro: no
 * confirma ni niega la vigencia de nada y no muestra datos de ninguna
 * persona. La trayectoria y las participaciones no cambian; los certificados
 * los emite y los verifica la institución o el proveedor que corresponda.
 */
export default function ServicioRetirado() {
  return (
    <main className="page" style={{ maxWidth: 640, margin: '3rem auto', padding: '0 1rem' }} data-testid="servicio-retirado">
      <h1 style={{ fontSize: '1.4rem' }}>Este servicio ya no está disponible</h1>
      <p>
        Afinia registra la trayectoria de los estudiantes y revisa sus evidencias, pero no emite ni verifica
        certificados. Para comprobar un certificado, consulta a la institución o al proveedor que lo emitió.
      </p>
      <p><Link to="/">Ir al inicio</Link></p>
    </main>
  );
}
