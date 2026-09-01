import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { HeatLocality, RiskLevel } from "../types/heat";
import { nearestLocality, riskZoneColor } from "../data/mockHeatLocalities";

type WardProps = { wardnum: number; Name1?: string; Name2?: string };
type WardFeature = GeoJSON.Feature<GeoJSON.Geometry, WardProps>;
type WardCollection = GeoJSON.FeatureCollection<GeoJSON.Geometry, WardProps>;

const RISK_LEVELS: RiskLevel[] = ["Low", "Moderate", "High", "Very High", "Extreme"];

const localityAliases: Array<[string, string]> = [
  ["kharadi", "Kharadi"],
  ["hadapsar", "Hadapsar"],
  ["viman", "Viman Nagar"],
  ["koregaon", "Koregaon Park"],
  ["kothrud", "Kothrud"],
  ["aundh", "Aundh"],
  ["baner", "Baner"],
  ["wakad", "Wakad"],
  ["shivaji", "Shivajinagar"],
  ["swargate", "Swargate"],
  ["pimpri", "Pimpri"],
  ["yerawada", "Yerawada"],
];

type Props = {
  localities: HeatLocality[];
  selected: HeatLocality;
  onSelect: (locality: HeatLocality) => void;
};

export function PuneHeatMap({ localities, selected, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const selectedRef = useRef(selected);
  const onSelectRef = useRef(onSelect);
  selectedRef.current = selected;
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!container.current || mapRef.current) return;
    let cancelled = false;

    const start = async () => {
      if (!container.current || mapRef.current) return;

      const map = L.map(container.current, {
        zoomControl: true,
        attributionControl: true,
        scrollWheelZoom: true,
      });
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        className: "saaya-basemap",
        maxZoom: 19,
      }).addTo(map);

      map.createPane("risk-zones");
      const zonePane = map.getPane("risk-zones");
      if (zonePane) zonePane.style.zIndex = "410";

      const response = await fetch("/data/pune-electoral-wards-2022.geojson");
      const wards = (await response.json()) as WardCollection;
      if (cancelled) {
        map.remove();
        return;
      }

      const byWard = new Map<number, HeatLocality | null>();
      for (const feature of wards.features) {
        byWard.set(feature.properties.wardnum, localityForWard(feature, localities));
      }

      L.geoJSON(wards, {
        pane: "risk-zones",
        style: (feature) => {
          const ward = feature as WardFeature | undefined;
          const loc = ward ? byWard.get(ward.properties.wardnum) ?? null : null;
          return zoneStyle(loc?.thermalRisk);
        },
        onEachFeature: (feature, layer) => {
          const ward = feature as WardFeature;
          const loc = byWard.get(ward.properties.wardnum) ?? null;
          const name = ward.properties.Name2 || `Ward ${ward.properties.wardnum}`;
          const risk = loc?.thermalRisk ?? "Moderate";
          layer.bindTooltip(
            `<strong>${name}</strong><br/>${risk} human thermal risk`,
            { sticky: true, opacity: 0.95 },
          );
          layer.on("click", (event) => {
            L.DomEvent.stopPropagation(event);
            if (loc) onSelectRef.current(loc);
          });
          layer.on("mouseover", () => {
            (layer as L.Path).setStyle({ fillOpacity: 0.5 });
          });
          layer.on("mouseout", () => {
            (layer as L.Path).setStyle(zoneStyle(risk));
          });
        },
      }).addTo(map);

      addRiskLegend(map);
      map.fitBounds(L.geoJSON(wards).getBounds().pad(0.04));

      markersRef.current = localities.map((loc) => {
        const marker = L.marker([loc.latitude, loc.longitude], {
          icon: labelIcon(loc.locality, loc.locality === selectedRef.current.locality),
          keyboard: true,
          zIndexOffset: 600,
          title: `${loc.locality}: ${loc.thermalRisk} human thermal risk (simulated)`,
        });
        marker.on("click", () => onSelectRef.current(loc));
        marker.addTo(map);
        return marker;
      });

      map.on("click", (event: L.LeafletMouseEvent) => {
        const match = nearestLocality(event.latlng.lat, event.latlng.lng, localities);
        if (match) onSelectRef.current(match);
      });

      const resize = () => map.invalidateSize();
      requestAnimationFrame(resize);
      window.addEventListener("resize", resize);
      (map as L.Map & { _saayaResize?: () => void })._saayaResize = resize;
    };

    void start();

    return () => {
      cancelled = true;
      const map = mapRef.current;
      if (map) {
        const resize = (map as L.Map & { _saayaResize?: () => void })._saayaResize;
        if (resize) window.removeEventListener("resize", resize);
        map.remove();
      }
      mapRef.current = null;
      markersRef.current = [];
    };
  }, [localities]);

  useEffect(() => {
    markersRef.current.forEach((marker, index) => {
      const loc = localities[index];
      if (!loc) return;
      marker.setIcon(labelIcon(loc.locality, loc.locality === selected.locality));
    });
  }, [localities, selected.locality]);

  return (
    <div
      ref={container}
      className="saaya-leaflet h-full min-h-[440px] w-full"
      aria-label="Interactive Pune human thermal risk heatmap"
    />
  );
}

function localityForWard(feature: WardFeature, localities: HeatLocality[]) {
  const label = `${feature.properties.Name1 ?? ""} ${feature.properties.Name2 ?? ""}`.toLowerCase();
  for (const [needle, locality] of localityAliases) {
    if (label.includes(needle)) {
      const match = localities.find((item) => item.locality === locality);
      if (match) return match;
    }
  }
  const containing = localities.find((item) =>
    pointInFeature(item.latitude, item.longitude, feature),
  );
  if (containing) return containing;
  const center = L.geoJSON(feature).getBounds().getCenter();
  return nearestLocality(center.lat, center.lng, localities, 40);
}

function pointInFeature(lat: number, lng: number, feature: WardFeature) {
  const geom = feature.geometry;
  if (geom.type === "Polygon") return pointInPolygon(lat, lng, geom.coordinates);
  if (geom.type === "MultiPolygon") {
    return geom.coordinates.some((polygon) => pointInPolygon(lat, lng, polygon));
  }
  return false;
}

function pointInPolygon(lat: number, lng: number, rings: number[][][]) {
  if (!rings[0] || !pointInRing(lat, lng, rings[0])) return false;
  for (let i = 1; i < rings.length; i += 1) {
    if (pointInRing(lat, lng, rings[i])) return false;
  }
  return true;
}

function pointInRing(lat: number, lng: number, ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersects = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function zoneStyle(risk: RiskLevel = "Moderate"): L.PathOptions {
  return {
    color: "#f7f8fa",
    weight: 0.6,
    opacity: 0.42,
    fillColor: riskZoneColor[risk],
    fillOpacity: 0.38,
    lineJoin: "round",
    lineCap: "round",
  };
}

function addRiskLegend(map: L.Map) {
  const legend = new L.Control({ position: "bottomleft" });
  legend.onAdd = () => {
    const wrap = L.DomUtil.create("div", "saaya-map-legend");
    wrap.innerHTML = `<p>Human Thermal Risk</p>${RISK_LEVELS.map(
      (risk) =>
        `<span><i style="background:${riskZoneColor[risk]}"></i>${risk}</span>`,
    ).join("")}`;
    L.DomEvent.disableClickPropagation(wrap);
    return wrap;
  };
  legend.addTo(map);
}

function labelIcon(name: string, selected: boolean) {
  return L.divIcon({
    className: "saaya-locality-marker",
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    html: `<span class="saaya-locality-label${selected ? " is-selected" : ""}">${name}</span>`,
  });
}
