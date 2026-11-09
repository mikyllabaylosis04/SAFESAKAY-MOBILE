import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/lib/api';
import { getStoredUser, updateName, updatePassword } from '@/lib/auth';
import { isOperator } from '@/lib/roles';
import { useAppTheme } from '@/lib/theme';

const PLACEHOLDER = '#B8BDC8';

type FocusedField = 'name' | 'current' | 'password' | 'confirm' | null;

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const [name, setName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [nameMessage, setNameMessage] = useState('');
  const [nameError, setNameError] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [focusedField, setFocusedField] = useState<FocusedField>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [operator, setOperator] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const focusedRef = useRef<FocusedField>(null);
  const fieldRefs = useRef<Partial<Record<Exclude<FocusedField, null>, View | null>>>({});

  function setFocus(field: Exclude<FocusedField, null>) {
    focusedRef.current = field;
    setFocusedField(field);
  }

  function keepFieldVisible(keyboardHeight: number) {
    const field = focusedRef.current;
    if (!field) {
      return;
    }

    fieldRefs.current[field]?.measureInWindow((_x, y, _w, h) => {
      const limit = Dimensions.get('window').height - keyboardHeight - 24;
      const bottom = y + h;
      if (bottom > limit) {
        scrollRef.current?.scrollTo({
          y: scrollY.current + (bottom - limit),
          animated: true,
        });
      }
    });
  }

  function inputStyle(field: Exclude<FocusedField, null>) {
    const focused = focusedField === field;
    return [
      styles.inputWrap,
      {
        borderColor: focused ? colors.blue : colors.border,
        backgroundColor: focused ? (isDark ? colors.iconBg : '#EEF4FF') : colors.card,
        borderWidth: focused ? 2 : 1.5,
      },
    ];
  }

  useEffect(() => {
    getStoredUser().then((user) => {
      setOperator(isOperator(user));
      if (user?.name) {
        setName(user.name);
      }
    });
  }, []);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardHeight(event.endCoordinates.height);
      keepFieldVisible(event.endCoordinates.height);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      focusedRef.current = null;
      setKeyboardHeight(0);
    });

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  async function handleSaveName() {
    const nextName = name.trim();
    if (!nextName) {
      setNameError('Please enter your name.');
      setNameMessage('');
      return;
    }

    setSavingName(true);
    setNameError('');
    setNameMessage('');

    try {
      const user = await updateName(nextName);
      setName(user.name);
      setNameMessage('Name updated.');
    } catch (err) {
      setNameError(err instanceof ApiError ? err.firstError() : 'Could not update name.');
    } finally {
      setSavingName(false);
    }
  }

  async function handleSavePassword() {
    if (!currentPassword || !password || !confirmPassword) {
      setPasswordError('Please fill in all password fields.');
      setPasswordMessage('');
      return;
    }

    if (password.length < 8) {
      setPasswordError('Password must contain at least 8 characters.');
      setPasswordMessage('');
      return;
    }

    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      setPasswordMessage('');
      return;
    }

    setSavingPassword(true);
    setPasswordError('');
    setPasswordMessage('');

    try {
      await updatePassword({
        current_password: currentPassword,
        password,
        password_confirmation: confirmPassword,
      });
      setCurrentPassword('');
      setPassword('');
      setConfirmPassword('');
      setPasswordMessage('Password updated.');
    } catch (err) {
      setPasswordError(err instanceof ApiError ? err.firstError() : 'Could not update password.');
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.page }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top']}>
          <ScrollView
            ref={scrollRef}
            style={styles.flex}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            onScroll={(event) => {
              scrollY.current = event.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={16}
            contentContainerStyle={[
              styles.content,
              { paddingBottom: 32 + insets.bottom + keyboardHeight },
            ]}>
            <Pressable
              hitSlop={12}
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
              <Ionicons name="chevron-back" size={26} color={colors.navy} />
            </Pressable>

            <Text style={[styles.title, { color: colors.navy }]}>Settings</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>
              {operator ? 'Update your password. Operator details are managed by admin.' : 'Change your name and password.'}
            </Text>

            {operator ? null : (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.navy }]}>Change Name</Text>
              <Text style={[styles.label, { color: colors.navy }]}>Fullname</Text>
              <View
                ref={(node) => {
                  fieldRefs.current.name = node;
                }}
                collapsable={false}
                style={inputStyle('name')}>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  onFocus={() => setFocus('name')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Enter your fullname"
                  placeholderTextColor={PLACEHOLDER}
                  autoCapitalize="words"
                  style={[styles.input, { color: colors.navy }]}
                />
              </View>
              {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}
              {nameMessage ? <Text style={styles.successText}>{nameMessage}</Text> : null}
              <Pressable
                disabled={savingName}
                onPress={handleSaveName}
                style={({ pressed }) => [
                  styles.saveBtn,
                  { backgroundColor: colors.blue },
                  (pressed || savingName) && styles.pressed,
                ]}>
                {savingName ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveText}>Save Name</Text>
                )}
              </Pressable>
            </View>
            )}

            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.navy }]}>Change Password</Text>
              <Text style={[styles.label, { color: colors.navy }]}>Current Password</Text>
              <View
                ref={(node) => {
                  fieldRefs.current.current = node;
                }}
                collapsable={false}
                style={inputStyle('current')}>
                <TextInput
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  onFocus={() => setFocus('current')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Enter current password"
                  placeholderTextColor={PLACEHOLDER}
                  secureTextEntry={!showCurrent}
                  autoCapitalize="none"
                  style={[styles.input, { color: colors.navy }]}
                />
                <Pressable hitSlop={8} onPress={() => setShowCurrent((value) => !value)}>
                  <Ionicons name={showCurrent ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.muted} />
                </Pressable>
              </View>

              <Text style={[styles.label, { color: colors.navy }]}>New Password</Text>
              <View
                ref={(node) => {
                  fieldRefs.current.password = node;
                }}
                collapsable={false}
                style={inputStyle('password')}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setFocus('password')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Enter new password"
                  placeholderTextColor={PLACEHOLDER}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  style={[styles.input, { color: colors.navy }]}
                />
                <Pressable hitSlop={8} onPress={() => setShowPassword((value) => !value)}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.muted} />
                </Pressable>
              </View>
              <Text style={[styles.hint, { color: colors.muted }]}>
                Password must contain at least 8 characters.
              </Text>

              <Text style={[styles.label, { color: colors.navy }]}>Confirm New Password</Text>
              <View
                ref={(node) => {
                  fieldRefs.current.confirm = node;
                }}
                collapsable={false}
                style={inputStyle('confirm')}>
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  onFocus={() => setFocus('confirm')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Confirm new password"
                  placeholderTextColor={PLACEHOLDER}
                  secureTextEntry={!showConfirm}
                  autoCapitalize="none"
                  style={[styles.input, { color: colors.navy }]}
                />
                <Pressable hitSlop={8} onPress={() => setShowConfirm((value) => !value)}>
                  <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.muted} />
                </Pressable>
              </View>
              {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
              {passwordMessage ? <Text style={styles.successText}>{passwordMessage}</Text> : null}
              <Pressable
                disabled={savingPassword}
                onPress={handleSavePassword}
                style={({ pressed }) => [
                  styles.saveBtn,
                  { backgroundColor: colors.blue },
                  (pressed || savingPassword) && styles.pressed,
                ]}>
                {savingPassword ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveText}>Save Password</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginLeft: -8,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 16,
    fontSize: 14,
  },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
  },
  label: {
    marginBottom: 6,
    marginTop: 4,
    fontSize: 14,
    fontWeight: '700',
  },
  inputWrap: {
    minHeight: 48,
    borderWidth: 1.5,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 15,
  },
  hint: {
    marginTop: 6,
    marginBottom: 8,
    fontSize: 12,
  },
  errorText: {
    marginTop: 8,
    color: '#D64545',
    fontSize: 13,
  },
  successText: {
    marginTop: 8,
    color: '#1FA971',
    fontSize: 13,
    fontWeight: '600',
  },
  saveBtn: {
    marginTop: 14,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.82,
  },
});
