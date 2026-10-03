import { useEffect, useMemo, useState } from 'react';
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
 * No hay registro: la cuenta la crea la universidad y su titular la activa
 * con lo que recibe en su correo institucional. En el teléfono se usa el
 * **código de seis dígitos** de ese correo: antes había que pegar un token de
 * 43 caracteres, que en un móvil es casi imposible de copiar bien.
 */
type Modo = 'login' | 'activar' | 'recuperar' | 'restablecer';

const PASSWORD_MIN = 12;
const INSTITUCIONAL = /^[a-z0-9._%+-]+@(?:[a-z0-9-]+\.)*univalle\.edu$/i;

const TITULO: Record<Modo, { t: string; s: string }> = {
  login: { t: 'Afinia', s: 'Ingeniería en Sistemas · Univalle' },
  activar: { t: 'Activa tu cuenta', s: 'Escribe el código de 6 dígitos de tu correo y elige tu contraseña' },
  recuperar: { t: 'Recuperar acceso', s: 'Te enviaremos un código a tu correo institucional' },
  restablecer: { t: 'Nueva contraseña', s: 'Escribe el código del correo y elige una contraseña nueva' },
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

function reloj(seg: number): string {
  return `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`;
}

export default function LoginScreen() {
  const { login } = useAuth();
  const [modo, setModo] = useState<Modo>('login');
  const [form, setForm] = useState({ email: '', password: '', code: '', confirm: '' });
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [espera, setEspera] = useState(0);

  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  const reqs = useMemo(() => requisitos(form.password), [form.password]);
  const avance = Math.round((reqs.filter((r) => r.ok).length / reqs.length) * 100);
  const pideClave = modo === 'activar' || modo === 'restablecer';

  /** Cambia de modo limpiando los campos sensibles; `mensaje` sobrevive al cambio. */
  const cambiarModo = (siguiente: Modo, mensaje: string | null = null) => {
    setModo(siguiente);
    setError(null);
    setAviso(mensaje);
    setForm((f) => ({ ...f, password: '', code: '', confirm: '' }));
  };

  const correoValido = (correo: string): string | null => {
    if (!correo) return 'Escribe tu correo institucional.';
    if (!INSTITUCIONAL.test(correo)) return 'Usa tu correo institucional (@univalle.edu o @est.univalle.edu).';
    return null;
  };

  const submit = async () => {
    setError(null);
    setAviso(null);
    const correo = form.email.trim().toLowerCase();

    const malo = correoValido(correo);
    if (malo) return setError(malo);
    if (pideClave) {
      if (!/^\d{6}$/.test(form.code.replace(/\s+/g, ''))) return setError('El código tiene 6 dígitos.');
      if (!reqs.every((r) => r.ok)) return setError('La contraseña todavía no cumple todos los requisitos.');
      if (form.confirm !== form.password) return setError('Las dos contraseñas no coinciden.');
    }

    setBusy(true);
    try {
      const entrada = { email: correo, code: form.code.replace(/\s+/g, ''), password: form.password };
      if (modo === 'login') {
        await login(correo, form.password);
      } else if (modo === 'recuperar') {
        const r = await activationService.forgotPassword(correo);
        setEspera(r.retryAfterSeconds ?? 120);
        cambiarModo('restablecer', r.message);
      } else if (modo === 'activar') {
        await activationService.activate(entrada);
        cambiarModo('login', '¡Tu cuenta está lista! Ya puedes iniciar sesión con tu nueva contraseña.');
      } else {
        await activationService.resetPassword(entrada);
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
    const malo = correoValido(correo);
    if (malo) return setError(malo);
    setBusy(true);
    setError(null);
    try {
      const r = modo === 'restablecer'
        ? await activationService.forgotPassword(correo)
        : await activationService.request(correo);
      setAviso(r.message);
      setEspera(r.retryAfterSeconds ?? 120);
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

          <Field
            label="Correo institucional"
            value={form.email}
            onChangeText={(t) => setForm({ ...form, email: t })}
            placeholder="nombre.apellido@est.univalle.edu"
            keyboardType="email-address"
          />

          {pideClave && (
            <Field
              label="Código de 6 dígitos"
              value={form.code}
              onChangeText={(t) => setForm({ ...form, code: t.replace(/[^\d]/g, '').slice(0, 6) })}
              placeholder="000000"
              keyboardType="numeric"
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
              {form.password.length > 0 && (
                <View style={styles.barra}>
                  <View
                    style={[
                      styles.barraLlena,
                      {
                        width: `${avance}%`,
                        backgroundColor: avance === 100 ? colors.green : avance >= 50 ? colors.amber : colors.red,
                      },
                    ]}
                  />
                </View>
              )}
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
                  : modo === 'activar' ? 'Activar mi cuenta'
                    : 'Guardar contraseña'
            }
            onPress={submit}
            loading={busy}
          />

          {pideClave && (
            espera > 0 ? (
              <Text style={styles.espera}>Podrás pedir otro código en {reloj(espera)}</Text>
            ) : (
              <Text style={styles.link} onPress={pedirCodigo}>
                ¿No te llegó? Envíame un código nuevo
              </Text>
            )
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
                Las cuentas las crea la universidad: no hay registro público. La invitación llega a
                tu correo institucional.
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
  espera: { color: colors.gray500, textAlign: 'center', marginTop: 14, fontSize: 12 },
  nota: { color: colors.gray500, fontSize: 11, textAlign: 'center', marginTop: 14, lineHeight: 16 },
  barra: { height: 6, borderRadius: 3, backgroundColor: colors.gray100, overflow: 'hidden', marginTop: -6, marginBottom: 8 },
  barraLlena: { height: 6, borderRadius: 3 },
  reqs: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12, marginTop: -4 },
  req: { flexDirection: 'row', alignItems: 'center', width: '50%', marginBottom: 3 },
  reqText: { fontSize: 11, color: colors.gray500, marginLeft: 4 },
});
