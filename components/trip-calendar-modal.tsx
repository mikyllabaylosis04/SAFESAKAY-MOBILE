import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/lib/theme';
import type { DayWeatherMark } from '@/lib/weather';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_DAYS_AHEAD = 90;
const LEGEND = [
  { label: 'Booked', bg: '#DCEBFF', border: '#1A5AD7' },
  { label: 'Weather hold', bg: '#FDECEC', border: '#E25C5C' },
  { label: 'Weather watch', bg: '#FFF7E0', border: '#F6C453' },
];

export function padDatePart(value: number) {
  return String(value).padStart(2, '0');
}

export function toYmd(date: Date) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

export function fromYmd(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export function maxBookableDate() {
  const date = startOfToday();
  date.setDate(date.getDate() + MAX_DAYS_AHEAD);
  return date;
}

export function formatTripDate(value: string) {
  return fromYmd(value).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

type Props = {
  open: boolean;
  selected: string;
  weatherDates?: Record<string, DayWeatherMark | string>;
  onClose: () => void;
  onSelect: (value: string) => void;
  onVisibleDates?: (dates: string[]) => void;
};

export function TripCalendarModal({
  open,
  selected,
  weatherDates = {},
  onClose,
  onSelect,
  onVisibleDates,
}: Props) {
  const { colors } = useAppTheme();
  const min = startOfToday();
  const max = maxBookableDate();
  const selectedDate = selected ? fromYmd(selected) : min;
  const [cursor, setCursor] = useState(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));

  useEffect(() => {
    if (open) {
      const next = selected ? fromYmd(selected) : startOfToday();
      setCursor(new Date(next.getFullYear(), next.getMonth(), 1));
    }
  }, [open, selected]);

  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const values: Array<string | null> = Array.from({ length: firstWeekday }, () => null);

    for (let day = 1; day <= daysInMonth; day += 1) {
      values.push(toYmd(new Date(year, month, day)));
    }

    while (values.length % 7 !== 0) {
      values.push(null);
    }

    return values;
  }, [cursor]);

  useEffect(() => {
    if (!open) {
      return;
    }
    onVisibleDates?.(cells.filter((value): value is string => Boolean(value)));
  }, [cells, open, onVisibleDates]);

  const monthLabel = cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const minMonth = new Date(min.getFullYear(), min.getMonth(), 1);
  const maxMonth = new Date(max.getFullYear(), max.getMonth(), 1);
  const canGoPrev = cursor > minMonth;
  const canGoNext = cursor < maxMonth;

  return (
    <Modal animationType="fade" transparent visible={open} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.navy }]}>Pick a trip date</Text>
            <Pressable accessibilityRole="button" hitSlop={8} onPress={onClose}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>
          <Text style={[styles.hint, { color: colors.muted }]}>Up to {MAX_DAYS_AHEAD} days ahead.</Text>
          <View style={styles.legend}>
            {LEGEND.map((item) => (
              <View key={item.label} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: item.bg, borderColor: item.border }]} />
                <Text style={[styles.legendText, { color: colors.muted }]}>{item.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.monthRow}>
            <Pressable
              disabled={!canGoPrev}
              onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
              style={[styles.monthBtn, { backgroundColor: colors.iconBg, opacity: canGoPrev ? 1 : 0.35 }]}>
              <Ionicons name="chevron-back" size={18} color={colors.navy} />
            </Pressable>
            <Text style={[styles.monthLabel, { color: colors.navy }]}>{monthLabel}</Text>
            <Pressable
              disabled={!canGoNext}
              onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              style={[styles.monthBtn, { backgroundColor: colors.iconBg, opacity: canGoNext ? 1 : 0.35 }]}>
              <Ionicons name="chevron-forward" size={18} color={colors.navy} />
            </Pressable>
          </View>

          <View style={styles.weekRow}>
            {WEEKDAYS.map((day) => (
              <Text key={day} style={[styles.weekday, { color: colors.muted }]}>
                {day}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((value, index) => {
              if (!value) {
                return <View key={`empty-${index}`} style={styles.dayCell} />;
              }

              const date = fromYmd(value);
              const mark = weatherDates[value];
              const tone = typeof mark === 'string' ? 'red' : mark?.tone;
              const weatherRed = tone === 'red';
              const weatherWatch = tone === 'yellow';
              const booked = tone === 'blue';
              const active = value === selected;
              const today = value === toYmd(min);

              return (
                <Pressable
                  key={value}
                  disabled={date < min || date > max}
                  onPress={() => {
                    onSelect(value);
                    onClose();
                  }}
                  style={[
                    styles.dayCell,
                    today && !active && !weatherRed && !weatherWatch && !booked && {
                      borderColor: colors.blue,
                      borderWidth: 1,
                    },
                    booked && { backgroundColor: '#DCEBFF', borderColor: colors.blue, borderWidth: 2 },
                    weatherRed && { backgroundColor: '#FDECEC', borderColor: '#E25C5C', borderWidth: 2 },
                    weatherWatch && { backgroundColor: '#FFF7E0', borderColor: '#F6C453', borderWidth: 1 },
                    active && weatherRed && { backgroundColor: '#C53030', borderColor: '#C53030' },
                    active && booked && { backgroundColor: colors.blue, borderColor: colors.blue },
                    active && !weatherRed && !booked && { backgroundColor: colors.blue, borderColor: colors.blue },
                  ]}>
                  <Text
                    style={[
                      styles.dayText,
                      { color: date < min || date > max ? colors.border : colors.navy },
                      booked && !active && { color: colors.blue, fontWeight: '800' },
                      weatherRed && { color: active ? '#FFFFFF' : '#C53030', fontWeight: '800' },
                      weatherWatch && !active && { color: '#B45309', fontWeight: '800' },
                      active && !weatherRed && { color: '#FFFFFF', fontWeight: '800' },
                    ]}>
                    {date.getDate()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  sheet: {
    zIndex: 1,
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
  },
  legendText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 8,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  monthBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: '800',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekday: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dayText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
