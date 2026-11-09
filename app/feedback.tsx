import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthWaves } from '@/components/auth-waves';
import { SAFESAKAY_LOGO } from '@/components/brand-lockup';
import { ApiError } from '@/lib/api';
import { fetchBooking } from '@/lib/bookings';
import { resolveMediaUrl } from '@/lib/config';
import { getFeedback, saveFeedback } from '@/lib/feedback';
import { useAppTheme } from '@/lib/theme';
import type { MobileBooking } from '@/lib/types';

const BLUE = '#1A5AD7';
const GREEN = '#22C55E';
const STAR = '#F5C542';
const FALLBACK_BOAT =
  'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&q=80';

const TAGS = ['Clean Boat', 'Friendly Operator', 'Safe Trip', 'Good Experience'];
const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

type Step = 'done' | 'rate' | 'sending' | 'thanks';

export default function FeedbackScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const params = useLocalSearchParams<{ id?: string }>();
  const bookingId = Number(params.id);

  const [booking, setBooking] = useState<MobileBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>('done');
  const [rating, setRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!bookingId) {
      setLoading(false);
      return;
    }

    Promise.all([fetchBooking(bookingId), getFeedback(bookingId).catch(() => null)])
      .then(([next, existing]) => {
        setBooking(next);
        if (existing) {
          setRating(existing.rating);
          setSelectedTags(existing.tags);
          setComment(existing.comment);
          setStep('thanks');
        }
      })
      .catch(() => setBooking(null))
      .finally(() => setLoading(false));
  }, [bookingId]);

  const photo = resolveMediaUrl(booking?.boat.picture_url) || FALLBACK_BOAT;
  const commentCount = comment.length;

  const ratingCopy = useMemo(() => RATING_LABELS[rating] || '', [rating]);

  function toggleTag(tag: string) {
    setSelectedTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag],
    );
  }

  async function submit() {
    if (!booking || rating < 1) {
      setError('Please tap a star rating first.');
      return;
    }

    setError('');
    setStep('sending');
    const started = Date.now();

    try {
      await saveFeedback({
        bookingId: booking.id,
        rating,
        tags: selectedTags,
        comment: comment.trim(),
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.firstError() : 'Could not submit feedback. Please try again.');
      setStep('rate');
      return;
    }

    const wait = Math.max(0, 1100 - (Date.now() - started));
    setTimeout(() => setStep('thanks'), wait);
  }

  function goHome() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/homepage');
  }

  if (loading) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.page }]}>
        <ActivityIndicator color={BLUE} style={{ flex: 1 }} />
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.page }]}>
        <SafeAreaView style={styles.safe} edges={['top']}>
          <Text style={[styles.missing, { color: colors.navy }]}>Rental not found.</Text>
          <Pressable onPress={goHome} style={[styles.primaryBtn, { backgroundColor: BLUE }]}>
            <Text style={styles.primaryText}>Back</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  if (step === 'sending') {
    return (
      <View style={[styles.screen, { backgroundColor: isDark ? colors.page : '#F4F8FF' }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <SafeAreaView style={styles.centerSafe} edges={['top']}>
          <Pressable hitSlop={12} onPress={() => setStep('rate')} style={styles.plainBack}>
            <Ionicons name="chevron-back" size={24} color={colors.navy} />
          </Pressable>
          <View style={styles.centerBody}>
            <View style={[styles.heroIconWrap, { backgroundColor: isDark ? '#1B2C4D' : '#E8F1FF' }]}>
              <Ionicons name="boat" size={54} color={BLUE} />
            </View>
            <Text style={[styles.centerTitle, { color: colors.navy }]}>Submitting{'\n'}your feedback...</Text>
            <Text style={[styles.centerBodyText, { color: colors.muted }]}>
              Please wait a moment while we save your feedback.
            </Text>
            <ActivityIndicator color={BLUE} style={{ marginTop: 18 }} />
          </View>
        </SafeAreaView>
        <AuthWaves height={180} />
      </View>
    );
  }

  if (step === 'thanks') {
    return (
      <View style={[styles.screen, { backgroundColor: isDark ? colors.page : '#F4F8FF' }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Image source={SAFESAKAY_LOGO} style={styles.thanksLogoBg} contentFit="contain" />
        <AuthWaves height={180} />
        <SafeAreaView style={styles.centerSafe} edges={['top']}>
          <View style={styles.centerBody}>
            <Image source={SAFESAKAY_LOGO} style={styles.thanksLogo} contentFit="contain" />
            <Text style={[styles.centerTitle, { color: colors.navy }]}>Thank You!</Text>
            <Text style={[styles.centerBodyText, { color: colors.muted }]}>
              Your feedback has been submitted successfully.
            </Text>
            <Text style={[styles.thanksNote, { color: colors.muted }]}>
              Thank you for using SafeSakay Mobile App. We look forward to serving you again on your
              next trips ahead!
            </Text>
          </View>
          <Pressable
            onPress={goHome}
            style={({ pressed }) => [
              styles.primaryBtn,
              styles.doneBtn,
              { backgroundColor: BLUE, marginBottom: Math.max(insets.bottom, 16) + 8 },
              pressed && styles.pressed,
            ]}>
            <Text style={styles.primaryText}>Done</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  if (step === 'rate') {
    return (
      <View style={[styles.screen, { backgroundColor: colors.page }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <SafeAreaView style={styles.safe} edges={['top']}>
          <View style={styles.topBar}>
            <Pressable hitSlop={12} onPress={() => setStep('done')} style={styles.plainBack}>
              <Ionicons name="chevron-back" size={24} color={colors.navy} />
            </Pressable>
            <Text style={[styles.topTitle, { color: colors.navy }]}>Rate Your Journey</Text>
            <View style={styles.plainBack} />
          </View>

          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[
                styles.rateContent,
                { paddingBottom: Math.max(insets.bottom, 16) + 88 },
              ]}>
              <Text style={[styles.rateIntro, { color: colors.muted }]}>
                How was your experience with this trip?
              </Text>

              <View style={[styles.boatCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Image source={{ uri: photo }} style={styles.boatThumb} contentFit="cover" />
                <View style={styles.boatCopy}>
                  <Text style={[styles.boatName, { color: colors.navy }]}>{booking.boat.name}</Text>
                  <Text style={[styles.boatMeta, { color: colors.muted }]}>Boat Rental</Text>
                  <Text style={[styles.boatCode, { color: BLUE }]}>{booking.code}</Text>
                </View>
              </View>

              <Text style={[styles.sectionLabel, { color: colors.navy }]}>Your Rating</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <Pressable key={value} hitSlop={6} onPress={() => setRating(value)}>
                    <Ionicons
                      name={value <= rating ? 'star' : 'star-outline'}
                      size={36}
                      color={STAR}
                    />
                  </Pressable>
                ))}
              </View>
              {ratingCopy ? (
                <Text style={[styles.ratingWord, { color: colors.muted }]}>{ratingCopy}!</Text>
              ) : null}

              <Text style={[styles.sectionLabel, { color: colors.navy }]}>What did you like the most?</Text>
              <View style={styles.tagsWrap}>
                {TAGS.map((tag) => {
                  const on = selectedTags.includes(tag);
                  return (
                    <Pressable
                      key={tag}
                      onPress={() => toggleTag(tag)}
                      style={[
                        styles.tag,
                        {
                          backgroundColor: on ? BLUE : isDark ? colors.iconBg : '#EEF4FF',
                          borderColor: on ? BLUE : colors.border,
                        },
                      ]}>
                      <Text style={[styles.tagText, { color: on ? '#FFFFFF' : colors.navy }]}>{tag}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.sectionLabel, { color: colors.navy }]}>Feedback (Optional)</Text>
              <View style={[styles.commentBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <TextInput
                  value={comment}
                  onChangeText={(value) => setComment(value.slice(0, 500))}
                  placeholder="The trip was smooth and safe. The operator was friendly and very accommodating!"
                  placeholderTextColor={isDark ? '#8A94A8' : '#A9B7C8'}
                  multiline
                  textAlignVertical="top"
                  style={[styles.commentInput, { color: colors.navy }]}
                />
                <Text style={[styles.counter, { color: colors.muted }]}>{commentCount}/500</Text>
              </View>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </ScrollView>
          </KeyboardAvoidingView>

          <View
            style={[
              styles.bottomBar,
              { paddingBottom: Math.max(insets.bottom, 16), backgroundColor: colors.page },
            ]}>
            <Pressable
              onPress={() => void submit()}
              style={({ pressed }) => [styles.primaryBtn, { backgroundColor: BLUE }, pressed && styles.pressed]}>
              <Text style={styles.primaryText}>Submit Feedback</Text>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <LinearGradient colors={['#163A86', '#1A5AD7', '#0E2A5C']} style={styles.hero}>
        <Image source={SAFESAKAY_LOGO} style={styles.logoBg} contentFit="contain" />
        <SafeAreaView style={styles.heroSafe} edges={['top']}>
          <View style={styles.heroTop}>
            <Pressable hitSlop={12} onPress={goHome} style={styles.heroBack}>
              <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
            </Pressable>
            <View style={styles.brandRow}>
              <Image source={SAFESAKAY_LOGO} style={styles.headerLogo} contentFit="contain" />
              <Text style={styles.brandName}>SAFESAKAY</Text>
            </View>
            <View style={styles.heroBack} />
          </View>

          <View style={styles.heroCopy}>
            <View style={styles.checkRing}>
              <View style={styles.checkCircle}>
                <Ionicons name="checkmark" size={34} color="#FFFFFF" />
              </View>
            </View>
            <Text style={styles.heroTitle}>Trip Completed!</Text>
            <Text style={styles.heroSubtitle}>
              Your trip has been successfully completed. We hope you had a safe and pleasant journey.
            </Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <View style={[styles.sheet, { backgroundColor: colors.page }]}>
        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.summaryTop}>
            <Image source={{ uri: photo }} style={styles.summaryPhoto} contentFit="cover" />
            <View style={styles.boatCopy}>
              <Text style={[styles.boatName, { color: colors.navy }]}>{booking.boat.name}</Text>
              <Text style={[styles.boatMeta, { color: colors.muted }]}>Boat Rental</Text>
              <Text style={[styles.boatCode, { color: BLUE }]}>{booking.code}</Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.summaryRow}>
            <View style={[styles.miniIcon, { backgroundColor: isDark ? colors.iconBg : '#EEF4FF' }]}>
              <Ionicons name="calendar-outline" size={16} color={BLUE} />
            </View>
            <Text style={[styles.summaryLabel, { color: colors.muted }]}>Date</Text>
            <Text style={[styles.summaryValue, { color: colors.navy }]}>{booking.booking_date_label}</Text>
          </View>
          <View style={styles.summaryRow}>
            <View style={[styles.miniIcon, { backgroundColor: isDark ? colors.iconBg : '#EEF4FF' }]}>
              <Ionicons name="location-outline" size={16} color={BLUE} />
            </View>
            <Text style={[styles.summaryLabel, { color: colors.muted }]}>Destination</Text>
            <Text style={[styles.summaryValue, { color: colors.navy }]} numberOfLines={2}>
              {booking.destination}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={() => setStep('rate')}
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: BLUE, marginTop: 18, marginBottom: Math.max(insets.bottom, 16) },
            pressed && styles.pressed,
          ]}>
          <Text style={styles.primaryText}>Rate Your Journey</Text>
          <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#163A86',
  },
  safe: {
    flex: 1,
  },
  missing: {
    marginTop: 40,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
  },
  hero: {
    minHeight: 390,
    overflow: 'hidden',
  },
  logoBg: {
    position: 'absolute',
    width: 320,
    height: 260,
    alignSelf: 'center',
    top: 86,
    opacity: 0.18,
  },
  heroSafe: {
    flex: 1,
    paddingHorizontal: 20,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroBack: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerLogo: {
    width: 28,
    height: 22,
  },
  brandName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  heroCopy: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 36,
  },
  checkRing: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: 'rgba(34, 197, 94, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    marginTop: 16,
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },
  heroSubtitle: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.86)',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 18,
  },
  sheet: {
    flex: 1,
    marginTop: -28,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  summaryCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  summaryPhoto: {
    width: 62,
    height: 62,
    borderRadius: 14,
    backgroundColor: '#D7E8FB',
  },
  boatCopy: {
    flex: 1,
  },
  boatName: {
    fontSize: 18,
    fontWeight: '800',
  },
  boatMeta: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '600',
  },
  boatCode: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    marginVertical: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  miniIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  summaryValue: {
    flex: 1.4,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'right',
  },
  primaryBtn: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: BLUE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.86,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    minHeight: 48,
  },
  plainBack: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  rateContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  rateIntro: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 16,
  },
  boatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
  },
  boatThumb: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: '#D7E8FB',
  },
  sectionLabel: {
    marginTop: 22,
    marginBottom: 10,
    fontSize: 16,
    fontWeight: '800',
  },
  starsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  ratingWord: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '700',
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '700',
  },
  commentBox: {
    borderWidth: 1,
    borderRadius: 16,
    minHeight: 120,
    padding: 12,
  },
  commentInput: {
    minHeight: 86,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  counter: {
    alignSelf: 'flex-end',
    fontSize: 12,
    fontWeight: '600',
  },
  errorText: {
    marginTop: 10,
    color: '#E25C5C',
    fontSize: 13,
    fontWeight: '700',
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  centerSafe: {
    flex: 1,
    zIndex: 2,
  },
  thanksLogo: {
    width: 168,
    height: 134,
  },
  thanksLogoBg: {
    position: 'absolute',
    width: 340,
    height: 270,
    alignSelf: 'center',
    top: 70,
    opacity: 0.12,
  },
  doneBtn: {
    marginHorizontal: 24,
    zIndex: 3,
  },
  centerBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  centerTitle: {
    marginTop: 18,
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 34,
  },
  centerBodyText: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    fontWeight: '600',
  },
  heroIconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thanksArt: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  thanksNote: {
    marginTop: 22,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    fontWeight: '500',
  },
});
