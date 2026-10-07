import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { apiError } from '../../api/client';
import { collaborationService } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { Badge, Button, Card, EmptyState, Field, Muted, SkeletonCards } from '../../components/ui';
import { useToast } from '../../components/feedback';
import { colors } from '../../theme';

const ESTADO: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendiente', color: colors.amber },
  accepted: { label: 'Aceptada', color: colors.green },
  rejected: { label: 'No aceptada', color: colors.gray500 },
  withdrawn: { label: 'Retirada', color: colors.gray500 },
};

/**
 * Necesidades abiertas para tu semestre y tus postulaciones (V3 §31, §55),
 * como en la web: postular con una presentación breve, retirar y ver la
 * respuesta con su motivo.
 */
export default function TeamNeedsSection() {
  const abiertas = useAsync(() => collaborationService.openNeeds(), []);
  const mias = useAsync(() => collaborationService.myApplications(), []);
  const [postulando, setPostulando] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const toast = useToast();
  const recargar = () => { abiertas.reload(); mias.reload(); };

  const postular = async (needId: string) => {
    setOcupado(needId);
    try {
      await collaborationService.applyToNeed(needId, mensaje.trim());
      toast.success('Postulación enviada.', 'Te avisaremos cuando el responsable responda.');
      setPostulando(null);
      setMensaje('');
      recargar();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setOcupado(null);
    }
  };
  const retirar = async (id: string) => {
    setOcupado(id);
    try {
      await collaborationService.withdrawApplication(id);
      toast.success('Postulación retirada.');
      recargar();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setOcupado(null);
    }
  };

  const necesidades = (abiertas.data ?? []).filter((n: any) => !n.isOwner);
  return (
    <>
      <Card title="Necesidades abiertas para ti">
        {abiertas.loading && !abiertas.data && <SkeletonCards count={2} />}
        {abiertas.data && necesidades.length === 0 && <EmptyState icon="users" message="Por ahora no hay necesidades abiertas para tu semestre." />}
        {necesidades.map((n: any) => {
          const mia = n.myApplication;
          return (
            <View key={n.id} style={styles.item}>
              <Text style={styles.titulo}>{n.purpose}</Text>
              <Muted>
                {n.owner?.name} · {(n.targetSemesters ?? []).length ? `Semestres ${n.targetSemesters.join(', ')}` : 'Cualquier semestre'} · {n.openings ?? 0} cupo(s)
              </Muted>
              {(n.requiredSkills ?? []).length > 0 && <Muted>Busca: {n.requiredSkills.map((s: any) => s.name).join(', ')}</Muted>}
              <View style={styles.fila}>
                {mia && <Badge color={ESTADO[mia.status]?.color}>{ESTADO[mia.status]?.label}</Badge>}
                {n.isMember ? <Muted>Ya formas parte de este equipo.</Muted> : null}
              </View>
              {!n.isMember && mia?.status === 'pending' && (
                <Button small variant="secondary" icon="x" title="Retirar postulación" loading={ocupado === mia.id} onPress={() => retirar(mia.id)} />
              )}
              {!n.isMember && (!mia || mia.status === 'withdrawn') && (postulando === n.id ? (
                <View style={{ marginTop: 8 }}>
                  <Field label="Preséntate en una o dos líneas (opcional)" value={mensaje} onChangeText={(t) => setMensaje(t.slice(0, 300))} multiline />
                  <View style={styles.fila}>
                    <Button small icon="send" title="Enviar postulación" loading={ocupado === n.id} onPress={() => postular(n.id)} />
                    <Button small variant="secondary" title="Cancelar" onPress={() => setPostulando(null)} />
                  </View>
                </View>
              ) : (
                <Button small icon="user-plus" title="Postular" disabled={(n.openings ?? 0) === 0} onPress={() => { setPostulando(n.id); setMensaje(''); }} />
              ))}
            </View>
          );
        })}
      </Card>
      {(mias.data ?? []).length > 0 && (
        <Card title="Mis postulaciones">
          {(mias.data ?? []).map((p: any) => (
            <View key={p.id} style={styles.item}>
              <Text style={styles.titulo}>{p.need?.purpose}</Text>
              <View style={styles.fila}>
                <Badge color={ESTADO[p.status]?.color}>{ESTADO[p.status]?.label}</Badge>
              </View>
              {p.status === 'rejected' && <Muted>{p.rejectionReasonLabel}{p.rejectionComment ? `: ${p.rejectionComment}` : ''}</Muted>}
            </View>
          ))}
        </Card>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  item: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  titulo: { fontWeight: '700', color: colors.gray900, marginBottom: 2 },
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 6, alignItems: 'center' },
});
