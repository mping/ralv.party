import { useState } from 'react';
import type { FormEvent } from 'react';
import { mapError, sendMagicLink } from '../lib/supabase';

interface RegisterModalProps {
  onClose?: () => void;
}

export default function RegisterModal({ onClose = () => {} }: RegisterModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setErrorMessage('');
    if (!name.trim() || !email.trim()) {
      setErrorMessage('Preenche o nome e o email.');
      setStatus('error');
      return;
    }

    setStatus('sending');
    try {
      await sendMagicLink(name.trim(), email.trim());
      setStatus('success');
    } catch (error) {
      setErrorMessage(mapError(error));
      setStatus('error');
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Registar">
      <div className="modal">
        <button className="close" type="button" onClick={onClose} aria-label="Fechar">
          ✕
        </button>

        {status === 'success' ? (
          <>
            <h2>Verifica o teu email 🎃</h2>
            <p>
              Enviámos-te uma <strong>ligação mágica</strong>. Guarda-a — dá-te acesso aos teus
              pins a qualquer momento.
            </p>
            <p className="hint">
              Não recebeste nada? Vê a pasta de spam ou tenta de novo com o mesmo email —
              recebes a mesma ligação.
            </p>
            <button className="cta" type="button" onClick={onClose}>
              Fechar
            </button>
          </>
        ) : (
          <>
            <h2>Registar a minha casa</h2>
            <p className="hint">
              Vais receber um email com uma ligação privada para gerires os teus pins.
            </p>
            <form onSubmit={submit}>
              <label>
                Nome
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={100}
                  placeholder="O teu nome"
                  required
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="nome@exemplo.pt"
                  required
                />
              </label>
              {errorMessage && (
                <p className="error" role="alert">
                  {errorMessage}
                </p>
              )}
              <button className="cta" type="submit" disabled={status === 'sending'}>
                {status === 'sending' ? 'A enviar…' : 'Receber a minha ligação'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
