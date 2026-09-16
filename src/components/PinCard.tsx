import type { KeyboardEvent } from 'react';
import type { Pin } from '../lib/supabase';
import { eventDate, formatDateShort, formatTime } from '../lib/format';
import { sweetEmoji, sweetLabel } from '../lib/sweets';

interface PinCardProps {
  pin: Pin;
  selected?: boolean;
  onClick?: () => void;
}

export default function PinCard({ pin, selected = false, onClick = () => {} }: PinCardProps) {
  const otherDay = pin.date !== eventDate();

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick();
    }
  }

  return (
    <div
      className={`pin-card${selected ? ' selected' : ''}`}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
    >
      <div className="pin-head">
        <h3>{pin.name}</h3>
        {otherDay && <span className="pin-date">{formatDateShort(pin.date)}</span>}
      </div>
      <p className="addr">📍 {pin.address}</p>
      {pin.floor_door && <p className="addr">🚪 {pin.floor_door}</p>}
      {pin.notes && <p className="addr">📝 {pin.notes}</p>}
      <p className="time">
        ⏰ {formatTime(pin.start_time)} – {formatTime(pin.end_time)}
      </p>
      <div className="chips">
        {pin.sweets.map((slug) => (
          <span className="chip" key={slug}>
            {sweetEmoji(slug)} {sweetLabel(slug)}
          </span>
        ))}
      </div>
    </div>
  );
}
