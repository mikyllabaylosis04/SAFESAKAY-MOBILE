import { Redirect, useRootNavigationState } from 'expo-router';
import { View } from 'react-native';

export default function Index() {
  const navigation = useRootNavigationState();

  if (!navigation?.key) {
    return <View style={{ flex: 1 }} />;
  }

  return <Redirect href="/intro" />;
}
