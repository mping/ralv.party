<script lang="ts">
  import type { Pin } from '../lib/supabase';
  import { eventDate, formatDateShort, formatTime } from '../lib/format';
  import { sweetEmoji, sweetLabel } from '../lib/sweets';

  let {
    pin,
    selected = false,
    onclick = () => {},
  }: { pin: Pin; selected?: boolean; onclick?: () => void } = $props();

  let otherDay = $derived(pin.date !== eventDate());
</script>

<div
  class="pin-card"
  class:selected
  role="button"
  tabindex="0"
  onclick={onclick}
  onkeydown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onclick();
    }
  }}
>
  <div class="pin-head">
    <h3>{pin.name}</h3>
    {#if otherDay}<span class="pin-date">{formatDateShort(pin.date)}</span>{/if}
  </div>
  <p class="addr">📍 {pin.address}</p>
  <p class="time">⏰ {formatTime(pin.start_time)} – {formatTime(pin.end_time)}</p>
  <div class="chips">
    {#each pin.sweets as slug}
      <span class="chip">{sweetEmoji(slug)} {sweetLabel(slug)}</span>
    {/each}
  </div>
</div>
