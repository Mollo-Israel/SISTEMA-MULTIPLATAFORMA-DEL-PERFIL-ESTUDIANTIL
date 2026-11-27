import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { apiError } from '../../api/client';
import {
  collaborationService, type ContactChannelType, type ContactChannelView, type ContactView,
} from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { useCameraPermissions } from 'expo-camera';
import { EscanerQr } from '../../components/EscanerQr';
import { leerQrDePerfil } from '../../qrPerfil';
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

  // V7.1 §12.1: se busca por nombre y apellidos; ya no se pega un identificador.
  const [buscar, setBuscar] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [hallados, setHallados] = useState<Awaited<ReturnType<typeof collaborationService.searchPeople>> | null>(null);
  const [pidiendo, setPidiendo] = useState<string | null>(null);
  // V7.1 §12.1 (T04, T05): escanear el QR del perfil de otra persona.
  const [permiso, pedirPermiso] = useCameraPermissions();
  const [escaneando, setEscaneando] = useState(false);
  const [avisoCamara, setAvisoCamara] = useState<{ texto: string; ajustes: boolean } | null>(null);
  const [avisoQr, setAvisoQr] = useState<string | null>(null);
  const [escaneado, setEscaneado] = useState<{
    slug: string; name: string; semester: number | null; bio?: string | null; enviada?: boolean;
  } | null>(null);
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

  const buscarPersonas = async () => {
    if (buscar.trim().length < 3) { toast.error('Escribe al menos 3 letras del nombre o los apellidos.'); return; }
    setBuscando(true);
    try {
      setHallados(await collaborationService.searchPeople(buscar.trim()));
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBuscando(false);
    }
  };

  /** El permiso se pide al tocar «Escanear QR», nunca al abrir la pantalla. */
  const abrirEscaner = async () => {
    setAvisoQr(null);
    setEscaneado(null);
    const actual = permiso?.granted ? permiso : await pedirPermiso();
    if (!actual.granted) {
      setAvisoCamara(actual.canAskAgain
        ? { texto: 'Sin permiso de cámara no se puede escanear. Puedes buscar a la persona por su nombre.', ajustes: false }
        : { texto: 'El permiso de cámara está desactivado. Actívalo en los ajustes del teléfono o busca a la persona por su nombre.', ajustes: true });
      return;
    }
    setAvisoCamara(null);
    setEscaneando(true);
  };

  const alLeerQr = async (texto: string) => {
    setEscaneando(false);
    const lectura = leerQrDePerfil(texto, enlaceState.data?.url);
    if (lectura.tipo === 'descartado') { setAvisoQr(lectura.mensaje); return; }
    if (lectura.slug === enlaceState.data?.slug) { setAvisoQr('Es tu propio código: compártelo para que te encuentren.'); return; }
    try {
      const perfil = await collaborationService.publicProfile(lectura.slug);
      setEscaneado({ slug: lectura.slug, name: perfil.name, semester: perfil.semester, bio: perfil.bio });
    } catch {
      // Mismo mensaje para un perfil inexistente, privado o con el identificador cambiado.
      setAvisoQr('Este código no lleva a un perfil compartible: puede que su dueño lo haya desactivado o cambiado.');
    }
  };

  const solicitarEscaneado = async () => {
    if (!escaneado) return;
    setPidiendo(escaneado.slug);
    try {
      await collaborationService.requestContact({ slug: escaneado.slug, source: 'qr' });
      toast.success('Solicitud enviada.', `${escaneado.name} decide si la acepta.`);
      setEscaneado({ ...escaneado, enviada: true });
      recargar();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setPidiendo(null);
    }
  };

  /** Se pide a la persona elegida (por su perfil), nunca por igualdad de nombre. */
  const solicitarA = async (persona: { slug: string; name: string }) => {
    setPidiendo(persona.slug);
    try {
      await collaborationService.requestContact({ slug: persona.slug, source: 'directory' });
      toast.success('Solicitud enviada.', `${persona.name} decide si la acepta.`);
      setHallados((h) => (h ?? []).map((x) => (x.slug === persona.slug ? { ...x, pending: true } : x)));
      recargar();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setPidiendo(null);
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
      toast.success(decision === 'accept' ? 'Te sumaste al equipo.' : 'Invitación declinada.');
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
                Todavía no está publicado. Actívalo desde la web, en Privacidad, y elige qué campos
                se ven: nada se comparte mientras no lo decidas.
              </Muted>
            )}
            {/* Seleccionable en vez de un boton de copiar: el portapapeles
                pediria una dependencia mas para algo que el sistema operativo
                ya resuelve manteniendo pulsado. */}
            <Text style={styles.enlace} selectable>{enlace.url}</Text>
            <Muted>
              El código QR lleva solo este enlace. Ni tu correo, ni tu código universitario.
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

      <Card title="Buscar a alguien">
        <Muted>
          Escribe su nombre y apellidos, en cualquier orden y con o sin tildes. Solo aparecen quienes
          aceptaron ser encontrados. Encontrar no agrega: la otra persona decide si acepta.
        </Muted>
        <Field
          label="Nombre y apellidos"
          value={buscar}
          onChangeText={setBuscar}
          placeholder="Mínimo 3 letras"
        />
        <View style={styles.botones}>
          <Button icon="search" title="Buscar" loading={buscando} onPress={buscarPersonas} />
          <Button icon="camera" variant="secondary" title="Escanear QR" onPress={abrirEscaner} />
        </View>
        {avisoCamara && (
          <View style={styles.item}>
            <Muted>{avisoCamara.texto}</Muted>
            {avisoCamara.ajustes && <Button small variant="secondary" icon="settings" title="Abrir ajustes" onPress={() => Linking.openSettings()} />}
          </View>
        )}
        {avisoQr && <Muted>{avisoQr}</Muted>}
        {escaneado && (
          <View style={styles.item}>
            <Text style={styles.nombre}>{escaneado.name}</Text>
            {!!escaneado.semester && <Muted>{`${escaneado.semester}.º semestre`}</Muted>}
            {!!escaneado.bio && <Muted>{escaneado.bio}</Muted>}
            <Muted>Solicitar contacto no te agrega: la otra persona la acepta o la rechaza.</Muted>
            {escaneado.enviada ? (
              <Badge color={colors.gray500}>Solicitud enviada</Badge>
            ) : (
              <Button icon="user-plus" title="Solicitar contacto" loading={pidiendo === escaneado.slug} onPress={solicitarEscaneado} />
            )}
          </View>
        )}
        <EscanerQr visible={escaneando} onLeido={(t) => void alLeerQr(t)} onCerrar={() => setEscaneando(false)} />
        {hallados && hallados.length === 0 && (
          <Muted>Nadie que aceptara ser encontrado coincide con esa búsqueda.</Muted>
        )}
        {(hallados ?? []).map((p) => (
          <View key={p.slug} style={styles.item}>
            <Text style={styles.nombre}>{p.name}</Text>
            {!!p.semester && <Muted>{`${p.semester}.º semestre`}</Muted>}
            {p.isContact && <Badge color={colors.green}>Ya es tu contacto</Badge>}
            {!p.isContact && p.pending && <Badge color={colors.gray500}>Solicitud pendiente</Badge>}
            {!p.isContact && !p.pending && (
              <Button icon="user-plus" title="Solicitar contacto" loading={pidiendo === p.slug} onPress={() => solicitarA(p)} />
            )}
          </View>
        ))}
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
          <EmptyState message="Todavía no tienes contactos. Comparte tu enlace o solicita el de alguien." />
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
