import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LogBox } from 'react-native';
import 'react-native-reanimated';

import { useOrganizationSessionGuard } from '@/lib/organization-access';
import { AppThemeProvider, useAppTheme } from '@/lib/theme';
import { usePushNotifications } from '@/lib/use-push-notifications';

LogBox.ignoreLogs([
  "Can't perform a React state update on a component that hasn't mounted yet",
  'Cannot connect to Expo CLI',
]);

export const unstable_settings = {
  anchor: 'intro',
};

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <RootLayoutNav />
    </AppThemeProvider>
  );
}

function RootLayoutNav() {
  const { isDark } = useAppTheme();
  useOrganizationSessionGuard();
  usePushNotifications();

  return (
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="intro" options={{ headerShown: false }} />
        <Stack.Screen name="loading" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
        <Stack.Screen name="createacc" options={{ headerShown: false }} />
        <Stack.Screen name="homepage" options={{ headerShown: false }} />
        <Stack.Screen name="organization-inactive" options={{ headerShown: false }} />
        <Stack.Screen name="organization-unavailable" options={{ headerShown: false }} />
        <Stack.Screen name="operator-home" options={{ headerShown: false }} />
        <Stack.Screen name="operator-requests" options={{ headerShown: false }} />
        <Stack.Screen name="operator-transactions" options={{ headerShown: false }} />
        <Stack.Screen name="operator-transaction-details" options={{ headerShown: false }} />
        <Stack.Screen name="operator-boats" options={{ headerShown: false }} />
        <Stack.Screen name="boats" options={{ headerShown: false }} />
        <Stack.Screen name="rent-boat" options={{ headerShown: false }} />
        <Stack.Screen name="booking" options={{ headerShown: false }} />
        <Stack.Screen name="booking-details" options={{ headerShown: false }} />
        <Stack.Screen name="payment-history" options={{ headerShown: false }} />
        <Stack.Screen name="edit-profile" options={{ headerShown: false }} />
        <Stack.Screen name="help" options={{ headerShown: false }} />
        <Stack.Screen name="emergency" options={{ headerShown: false }} />
        <Stack.Screen name="xendit-checkout" options={{ headerShown: false }} />
        <Stack.Screen name="xendit-payment-success" options={{ headerShown: false }} />
        <Stack.Screen name="no-show" options={{ headerShown: false }} />
        <Stack.Screen name="feedback" options={{ headerShown: false }} />
        <Stack.Screen name="boat-info" options={{ headerShown: false }} />
        <Stack.Screen
          name="rental-result"
          options={{
            headerShown: false,
            presentation: 'transparentModal',
            animation: 'fade',
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
        <Stack.Screen name="notification" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ headerShown: false }} />
        <Stack.Screen name="gcash-settings" options={{ headerShown: false }} />
        <Stack.Screen name="operator-commissions" options={{ headerShown: false }} />
        <Stack.Screen name="commission-settle" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="about" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}
