import Clipboard from '@react-native-clipboard/clipboard';

export async function copyPublicText(text: string): Promise<void> {
  Clipboard.setString(text);
}
