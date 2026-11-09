import { Dimensions, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useAppTheme } from '@/lib/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Props = {
  height?: 140 | 180;
};

export function AuthWaves({ height = 140 }: Props) {
  const { isDark } = useAppTheme();
  const top = isDark ? '#1B2C4D' : '#E7F1FC';
  const mid = isDark ? '#162238' : '#D6E7FB';
  const bottom = isDark ? '#121A2C' : '#C5DEF5';

  return (
    <View pointerEvents="none" style={[styles.wrap, { height }]}>
      <Svg
        width={SCREEN_WIDTH}
        height={height}
        viewBox={`0 0 390 ${height}`}
        preserveAspectRatio="xMidYMax slice">
        <Path
          d="M-20 88 C70 40 140 120 210 72 C280 24 330 110 420 70 L420 200 L-20 200 Z"
          fill={top}
        />
        <Path
          d="M-20 108 C90 70 160 138 250 98 C330 62 360 128 420 108 L420 200 L-20 200 Z"
          fill={mid}
        />
        {height === 180 ? (
          <Path
            d="M-20 148 C100 124 170 168 250 150 C330 132 360 168 420 156 L420 200 L-20 200 Z"
            fill={bottom}
          />
        ) : null}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
