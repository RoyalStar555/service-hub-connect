export type ServiceRequest = {
  id: string;
  driver_id: string;
  mechanic_id: string | null;
  vehicle_type: string;
  issue_type: string;
  exact_lat: number | null;
  exact_lng: number | null;
  status: string;
  fee_paid: number;
  breakdown_address?: string | null;
  vehicle_model?: string | null;
  customer_note?: string | null;
  media_url?: string | null;
  created_at: string;
};

export const VEHICLE_TYPES = [
  "Heavy Truck",
  "Trailer / Container",
  "Tipper",
  "Bus / Coach",
  "Light Commercial Van",
];

export const ISSUE_TYPES = [
  "Tyre burst / puncture",
  "Engine breakdown",
  "Battery / electrical",
  "Brake failure",
  "Fuel / diesel out",
  "Towing required",
];
