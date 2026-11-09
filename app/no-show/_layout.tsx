import { Stack } from 'expo-router';

export default function NoShowLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
