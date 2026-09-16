import { useCallback, useEffect, useState } from 'react';
import Map from '../components/Map';
import PinCard from '../components/PinCard';
import PinForm from '../components/PinForm';
import {
  deletePin,
  getMyData,
  mapError,
  upsertPin,
  type Pin,
  type PinInput,
} from '../lib/supabase';

interface ManageProps {
  uuid: string;
}

type PinDraft = Pin | { lat: number; lng: number } | null;

function requestUserLocation(onLocation: (location: { lat: number; lng: number }) => void): void {
  if (!('geolocation' in navigator)) return;
  navigator.geolocation.getCurrentPosition(
    (position) => {
      onLocation({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
    },
    () => {
      // The map remains at its configured initial center when permission is unavailable.
    },
    {
      enableHighAccuracy: false,
      maximumAge: 300_000,
      timeout: 10_000,
    },
  );
}

export default function Manage({ uuid }: ManageProps) {
  const [loading, setLoading] = useState(true);
  const [found, setFound] = useState(false);
  const [userName, setUserName] = useState('');
  const [pins, setPins] = useState<Pin[]>([]);
  const [loadError, setLoadError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PinDraft>(null);
  const [focus, setFocus] = useState<{ lat: number; lng: number; n: number } | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const loadData = useCallback(async (): Promise<void> => {
    const data = await getMyData(uuid);
    setFound(data.found);
    if (data.found) {
      setUserName(data.name ?? '');
      setPins(data.pins ?? []);
    }
  }, [uuid]);

  useEffect(() => {
    let active = true;
    requestUserLocation((location) => {
      if (active) setUserLocation(location);
    });

    void loadData()
      .catch((error) => {
        if (active) setLoadError(mapError(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [loadData]);

  function openForm(target: PinDraft): void {
    setEditing(target);
    setFormOpen(true);
  }

  function closeForm(): void {
    setFormOpen(false);
    setEditing(null);
  }

  async function save(pin: PinInput): Promise<void> {
    await upsertPin(uuid, pin);
    await loadData();
    closeForm();
  }

  async function remove(pin: Pin): Promise<void> {
    if (!window.confirm(`Remover "${pin.name}"?`)) return;
    try {
      await deletePin(uuid, pin.id);
      setPins((current) => current.filter((currentPin) => currentPin.id !== pin.id));
    } catch (error) {
      window.alert(mapError(error));
    }
  }

  return (
    <div className="page manage">
      <header>
        <div className="brand">
          <span className="logo">🎃</span>
          <div>
            <h1>RALV.PARTY</h1>
            <p className="tagline">A gerir os teus pins</p>
          </div>
        </div>
        <div className="actions">
          {found && (
            <button className="cta" type="button" onClick={() => openForm(null)}>
              Adicionar pin
            </button>
          )}
        </div>
      </header>

      {loading ? (
        <main>
          <p className="status">A carregar… 🎃</p>
        </main>
      ) : loadError ? (
        <main>
          <p className="status error">{loadError}</p>
        </main>
      ) : !found ? (
        <main className="unknown">
          <div className="unknown-card">
            <h2>Ligação desconhecida 👻</h2>
            <p>
              Não reconhecemos esta ligação. Verifica o email que recebeste ou regista-te de novo
              com o mesmo email para receberes a tua ligação.
            </p>
            <a className="cta" href="/">
              Voltar ao mapa
            </a>
          </div>
        </main>
      ) : (
        <main className="manage-grid">
          <div className="map-col">
            <Map
              pins={pins}
              mode="edit"
              center={userLocation}
              focus={focus}
              onMapClick={(location) => openForm(location)}
            />
          </div>
          <aside className="my-pins">
            <h2>Olá, {userName}! 👋</h2>
            <p className="hint">
              <strong>Guarda esta ligação nos favoritos</strong> — é a tua chave de acesso. Se a
              perderes, regista-te de novo com o mesmo email e recebes a mesma ligação.
            </p>
            <p className="hint map-tip">
              Clica no mapa para escolher o local de um novo pin, ou usa o botão acima e pesquisa
              a morada no formulário.
            </p>

            {pins.length === 0 ? (
              <p className="status">Ainda não tens pins. Adiciona o primeiro! 🍬</p>
            ) : (
              <div className="own-list">
                {pins.map((pin) => (
                  <div className="own-pin" key={pin.id}>
                    <PinCard
                      pin={pin}
                      onClick={() =>
                        setFocus({ lat: pin.lat, lng: pin.lng, n: Date.now() })
                      }
                    />
                    <div className="own-actions">
                      <button className="ghost" type="button" onClick={() => openForm(pin)}>
                        Editar
                      </button>
                      <button className="danger" type="button" onClick={() => void remove(pin)}>
                        Remover
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </aside>
        </main>
      )}

      <footer>
        <span>Feito com 🎃 em Portugal</span>
      </footer>

      {formOpen && <PinForm initial={editing} onSave={save} onClose={closeForm} />}
    </div>
  );
}
