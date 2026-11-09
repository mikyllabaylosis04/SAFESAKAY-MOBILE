import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { SAFESAKAY_LOGO } from '@/components/brand-lockup';

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function logoDataUri(): Promise<string | null> {
  try {
    const asset = Asset.fromModule(SAFESAKAY_LOGO);
    await asset.downloadAsync();
    if (!asset.localUri) {
      return null;
    }

    const data = await FileSystem.readAsStringAsync(asset.localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return `data:image/png;base64,${data}`;
  } catch {
    return null;
  }
}

function toFileUri(uri: string) {
  if (uri.startsWith('file://') || uri.startsWith('content://')) {
    return uri;
  }
  return `file://${uri}`;
}

export async function saveAndSharePdf(input: {
  html: string;
  filename: string;
  dialogTitle: string;
}): Promise<'shared' | 'saved'> {
  const printed = await Print.printToFileAsync({
    html: input.html,
    base64: true,
  });

  if (Platform.OS === 'web') {
    return 'shared';
  }

  const destDir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
  if (!destDir) {
    throw new Error('Could not save the file on this device.');
  }

  const dest = `${destDir}${input.filename}`;
  await FileSystem.deleteAsync(dest, { idempotent: true });

  if (printed.base64) {
    await FileSystem.writeAsStringAsync(dest, printed.base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } else {
    await FileSystem.copyAsync({
      from: toFileUri(printed.uri),
      to: dest,
    });
  }

  const saved = await FileSystem.getInfoAsync(dest);
  if (!saved.exists) {
    throw new Error('Could not save the file on this device.');
  }

  try {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(dest, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
        dialogTitle: input.dialogTitle,
      });
      return 'shared';
    }
  } catch {
    // Expo Go on Android can block sharing some local URIs. Save with the folder picker instead.
  }

  if (Platform.OS === 'android') {
    const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permissions.granted) {
      throw new Error('Choose a folder to save the PDF.');
    }

    const data =
      printed.base64 ??
      (await FileSystem.readAsStringAsync(dest, {
        encoding: FileSystem.EncodingType.Base64,
      }));
    const safUri = await FileSystem.StorageAccessFramework.createFileAsync(
      permissions.directoryUri,
      input.filename,
      'application/pdf',
    );
    await FileSystem.writeAsStringAsync(safUri, data, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return 'saved';
  }

  await Print.printAsync({ html: input.html });
  return 'shared';
}
