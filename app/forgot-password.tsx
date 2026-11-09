import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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
import { requestPasswordReset, resetPasswordWithCode, verifyResetCode } from '@/lib/auth';
import { PASSWORD_HINT, passwordStrengthError } from '@/lib/password';
import { useAppTheme } from '@/lib/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

const PLACEHOLDER = '#A9B7C8';
const INPUT_BG = '#F3F7FC';

type Step = 'email' | 'code' | 'password';

export default function ForgotPasswordScreen() {
  const { colors, isDark } = useAppTheme();
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);

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

  function goBack() {
    if (step === 'code') {
      setStep('email');
      setCode('');
      setError('');
      return;
    }

    if (step === 'password') {
      setStep('code');
      setPassword('');
      setPasswordConfirmation('');
      setError('');
      return;
    }

    router.back();
  }

  async function handleSendCode() {
    const nextEmail = email.trim();

    if (!nextEmail) {
      setError('Please enter your email.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await requestPasswordReset(nextEmail);
      setStep('code');
    } catch (err) {
      setError(
        err instanceof ApiError ? err.firstError() : 'Could not send the code. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyCode() {
    const nextCode = code.replace(/\D/g, '');

    if (nextCode.length !== 6) {
      setError('Enter the 6-digit code from your email.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await verifyResetCode(email.trim(), nextCode);
      setCode(nextCode);
      setStep('password');
    } catch (err) {
      setError(err instanceof ApiError ? err.firstError() : 'That code is invalid. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetPassword() {
    const passwordError = passwordStrengthError(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (password !== passwordConfirmation) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await resetPasswordWithCode({
        email: email.trim(),
        code,
        password,
        password_confirmation: passwordConfirmation,
      });
      router.replace('/login');
    } catch (err) {
      setError(
        err instanceof ApiError ? err.firstError() : 'Could not reset the password. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  const title =
    step === 'email' ? 'Forgot password?' : step === 'code' ? 'Enter the code' : 'New password';
  const subtitle =
    step === 'email'
      ? 'Enter the email on your SafeSakay account. We will send a 6-digit code there.'
      : step === 'code'
        ? `We sent a 6-digit code to ${email.trim()}. Check inbox and spam.`
        : 'Create a new password for your SafeSakay account.';

  const iconColor = isDark ? colors.muted : '#9AADC0';
  const placeholder = isDark ? '#8A95A8' : PLACEHOLDER;
  const inputBg = isDark ? colors.iconBg : INPUT_BG;
  const inputFocusBg = isDark ? '#243B63' : '#EEF4FF';
  const wrap = (on: boolean) => ({
    backgroundColor: on ? inputFocusBg : inputBg,
    borderColor: on ? colors.blue : colors.border,
  });

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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={12}
              onPress={goBack}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
              <Ionicons name="chevron-back" size={28} color={colors.navy} />
            </Pressable>

            <View style={styles.logoWrap}>
              <BrandLockup variant="login" />
            </View>

            <Text style={[styles.title, { color: colors.navy }]}>{title}</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</Text>

            {step === 'email' ? (
              <>
                <View style={[styles.inputWrap, wrap(focused === 'email')]}>
                  <Ionicons name="mail-outline" size={20} color={iconColor} />
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    onFocus={() => setFocused('email')}
                    onBlur={() => setFocused(null)}
                    placeholder="Email"
                    placeholderTextColor={placeholder}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    style={[styles.input, { color: colors.navy }]}
                  />
                </View>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <Pressable
                  accessibilityRole="button"
                  disabled={submitting}
                  style={({ pressed }) => [
                    styles.submitButton,
                    { backgroundColor: colors.blue },
                    (pressed || submitting) && styles.pressed,
                  ]}
                  onPress={handleSendCode}>
                  {submitting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitLabel}>Send code</Text>
                  )}
                </Pressable>
              </>
            ) : null}

            {step === 'code' ? (
              <>
                <View style={[styles.inputWrap, wrap(focused === 'code')]}>
                  <Ionicons name="keypad-outline" size={20} color={iconColor} />
                  <TextInput
                    value={code}
                    onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
                    onFocus={() => setFocused('code')}
                    onBlur={() => setFocused(null)}
                    placeholder="6-digit code"
                    placeholderTextColor={placeholder}
                    keyboardType="number-pad"
                    textContentType="oneTimeCode"
                    maxLength={6}
                    style={[styles.input, { color: colors.navy }]}
                  />
                </View>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <Pressable
                  accessibilityRole="button"
                  disabled={submitting}
                  style={({ pressed }) => [
                    styles.submitButton,
                    { backgroundColor: colors.blue },
                    (pressed || submitting) && styles.pressed,
                  ]}
                  onPress={handleVerifyCode}>
                  {submitting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitLabel}>Verify code</Text>
                  )}
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  disabled={submitting}
                  hitSlop={8}
                  onPress={handleSendCode}
                  style={styles.resendButton}>
                  <Text style={[styles.loginLink, { color: colors.blue }]}>Resend code</Text>
                </Pressable>
              </>
            ) : null}

            {step === 'password' ? (
              <>
                <View style={[styles.inputWrap, wrap(focused === 'password')]}>
                  <Ionicons name="lock-closed-outline" size={20} color={iconColor} />
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    onFocus={() => setFocused('password')}
                    onBlur={() => setFocused(null)}
                    placeholder="New password"
                    placeholderTextColor={placeholder}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="newPassword"
                    style={[styles.input, { color: colors.navy }]}
                  />
                  <Pressable
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={() => setShowPassword((value) => !value)}>
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={iconColor} />
                  </Pressable>
                </View>
                <Text style={[styles.hint, { color: colors.muted }]}>{PASSWORD_HINT}</Text>

                <View style={[styles.inputWrap, wrap(focused === 'confirm')]}>
                  <Ionicons name="lock-closed-outline" size={20} color={iconColor} />
                  <TextInput
                    value={passwordConfirmation}
                    onChangeText={setPasswordConfirmation}
                    onFocus={() => setFocused('confirm')}
                    onBlur={() => setFocused(null)}
                    placeholder="Confirm password"
                    placeholderTextColor={placeholder}
                    secureTextEntry={!showConfirm}
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="newPassword"
                    style={[styles.input, { color: colors.navy }]}
                  />
                  <Pressable
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={() => setShowConfirm((value) => !value)}>
                    <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color={iconColor} />
                  </Pressable>
                </View>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <Pressable
                  accessibilityRole="button"
                  disabled={submitting}
                  style={({ pressed }) => [
                    styles.submitButton,
                    { backgroundColor: colors.blue },
                    (pressed || submitting) && styles.pressed,
                  ]}
                  onPress={handleResetPassword}>
                  {submitting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitLabel}>Save new password</Text>
                  )}
                </Pressable>
              </>
            ) : null}

            <Pressable
              accessibilityRole="link"
              hitSlop={8}
              onPress={() => router.replace('/login')}
              style={styles.loginLinkButton}>
              <Text style={[styles.loginLink, { color: colors.blue }]}>Back to Login</Text>
            </Pressable>
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
    paddingBottom: 40,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginTop: 4,
    marginLeft: -8,
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    marginTop: 4,
    fontSize: 30,
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
    marginBottom: 18,
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
  hint: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 10,
    paddingHorizontal: 8,
  },
  errorText: {
    marginBottom: 12,
    color: '#D64545',
    fontSize: 13,
    textAlign: 'center',
  },
  submitButton: {
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitLabel: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  resendButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  loginLinkButton: {
    marginTop: 22,
    alignItems: 'center',
  },
  loginLink: {
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
  },
});
