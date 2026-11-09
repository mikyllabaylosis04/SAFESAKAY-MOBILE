import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AuthWaves } from '@/components/auth-waves';
import { BrandLockup } from '@/components/brand-lockup';
import { ApiError } from '@/lib/api';
import { loginAccount } from '@/lib/auth';
import { homeHrefForUser } from '@/lib/roles';
import { useAppTheme } from '@/lib/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

const PLACEHOLDER = '#A9B7C8';
const INPUT_BG = '#F3F7FC';

export default function LoginScreen() {
  const { colors, isDark } = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ registered?: string; username?: string }>();
  const justRegistered = params.registered === '1';
  const [username, setUsername] = useState(params.username ?? '');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<'username' | 'password' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (params.username) {
      setUsername(params.username);
    }
  }, [params.username]);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const keyboardOpen = keyboardHeight > 0;

  function focusField(field: 'username' | 'password') {
    setFocusedField(field);
  }

  async function handleLogin() {
    const nextUsername = username.trim();

    if (!nextUsername || !password) {
      setError('Please enter your username and password.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const user = await loginAccount({ username: nextUsername, password });
      router.replace(homeHrefForUser(user));
    } catch (err) {
      const detail = err instanceof ApiError ? err.firstError() : 'Login failed. Please try again.';
      setError(
        /incorrect|inactive/i.test(detail)
          ? `${detail} Use this Gmail or the username before @. If the password is wrong, tap Forgot password.`
          : detail,
      );
    } finally {
      setSubmitting(false);
    }
  }

  const iconColor = isDark ? colors.muted : '#9AADC0';
  const placeholder = isDark ? '#8A95A8' : PLACEHOLDER;
  const inputBg = isDark ? colors.iconBg : INPUT_BG;
  const inputFocusBg = isDark ? '#243B63' : '#EEF4FF';

  return (
    <View style={[styles.screen, { backgroundColor: isDark ? colors.page : '#FFFFFF' }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AuthWaves />

      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
            contentContainerStyle={[styles.content, { paddingBottom: 40 + keyboardHeight }]}
            showsVerticalScrollIndicator={false}>
            <View style={[styles.logoWrap, keyboardOpen && styles.logoWrapCompact]}>
              <BrandLockup variant={keyboardOpen ? 'compact' : 'login'} />
            </View>

            <Text style={[styles.title, { color: colors.navy }, keyboardOpen && styles.titleCompact]}>Welcome !</Text>
            {keyboardOpen ? null : (
              <Text style={[styles.subtitle, { color: colors.muted }]}>
                {justRegistered
                  ? 'Account created. Please log in to continue.'
                  : 'Please login to your account'}
              </Text>
            )}

            <View
              style={[
                styles.inputWrap,
                {
                  backgroundColor: focusedField === 'username' ? inputFocusBg : inputBg,
                  borderColor: focusedField === 'username' ? colors.blue : colors.border,
                },
              ]}>
              <Ionicons name="person-outline" size={20} color={iconColor} />
              <TextInput
                value={username}
                onChangeText={setUsername}
                onFocus={() => focusField('username')}
                onBlur={() => setFocusedField(null)}
                placeholder="Username or Email"
                placeholderTextColor={placeholder}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                textContentType="username"
                style={[styles.input, { color: colors.navy }]}
              />
            </View>

            <View
              style={[
                styles.inputWrap,
                {
                  backgroundColor: focusedField === 'password' ? inputFocusBg : inputBg,
                  borderColor: focusedField === 'password' ? colors.blue : colors.border,
                },
              ]}>
              <Ionicons name="lock-closed-outline" size={20} color={iconColor} />
              <TextInput
                value={password}
                onChangeText={setPassword}
                onFocus={() => focusField('password')}
                onBlur={() => setFocusedField(null)}
                placeholder="Password"
                placeholderTextColor={placeholder}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password"
                textContentType="password"
                style={[styles.input, { color: colors.navy }]}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                hitSlop={8}
                onPress={() => setShowPassword((visible) => !visible)}
                style={styles.eyeButton}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={iconColor}
                />
              </Pressable>
            </View>

            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: rememberMe }}
              onPress={() => setRememberMe((checked) => !checked)}
              style={[styles.rememberRow, keyboardOpen && styles.rememberRowCompact]}>
              <View
                style={[
                  styles.checkbox,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  rememberMe && { backgroundColor: colors.blue, borderColor: colors.blue },
                ]}>
                {rememberMe ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
              </View>
              <Text style={[styles.rememberLabel, { color: colors.navy }]}>Remember me</Text>
            </Pressable>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              accessibilityRole="button"
              disabled={submitting}
              style={({ pressed }) => [
                styles.loginButton,
                { backgroundColor: colors.blue },
                (pressed || submitting) && styles.pressed,
              ]}
              onPress={handleLogin}>
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.loginLabel}>Login</Text>
              )}
            </Pressable>

            <Pressable
              accessibilityRole="link"
              hitSlop={8}
              onPress={() => router.push('/forgot-password')}
              style={styles.forgotButton}>
              <Text style={[styles.forgotText, { color: colors.blue }]}>Forgot password?</Text>
            </Pressable>

            <View style={styles.registerRow}>
              <Text style={[styles.registerText, { color: colors.muted }]}>Don't have an account? </Text>
              <Pressable
                accessibilityRole="link"
                hitSlop={6}
                onPress={() => router.push('/createacc')}>
                <Text style={[styles.registerLink, { color: colors.blue }]}>Create account</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 28,
    paddingTop: 12,
    paddingBottom: 40,
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: 8,
  },
  logoWrapCompact: {
    marginBottom: 0,
  },
  titleCompact: {
    marginTop: 2,
    marginBottom: 12,
    fontSize: 24,
  },
  title: {
    marginTop: 4,
    fontSize: 34,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 28,
    fontSize: 16,
    textAlign: 'center',
  },
  inputWrap: {
    minHeight: 54,
    marginBottom: 14,
    borderWidth: 1,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    gap: 10,
  },
  input: {
    flex: 1,
    height: 54,
    fontSize: 15,
  },
  eyeButton: {
    paddingVertical: 8,
    paddingLeft: 4,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
    marginBottom: 22,
  },
  rememberRowCompact: {
    marginBottom: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rememberLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  loginButton: {
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    marginBottom: 12,
    color: '#D64545',
    fontSize: 13,
    textAlign: 'center',
  },
  loginLabel: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  forgotButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  forgotText: {
    fontSize: 15,
    fontWeight: '700',
  },
  registerRow: {
    marginTop: 22,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  registerText: {
    fontSize: 15,
  },
  registerLink: {
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
  },
});
