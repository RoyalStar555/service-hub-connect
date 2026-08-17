import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Circle, MapContainer, Marker, TileLayer, Tooltip } from "react-leaflet";
import type { ServiceRequest } from "@/lib/service-requests";

export const MASK_OFFSET = 0.015;

const redIcon = L.divIcon({
  className: "",
  html: `<span style="display:block;width:18px;height:18px;border-radius:9999px;background:#dc2626;border:3px solid #fff;box-shadow:0 0 0 4px rgba(220,38,38,0.25)"></span>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

export default function MechanicMap({
  center,
  pending,
  unlocked,
  onSelect,
}: {
  center: { lat: number; lng: number };
  pending: ServiceRequest[];
  unlocked: ServiceRequest[];
  onSelect: (request: ServiceRequest) => void;
}) {
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={11}
      scrollWheelZoom
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {pending.map((r) =>
        r.exact_lat != null && r.exact_lng != null ? (
          <Circle
            key={r.id}
            center={[r.exact_lat + MASK_OFFSET, r.exact_lng + MASK_OFFSET]}
            radius={3000}
            pathOptions={{ color: "#d97706", fillColor: "#fbbf24", fillOpacity: 0.3, weight: 2 }}
            eventHandlers={{ click: () => onSelect(r) }}
          >
            <Tooltip>{r.vehicle_type} · approximate area</Tooltip>
          </Circle>
        ) : null,
      )}

      {unlocked.map((r) =>
        r.exact_lat != null && r.exact_lng != null ? (
          <Marker
            key={r.id}
            position={[r.exact_lat, r.exact_lng]}
            icon={redIcon}
            eventHandlers={{ click: () => onSelect(r) }}
          >
            <Tooltip>{r.issue_type}</Tooltip>
          </Marker>
        ) : null,
      )}
    </MapContainer>
  );
}
