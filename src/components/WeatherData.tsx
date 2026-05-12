import { useEffect, useState } from 'react';
import { useMap } from 'maplibre-react-components';
import { fetchWeatherApi } from 'openmeteo';

interface WindPoint {
  lat: number;
  lng: number;
  speed: number;
  direction: number;
}

export const WeatherData = () => {
  const map = useMap();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!map) return;

    const fetchAndDrawWind = async () => {
      setLoading(true);
      const bounds = map.getBounds();
      
      // Create grid points
      const gridSize = 8;
      const latStep = (bounds.getNorth() - bounds.getSouth()) / gridSize;
      const lngStep = (bounds.getEast() - bounds.getWest()) / gridSize;
      
      const lats: number[] = [];
      const lngs: number[] = [];
      
      for (let i = 0; i <= gridSize; i++) {
        for (let j = 0; j <= gridSize; j++) {
          lats.push(bounds.getSouth() + i * latStep);
          lngs.push(bounds.getWest() + j * lngStep);
        }
      }

      try {
        const params = {
          latitude: lats,
          longitude: lngs,
          current: ['wind_speed_10m', 'wind_direction_10m'],
        };
        
        const url = 'https://api.open-meteo.com/v1/forecast';
        const responses = await fetchWeatherApi(url, params);
        
        const windPoints: WindPoint[] = responses.map((response, idx) => {
          const current = response.current()!;
          return {
            lat: lats[idx],
            lng: lngs[idx],
            speed: current.variables(0)!.value(),
            direction: current.variables(1)!.value(),
          };
        });
        
        if (map.getLayer('wind-lines')) {
          map.removeLayer('wind-lines');
        }
        if (map.getSource('wind-lines')) {
          map.removeSource('wind-lines');
        }
        
        const lineFeatures = windPoints.map((point) => {
          const lines: any[] = [];
          
          // Create flowing line from each point
          const numPoints = 20;
          const lineLength = 0.5; // degrees
          
          for (let i = 0; i < numPoints; i++) {
            const progress = i / numPoints;
            const angleRad = (point.direction * Math.PI) / 180;
            
            const startLng = point.lng + Math.sin(angleRad) * lineLength * progress;
            const startLat = point.lat + Math.cos(angleRad) * lineLength * progress;
            const endLng = point.lng + Math.sin(angleRad) * lineLength * (progress + 0.05);
            const endLat = point.lat + Math.cos(angleRad) * lineLength * (progress + 0.05);
            
            lines.push({
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: [[startLng, startLat], [endLng, endLat]],
              },
              properties: {
                windSpeed: point.speed,
                opacity: 1 - progress * 0.5, // Fade out
              },
            });
          }
          
          return lines;
        }).flat();
        
        // Add source
        map.addSource('wind-lines', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: lineFeatures,
          },
        });
        
        // Add line layer with color based on speed
        map.addLayer({
          id: 'wind-lines',
          type: 'line',
          source: 'wind-lines',
          paint: {
            'line-width': 2,
            'line-color': [
              'interpolate',
              ['linear'],
              ['get', 'windSpeed'],
              0, '#3b82f6',    // Blue - calm
              5, '#22c55e',    // Green
              10, '#eab308',   // Yellow
              15, '#f97316',   // Orange
              20, '#ef4444'    // Red - strong
            ],
            'line-opacity': ['get', 'opacity'],
          },
        });
        
      } catch (error) {
        console.error('Error fetching wind data:', error);
      }
      
      setLoading(false);
    };

    fetchAndDrawWind();

    const handleMoveEnd = () => {
      fetchAndDrawWind();
    };

    map.on('moveend', handleMoveEnd);

    return () => {
      map.off('moveend', handleMoveEnd);
      if (map.getLayer('wind-lines')) {
        map.removeLayer('wind-lines');
      }
      if (map.getSource('wind-lines')) {
        map.removeSource('wind-lines');
      }
    };
  }, [map]);

  return (
    <div style={{
      position: 'absolute',
      top: '80px',
      right: '10px',
      backgroundColor: 'white',
      padding: '12px',
      borderRadius: '8px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
      zIndex: 1000,
      minWidth: '200px',
    }}>
      <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 'bold' }}>
        Vindkart (10m)
      </h3>
      
      {loading && (
        <div style={{ fontSize: '12px', color: '#666' }}>
          Laster...
        </div>
      )}
      
      {/* Color legend */}
      <div style={{ fontSize: '11px', marginTop: '8px' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Vindstyrke:</div>
        <div style={{ 
          height: '20px', 
          background: 'linear-gradient(to right, #3b82f6, #22c55e, #eab308, #f97316, #ef4444)',
          borderRadius: '4px',
          marginBottom: '4px'
        }}></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#666' }}>
          <span>Svak</span>
          <span>Moderat</span>
          <span>Sterk</span>
        </div>
      </div>
      
      <p style={{ margin: '8px 0 0 0', fontSize: '10px', color: '#666' }}>
        Linjer viser vindretning og styrke. Zoom/pan for å oppdatere.
      </p>
    </div>
  );
};