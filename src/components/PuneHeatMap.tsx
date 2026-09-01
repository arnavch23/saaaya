import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { HistoricalWardRisk, RiskLevel } from "../types/heat";

type WardProps = { wardnum: number; Name1?: string; Name2?: string };
type WardFeature = GeoJSON.Feature<GeoJSON.Geometry, WardProps>;
type WardCollection = GeoJSON.FeatureCollection<GeoJSON.Geometry, WardProps>;
const levels: RiskLevel[] = ["Low", "Moderate", "High", "Very High", "Extreme"];
const colors: Record<RiskLevel, string> = { Low: "#257451", Moderate: "#b67a13", High: "#ca5a1d", "Very High": "#b73335", Extreme: "#68233f" };

type Props = { wards: readonly HistoricalWardRisk[]; selected: HistoricalWardRisk; onSelect: (ward: HistoricalWardRisk) => void };

export function PuneHeatMap({ wards, selected, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const selectedRef = useRef(selected);
  const onSelectRef = useRef(onSelect);
  selectedRef.current = selected;
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!container.current || mapRef.current) return;
    let cancelled = false;
    const map = L.map(container.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: true });
    mapRef.current = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', className: "saaya-basemap", maxZoom: 19 }).addTo(map);
    void fetch("/data/pune-electoral-wards-2022.geojson").then((response) => response.json()).then((geojson: WardCollection) => {
      if (cancelled) return;
      const byId = new Map(wards.map((ward) => [ward.wardId, ward]));
      const style = (risk?: RiskLevel): L.PathOptions => ({ color: "#f8fafc", weight: 0.8, opacity: .8, fillColor: risk ? colors[risk] : "#94a3b8", fillOpacity: .68, lineJoin: "round" });
      L.geoJSON(geojson, {
        style: (feature) => style(byId.get((feature as WardFeature).properties.wardnum)?.riskLevel),
        onEachFeature: (feature, layer) => {
          const ward = byId.get((feature as WardFeature).properties.wardnum);
          if (!ward) return;
          layer.bindTooltip(`<strong>Ward ${ward.wardId} · ${ward.wardName}</strong><br/>${ward.riskLevel} risk · WBGT ${ward.wbgt.toFixed(1)}°C`, { sticky: true, opacity: .96 });
          layer.on("click", () => onSelectRef.current(ward));
          layer.on("mouseover", () => (layer as L.Path).setStyle({ fillOpacity: .84, weight: 1.5 }));
          layer.on("mouseout", () => (layer as L.Path).setStyle(style(ward.riskLevel)));
        },
      }).addTo(map);
      addLegend(map);
      map.fitBounds(L.geoJSON(geojson).getBounds().pad(.04));
    }).catch(() => undefined);
    return () => { cancelled = true; map.remove(); mapRef.current = null; };
  }, [wards]);

  return <div ref={container} className="saaya-leaflet h-full min-h-[440px] w-full" aria-label={`Interactive Pune ward thermal-risk map; selected ward ${selected.wardName}`} />;
}

function addLegend(map: L.Map) {
  const legend = new L.Control({ position: "bottomleft" });
  legend.onAdd = () => {
    const wrap = L.DomUtil.create("div", "saaya-map-legend");
    wrap.innerHTML = `<p>Screening WBGT risk</p>${levels.map((risk) => `<span><i style="background:${colors[risk]}"></i>${risk}</span>`).join("")}`;
    L.DomEvent.disableClickPropagation(wrap);
    return wrap;
  };
  legend.addTo(map);
}
