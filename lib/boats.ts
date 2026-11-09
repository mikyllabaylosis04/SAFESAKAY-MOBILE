import { api } from '@/lib/api';
import type { Boat, BoatAvailability } from '@/lib/types';

export async function fetchBoats(): Promise<Boat[]> {
  const response = await api<{ data: Boat[] }>('/boats');
  return response.data;
}

export async function fetchRentalBoats(): Promise<Boat[]> {
  const boats = await fetchBoats();
  return boats.filter((boat) => boat.open_for_booking);
}

export async function fetchBoatById(id: number): Promise<Boat | null> {
  const boats = await fetchBoats();
  return boats.find((boat) => boat.id === id) ?? null;
}

export async function fetchBoatAvailability(id: number, date: string): Promise<BoatAvailability> {
  return api<BoatAvailability>(`/boats/${id}/availability?date=${encodeURIComponent(date)}`);
}

export async function updateBoatStatus(
  id: number,
  status: 'available' | 'maintenance' | 'unavailable',
): Promise<Boat> {
  const response = await api<{ data: Boat }>(`/boats/${id}/status`, {
    method: 'PATCH',
    body: { status },
  });
  return response.data;
}
