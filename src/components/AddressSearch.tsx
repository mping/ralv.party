import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { searchAddress, type GeocodeResult } from '../lib/geocode';

interface AddressSearchProps {
  value?: string;
  defaultQuery?: string;
  locating?: boolean;
  onSelect?: (result: GeocodeResult) => void;
  onLocate?: () => void;
}

export default function AddressSearch({
  value = '',
  defaultQuery = '',
  locating = false,
  onSelect = () => {},
  onLocate = () => {},
}: AddressSearchProps) {
  const [query, setQuery] = useState(value || defaultQuery);
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const typingRef = useRef(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!typingRef.current) setQuery(value || defaultQuery);
  }, [defaultQuery, value]);

  useEffect(() => {
    return () => {
      clearTimeout(searchTimerRef.current);
      clearTimeout(closeTimerRef.current);
      controllerRef.current?.abort();
    };
  }, []);

  function choose(result: GeocodeResult): void {
    typingRef.current = false;
    setQuery(result.label);
    setOpen(false);
    setResults([]);
    onSelect(result);
  }

  function handleInput(nextQuery: string): void {
    typingRef.current = true;
    setQuery(nextQuery);
    scheduleSearch(nextQuery);
  }

  function scheduleSearch(nextQuery: string): void {
    clearTimeout(searchTimerRef.current);
    controllerRef.current?.abort();

    const trimmedQuery = nextQuery.trim();
    if (trimmedQuery.length < 3) {
      setSearching(false);
      setResults([]);
      setOpen(false);
      return;
    }

    searchTimerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      controllerRef.current = controller;
      setSearching(true);
      setErrorMessage('');

      try {
        const nextResults = await searchAddress(trimmedQuery, controller.signal);
        if (controllerRef.current !== controller) return;
        setResults(nextResults);
        setOpen(nextResults.length > 0);
      } catch {
        if (controller.signal.aborted) return;
        setErrorMessage('Não foi possível pesquisar. Tenta de novo.');
      } finally {
        if (controllerRef.current === controller) setSearching(false);
      }
    }, 350);
  }

  useEffect(() => {
    if (defaultQuery.trim().length >= 3) scheduleSearch(defaultQuery);
  }, [defaultQuery]);

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter' && open && results.length > 0) {
      event.preventDefault();
      choose(results[0]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  function handleBlur(): void {
    typingRef.current = false;
    closeTimerRef.current = setTimeout(() => setOpen(false), 150);
  }

  function locate(): void {
    typingRef.current = false;
    setOpen(false);
    setResults([]);
    onLocate();
  }

  return (
    <div className="addr-search">
      <div className="address-input-row">
        <input
          type="text"
          placeholder="Ex.: Rua das Flores 12, Lisboa"
          value={query}
          onChange={(event) => handleInput(event.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={handleBlur}
          aria-label="Morada"
        />
        <button
          className="locate"
          type="button"
          onClick={locate}
          disabled={locating}
          aria-label={locating ? 'A obter a tua localização' : 'Usar a minha localização'}
          title="Usar a minha localização"
        >
          {locating ? '…' : '⌖'}
        </button>
      </div>
      {searching && <p className="hint">A pesquisar…</p>}
      {open && (
        <ul className="results">
          {results.map((result) => (
            <li
              key={`${result.lat},${result.lng},${result.label}`}
              role="option"
              aria-selected={false}
              onMouseDown={(event) => {
                event.preventDefault();
                choose(result);
              }}
            >
              {result.label}
            </li>
          ))}
        </ul>
      )}
      {errorMessage && <p className="error">{errorMessage}</p>}
    </div>
  );
}
