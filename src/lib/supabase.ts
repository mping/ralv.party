// Supabase client and typed wrappers for RPCs defined by the migrations.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  throw new Error('Missing SUPABASE_URL / SUPABASE_ANON_KEY in .env');
}

export const supabase: SupabaseClient = createClient(url, anonKey);

export interface Pin {
  id: string;
  name: string;
  address: string;
  floor_door: string | null;
  notes: string | null;
  lat: number;
  lng: number;
  date: string; // "2026-10-31"
  start_time: string; // "18:00:00"
  end_time: string; // "21:00:00"
  sweets: string[];
  created_at?: string;
}

export interface PinInput {
  id: string | null; // null creates a new pin
  name: string;
  address: string;
  floor_door: string;
  notes: string;
  lat: number;
  lng: number;
  date: string;
  start_time: string;
  end_time: string;
  sweets: string[];
}

export interface MyData {
  found: boolean;
  name?: string;
  email?: string;
  pins: Pin[];
}

export async function getPublicPins(): Promise<Pin[]> {
  const { data, error } = await supabase.rpc('get_public_pins');
  if (error) throw error;
  return (data ?? []) as Pin[];
}

export async function getMyData(secret: string): Promise<MyData> {
  const { data, error } = await supabase.rpc('get_my_data', { p_secret: secret });
  if (error) throw error;
  return data as MyData;
}

export async function upsertPin(secret: string, pin: PinInput): Promise<void> {
  const { error } = await supabase.rpc('upsert_pin', {
    p_secret: secret,
    p_pin_id: pin.id,
    p_name: pin.name,
    p_address: pin.address,
    p_floor_door: pin.floor_door,
    p_notes: pin.notes,
    p_lat: pin.lat,
    p_lng: pin.lng,
    p_date: pin.date,
    p_start_time: pin.start_time,
    p_end_time: pin.end_time,
    p_sweets: pin.sweets,
  });
  if (error) throw error;
}

export async function deletePin(secret: string, pinId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_pin', {
    p_secret: secret,
    p_pin_id: pinId,
  });
  if (error) throw error;
}

// Translate RPC and Edge Function errors into user-facing pt-PT messages.
export function mapError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('invalid_secret')) return 'Ligação inválida ou desconhecida.';
  if (msg.includes('invalid_times')) return 'A hora de fim tem de ser depois da hora de início.';
  if (msg.includes('invalid_email')) return 'O email não parece válido.';
  if (msg.includes('invalid_name')) return 'O nome não pode estar vazio.';
  if (msg.includes('invalid_floor_door')) return 'O andar/porta é demasiado longo.';
  if (msg.includes('invalid_notes')) return 'As notas são demasiado longas.';
  if (msg.includes('email_failed')) return 'Não foi possível enviar o email. Tenta de novo mais tarde.';
  if (msg.includes('register_failed')) return 'Não foi possível concluir o registo. Tenta de novo.';
  if (msg.includes('geocode_failed')) return 'Não foi possível pesquisar a morada. Tenta de novo.';
  if (msg.includes('fetch') || msg.includes('Failed')) return 'Não foi possível ligar ao servidor. Tenta de novo.';
  return 'Algo correu mal. Tenta de novo mais tarde.';
}

interface RegisterResult {
  ok?: boolean;
  error?: string;
}

export async function sendMagicLink(name: string, email: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke<RegisterResult>('register', {
    body: { name, email },
  });
  if (error) {
    // The Edge Function returns { error: "<code>" } in 4xx/5xx responses.
    const ctx = (error as { context?: unknown }).context;
    const bodyError =
      typeof ctx === 'object' && ctx !== null ? (ctx as RegisterResult).error : undefined;
    if (bodyError) throw new Error(bodyError);
    throw error;
  }
  if (data?.error) throw new Error(data.error);
}
