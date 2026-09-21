import { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { apiError } from '../api/client';
import { activationService } from '../services';
import { Field, Button, ErrorText, Success } from '../components/ui';
import { Icon } from '../components/icons';
import { colors } from '../theme';

/**
 * Pantallas de entrada (§9, §12, §13).
 *
 * No hay registro: la cuenta la provisiona la carrera desde el padrón
 * institucional y su titular la activa con el código que recibe por correo.
 * Los cuatro modos son los únicos caminos posibles hacia adentro.
 */
type Modo = 'login' | 'activar' | 'recuperar' | 'restablecer';

const PASSWORD_MIN = 12;

const TITULO: Record<Modo, { t: string; s: string }> = {
  login: { t: 'Afinia', s: 'Ingeniería en Sistemas · Univalle' },
  activar: { t: 'Activa tu cuenta', s: 'Pega el código que recibiste por correo y define tu contraseña' },
  recuperar: { t: 'Recuperar acceso', s: 'Te enviaremos un código a tu correo institucional' },
  restablecer: { t: 'Nueva contraseña', s: 'Pega el código del correo y elige una contraseña nueva' },
};

function requisitos(p: string) {
  return [
    { t: `${PASSWORD_MIN}+ caracteres`, ok: p.length >= PASSWORD_MIN && p.length <= 128 },
    { t: 'Una mayúscula', ok: /[A-Z]/.test(p) },
    { t: 'Una minúscula', ok: /[a-z]/.test(p) },
    { t: 'Un número', ok: /\d/.test(p) },
    { t: 'Un símbolo', ok: /[^A-Za-z0-9\s]/.test(p) },
    { t: 'Sin espacios', ok: p.length > 0 && !/\s/.test(p) },
  ];
}

export default function LoginScreen() {
  const { login } = useAuth();
  const [modo, setModo] = useState<Modo>('login');
  const [form, setForm] = useState({ email: '', password: '', token: '', confirm: '' });
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reqs = useMemo(() => requisitos(form.password), [form.password]);
  const pideClave = modo === 'activar' || modo === 'restablecer';

  /** Cambia de modo limpiando los campos sensibles; `mensaje` sobrevive al cambio. */
  const cambiarModo = (siguiente: Modo, mensaje: string | null = null) => {
    setModo(siguiente);
    setError(null);
    setAviso(mensaje);
    setForm((f) => ({ ...f, password: '', token: '', confirm: '' }));
  };

  const submit = async () => {
    setError(null);
    setAviso(null);

    if (pideClave) {
      if (!form.token.trim()) return setError('Pega el código que recibiste por correo.');
      if (!reqs.every((r) => r.ok)) return setError('La contraseña no cumple los requisitos.');
      if (form.confirm !== form.password) return setError('Las contraseñas no coinciden.');
    } else if (!form.email.trim()) {
      return setError('Escribe tu correo institucional.');
    }

    setBusy(true);
    try {
      const correo = form.email.trim().toLowerCase();
      if (modo === 'login') {
        await login(correo, form.password);
      } else if (modo === 'recuperar') {
        const r = await activationService.forgotPassword(correo);
        setAviso(r.message);
        setModo('restablecer');
      } else if (modo === 'activar') {
        await activationService.activate(form.token.trim(), form.password);
        cambiarModo('login', 'Cuenta activada. Ya puedes iniciar sesión con tu nueva contraseña.');
      } else {
        await activationService.resetPassword(form.token.trim(), form.password);
        cambiarModo('login', 'Contraseña actualizada. Inicia sesión con la nueva.');
      }
    } catch (e) {
      setError(apiError(e, 'No se pudo completar la operación.'));
    } finally {
      setBusy(false);
    }
  };

  const pedirCodigo = async () => {
    const correo = form.email.trim().toLowerCase();
    if (!correo) return setError('Escribe tu correo institucional para enviarte el código.');
    setBusy(true);
    setError(null);
    try {
      const r = await activationService.request(correo);
      setAviso(r.message);
    } catch (e) {
      setError(apiError(e, 'No se pudo enviar el código.'));
    } finally {
      setBusy(false);
    }
  };

  const cabecera = TITULO[modo];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.wrap}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>{cabecera.t}</Text>
          <Text style={styles.subtitle}>{cabecera.s}</Text>

          {error && <ErrorText message={error} />}
          {aviso && <Success message={aviso} />}

          {modo === 'login' || modo === 'recuperar' || modo === 'activar' ? (
            <Field
              label="Correo institucional"
              value={form.email}
              onChangeText={(t) => setForm({ ...form, email: t })}
              placeholder="nombre.apellido@univalle.edu"
              keyboardType="email-address"
            />
          ) : null}

          {pideClave && (
            <Field
              label="Código del correo"
              value={form.token}
              onChangeText={(t) => setForm({ ...form, token: t })}
              placeholder="Pega aquí el código"
            />
          )}

          {modo === 'login' && (
            <Field
              label="Contraseña"
              value={form.password}
              onChangeText={(t) => setForm({ ...form, password: t })}
              secureTextEntry
            />
          )}

          {pideClave && (
            <>
              <Field
                label="Nueva contraseña"
                value={form.password}
                onChangeText={(t) => setForm({ ...form, password: t })}
                secureTextEntry
              />
              <View style={styles.reqs}>
                {reqs.map((r) => (
                  <View key={r.t} style={styles.req}>
                    <Icon
                      name={r.ok ? 'check-circle' : 'circle'}
                      size={12}
                      color={r.ok ? colors.green : colors.gray500}
                    />
                    <Text style={[styles.reqText, r.ok && { color: colors.green }]}>{r.t}</Text>
                  </View>
                ))}
              </View>
              <Field
                label="Confirmar contraseña"
                value={form.confirm}
                onChangeText={(t) => setForm({ ...form, confirm: t })}
                secureTextEntry
              />
            </>
          )}

          <Button
            title={
              modo === 'login' ? 'Ingresar'
                : modo === 'recuperar' ? 'Enviarme el código'
                  : modo === 'activar' ? 'Activar cuenta'
                    : 'Guardar contraseña'
            }
            onPress={submit}
            loading={busy}
          />

          {modo === 'activar' && (
            <Text style={styles.link} onPress={pedirCodigo}>
              ¿No tienes el código? Reenviármelo
            </Text>
          )}

          {modo === 'login' ? (
            <>
              <Text style={styles.link} onPress={() => cambiarModo('activar')}>
                ¿Tu cuenta es nueva? Actívala
              </Text>
              <Text style={styles.link} onPress={() => cambiarModo('recuperar')}>
                Olvidé mi contraseña
              </Text>
              <Text style={styles.nota}>
                Las cuentas las crea la carrera con el padrón institucional. No hay registro
                público.
              </Text>
            </>
          ) : (
            <Text style={styles.link} onPress={() => cambiarModo('login')}>
              ← Volver a iniciar sesión
            </Text>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bordo },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  card: { backgroundColor: colors.white, borderRadius: 16, padding: 22 },
  title: { fontSize: 19, fontWeight: '800', color: colors.bordo, textAlign: 'center' },
  subtitle: { fontSize: 12, color: colors.gray500, textAlign: 'center', marginBottom: 18 },
  link: { color: colors.bordo, textAlign: 'center', marginTop: 14, fontWeight: '600' },
  nota: { color: colors.gray500, fontSize: 11, textAlign: 'center', marginTop: 14, lineHeight: 16 },
  reqs: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12, marginTop: -4 },
  req: { flexDirection: 'row', alignItems: 'center', width: '50%', marginBottom: 3 },
  reqText: { fontSize: 11, color: colors.gray500, marginLeft: 4 },
});
