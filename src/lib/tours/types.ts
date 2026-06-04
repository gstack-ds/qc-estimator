// Shared tour types — no server dependencies so safe to import in both
// server actions and client components (including dynamic PDF imports).

export interface TourDetails {
  pickup_type?: 'hotel' | 'meeting_point' | 'airport' | null;
  pickup_address?: string | null;
  dropoff_address?: string | null;
  meeting_point_notes?: string | null;
  departure_time?: string | null;
  return_time?: string | null;
  duration_hours?: number | null;
  pricing_mode?: 'per_person' | 'flat' | null;
  guide_notes?: string | null;
  internal_notes?: string | null;
  self_guided?: boolean | null;
  guests_per_guide?: number | null;
  venue_guide_cap?: number | null;
  wave_size?: number | null;
}

export interface TourCatalogEntry {
  id: string;
  name: string;
  tour_details: TourDetails;
  notes: string | null;
  created_at: string;
}
