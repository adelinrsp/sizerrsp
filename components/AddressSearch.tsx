'use client';

import { useEffect, useRef, useState } from 'react';
import { resolveProvider } from '@/lib/map/provider';
import type { AddressSuggestion } from '@/lib/types';

type Props = {
  onSelect: (suggestion: AddressSuggestion) => void;
};

const DEBOUNCE_MS = 320;

/** Sources are swapped wholesale with the map provider, so the credits follow. */
const IS_OSM = resolveProvider() === 'osm';
const SUBTITLE = IS_OSM
  ? 'Entrez une adresse pour placer les panneaux sur la vue aérienne.'
  : 'Entrez une adresse pour analyser le toit via Google Solar API.';
const CREDITS = IS_OSM
  ? 'OpenStreetMap · Esri World Imagery · API Adresse (BAN)'
  : 'Google Maps · Places API · Solar API';

export default function AddressSearch({ onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      abort.current?.abort();
    };
  }, []);

  function handleChange(value: string) {
    setQuery(value);
    setError(null);
    if (timer.current) clearTimeout(timer.current);

    if (value.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    timer.current = setTimeout(async () => {
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;
      try {
        const res = await fetch(`/api/places/autocomplete?q=${encodeURIComponent(value)}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Recherche indisponible.');
          setSuggestions([]);
          setOpen(false);
          return;
        }
        setSuggestions(data.suggestions || []);
        setOpen((data.suggestions || []).length > 0);
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setError('Recherche indisponible.');
      }
    }, DEBOUNCE_MS);
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 56,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        animation: 'fadeIn 0.5s ease',
      }}
    >
      <div
        style={{
          width: 560,
          maxWidth: '100%',
          background: '#fff',
          borderRadius: 18,
          boxShadow: '0 12px 48px rgba(0,29,61,0.28)',
          padding: '40px 44px',
          animation: 'fadeUp 0.5s ease',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#FFF8E1',
              border: '1px solid rgba(255,190,0,0.35)',
              borderRadius: 20,
              padding: '4px 12px',
              fontSize: 11,
              fontWeight: 600,
              color: '#9a6f00',
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
              marginBottom: 14,
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
              <circle cx="5" cy="5" r="4" fill="#FFBE00" />
            </svg>
            Dimensionnement solaire
          </div>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: 'var(--navy)',
              margin: '0 0 8px',
              lineHeight: 1.2,
            }}
          >
            Où installer les panneaux ?
          </h1>
          <p style={{ fontSize: 14, color: 'var(--ink-muted)', margin: 0 }}>
            {SUBTITLE}
          </p>
        </div>

        <div style={{ position: 'relative' }}>
          <div
            style={{
              position: 'absolute',
              left: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
            }}
          >
            <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden>
              <circle cx="8.5" cy="8.5" r="5.5" stroke="#94a3b8" strokeWidth="1.8" />
              <path d="M13.5 13.5L17 17" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
          <input
            type="text"
            aria-label="Adresse du bâtiment"
            placeholder="Ex. 42 Rue de la République, Lyon"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            onFocus={() => setOpen(suggestions.length > 0)}
            style={{
              width: '100%',
              height: 52,
              padding: '0 16px 0 44px',
              border: '2px solid var(--line)',
              borderRadius: 11,
              fontSize: 15,
              color: 'var(--navy)',
              outline: 'none',
            }}
          />
          {open && (
            <ul
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                right: 0,
                background: '#fff',
                border: '1.5px solid var(--line)',
                borderRadius: 11,
                boxShadow: '0 8px 28px rgba(0,29,61,0.14)',
                overflow: 'hidden',
                zIndex: 500,
                listStyle: 'none',
                margin: 0,
                padding: 0,
              }}
            >
              {suggestions.map((s) => (
                <li key={s.placeId}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setQuery(s.label);
                      setOpen(false);
                      onSelect(s);
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '12px 16px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      borderBottom: '1px solid #f1f5f9',
                      background: 'transparent',
                      border: 'none',
                      borderBottomWidth: 1,
                      borderBottomStyle: 'solid',
                      borderBottomColor: '#f1f5f9',
                    }}
                  >
                    <svg width="11" height="14" viewBox="0 0 11 14" fill="none" aria-hidden>
                      <path
                        d="M5.5 0C3.02 0 1 2.02 1 4.5c0 3.4 4.5 9.5 4.5 9.5s4.5-6.1 4.5-9.5C10 2.02 7.98 0 5.5 0z"
                        fill="#FFBE00"
                      />
                      <circle cx="5.5" cy="4.5" r="1.8" fill="#001D3D" />
                    </svg>
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: 'var(--navy)',
                        lineHeight: 1.3,
                      }}
                    >
                      {s.label}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error ? (
          <p
            style={{
              fontSize: 12,
              color: '#b91c1c',
              textAlign: 'center',
              margin: '16px 0 0',
            }}
          >
            {error}
          </p>
        ) : (
          <p
            style={{
              fontSize: 11,
              color: '#b0bec8',
              textAlign: 'center',
              margin: '16px 0 0',
            }}
          >
            {CREDITS}
          </p>
        )}
      </div>
    </div>
  );
}
