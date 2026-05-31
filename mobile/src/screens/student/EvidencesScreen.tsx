import { Text } from 'react-native';
import { profileService } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { Screen, Card, H1, Muted, Loading, ErrorText, EmptyState } from '../../components/ui';

export default function EvidencesScreen() {
  const { data, loading, error, reload } = useAsync(() => profileService.summary().catch(() => null), []);

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <H1>Evidencias y certificados</H1>
      <Muted>Resumen de tus evidencias de proyectos y certificados externos.</Muted>
      {loading && <Loading />}
      {error && <ErrorText message={error} />}

      {data && (
        <>
          <Card title={`Evidencias de proyectos (${data.evidences.length})`}>
            {data.evidences.length === 0 ? (
              <EmptyState message="Sin evidencias registradas." />
            ) : (
              data.evidences.map((e: any) => (
                <Muted key={e.id}>• {e.description || e.evidenceType}: {e.externalUrl ?? e.fileUrl}</Muted>
              ))
            )}
          </Card>

          <Card title={`Certificados externos (${data.externalCertificates.length})`}>
            {data.externalCertificates.length === 0 ? (
              <EmptyState message="Sin certificados externos." />
            ) : (
              data.externalCertificates.map((c: any) => (
                <Text key={c.id}>• {c.certificateName} — {c.issuer}</Text>
              ))
            )}
          </Card>

          <Card title={`Constancias internas (${data.internalConstancies.length})`}>
            {data.internalConstancies.length === 0 ? (
              <EmptyState message="Sin constancias internas." />
            ) : (
              data.internalConstancies.map((c: any) => <Text key={c.id}>• {c.description} ({c.status})</Text>)
            )}
          </Card>
        </>
      )}
    </Screen>
  );
}
