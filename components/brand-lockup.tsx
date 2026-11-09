import { Image, StyleSheet, Text, View } from 'react-native';

export const SAFESAKAY_LOGO = require('@/assets/images/safesakay-logo.png');
export const BRAND_BLUE = '#1A5AD7';

type Props = {
  variant?: 'header' | 'menu' | 'about' | 'hero' | 'login' | 'compact';
  color?: string;
  tagline?: string;
  taglineColor?: string;
};

export function BrandLockup({
  variant = 'header',
  color = BRAND_BLUE,
  tagline,
  taglineColor,
}: Props) {
  if (variant === 'hero' || variant === 'about' || variant === 'login' || variant === 'compact') {
    const logoStyle =
      variant === 'hero'
        ? styles.heroLogo
        : variant === 'login'
          ? styles.loginLogo
          : variant === 'compact'
            ? styles.compactLogo
            : styles.aboutLogo;

    return <Image source={SAFESAKAY_LOGO} style={logoStyle} resizeMode="contain" />;
  }

  return (
    <View style={styles.row}>
      <Image
        source={SAFESAKAY_LOGO}
        style={variant === 'menu' ? styles.menuLogo : styles.headerLogo}
        resizeMode="contain"
      />
      <View style={styles.copy}>
        <Text style={[variant === 'menu' ? styles.menuName : styles.headerName, { color }]}>
          SAFESAKAY
        </Text>
        {tagline ? (
          <Text style={[styles.tagline, taglineColor ? { color: taglineColor } : null]}>{tagline}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  copy: {
    flexShrink: 1,
  },
  headerLogo: {
    width: 38,
    height: 30,
  },
  headerName: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  menuLogo: {
    width: 52,
    height: 42,
  },
  menuName: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  tagline: {
    marginTop: 2,
    color: '#3D4660',
    fontSize: 11,
    fontWeight: '500',
  },
  aboutLogo: {
    width: 132,
    height: 106,
  },
  heroLogo: {
    width: 168,
    height: 134,
  },
  loginLogo: {
    width: 112,
    height: 90,
  },
  compactLogo: {
    width: 78,
    height: 62,
  },
});
