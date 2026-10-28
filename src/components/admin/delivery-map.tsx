'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';

export interface MapPin {
  id: string;
  lat: number;
  lng: number;
  label: string;
  sub?: string;
  stale?: boolean;
}

/**
 * Live driver map. Leaflet touches `window`, so it is loaded inside an effect (never during server render).
 * Markers are built from DOM nodes with textContent, so names and emails can't inject markup.
 */
export function DeliveryMap({ pins, selectedId, onSelect, height = 420, label = 'Map of driver locations' }: { pins: MapPin[]; selectedId?: string | null; onSelect?: (id: string) => void; height?: number; label?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const state = useRef<{ L: typeof Leaflet; map: Leaflet.Map; layer: Leaflet.LayerGroup; fitted: string } | null>(null);
  const [ready, setReady] = useState(false);
  const [tilesFailed, setTilesFailed] = useState(false);
  const fitRef = useRef<() => void>(() => undefined);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;

  useEffect(() => {
    let dead = false;
    let cleanup: (() => void) | undefined;
    void import('leaflet').then((mod) => {
      if (dead || !host.current) return;
      const L = (mod as unknown as { default?: typeof Leaflet }).default ?? mod;
      const map = L.map(host.current, { zoomControl: true, attributionControl: true }).setView([24.8607, 67.0011], 12);
      const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(map);
      let errors = 0;
      tiles.on('tileerror', () => {
        errors += 1;
        if (errors >= 3) setTilesFailed(true);
      });
      tiles.on('tileload', () => {
        errors = 0;
        setTilesFailed(false);
      });
      const layer = L.layerGroup().addTo(map);
      state.current = { L, map, layer, fitted: '' };
      setReady(true);
      cleanup = () => {
        map.remove();
        state.current = null;
      };
    });
    return () => {
      dead = true;
      cleanup?.();
      setReady(false);
    };
  }, []);

  useEffect(() => {
    const s = state.current;
    if (!ready || !s) return;
    const { L, map, layer } = s;
    layer.clearLayers();
    for (const p of pins) {
      const el = document.createElement('div');
      el.className = `dl-pin${p.stale ? ' is-stale' : ''}${p.id === selectedId ? ' is-selected' : ''}`;
      const dot = document.createElement('span');
      dot.className = 'dl-pin-dot';
      dot.textContent = '🛵';
      const tag = document.createElement('span');
      tag.className = 'dl-pin-tag';
      tag.textContent = p.label;
      el.append(dot, tag);
      const marker = L.marker([p.lat, p.lng], { icon: L.divIcon({ html: el, className: 'dl-pin-wrap', iconSize: [0, 0] }), keyboard: true, title: `${p.label}${p.sub ? ', ' + p.sub : ''}`, zIndexOffset: p.id === selectedId ? 1000 : 0 });
      marker.on('click', () => selectRef.current?.(p.id));
      marker.addTo(layer);
    }
    const fit = () => {
      if (pins.length === 1) map.setView([pins[0].lat, pins[0].lng], 15);
      else if (pins.length > 1) map.fitBounds(L.latLngBounds(pins.map((p) => [p.lat, p.lng] as [number, number])), { padding: [48, 48], maxZoom: 16 });
    };
    fitRef.current = fit;
    // Fit the view when the set of drivers changes, not on every refresh (that would fight the person panning).
    const key = pins.map((p) => p.id).sort().join(',');
    if (pins.length && s.fitted !== key) {
      s.fitted = key;
      fit();
    }
  }, [pins, selectedId, ready]);

  useEffect(() => {
    const s = state.current;
    const p = pins.find((x) => x.id === selectedId);
    if (ready && s && p) s.map.panTo([p.lat, p.lng], { animate: true });
    // only when the selection changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, ready]);

  return (
    <div className="dl-map-box" style={{ height }}>
      <div ref={host} className="dl-map" role="region" aria-label={label} />
      {pins.length > 1 && <button type="button" className="dl-map-fit" onClick={() => fitRef.current()}>Show all drivers</button>}
      {!ready && <div className="dl-map-loading ad-skel" aria-hidden="true" />}
      {tilesFailed && <p className="dl-map-note" role="status">The street map couldn&apos;t load, but the driver pins are still in the right place.</p>}
    </div>
  );
}
