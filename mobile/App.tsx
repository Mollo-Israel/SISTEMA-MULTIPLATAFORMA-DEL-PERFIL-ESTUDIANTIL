import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { ConfirmProvider, ToastProvider } from './src/components/feedback';
import RootNavigator from './src/navigation/RootNavigator';
import { Loading } from './src/components/ui';
import { colors } from './src/theme';

function Gate() {
  const { loading } = useAuth();
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.gray50 }}>
        <Loading />
      </View>
    );
  }
  return (
    <NavigationContainer>
      <RootNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ToastProvider>
        <ConfirmProvider>
          <AuthProvider>
            <StatusBar style="light" />
            <Gate />
          </AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}
