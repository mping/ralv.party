import { useEffect, useMemo, useState } from 'react';
import Map from '../components/Map';
import PinCard from '../components/PinCard';
import RegisterModal from '../components/RegisterModal';
import { getPublicPins, type Pin } from '../lib/supabase';
import { eventDate, formatDate } from '../lib/format';

export default function Home() {
  const [pins, setPins] = useState<Pin[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [view, setView] = useState<'map' | 'list'>('map');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ lat: number; lng: number; n: number } | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(eventDate());

  const dates = useMemo(() => [...new Set(pins.map((pin) => pin.date))].sort(), [pins]);
  const visiblePins = useMemo(
    () => pins.filter((pin) => pin.date === selectedDate),
    [pins, selectedDate],
  );

  useEffect(() => {
    let active = true;

    void getPublicPins()
      .then((nextPins) => {
        if (!active) return;
        setPins(nextPins);
        const nextDates = [...new Set(nextPins.map((pin) => pin.date))].sort();
        if (nextDates.length > 0 && !nextDates.includes(eventDate())) {
          setSelectedDate(nextDates[0]);
        }
      })
      .catch(() => {
        if (active) setLoadError('Não foi possível carregar os pins. Tenta recarregar a página.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  function focusPin(pin: Pin): void {
    setView('map');
    setSelectedId(pin.id);
    setFocus({ lat: pin.lat, lng: pin.lng, n: Date.now() });
  }

  return (
    <div className="page home">
      <header>
        <div className="brand">
          <span className="logo">🎃</span>
          <div>
            <h1>RALV.PARTY</h1>
            <p className="tagline">Casas com doces para o Halloween em Portugal</p>
          </div>
        </div>
        <div className="actions">
          {dates.length > 0 && (
            <select
              className="date-select"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              aria-label="Dia"
            >
              {dates.map((date) => (
                <option value={date} key={date}>
                  {formatDate(date)}
                </option>
              ))}
            </select>
          )}
          <div className="toggle" role="tablist">
            <button
              role="tab"
              className={view === 'map' ? 'active' : undefined}
              aria-selected={view === 'map'}
              onClick={() => setView('map')}
            >
              Mapa
            </button>
            <button
              role="tab"
              className={view === 'list' ? 'active' : undefined}
              aria-selected={view === 'list'}
              onClick={() => setView('list')}
            >
              Lista
            </button>
          </div>
          <button className="cta" type="button" onClick={() => setRegisterOpen(true)}>
            Registar a minha casa
          </button>
        </div>
      </header>

      <main className={view === 'list' ? 'list-mode' : undefined}>
        {loading ? (
          <p className="status">A carregar pins… 🎃</p>
        ) : loadError ? (
          <p className="status error">{loadError}</p>
        ) : view === 'map' ? (
          <Map pins={visiblePins} focus={focus} onSelect={(pin) => setSelectedId(pin.id)} />
        ) : (
          <div className="list">
            {visiblePins.length === 0 ? (
              <p className="status">
                Ainda não há casas com doces neste dia. Sê o primeiro a adicionar a tua! 🍬
              </p>
            ) : (
              visiblePins.map((pin) => (
                <PinCard
                  pin={pin}
                  selected={pin.id === selectedId}
                  onClick={() => focusPin(pin)}
                  key={pin.id}
                />
              ))
            )}
          </div>
        )}
      </main>

      <footer>
        <span>
          Dados geográficos ©{' '}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
            OpenStreetMap contributors
          </a>
        </span>
        <span>Feito com 🎃 em Portugal</span>
      </footer>

      {registerOpen && <RegisterModal onClose={() => setRegisterOpen(false)} />}
    </div>
  );
}
