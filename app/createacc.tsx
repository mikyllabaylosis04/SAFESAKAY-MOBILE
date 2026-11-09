import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
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
import { AddressPicker } from '@/components/address-picker';
import { AuthWaves } from '@/components/auth-waves';
import { BrandLockup } from '@/components/brand-lockup';
import { ApiError } from '@/lib/api';
import { fetchOrganizations, registerAccount } from '@/lib/auth';
import { PASSWORD_HINT, passwordStrengthError } from '@/lib/password';
import type { PickedAddress } from '@/lib/psgc';
import { useAppTheme } from '@/lib/theme';
import {
  availableServiceAreas,
  FALLBACK_BARANGAYS,
  matchOrganizationFromAddress,
  pickLakandula,
  type Organization,
} from '@/lib/types';
import { SafeAreaView } from 'react-native-safe-area-context';

const PLACEHOLDER = '#A9B7C8';
const INPUT_BG = '#F3F7FC';

export default function CreateAccountScreen() {
  const { colors, isDark } = useAppTheme();
  const router = useRouter();
  const [fullname, setFullname] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [areas, setAreas] = useState<Organization[]>(FALLBACK_BARANGAYS);
  const [address, setAddress] = useState<PickedAddress | null>(null);
  const [addressOpen, setAddressOpen] = useState(false);
  const [serviceArea, setServiceArea] = useState<Organization | undefined>(undefined);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<
    'fullname' | 'email' | 'phone' | 'password' | 'confirm' | null
  >(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const focusedWrapRef = useRef<View | null>(null);
  const scrollY = useRef(0);
  const keyboardHeightRef = useRef(0);
  const keyboardTopRef = useRef(0);
  const fullnameWrapRef = useRef<View>(null);
  const emailWrapRef = useRef<View>(null);
  const phoneWrapRef = useRef<View>(null);
  const phoneInputRef = useRef<TextInput>(null);
  const passwordWrapRef = useRef<View>(null);
  const confirmWrapRef = useRef<View>(null);
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const confirmInputRef = useRef<TextInput>(null);

  function scrollFocusedAboveKeyboard() {
    const node = focusedWrapRef.current;
    const keyboardTop =
      keyboardTopRef.current || Dimensions.get('window').height - keyboardHeightRef.current;
    if (!node || keyboardHeightRef.current <= 0) {
      return;
    }

    node.measureInWindow((_x, y, _width, height) => {
      const overflow = y + height + 28 - keyboardTop;
      if (overflow > 0) {
        scrollRef.current?.scrollTo({
          y: Math.max(0, scrollY.current + overflow),
          animated: true,
        });
      }
    });
  }

  function handleInputFocus(
    field: 'fullname' | 'email' | 'phone' | 'password' | 'confirm',
    node: View | null,
  ) {
    setFocusedField(field);
    focusedWrapRef.current = node;
    setTimeout(() => scrollFocusedAboveKeyboard(), 50);
    setTimeout(() => scrollFocusedAboveKeyboard(), 180);
  }

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (event) => {
      keyboardHeightRef.current = event.endCoordinates.height;
      keyboardTopRef.current = event.endCoordinates.screenY;
      setKeyboardHeight(event.endCoordinates.height);
      setTimeout(() => scrollFocusedAboveKeyboard(), 80);
    });
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => {
      keyboardHeightRef.current = 0;
      keyboardTopRef.current = 0;
      setKeyboardHeight(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    fetchOrganizations()
      .then((items) => {
        setAreas(availableServiceAreas(items.length > 0 ? items : FALLBACK_BARANGAYS));
      })
      .catch(() => {
        setAreas(FALLBACK_BARANGAYS);
      });
  }, []);

  useEffect(() => {
    if (!address) {
      setServiceArea(undefined);
      return;
    }

    setServiceArea(matchOrganizationFromAddress(areas, address) ?? pickLakandula(areas));
  }, [address, areas]);

  async function handleRegister() {
    const name = fullname.trim();
    const nextEmail = email.trim();

    const nextPhone = phone.replace(/[\s\-()]/g, '');

    if (!name || !nextEmail || !nextPhone || !address || !password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }

    if (!/^(\+?63|0)9\d{9}$/.test(nextPhone)) {
      setError('Enter a valid mobile number, like 09171234567.');
      return;
    }

    if (!acceptedTerms) {
      setError('Please agree to the Terms & Conditions and Privacy Policy.');
      return;
    }

    const passwordError = passwordStrengthError(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await registerAccount({
        name,
        email: nextEmail,
        contact_number: nextPhone,
        organization_id: serviceArea?.id ?? pickLakandula(areas)?.id,
        address: address.address,
        password,
        password_confirmation: confirmPassword,
      });
      router.replace({
        pathname: '/login',
        params: { registered: '1', username: nextEmail },
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.firstError() : 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const iconColor = isDark ? colors.muted : '#9AADC0';
  const placeholder = isDark ? '#8A95A8' : PLACEHOLDER;
  const inputBg = isDark ? colors.iconBg : INPUT_BG;
  const inputFocusBg = isDark ? '#243B63' : '#EEF4FF';
  const wrap = (focused: boolean) => ({
    backgroundColor: focused ? inputFocusBg : inputBg,
    borderColor: focused ? colors.blue : colors.border,
  });
  const keyboardOpen = keyboardHeight > 0;

  return (
    <View style={[styles.screen, { backgroundColor: isDark ? colors.page : '#FFFFFF' }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AuthWaves />

      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            ref={scrollRef}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
            onScroll={(event) => {
              scrollY.current = event.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={16}
            contentContainerStyle={[
              styles.content,
              { paddingBottom: 36 + keyboardHeight },
            ]}
            showsVerticalScrollIndicator={false}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={12}
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
              <Ionicons name="chevron-back" size={24} color={colors.navy} />
            </Pressable>

            <View style={[styles.logoWrap, keyboardOpen && styles.logoWrapCompact]}>
              <BrandLockup variant="compact" />
            </View>

            <Text style={[styles.title, { color: colors.navy }, keyboardOpen && styles.titleCompact]}>
              Create Account
            </Text>
            {keyboardOpen ? null : (
              <Text style={[styles.subtitle, { color: colors.muted }]}>
                Register as a passenger to book boats
              </Text>
            )}

            <View
              ref={fullnameWrapRef}
              collapsable={false}
              style={[styles.inputWrap, wrap(focusedField === 'fullname')]}>
              <Ionicons name="person-outline" size={18} color={iconColor} />
              <TextInput
                value={fullname}
                onChangeText={setFullname}
                onFocus={() => handleInputFocus('fullname', fullnameWrapRef.current)}
                onBlur={() => setFocusedField(null)}
                placeholder="Fullname"
                placeholderTextColor={placeholder}
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
                returnKeyType="next"
                onSubmitEditing={() => emailInputRef.current?.focus()}
                style={[styles.input, { color: colors.navy }]}
              />
            </View>

            <View
              ref={emailWrapRef}
              collapsable={false}
              style={[styles.inputWrap, wrap(focusedField === 'email')]}>
              <Ionicons name="mail-outline" size={18} color={iconColor} />
              <TextInput
                ref={emailInputRef}
                value={email}
                onChangeText={setEmail}
                onFocus={() => handleInputFocus('email', emailWrapRef.current)}
                onBlur={() => setFocusedField(null)}
                placeholder="Email"
                placeholderTextColor={placeholder}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="next"
                onSubmitEditing={() => phoneInputRef.current?.focus()}
                style={[styles.input, { color: colors.navy }]}
              />
            </View>

            <View
              ref={phoneWrapRef}
              collapsable={false}
              style={[styles.inputWrap, wrap(focusedField === 'phone')]}>
              <Ionicons name="call-outline" size={18} color={iconColor} />
              <TextInput
                ref={phoneInputRef}
                value={phone}
                onChangeText={setPhone}
                onFocus={() => handleInputFocus('phone', phoneWrapRef.current)}
                onBlur={() => setFocusedField(null)}
                placeholder="Mobile number (09XXXXXXXXX)"
                placeholderTextColor={placeholder}
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                maxLength={16}
                returnKeyType="next"
                onSubmitEditing={() => passwordInputRef.current?.focus()}
                style={[styles.input, { color: colors.navy }]}
              />
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Select address"
              onPress={() => setAddressOpen(true)}
              style={[styles.inputWrap, wrap(Boolean(address))]}>
              <Ionicons name="location-outline" size={18} color={iconColor} />
              <Text
                numberOfLines={1}
                style={[
                  styles.addressText,
                  { color: address ? colors.navy : placeholder },
                ]}>
                {address?.address ?? 'Select address'}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={iconColor} />
            </Pressable>
            {address ? (
              <Text style={[styles.areaHint, { color: colors.muted }]}>
                {serviceArea
                  ? `Service area: ${serviceArea.name}. You can change this later on Home.`
                  : 'Address saved. You can pick a service area later on Home.'}
              </Text>
            ) : (
              <Text style={[styles.areaHint, { color: colors.muted }]}>
                Pick your address first. Matching boat info will appear from that location.
              </Text>
            )}
            <AddressPicker
              open={addressOpen}
              onClose={() => setAddressOpen(false)}
              onSelect={setAddress}
            />

            <View
              ref={passwordWrapRef}
              collapsable={false}
              style={[styles.inputWrap, wrap(focusedField === 'password')]}>
              <Ionicons name="lock-closed-outline" size={18} color={iconColor} />
              <TextInput
                ref={passwordInputRef}
                value={password}
                onChangeText={setPassword}
                onFocus={() => handleInputFocus('password', passwordWrapRef.current)}
                onBlur={() => setFocusedField(null)}
                placeholder="Password"
                placeholderTextColor={placeholder}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="next"
                onSubmitEditing={() => confirmInputRef.current?.focus()}
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
                  size={18}
                  color={iconColor}
                />
              </Pressable>
            </View>
            <Text style={[styles.hint, { color: colors.muted }]}>{PASSWORD_HINT}</Text>

            <View
              ref={confirmWrapRef}
              collapsable={false}
              style={[styles.inputWrap, wrap(focusedField === 'confirm')]}>
              <Ionicons name="lock-closed-outline" size={18} color={iconColor} />
              <TextInput
                ref={confirmInputRef}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                onFocus={() => handleInputFocus('confirm', confirmWrapRef.current)}
                onBlur={() => setFocusedField(null)}
                placeholder="Confirm password"
                placeholderTextColor={placeholder}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="done"
                blurOnSubmit
                onSubmitEditing={() => Keyboard.dismiss()}
                style={[styles.input, { color: colors.navy }]}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                hitSlop={8}
                onPress={() => setShowConfirmPassword((visible) => !visible)}
                style={styles.eyeButton}>
                <Ionicons
                  name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={iconColor}
                />
              </Pressable>
            </View>

            <View style={styles.termsCheckRow}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: acceptedTerms }}
                hitSlop={8}
                onPress={() => setAcceptedTerms((value) => !value)}
                style={[
                  styles.checkbox,
                  {
                    borderColor: acceptedTerms ? colors.blue : colors.border,
                    backgroundColor: acceptedTerms ? colors.blue : 'transparent',
                  },
                ]}>
                {acceptedTerms ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
              </Pressable>
              <Text style={[styles.termsText, styles.termsCopy, { color: colors.muted }]}>
                I agree to the{' '}
                <Text
                  accessibilityRole="link"
                  onPress={() => router.push({ pathname: '/help', params: { section: 'terms', organization_id: serviceArea?.id ? String(serviceArea.id) : '' } })}
                  style={[styles.termsLink, { color: colors.blue }]}>
                  Terms & Conditions
                </Text>{' '}
                and{' '}
                <Text
                  accessibilityRole="link"
                  onPress={() => router.push({ pathname: '/help', params: { section: 'privacy', organization_id: serviceArea?.id ? String(serviceArea.id) : '' } })}
                  style={[styles.termsLink, { color: colors.blue }]}>
                  Privacy Policy
                </Text>
              </Text>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              accessibilityRole="button"
              disabled={submitting}
              style={({ pressed }) => [
                styles.registerButton,
                { backgroundColor: colors.blue },
                (pressed || submitting) && styles.pressed,
              ]}
              onPress={handleRegister}>
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.registerLabel}>Register</Text>
              )}
            </Pressable>

            <Pressable
              accessibilityRole="link"
              hitSlop={8}
              onPress={() => router.push('/forgot-password')}
              style={styles.forgotButton}>
              <Text style={[styles.forgotText, { color: colors.blue }]}>Forgot password?</Text>
            </Pressable>

            <View style={styles.loginRow}>
              <Text style={[styles.loginText, { color: colors.muted }]}>Already have an account? </Text>
              <Pressable
                accessibilityRole="link"
                hitSlop={6}
                onPress={() => router.replace('/login')}>
                <Text style={[styles.loginLink, { color: colors.blue }]}>Login</Text>
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
    paddingBottom: 28,
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    marginLeft: -8,
  },
  logoWrap: {
    alignItems: 'center',
    marginTop: -4,
    marginBottom: 2,
  },
  logoWrapCompact: {
    marginTop: -8,
    marginBottom: 0,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  titleCompact: {
    fontSize: 20,
    marginBottom: 10,
  },
  subtitle: {
    marginTop: 4,
    marginBottom: 16,
    fontSize: 14,
    textAlign: 'center',
  },
  hint: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 10,
    paddingHorizontal: 8,
  },
  inputWrap: {
    minHeight: 46,
    marginBottom: 10,
    borderWidth: 1,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  input: {
    flex: 1,
    height: 46,
    fontSize: 14,
  },
  addressText: {
    flex: 1,
    fontSize: 14,
  },
  areaHint: {
    marginTop: -4,
    marginBottom: 10,
    marginLeft: 8,
    fontSize: 12,
  },
  eyeButton: {
    paddingVertical: 6,
    paddingLeft: 4,
  },
  errorText: {
    marginBottom: 10,
    color: '#D64545',
    fontSize: 13,
    textAlign: 'center',
  },
  termsCheckRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 2,
    marginBottom: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  termsCopy: {
    flex: 1,
    lineHeight: 20,
  },
  termsText: {
    fontSize: 13,
  },
  termsLink: {
    fontSize: 13,
    fontWeight: '700',
  },
  registerButton: {
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  registerLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  forgotButton: {
    marginTop: 14,
    alignItems: 'center',
  },
  forgotText: {
    fontSize: 14,
    fontWeight: '700',
  },
  loginRow: {
    marginTop: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    fontSize: 14,
  },
  loginLink: {
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
  },
});
