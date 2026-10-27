import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import PinCard from '../components/PinCard';
import PinForm from '../components/PinForm';
import {
  adminDeletePin,
  adminDeleteUser,
  adminList,
  adminUpdatePin,
  mapError,
  type AdminUser,
  type Pin,
  type PinInput,
} from '../lib/supabase';

// Kept per tab only: closing the tab forgets the password.
const STORAGE_KEY = 'ralv-admin-password';

function readStoredPassword(): string {
  try {
    return sessionStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function storePassword(password: string | null): void {
  try {
    if (password) sessionStorage.setItem(STORAGE_KEY, password);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage is a convenience; without it the password is asked again after a reload.
  }
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function formatRegistered(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString('pt-PT', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function Admin() {
  // Holds the stored candidate until it is verified, then the confirmed password.
  const [password, setPassword] = useState(readStoredPassword);
  const [input, setInput] = useState('');
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [loading, setLoading] = useState(() => password !== '');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Pin | null>(null);

  async function signIn(candidate: string): Promise<void> {
    setLoading(true);
    setError('');
    try {
      const list = await adminList(candidate);
      storePassword(candidate);
      setPassword(candidate);
      setUsers(list);
      setInput('');
    } catch (err) {
      storePassword(null);
      setPassword('');
      setError(mapError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (password) void signIn(password);
    // Only the stored password is verified on mount; later sign-ins use the form.
  }, []);

  function signOut(): void {
    storePassword(null);
    setPassword('');
    setUsers(null);
    setEditing(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const candidate = input.trim();
    if (candidate) await signIn(candidate);
  }

  async function mutate(action: () => Promise<void>): Promise<void> {
    try {
      await action();
      setUsers(await adminList(password));
    } catch (err) {
      if (err instanceof Error && err.message === 'unauthorized') {
        signOut();
        setError(mapError(err));
        return;
      }
      window.alert(mapError(err));
    }
  }

  async function save(pin: PinInput): Promise<void> {
    await adminUpdatePin(password, pin);
    setUsers(await adminList(password));
    setEditing(null);
  }

  async function removePin(pin: Pin): Promise<void> {
    if (!window.confirm(`Remover "${pin.name}"?`)) return;
    await mutate(() => adminDeletePin(password, pin.id));
  }

  async function removeUser(user: AdminUser): Promise<void> {
    const pins = user.pins.length;
    const what = pins === 0 ? '' : ` e ${pins === 1 ? 'o seu pin' : `os seus ${pins} pins`}`;
    if (!window.confirm(`Remover ${user.name} (${user.email})${what}?`)) return;
    await mutate(() => adminDeleteUser(password, user.email));
  }

  const pinCount = users?.reduce((total, user) => total + user.pins.length, 0) ?? 0;

  return (
    <div className="page admin">
      <header>
        <div className="brand">
          <span className="logo">🎃</span>
          <div>
            <h1>RALV.PARTY</h1>
            <p className="tagline">Administração</p>
          </div>
        </div>
        <div className="actions">
          {users && (
            <button className="ghost" type="button" onClick={signOut}>
              Sair
            </button>
          )}
        </div>
      </header>

      {users ? (
        <main className="list-mode">
          <div className="list">
            <p className="hint">
              {plural(users.length, 'participante', 'participantes')} ·{' '}
              {plural(pinCount, 'pin', 'pins')}
            </p>
            {users.length === 0 ? (
              <p className="status">Ainda não há participantes. 👻</p>
            ) : (
              users.map((user) => (
                <section className="admin-user" key={user.email}>
                  <div className="admin-user-head">
                    <div>
                      <h3>{user.name}</h3>
                      <p className="hint">
                        {user.email} · registo a {formatRegistered(user.created_at)}
                      </p>
                    </div>
                    <button className="danger" type="button" onClick={() => void removeUser(user)}>
                      Remover participante
                    </button>
                  </div>

                  {user.pins.length === 0 ? (
                    <p className="hint">Sem pins.</p>
                  ) : (
                    <div className="own-list">
                      {user.pins.map((pin) => (
                        <div className="own-pin" key={pin.id}>
                          <PinCard pin={pin} />
                          <div className="own-actions">
                            <button className="ghost" type="button" onClick={() => setEditing(pin)}>
                              Editar
                            </button>
                            <button
                              className="danger"
                              type="button"
                              onClick={() => void removePin(pin)}
                            >
                              Remover
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              ))
            )}
          </div>
        </main>
      ) : password && loading ? (
        <main>
          <p className="status">A carregar… 🎃</p>
        </main>
      ) : (
        <main className="unknown">
          <form className="unknown-card admin-login" onSubmit={submit}>
            <h2>Administração 🔒</h2>
            <p>Introduz a palavra-passe de administração.</p>
            {/* Lets password managers save the password under a stable account name. */}
            <input type="text" autoComplete="username" value="admin" readOnly hidden />
            <input
              type="password"
              autoComplete="current-password"
              aria-label="Palavra-passe"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              autoFocus
            />
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="cta" type="submit" disabled={loading || !input.trim()}>
              {loading ? 'A entrar…' : 'Entrar'}
            </button>
          </form>
        </main>
      )}

      <footer>
        <span>Feito com 🎃 em Portugal</span>
      </footer>

      {editing && <PinForm initial={editing} onSave={save} onClose={() => setEditing(null)} />}
    </div>
  );
}
