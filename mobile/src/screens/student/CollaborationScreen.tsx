import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { apiError } from '../../api/client';
import {
  collaborationService, type ContactChannelType, type ContactChannelView, type ContactView,
} from '../../services';
import { useAsync } from '../../hooks/useAsync';
import TeamNeedsSection from './TeamNeedsSection';
import {
  Badge, Button, Card, EmptyState, Field, Muted, SkeletonCards,
} from '../../components/ui';
import { useConfirm, useToast } from '../../components/feedback';
import { colors } from '../../theme';

const DISPONIBILIDAD: Record<string, string> = {
  looking: 'Busca equipo',
  open: 'Escucha propuestas',
  busy: 'Sin margen',
  unspecified: 'Sin declarar',
};

/**
 * Colaboracion en el movil (§43, §45, §46).
 *
 * El telefono es donde se piden y se responden contactos, y donde se contestan
 * las invitaciones a un equipo: son cosas que pasan en un pasillo, no sentado.
 *
 * El codigo QR se imprime desde la web. Dibujarlo aqui pediria una libreria de
 * SVG que el proyecto no tiene, y el enlace se comparte igual de bien copiado.
 */
const CANALES: { channel: ContactChannelType; label: string; placeholder: string }[] = [
  { channel: 'teams', label: 'Microsoft Teams', placeholder: 'tu.cuenta@est.univalle.edu' },
  { channel: 'whatsapp', label: 'WhatsApp', placeholder: '+591 71234567' },
  { channel: 'linkedin', label: 'LinkedIn', placeholder: 'linkedin.com/in/tu-nombre' },
  { channel: 'email', label: 'Correo de contacto', placeholder: 'nombre@correo.com' },
  { channel: 'link', label: 'Otro enlace', placeholder: 'https://tu-portafolio.dev' },
];

/**
 * «Cómo contactarte» (V2 §59). La validación es la del servidor: aquí solo se
 * escribe y se muestra el error del canal que no pasó.
 */
function MisCanales() {
  const [valores, setValores] = useState<Record<string, { value: string; isPublic: boolean }>>({});
  const [guardando, setGuardando] = useState(false);
  const toast = useToast();

  const aplicar = (lista: ContactChannelView[]) =>
    setValores(Object.fromEntries(lista.map((c) => [c.channel, { value: c.value, isPublic: c.isPublic }])));

  useEffect(() => {
    collaborationService.myChannels().then(aplicar).catch(() => {});
  }, []);

  const guardar = async () => {
    setGuardando(true);
    try {
      const lista = CANALES
        .filter((c) => (valores[c.channel]?.value ?? '').trim())
        .map((c) => ({ channel: c.channel, value: valores[c.channel].value.trim(), isPublic: !!valores[c.channel].isPublic }));
      aplicar(await collaborationService.saveChannels(lista));
      toast.success('Canales guardados.', 'Tus contactos ya los ven.');
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Card title="Cómo contactarte">
      <Muted>
        Afinia no tiene chat: tus contactos te escriben por el canal que elijas. Todos son opcionales.
      </Muted>
      {CANALES.map((c) => (
        <View key={c.channel}>
          <Field
            label={c.label}
            value={valores[c.channel]?.value ?? ''}
            placeholder={c.placeholder}
            onChangeText={(t) => setValores({ ...valores, [c.channel]: { value: t, isPublic: valores[c.channel]?.isPublic ?? false } })}
          />
          <View style={styles.fila}>
            <Switch
              value={!!valores[c.channel]?.isPublic}
              disabled={!(valores[c.channel]?.value ?? '').trim()}
              onValueChange={(v) => setValores({ ...valores, [c.channel]: { value: valores[c.channel]?.value ?? '', isPublic: v } })}
              accessibilityLabel={`Mostrar ${c.label} en mi perfil público`}
            />
            <Muted>Mostrar en mi perfil público</Muted>
          </View>
        </View>
      ))}
      <Button icon="save" title="Guardar canales" loading={guardando} onPress={guardar} />
    </Card>
  );
}

export default function CollaborationScreen() {
  const enlaceState = useAsync(() => collaborationService.myPublicLink(), []);
  const contactosState = useAsync(() => collaborationService.contacts(), []);
  const recibidasState = useAsync(() => collaborationService.receivedRequests(), []);
  const invitacionesState = useAsync(() => collaborationService.myTeamInvitations(), []);

  const [slug, setSlug] = useState('');
  const [enviando, setEnviando] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();

  const recargar = useCallback(() => {
    contactosState.reload();
    recibidasState.reload();
    invitacionesState.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rotar = async () => {
    const ok = await confirm({
      title: 'Cambiar tu identificador',
      message:
        'Los codigos QR que ya compartiste dejaran de funcionar. Es lo que se hace '
        + 'cuando uno acabo donde no debia.',
      confirmLabel: 'Cambiar',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await collaborationService.rotatePublicLink();
      enlaceState.reload();
      toast.success('Identificador cambiado.');
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const solicitar = async () => {
    setEnviando(true);
    try {
      await collaborationService.requestContact({ slug: slug.trim(), source: 'qr' });
      toast.success('Solicitud enviada.', 'La otra persona decide si la acepta.');
      setSlug('');
      recargar();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setEnviando(false);
    }
  };

  const decidir = async (id: string, decision: 'accept' | 'reject') => {
    try {
      await collaborationService.decideContactRequest(id, decision);
      toast.success(decision === 'accept' ? 'Contacto establecido.' : 'Solicitud rechazada.');
      recargar();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const responderInvitacion = async (id: string, decision: 'accept' | 'decline') => {
    try {
      await collaborationService.decideTeamInvitation(id, decision);
      toast.success(decision === 'accept' ? 'Te sumaste al equipo.' : 'Invitacion declinada.');
      recargar();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const enlace = enlaceState.data;
  const recibidas = recibidasState.data ?? [];
  const invitaciones = invitacionesState.data ?? [];
  const contactos: ContactView[] = contactosState.data ?? [];

  return (
    <ScrollView contentContainerStyle={styles.contenido}>
      <Card title="Mi perfil compartible">
        {enlaceState.loading && !enlace && <SkeletonCards count={1} />}
        {enlace && (
          <>
            <View style={styles.fila}>
              <Badge color={enlace.enabled ? colors.green : colors.gray500}>
                {enlace.enabled ? 'Publicado' : 'Sin publicar'}
              </Badge>
            </View>
            {!enlace.enabled && (
              <Muted>
                Todavia no esta publicado. Actualo desde la web, en Privacidad, y elige que campos
                se ven: nada se comparte mientras no lo decidas.
              </Muted>
            )}
            {/* Seleccionable en vez de un boton de copiar: el portapapeles
                pediria una dependencia mas para algo que el sistema operativo
                ya resuelve manteniendo pulsado. */}
            <Text style={styles.enlace} selectable>{enlace.url}</Text>
            <Muted>
              El codigo QR lleva solo este enlace. Ni tu correo, ni tu codigo universitario.
              Para imprimirlo, entra desde la web.
            </Muted>
            <View style={styles.botones}>
              <Button
                icon="refresh-cw"
                variant="secondary"
                title="Cambiar identificador"
                onPress={rotar}
              />
            </View>
          </>
        )}
      </Card>

      <MisCanales />

      <Card title="Solicitar contacto">
        <Muted>
          Escanear un QR te lleva al perfil, pero no establece contacto: eso lo decide la otra
          persona.
        </Muted>
        <Field
          label="Identificador del perfil"
          value={slug}
          onChangeText={setSlug}
          placeholder="cdwxx59caf76"
        />
        <Button
          icon="user-plus"
          title="Enviar solicitud"
          loading={enviando}
          onPress={solicitar}
        />
      </Card>

      {recibidas.length > 0 && (
        <Card title={`Solicitudes recibidas (${recibidas.length})`}>
          {recibidas.map((r: any) => (
            <View key={r.id} style={styles.item}>
              <Text style={styles.nombre}>{r.student?.name}</Text>
              {!!r.message && <Muted>{r.message}</Muted>}
              <View style={styles.botones}>
                <Button icon="check" title="Aceptar" onPress={() => decidir(r.id, 'accept')} />
                <Button
                  icon="x"
                  variant="secondary"
                  title="Rechazar"
                  onPress={() => decidir(r.id, 'reject')}
                />
              </View>
            </View>
          ))}
        </Card>
      )}

      {invitaciones.length > 0 && (
        <Card title={`Invitaciones a equipos (${invitaciones.length})`}>
          {invitaciones.map((i: any) => (
            <View key={i.id} style={styles.item}>
              <Text style={styles.nombre}>{i.team?.name}</Text>
              {!!i.team?.purpose && <Muted>{i.team.purpose}</Muted>}
              <View style={styles.botones}>
                <Button
                  icon="check"
                  title="Aceptar"
                  onPress={() => responderInvitacion(i.id, 'accept')}
                />
                <Button
                  icon="x"
                  variant="secondary"
                  title="Declinar"
                  onPress={() => responderInvitacion(i.id, 'decline')}
                />
              </View>
            </View>
          ))}
        </Card>
      )}

      {/* V3 §31, §55 */}
      <TeamNeedsSection />

      <Card title="Mis contactos">
        {contactosState.loading && !contactosState.data && <SkeletonCards count={2} />}
        {(!contactosState.loading || contactosState.data) && contactos.length === 0 && (
          <EmptyState message="Todavia no tienes contactos. Comparte tu enlace o solicita el de alguien." />
        )}
        {contactos.map((c) => (
          <View key={c.contactId} style={styles.item}>
            <Text style={styles.nombre}>{c.note?.alias || c.name}</Text>
            <Muted>
              {c.semester ? `${c.semester}.º semestre · ` : ''}
              {DISPONIBILIDAD[c.availability ?? 'unspecified']}
            </Muted>
            {/* V2 §59: el contacto se hace fuera de Afinia, por el canal que compartió. */}
            <View style={styles.botones}>
              {(c.channels ?? []).filter((k) => k.href).map((k) => (
                <Pressable
                  key={k.channel}
                  onPress={() => Linking.openURL(k.href!)}
                  accessibilityRole="link"
                  style={[styles.canal, k.channel === c.note?.preferredChannel && styles.canalPreferido]}
                >
                  <Text style={[styles.canalTexto, k.channel === c.note?.preferredChannel && { color: '#fff' }]}>
                    {k.label}
                  </Text>
                </Pressable>
              ))}
              {(c.channels ?? []).length === 0 && <Muted>No compartió canales.</Muted>}
            </View>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenido: { padding: 16, gap: 12, paddingBottom: 32 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  enlace: {
    fontSize: 12,
    color: colors.gray700,
    backgroundColor: colors.gray100,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    marginVertical: 8,
  },
  botones: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  item: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray100,
  },
  nombre: { fontWeight: '700', color: colors.gray700 },
  canal: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14,
    borderWidth: 1, borderColor: colors.bordo,
  },
  canalPreferido: { backgroundColor: colors.bordo },
  canalTexto: { color: colors.gray700, fontWeight: '600', fontSize: 12 },
});
