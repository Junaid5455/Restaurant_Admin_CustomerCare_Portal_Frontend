'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';

export interface LatLng { lat: number; lng: number }

const DEFAULT_CENTER: LatLng = { lat: 30.3753, lng: 69.3451 }; // Pakistan, until the guest picks a spot

/** Rounds to the 6 decimals the backend stores. */
export const roundCoord = (n: number) => Math.round(n * 1e6) / 1e6;
export const googleMapsPinLink = (p: LatLng) => `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;

/**
 * Map for choosing where the order should be delivered: tap the map or drag the pin, or use the phone's location.
 * Leaflet touches `window`, so it is loaded inside an effect (never during server render).
 */
export function LocationPicker({ value, onChange, error }: { value: LatLng | null; onChange: (p: LatLng) => void; error?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const state = useRef<{ L: typeof Leaflet; map: Leaflet.Map; marker: Leaflet.Marker | null } | null>(null);
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  const [locating, setLocating] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [tilesFailed, setTilesFailed] = useState(false);

  function place(p: LatLng, zoom?: number) {
    const s = state.current;
    if (!s) return;
    const ll: Leaflet.LatLngExpression = [p.lat, p.lng];
    if (s.marker) s.marker.setLatLng(ll);
    else {
      s.marker = s.L.marker(ll, { draggable: true, keyboard: true, title: 'Delivery location. Drag to move.' }).addTo(s.map);
      s.marker.on('dragend', () => {
        const at = s.marker!.getLatLng();
        changeRef.current({ lat: roundCoord(at.lat), lng: roundCoord(at.lng) });
      });
    }
    if (zoom) s.map.setView(ll, zoom);
  }

  useEffect(() => {
    let dead = false;
    let cleanup: (() => void) | undefined;
    void import('leaflet').then((mod) => {
      if (dead || !host.current) return;
      const L = (mod as unknown as { default?: typeof Leaflet }).default ?? mod;
      const start = value ?? DEFAULT_CENTER;
      const map = L.map(host.current, { zoomControl: true }).setView([start.lat, start.lng], value ? 17 : 5);
      let errors = 0;
      const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(map);
      tiles.on('tileerror', () => { errors += 1; if (errors >= 3) setTilesFailed(true); });
      // Leaflet's default marker icon files are not bundled, so draw the pin ourselves.
      const icon = L.divIcon({ className: 'lp-pin', html: '<span>📍</span>', iconSize: [32, 32], iconAnchor: [16, 30] });
      L.Marker.prototype.options.icon = icon;
      state.current = { L, map, marker: null };
      if (value) place(value);
      map.on('click', (e: Leaflet.LeafletMouseEvent) => {
        const p = { lat: roundCoord(e.latlng.lat), lng: roundCoord(e.latlng.lng) };
        place(p);
        changeRef.current(p);
      });
      setTimeout(() => map.invalidateSize(), 150);
      cleanup = () => { map.remove(); state.current = null; };
    });
    return () => { dead = true; cleanup?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the pin in step when the value is set from outside (for example after "use my location").
  useEffect(() => { if (value) place(value); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  function useMyLocation() {
    setNote(null);
    if (!('geolocation' in navigator)) { setNote('This browser can’t share a location. Tap the map instead.'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: roundCoord(pos.coords.latitude), lng: roundCoord(pos.coords.longitude) };
        place(p, 17);
        onChange(p);
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        setNote(err.code === err.PERMISSION_DENIED ? 'Location is blocked for this site. Allow it in your browser settings, or tap the map instead.' : 'We couldn’t find your location. Tap the map instead.');
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    );
  }

  return (
    <div className="lp">
      <div className="lp-bar">
        <button type="button" className="btn btn-ghost" onClick={useMyLocation} disabled={locating}>{locating ? 'Finding you…' : '📍 Use my current location'}</button>
        {value && <a className="lp-link" href={googleMapsPinLink(value)} target="_blank" rel="noreferrer noopener">Check in Google Maps ↗</a>}
      </div>
      <div ref={host} className="lp-map" role="application" aria-label="Map. Tap to drop a pin where the order should be delivered, then drag the pin to adjust." />
      <p className="lp-hint">{value ? `Pin set (${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}). Drag it to adjust.` : 'Tap the map to drop a pin on your door, or use your current location.'}</p>
      {tilesFailed && <p className="lp-hint" role="status">The map picture didn’t load, but the pin still works. Use “Use my current location”.</p>}
      {note && <p className="field-error" role="status">{note}</p>}
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  );
}
