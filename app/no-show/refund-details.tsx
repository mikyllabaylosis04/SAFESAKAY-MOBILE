
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
import { useAppTheme } from '@/lib/theme';

const BLUE = '#1A5AD7';

export default function RefundDetailsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();

  const params = useLocalSearchParams<{
    bookingId?: string;
  }>();

  const bookingId = Number(params.bookingId);

  const [loading, setLoading] = useState(true);

  const [authToken, setAuthToken] = useState('');

  const [details, setDetails] = useState<{
    code: string;
    amount: string;
    reference: string;
    date: string;
    status: string;
    receiptUrl?: string | null;
  } | null>(null);

  useEffect(() => {
    // FIX: Read the authentication token from session.
    void getToken().then((token) => {
      setAuthToken(token ?? '');
    });

    if (!bookingId) {
      setLoading(false);
      return;
    }

    void fetchBooking(bookingId)
      .then((booking) => {
        const incident =
          booking?.operator_no_show_incident;

        setDetails({
          code: booking?.code ?? '—',

          amount:
            incident?.refund_amount_label ??
            booking?.down_payment_amount_label ??
            incident?.refundable_downpayment_label ??
            '—',

          reference:
            incident?.refund_reference ?? '—',

          date:
            incident?.refund_processed_at_label ?? '—',

          status:
            incident?.refund_status_label ?? 'Refunded',

          receiptUrl:
            incident?.refund_receipt_url,
        });
      })
      .finally(() => setLoading(false));
  }, [bookingId]);

  // FIX: Resolve the receipt URL using lib/config.
  const receiptUrl = resolveMediaUrl(
    details?.receiptUrl ?? '',
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

  return (
    <SafeAreaView
      style={[
        styles.screen,
        { backgroundColor: colors.page },
      ]}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Ionicons
            name="arrow-back"
            size={22}
            color={colors.navy}
          />
        </Pressable>

        <Text
          style={[
            styles.title,
            { color: colors.navy },
          ]}
        >
          Refund Details
        </Text>
      </View>

      {loading || !details ? (
        <ActivityIndicator
          style={{ marginTop: 24 }}
          color={BLUE}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: 16,
            gap: 12,
          }}
        >
          <Info
            label="Booking reference"
            value={`#${details.code}`}
          />

          <Info
            label="Refund amount"
            value={details.amount}
          />

          <Info
            label="GCash reference"
            value={details.reference}
          />

          <Info
            label="Refund date"
            value={details.date}
          />

          <Info
            label="Status"
            value={details.status}
          />

          {receiptSource ? (
            <Image
              source={receiptSource}
              style={styles.receipt}
              contentFit="contain"
            />
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <Text
        style={{
          color: '#7A8699',
        }}
      >
        {label}
      </Text>

      <Text
        style={{
          color: '#163A5F',
          fontWeight: '700',
          flex: 1,
          textAlign: 'right',
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

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },

  title: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },

  btn: {
    marginTop: 12,
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  btnText: {
    color: '#fff',
    fontWeight: '700',
  },

  receipt: {
    width: '100%',
    height: 320,
    borderRadius: 12,
    marginTop: 8,
    backgroundColor: '#EEF1F6',
  },
});
