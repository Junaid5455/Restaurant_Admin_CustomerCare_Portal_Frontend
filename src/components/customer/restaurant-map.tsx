'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import type * as Leaflet from 'leaflet';
import './location-picker.css';

/** The restaurant's spot on the map, plus one-tap Google Maps directions. Read-only. */
export function RestaurantMap({ lat, lng, name, address }: { lat: number; lng: number; name: string; address: string }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let dead = false;
    let cleanup: (() => void) | undefined;
    void import('leaflet').then((mod) => {
      if (dead || !host.current) return;
      const L = (mod as unknown as { default?: typeof Leaflet }).default ?? mod;
      const map = L.map(host.current, { zoomControl: true, scrollWheelZoom: false }).setView([lat, lng], 16);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(map);
      const icon = L.divIcon({ className: 'lp-pin', html: '<span>📍</span>', iconSize: [32, 32], iconAnchor: [16, 30] });
      L.marker([lat, lng], { icon, title: name, keyboard: false }).addTo(map);
      setTimeout(() => map.invalidateSize(), 150);
      cleanup = () => map.remove();
    });
    return () => { dead = true; cleanup?.(); };
  }, [lat, lng, name]);

  const directions = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  const view = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  return (
    <section className="rmap" aria-label={`Where to find ${name}`}>
      <h2 className="rmap-title">Find us</h2>
      <div ref={host} className="lp-map" role="img" aria-label={`Map showing ${name}${address ? `, ${address}` : ''}`} />
      <div className="rmap-actions">
        <a className="btn btn-primary" href={directions} target="_blank" rel="noreferrer noopener">🧭 Get directions</a>
        <a className="btn btn-ghost" href={view} target="_blank" rel="noreferrer noopener">Open in Google Maps ↗</a>
      </div>
    </section>
  );
}
