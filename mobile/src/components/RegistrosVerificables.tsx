import { useCallback, useEffect, useState } from 'react';
import { Linking, Share, StyleSheet, Text, View } from 'react-native';
import { apiError } from '../api/client';
import { abrirArchivo } from '../archivos';
import { credentialService, type MisRegistros, type RegistroVerificable } from '../services';
import { colors } from '../theme';
import { Badge, Button, Card, EmptyState, Muted } from './ui';
import { useToast } from './feedback';

const ESTADO: Record<RegistroVerificable['status'], { label: string; color: string }> = {
  active: { label: 'Vigente', color: colors.green },
  suspended: { label: 'Suspendido', color: colors.amber },
  without_effect: { label: 'Sin efecto', color: colors.gray500 },
  revoked: { label: 'Revocado', color: colors.red },
};

const COLOR_TIPO: Record<RegistroVerificable['sourceType'], string> = {
  participation: '#0f766e',
  institution_certificate: '#1e3a8a',
  internal_constancy: '#6d28d9',
};

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' }) : null;

/**
 * V8 · Registros verificables en el teléfono.
 *
 * Lo mismo que en la web, pensado para compartir desde el bolsillo: el enlace
 * de verificación por WhatsApp o correo, el PDF con QR y la insignia que lleva
 * la firma adentro.
 */
export default function RegistrosVerificables() {
  const toast = useToast();
  const [datos, setDatos] = useState<MisRegistros | null>(null);
  const [cargando, setCargando] = useState(true);
  const [emitiendo, setEmitiendo] = useState(false);
  const [abriendo, setAbriendo] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setDatos(await credentialService.mine());
    } catch {
      setDatos(null);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const emitir = async () => {
    setEmitiendo(true);
    try {
      const r = await credentialService.issueMine();
      toast.success(r.issued === 1 ? 'Se firmó 1 registro.' : `Se firmaron ${r.issued} registros.`);
      await cargar();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setEmitiendo(false);
    }
  };

  const compartir = async (item: RegistroVerificable) => {
    try {
      await Share.share({
        message: `${item.achievementName}\nVerifícalo en: ${item.verifyUrl}\nCódigo: ${item.code}`,
      });
    } catch {
      // la persona cerró el diálogo
    }
  };

  const abrir = async (item: RegistroVerificable, formato: 'pdf' | 'png') => {
    setAbriendo(`${item.id}:${formato}`);
    try {
      await abrirArchivo(credentialService.downloadPath(item.id, formato), `registro-${item.code}.${formato}`);
    } catch (e) {
      toast.error((e as Error).message || apiError(e));
    } finally {
      setAbriendo(null);
    }
  };

  if (cargando) return null;
  if (!datos) return null;

  return (
    <Card title={`Registros verificables (${datos.items.length})`}>
      <Muted>
        Tu participación confirmada, firmada digitalmente. Quien la reciba puede comprobarla con el enlace o el QR, sin cuenta.
        No es un certificado académico.
      </Muted>

      {!datos.policy.enabled && (
        <Text style={styles.aviso}>Dirección todavía no habilitó la emisión. Lo ya emitido se sigue verificando.</Text>
      )}
      {datos.policy.enabled && datos.pending.length > 0 && (
        <View style={{ marginTop: 10 }}>
          <Button
            title={datos.pending.length === 1 ? 'Firmar 1 registro pendiente' : `Firmar ${datos.pending.length} registros pendientes`}
            icon="shield"
            loading={emitiendo}
            onPress={emitir}
          />
        </View>
      )}

      {datos.items.length === 0 ? (
        <EmptyState icon="award" message="Aún no tienes registros firmados." />
      ) : (
        datos.items.map((item) => {
          const est = ESTADO[item.status];
          return (
            <View key={item.id} style={styles.fila}>
              <View style={[styles.punto, { backgroundColor: COLOR_TIPO[item.sourceType] }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.titulo}>{item.achievementName}</Text>
                <Text style={styles.meta}>
                  {item.sourceLabel}{item.occurredAt ? ` · ${fecha(item.occurredAt)}` : ''}
                </Text>
                <View style={styles.lineaEstado}>
                  <Badge color={est.color}>{est.label}</Badge>
                  <Text style={styles.codigo} selectable>{item.code}</Text>
                </View>
                {item.status === 'revoked' && !!item.revocationReason && <Text style={styles.motivo}>Motivo: {item.revocationReason}</Text>}
                {item.status === 'suspended' && !!item.suspensionReason && <Text style={styles.motivo}>{item.suspensionReason}</Text>}
                <View style={styles.acciones}>
                  <Button small variant="secondary" icon="share-2" title="Compartir" onPress={() => compartir(item)} />
                  <Button small variant="secondary" icon="file-text" title="PDF" loading={abriendo === `${item.id}:pdf`} onPress={() => abrir(item, 'pdf')} />
                  <Button small variant="secondary" icon="award" title="Insignia" loading={abriendo === `${item.id}:png`} onPress={() => abrir(item, 'png')} />
                  <Button small variant="secondary" icon="external-link" title="Verificar" onPress={() => Linking.openURL(item.verifyUrl)} />
                  {item.status === 'active' && !!item.linkedInUrl && (
                    <Button small variant="secondary" icon="linkedin" title="LinkedIn" onPress={() => Linking.openURL(item.linkedInUrl!)} />
                  )}
                </View>
              </View>
            </View>
          );
        })
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  aviso: { marginTop: 10, color: colors.amber, fontSize: 13 },
  fila: { flexDirection: 'row', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  punto: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  titulo: { fontWeight: '700', color: colors.gray900, fontSize: 14 },
  meta: { color: colors.gray500, fontSize: 12, marginTop: 2 },
  lineaEstado: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  codigo: { fontFamily: 'monospace', fontWeight: '700', color: colors.gray700, fontSize: 13 },
  motivo: { color: colors.red, fontSize: 12, marginTop: 4 },
  acciones: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
});
