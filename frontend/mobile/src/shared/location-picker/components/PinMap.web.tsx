import { createElement, useEffect, useMemo, useState } from 'react';

import { MAPBOX_PUBLIC_TOKEN } from '@/constants/config';

import { buildMapPickerHtml } from '../mapPickerHtml';
import type { LatLng } from '../types';

type Props = { start: LatLng; zoom: number; onCenter: (c: LatLng) => void };

/** Browser preview: the same map page in an iframe (react-native-webview has no web support). */
export function PinMap({ start, zoom, onCenter }: Props) {
  // A callback ref kept in state, so the effect below re-binds when the iframe mounts.
  const [frame, setFrame] = useState<HTMLIFrameElement | null>(null);
  const html = useMemo(
    () => buildMapPickerHtml(MAPBOX_PUBLIC_TOKEN, start.latitude, start.longitude, zoom),
    [start.latitude, start.longitude, zoom],
  );

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!frame || e.source !== frame.contentWindow) return;
      try {
        const msg = JSON.parse(String(e.data));
        if (msg.type === 'center') onCenter({ latitude: msg.latitude, longitude: msg.longitude });
      } catch {
        // ignore
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [frame, onCenter]);

  return createElement('iframe', {
    ref: setFrame,
    srcDoc: html,
    title: 'Map',
    style: { border: 0, width: '100%', height: '100%' },
  });
}
