import { Screen, Card, H1, Muted } from '../components/ui';

export default function ComingSoonScreen() {
  return (
    <Screen>
      <H1>Próximamente</H1>
      <Card title="Funciones en desarrollo">
        <Muted>
          Chat, contactos por QR y equipos avanzados forman parte de futuras versiones del sistema y aún
          no están disponibles en el 30% inicial.
        </Muted>
      </Card>
    </Screen>
  );
}
