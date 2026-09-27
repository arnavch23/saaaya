import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Ward } from "../types/heat";

type GeoFeature = Feature<Geometry, { wardnum: number; Name1?: string; Name2?: string }>;
type WardCollection = FeatureCollection<Geometry, GeoFeature["properties"]>;

const riskColor = {
  Low: "#34a56f", Moderate: "#d99b16", High: "#e77525", "Very High": "#e34d45", Extreme: "#9f2734",
} as const;

type Props = { wards: Ward[]; selected: Ward; onSelect: (ward: Ward) => void };

export function PuneRiskMap({ wards, selected, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const selectedRef = useRef(selected.id);
  selectedRef.current = selected.id;

  useEffect(() => {
    if (!container.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: container.current,
      style: {
        version: 8,
        sources: { osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "© OpenStreetMap contributors" } },
        layers: [{ id: "osm", type: "raster", source: "osm", paint: { "raster-opacity": 0.55, "raster-saturation": -0.8, "raster-brightness-max": 0.95 } }],
      },
      attributionControl: {},
      cooperativeGestures: true,
    });
    mapRef.current = map;

    map.on("load", async () => {
      const response = await fetch("/data/pune-electoral-wards-2022.geojson");
      const data = (await response.json()) as WardCollection;
      const mapped = {
        ...data,
        features: data.features.map((feature) => {
          const base = wards[(feature.properties.wardnum - 1) % wards.length];
          return { ...feature, properties: { ...feature.properties, risk: base.thermalRisk, mockIndex: (feature.properties.wardnum - 1) % wards.length } };
        }),
      };

      map.addSource("pune-wards", { type: "geojson", data: mapped });
      map.addLayer({ id: "ward-fill", type: "fill", source: "pune-wards", paint: { "fill-color": ["match", ["get", "risk"], "Low", riskColor.Low, "Moderate", riskColor.Moderate, "High", riskColor.High, "Very High", riskColor["Very High"], "Extreme", riskColor.Extreme, "#94a3b8"], "fill-opacity": 0.73 } });
      map.addLayer({ id: "ward-outline", type: "line", source: "pune-wards", paint: { "line-color": "#ffffff", "line-width": 1.15 } });
      map.addLayer({ id: "ward-selected", type: "line", source: "pune-wards", filter: ["==", ["get", "wardnum"], selectedRef.current], paint: { "line-color": "#17202a", "line-width": 3 } });

      const bounds = new maplibregl.LngLatBounds();
      mapped.features.forEach((feature) => {
        const visit = (coordinates: unknown): void => {
          if (!Array.isArray(coordinates)) return;
          if (typeof coordinates[0] === "number") bounds.extend(coordinates as [number, number]);
          else coordinates.forEach(visit);
        };
        if ("coordinates" in feature.geometry) visit(feature.geometry.coordinates);
      });
      map.fitBounds(bounds, { padding: 38, duration: 0 });

      const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12 });
      map.on("mousemove", "ward-fill", (event) => {
        map.getCanvas().style.cursor = "pointer";
        const props = event.features?.[0]?.properties;
        if (props && event.lngLat) popup.setLngLat(event.lngLat).setHTML(`<strong>${props.Name2 || `Ward ${props.wardnum}`}</strong><br/><span>${props.risk} human thermal risk</span>`).addTo(map);
      });
      map.on("mouseleave", "ward-fill", () => { map.getCanvas().style.cursor = ""; popup.remove(); });
      map.on("click", "ward-fill", (event) => {
        const props = event.features?.[0]?.properties;
        if (!props) return;
        const number = Number(props.wardnum);
        const base = wards[Number(props.mockIndex)];
        const ward = { ...base, id: number, name: props.Name2 || props.Name1 || `Ward ${String(number).padStart(2, "0")}` };
        map.setFilter("ward-selected", ["==", ["get", "wardnum"], number]);
        onSelect(ward);
      });
    });
    return () => { map.remove(); mapRef.current = null; };
  }, [onSelect, wards]);

  useEffect(() => {
    const map = mapRef.current;
    if (map?.getLayer("ward-selected")) map.setFilter("ward-selected", ["==", ["get", "wardnum"], selected.id]);
  }, [selected.id]);

  return <div ref={container} className="h-[390px] w-full" aria-label="Interactive 2022 Pune ward-level human thermal risk map" />;
}
