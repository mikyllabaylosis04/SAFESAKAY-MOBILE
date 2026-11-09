
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getToken } from '@/lib/session';
import { fetchBooking } from '@/lib/bookings';
import { resolveMediaUrl } from '@/lib/config';
import type { MobileBooking } from '@/lib/types';
import { useAppTheme } from '@/lib/theme';

const BLUE = '#1A5AD7';
const GREEN = '#1FA971';

export default function RefundProcessedScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();

  const params = useLocalSearchParams<{
    bookingId?: string;
  }>();

  const bookingId = Number(params.bookingId);

  const [booking, setBooking] =
    useState<MobileBooking | null>(null);

  const [loading, setLoading] = useState(true);

  const [authToken, setAuthToken] = useState('');

  useEffect(() => {
    // FIX: getToken is exported from lib/session.
    void getToken().then((token) => {
      setAuthToken(token ?? '');
    });

    if (!bookingId) {
      setLoading(false);
      return;
    }

    void fetchBooking(bookingId)
      .then(setBooking)
      .finally(() => setLoading(false));
  }, [bookingId]);

  const incident = booking?.operator_no_show_incident;

  const amount =
    incident?.refund_amount_label ??
    booking?.down_payment_amount_label ??
    incident?.refundable_downpayment_label ??
    '—';

  // FIX: Use the existing media URL resolver.
  const receiptUrl = resolveMediaUrl(
    incident?.refund_receipt_url ?? '',
  );

  const receiptSource =
    receiptUrl && authToken
      ? {
          uri: receiptUrl,
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      : null;

  if (loading) {
    return (
      <SafeAreaView
        style={[
          styles.screen,
          { backgroundColor: colors.page },
        ]}
      >
        <ActivityIndicator
          style={{ marginTop: 40 }}
          color={BLUE}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[
        styles.screen,
        { backgroundColor: colors.page },
      ]}
    >
      <ScrollView contentContainerStyle={styles.body}>
        <View
          style={[
            styles.icon,
            { backgroundColor: GREEN },
          ]}
        >
          <Ionicons
            name="checkmark"
            size={34}
            color="#fff"
          />
        </View>

        <Text
          style={[
            styles.heading,
            { color: colors.navy },
          ]}
        >
          Refund Successfully Processed!
        </Text>

        <Text
          style={[
            styles.copy,
            { color: colors.muted },
          ]}
        >
          Your full downpayment has been successfully
          refunded through GCash.
        </Text>

        <View
          style={[
            styles.card,
            {
              borderColor: colors.border,
              backgroundColor: colors.card,
            },
          ]}
        >
          <Row
            label="Refund Amount"
            value={amount}
          />

          <Row
            label="Payment Method"
            value="GCash"
          />

          <Row
            label="Transaction Reference"
            value={incident?.refund_reference ?? '—'}
          />

          <Row
            label="Refund Date"
            value={
              incident?.refund_processed_at_label ?? '—'
            }
          />

          <Row
            label="Refund Status"
            value={
              incident?.refund_status_label ?? 'Refunded'
            }
          />
        </View>

        {receiptSource ? (
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/no-show/refund-details',
                params: {
                  bookingId: String(bookingId),
                },
              })
            }
          >
            <Image
              source={receiptSource}
              style={styles.receiptPreview}
              contentFit="cover"
            />

            <Text
              style={{
                color: BLUE,
                fontWeight: '700',
                textAlign: 'center',
                marginTop: 6,
              }}
            >
              View Refund Receipt
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={() => router.replace('/boats')}
          style={[
            styles.primaryBtn,
            { backgroundColor: BLUE },
          ]}
        >
          <Text style={styles.primaryText}>
            Rent Another Boat
          </Text>
        </Pressable>

        <Pressable
          onPress={() =>
            router.push({
              pathname: '/no-show/refund-details',
              params: {
                bookingId: String(bookingId),
              },
            })
          }
          style={[
            styles.outlineBtn,
            { borderColor: colors.border },
          ]}
        >
          <Text
            style={{
              color: colors.navy,
              fontWeight: '700',
            }}
          >
            View Refund Details
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.replace('/homepage')}
          style={styles.linkBtn}
        >
          <Text
            style={{
              color: colors.muted,
              fontWeight: '600',
            }}
          >
            Back to Homepage
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View
      style={{
        gap: 2,
        marginBottom: 10,
      }}
    >
      <Text
        style={{
          color: '#7A8699',
          fontSize: 13,
        }}
      >
        {label}
      </Text>

      <Text
        style={{
          color: '#163A5F',
          fontWeight: '700',
        }}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  body: {
    padding: 20,
    alignItems: 'center',
    gap: 12,
    paddingBottom: 40,
  },

  icon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  heading: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },

  copy: {
    textAlign: 'center',
    lineHeight: 20,
  },

  card: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginTop: 8,
  },

  primaryBtn: {
    marginTop: 8,
    width: '100%',
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  primaryText: {
    color: '#fff',
    fontWeight: '700',
  },

  outlineBtn: {
    width: '100%',
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },

  linkBtn: {
    paddingVertical: 12,
  },

  receiptPreview: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    marginTop: 8,
  },
});
