import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { Pin, PinInput } from '../lib/supabase';
import { mapError } from '../lib/supabase';
import { reverseGeocode } from '../lib/geocode';
import { eventDate } from '../lib/format';
import { SWEETS } from '../lib/sweets';
import AddressSearch from './AddressSearch';

type PinDraft = Pin | { lat: number; lng: number } | null;
const DEFAULT_ADDRESS_QUERY = 'R Afonso Lopes Vieira 20';

interface PinFormProps {
  initial?: PinDraft;
  onSave?: (pin: PinInput) => Promise<void>;
  onClose?: () => void;
}

function isPin(initial: PinDraft): initial is Pin {
  return initial !== null && 'id' in initial;
}

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      maximumAge: 60_000,
      timeout: 10_000,
    });
  });
}

export default function PinForm({
  initial = null,
  onSave = () => Promise.resolve(),
  onClose = () => {},
}: PinFormProps) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [date, setDate] = useState(eventDate());
  const [start, setStart] = useState('18:00');
  const [end, setEnd] = useState('21:00');
  const [sweets, setSweets] = useState<string[]>(['chocolate']);
  const [errorMessage, setErrorMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const pin = isPin(initial) ? initial : null;
    const draftLocation = initial && 'lat' in initial ? initial : null;

    setName(pin?.name ?? '');
    setAddress(pin?.address ?? '');
    setDate(pin?.date ?? eventDate());
    setStart(pin?.start_time.slice(0, 5) ?? '18:00');
    setEnd(pin?.end_time.slice(0, 5) ?? '21:00');
    setSweets(pin?.sweets ?? ['chocolate']);
    setLat(draftLocation?.lat ?? null);
    setLng(draftLocation?.lng ?? null);

    if (draftLocation && !pin?.address) {
      void reverseGeocode(draftLocation.lat, draftLocation.lng)
        .then((found) => {
          if (!cancelled && found) setAddress(found);
        })
        .catch(() => {
          // The user can still enter the address manually.
        });
    }

    return () => {
      cancelled = true;
    };
  }, [initial]);

  function toggleSweet(slug: string): void {
    setSweets((current) =>
      current.includes(slug) ? current.filter((sweet) => sweet !== slug) : [...current, slug],
    );
  }

  async function locateAddress(): Promise<void> {
    setErrorMessage('');
    if (!('geolocation' in navigator)) {
      setErrorMessage('A localização não é suportada neste navegador.');
      return;
    }

    setLocating(true);
    try {
      const position = await getCurrentPosition();
      const nextLat = position.coords.latitude;
      const nextLng = position.coords.longitude;
      setLat(nextLat);
      setLng(nextLng);
      setAddress('');

      const found = await reverseGeocode(nextLat, nextLng);
      if (!found) {
        setErrorMessage('Não foi possível encontrar a morada desta localização.');
        return;
      }
      setAddress(found);
    } catch {
      setErrorMessage('Não foi possível usar a tua localização. Confirma a permissão e tenta de novo.');
    } finally {
      setLocating(false);
    }
  }

  function validate(): boolean {
    if (!name.trim()) {
      setErrorMessage('Dá um nome ao pin.');
      return false;
    }
    if (!address.trim()) {
      setErrorMessage('Indica a morada (usa a pesquisa).');
      return false;
    }
    if (lat === null || lng === null) {
      setErrorMessage('Escolhe a localização: procura a morada na pesquisa.');
      return false;
    }
    if (!start || !end) {
      setErrorMessage('Indica a hora de início e de fim.');
      return false;
    }
    if (start >= end) {
      setErrorMessage('A hora de fim tem de ser depois da hora de início.');
      return false;
    }
    if (sweets.length === 0) {
      setErrorMessage('Escolhe pelo menos um tipo de doces.');
      return false;
    }
    return true;
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setErrorMessage('');
    if (!validate() || lat === null || lng === null) return;

    setSaving(true);
    try {
      await onSave({
        id: isPin(initial) ? initial.id : null,
        name: name.trim(),
        address: address.trim(),
        lat,
        lng,
        date,
        start_time: `${start}:00`,
        end_time: `${end}:00`,
        sweets,
      });
    } catch (error) {
      setErrorMessage(mapError(error));
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Pin">
      <div className="modal">
        <button className="close" type="button" onClick={onClose} aria-label="Fechar">
          ✕
        </button>
        <h2>{isPin(initial) ? 'Editar pin' : 'Adicionar pin'}</h2>

        <form onSubmit={submit}>
          <label>
            Nome do pin
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
              placeholder="Ex.: Casa do Tiago"
            />
          </label>

          <div className="field-label">
            <span>Morada</span>
            <AddressSearch
              value={address}
              defaultQuery={initial === null ? DEFAULT_ADDRESS_QUERY : undefined}
              locating={locating}
              onSelect={(result) => {
                setAddress(result.label);
                setLat(result.lat);
                setLng(result.lng);
              }}
              onLocate={() => void locateAddress()}
            />
          </div>
          {lat !== null && lng !== null ? (
            <p className="hint">
              📍 {lat.toFixed(5)}, {lng.toFixed(5)}
            </p>
          ) : (
            <p className="hint">Ainda sem localização — usa a pesquisa acima.</p>
          )}

          <div className="row">
            <label>
              Dia
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </label>
          </div>
          <div className="row">
            <label>
              Hora de início
              <input type="time" value={start} onChange={(event) => setStart(event.target.value)} />
            </label>
            <label>
              Hora de fim
              <input type="time" value={end} onChange={(event) => setEnd(event.target.value)} />
            </label>
          </div>

          <fieldset className="sweets">
            <legend>Doces disponíveis</legend>
            <div className="sweet-grid">
              {SWEETS.map((sweet) => {
                const checked = sweets.includes(sweet.slug);
                return (
                  <label className={`sweet-option${checked ? ' checked' : ''}`} key={sweet.slug}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSweet(sweet.slug)}
                    />
                    <span>
                      {sweet.emoji} {sweet.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {errorMessage && (
            <p className="error" role="alert">
              {errorMessage}
            </p>
          )}

          <div className="actions">
            <button type="button" className="ghost" onClick={onClose}>
              Cancelar
            </button>
            <button className="cta" type="submit" disabled={saving}>
              {saving ? 'A guardar…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
