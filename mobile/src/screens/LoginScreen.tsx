import { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { apiError } from '../api/client';
import { Field, Button, ErrorText } from '../components/ui';
import { colors } from '../theme';

export default function LoginScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      if (mode === 'login') await login(form.email, form.password);
      else await register(form);
    } catch (e) { setError(apiError(e, 'No se pudo iniciar sesión.')); } finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
      <View style={styles.card}>
        <Text style={styles.title}>Perfil Estudiantil Dinámico</Text>
        <Text style={styles.subtitle}>Ingeniería en Sistemas · Univalle</Text>
        {error && <ErrorText message={error} />}
        {mode === 'register' && (
          <>
            <Field label="Nombres" value={form.firstName} onChangeText={(t) => setForm({ ...form, firstName: t })} />
            <Field label="Apellidos" value={form.lastName} onChangeText={(t) => setForm({ ...form, lastName: t })} />
          </>
        )}
        <Field label="Correo" value={form.email} onChangeText={(t) => setForm({ ...form, email: t })} keyboardType="email-address" />
        <Field label="Contraseña" value={form.password} onChangeText={(t) => setForm({ ...form, password: t })} secureTextEntry />
        <Button title={busy ? 'Procesando…' : mode === 'login' ? 'Ingresar' : 'Registrarme como estudiante'} onPress={submit} disabled={busy} />
        <Text style={styles.switch} onPress={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}>
          {mode === 'login' ? '¿Eres estudiante nuevo? Crear cuenta' : '¿Ya tienes cuenta? Iniciar sesión'}
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bordo, justifyContent: 'center', padding: 20 },
  card: { backgroundColor: colors.white, borderRadius: 16, padding: 22 },
  title: { fontSize: 19, fontWeight: '800', color: colors.bordo, textAlign: 'center' },
  subtitle: { fontSize: 12, color: colors.gray500, textAlign: 'center', marginBottom: 18 },
  switch: { color: colors.bordo, textAlign: 'center', marginTop: 16 },
});
