import { Text, View } from 'react-native';
import { reportService } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { Screen, Card, Muted, ErrorText, PageHeader, SkeletonCards } from '../../components/ui';

export default function TeacherReport() {
  const { data, loading, error, reload } = useAsync(() => reportService.teacherOverview(), []);
  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <PageHeader
        title="Reporte del curso"
        description="Descriptivo. No genera ranking ni evalúa rendimiento."
      />
      {loading && <SkeletonCards count={3} />}
      {error && <ErrorText message={error} />}
      {data && (
        <>
          <Card title="Estudiantes">
            <Text>Total: {data.students.total}</Text>
            <Text>Perfiles incompletos: {data.incompleteStudents.count}</Text>
            <Text>Participaciones confirmadas: {data.participation.byStatus.confirmed}</Text>
          </Card>
          <Card title="Intereses predominantes">
            {data.topInterests.length === 0 ? <Muted>Sin datos.</Muted> : data.topInterests.map((i: any) => (
              <View key={i.area} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text>{i.area}</Text><Text>{i.count}</Text>
              </View>
            ))}
          </Card>
          <Card title="Tecnologías más usadas">
            {data.topTechnologies.length === 0 ? <Muted>Sin datos.</Muted> : data.topTechnologies.map((t: any) => (
              <View key={t.technology} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text>{t.technology}</Text><Text>{t.count}</Text>
              </View>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}
