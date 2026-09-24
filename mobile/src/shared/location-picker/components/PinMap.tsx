import { StyleSheet } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

import { MAPBOX_PUBLIC_TOKEN } from '@/constants/config';

import { buildMapPickerHtml } from '../mapPickerHtml';
import type { LatLng } from '../types';

type Props = { start: LatLng; zoom: number; onCenter: (c: LatLng) => void };

/** Native: the map page in a WebView. See PinMap.web.tsx for the browser. */
export function PinMap({ start, zoom, onCenter }: Props) {
  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'center') onCenter({ latitude: msg.latitude, longitude: msg.longitude });
    } catch {
      // A malformed message is never fatal: the pin just doesn't update once.
    }
  };
  return (
    <WebView
      originWhitelist={['*']}
      source={{ html: buildMapPickerHtml(MAPBOX_PUBLIC_TOKEN, start.latitude, start.longitude, zoom) }}
      onMessage={onMessage}
      style={styles.map}
    />
  );
}

const styles = StyleSheet.create({ map: { flex: 1 } });
