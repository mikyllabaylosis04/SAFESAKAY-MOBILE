import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export type PickedImage = {
  uri: string;
  mime?: string;
  name?: string;
};

const OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  quality: 0.85,
};

function toPicked(asset: ImagePicker.ImagePickerAsset): PickedImage {
  return {
    uri: asset.uri,
    mime: asset.mimeType ?? undefined,
    name: asset.fileName ?? undefined,
  };
}

export async function takeProofPhoto(): Promise<PickedImage | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('Camera permission needed', 'Allow camera access to take a proof photo.');
    return null;
  }

  const result = await ImagePicker.launchCameraAsync(OPTIONS);
  if (result.canceled || !result.assets[0]?.uri) {
    return null;
  }

  return toPicked(result.assets[0]);
}

export async function chooseProofFromGallery(): Promise<PickedImage | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('Photos permission needed', 'Allow photo access to upload proof from your gallery.');
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync(OPTIONS);
  if (result.canceled || !result.assets[0]?.uri) {
    return null;
  }

  return toPicked(result.assets[0]);
}
