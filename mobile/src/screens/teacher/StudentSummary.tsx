import { useState } from 'react';
import { Text, View } from 'react-native';
import { apiError } from '../../api/client';
import { affinityService, profileService } from '../../services';
import { Screen, Card, H1, Muted, Field, Button, ErrorText, Badge } from '../../components/ui';
import { affinityColor } from '../../theme';

export default function StudentSummary() {
  const [profileId, setProfileId] = useState('');
  const [view, setView] = useState<any>(null);
  const [affinity, setAffinity] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const search = async () => {
    setError(null); setView(null); setAffinity([]);
    try {
      const [v, a] = await Promise.all([
        profileService.allowedView(profileId),
        affinityService.student(profileId).catch(() => []),
      ]);
      setView(v); setAffinity(a as any[]);
    } catch (e) { setError(apiError(e, 'No se pudo cargar el perfil.')); }
  };

  return (
    <Screen>
      <H1>Perfil del estudiante</H1>
      <Muted>Vista permitida. Sin datos personales sensibles ni notas.</Muted>
      <Card>
        <Field label="ID de perfil (studentProfileId)" value={profileId} onChangeText={setProfileId} />
        <Button title="Consultar" onPress={search} />
        {error && <ErrorText message={error} />}
      </Card>

      {view && (
        <Card title={view.studentName ?? 'Estudiante'}>
          <Text>Semestre: {view.semester ?? '—'} · {view.status}</Text>
          <Text>Intereses: {view.interests?.map((i: any) => i.area).join(', ') || '—'}</Text>
          <Text>Habilidades: {view.skills?.map((s: any) => `${s.skill} (${s.level})`).join(', ') || '—'}</Text>
          <Text>Proyectos: {view.projects?.length ?? 0} · Actividades: {view.activities?.length ?? 0}</Text>
          <Text style={{ fontWeight: '600', marginTop: 8 }}>Afinidades</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {affinity.length === 0 ? <Muted>Sin afinidades.</Muted> : affinity.map((a) => (
              <Badge key={a.id} color={affinityColor(a.level)}>{a.academicArea?.name}: {a.level}</Badge>
            ))}
          </View>
        </Card>
      )}
    </Screen>
  );
}
