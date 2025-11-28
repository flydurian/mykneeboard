import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface FlightPath {
  callsign: string;
  path: Array<{
    lat: number;
    lon: number;
    altitude?: number;
    timestamp: number;
  }>;
  departure: {
    icao: string;
    name: string;
    lat: number;
    lon: number;
  };
  arrival: {
    icao: string;
    name: string;
    lat: number;
    lon: number;
  };
}

interface FlightMapProps {
  flightPath?: FlightPath;
  isVisible: boolean;
  onClose: () => void;
}

const FlightMap: React.FC<FlightMapProps> = ({ flightPath, isVisible, onClose }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapMode, setMapMode] = useState<'street' | 'satellite' | 'terrain'>('street');
  const mapInstance = useRef<L.Map | null>(null);

  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!isVisible || !mapRef.current) return;

    // 지도 초기화 함수
    const initializeMap = () => {
      if (!mapRef.current) return;

      console.log('🗺️ Leaflet 지도 초기화 시작...', {
        hasFlightPath: !!flightPath,
        departure: flightPath?.departure,
        arrival: flightPath?.arrival
      });

      try {
        // 기존 지도 제거
        if (mapInstance.current) {
          mapInstance.current.remove();
          mapInstance.current = null;
        }

        // 기본 지도 생성 (서울 중심)
        const map = L.map(mapRef.current, {
          center: [37.5665, 126.9780], // 서울
          zoom: 6,
          zoomControl: false, // 기본 확대/축소 버튼 비활성화
          attributionControl: true,
          preferCanvas: false // 렌더링 방식 설정
        });

        // 커스텀 확대/축소 컨트롤을 오른쪽 하단에 추가
        const zoomControl = L.control.zoom({
          position: 'bottomright'
        });
        zoomControl.addTo(map);

        // 지도 크기 강제 업데이트
        setTimeout(() => {
          map.invalidateSize();
        }, 300);

        // 기본 타일 레이어 추가
        addTileLayer(map, mapMode);

        mapInstance.current = map;

        // 지도 로드 이벤트 감지
        map.whenReady(() => {
          console.log('✅ Leaflet 지도 준비 완료 (whenReady)');
          setMapReady(true);
        });

        if (flightPath) {
          console.log('🛫 경로 데이터:', {
            callsign: flightPath.callsign,
            pathPoints: flightPath.path?.length || 0,
            samplePoint: flightPath.path?.[0]
          });

          // 출발지/도착지 마커 추가
          const departureIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="background-color: #10b981; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold;">출</div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          });

          const arrivalIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="background-color: #ef4444; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold;">도</div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          });

          // 출발지 마커
          L.marker([flightPath.departure.lat, flightPath.departure.lon], {
            icon: departureIcon
          })
            .addTo(map)
            .bindPopup(`<b>${flightPath.departure.icao}</b><br>${flightPath.departure.name}`);

          // 도착지 마커
          L.marker([flightPath.arrival.lat, flightPath.arrival.lon], {
            icon: arrivalIcon
          })
            .addTo(map)
            .bindPopup(`<b>${flightPath.arrival.icao}</b><br>${flightPath.arrival.name}`);

          // 실제 경로가 있으면 그리기
          if (flightPath.path && flightPath.path.length > 0) {
            console.log('✅ 실제 ADS-B 경로 사용:', flightPath.path.length, '개 포인트');

            const pathCoords = flightPath.path.map(point => [point.lat, point.lon] as [number, number]);

            // 경로 선 그리기
            L.polyline(pathCoords, {
              color: '#3b82f6',
              weight: 3,
              opacity: 0.8,
              smoothFactor: 1
            }).addTo(map);

            // 전체 경로를 볼 수 있도록 지도 범위 조정
            const group = new L.FeatureGroup();
            group.addLayer(L.polyline(pathCoords));
            map.fitBounds(group.getBounds().pad(0.1));
          } else {
            console.log('⚠️ 경로 데이터 없음, 직선 연결');

            // 직선 연결
            const directPath: [number, number][] = [
              [flightPath.departure.lat, flightPath.departure.lon],
              [flightPath.arrival.lat, flightPath.arrival.lon]
            ];

            L.polyline(directPath, {
              color: '#f59e0b',
              weight: 3,
              opacity: 0.8,
              dashArray: '10, 5'
            }).addTo(map);

            // 출발지-도착지를 볼 수 있도록 지도 범위 조정
            const bounds = L.latLngBounds(directPath);
            map.fitBounds(bounds.pad(0.1));
          }
        }

        console.log('✅ Leaflet 지도 초기화 완료');

        // 지도 크기 다시 조정
        setTimeout(() => {
          if (mapInstance.current) {
            mapInstance.current.invalidateSize();
          }
        }, 200);
      } catch (err) {
        console.error('Leaflet 초기화 오류:', err);
      }
    };

    const addTileLayer = (map: L.Map, mode: string) => {
      // 기존 타일 레이어 제거 (타입 문제로 any 사용하지 않고 직접 관리)
      map.eachLayer((layer) => {
        if (layer instanceof L.TileLayer) {
          map.removeLayer(layer);
        }
      });

      let tileLayer;
      switch (mode) {
        case 'satellite':
          // 실제 위성 이미지 타일 (ESRI World Imagery)
          tileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: '© Esri, Maxar, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, and the GIS User Community',
            maxZoom: 19
          });
          break;
        case 'terrain':
          // 지형 스타일 (OpenTopoMap)
          tileLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 17
          });
          break;
        default: // street
          // 일반 도로 지도 (OpenStreetMap)
          tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
          });
      }

      tileLayer.addTo(map);
    };

    // 즉시 초기화
    initializeMap();

    // ResizeObserver 설정
    const resizeObserver = new ResizeObserver(() => {
      if (mapInstance.current) {
        console.log('📏 지도 컨테이너 크기 변경 감지, invalidateSize 호출');
        mapInstance.current.invalidateSize();
      }
    });

    if (mapRef.current) {
      resizeObserver.observe(mapRef.current);
    }

    return () => {
      // 지도 정리
      setMapReady(false); // 정리 시 상태 초기화
      resizeObserver.disconnect();
      if (mapInstance.current) {
        try {
          mapInstance.current.remove();
        } catch (e) {
          console.error('Map cleanup error:', e);
        }
        mapInstance.current = null;
      }
    };
  }, [isVisible, flightPath, mapMode]);

  // 지도 모드 전환 함수
  const switchMapMode = (mode: 'street' | 'satellite' | 'terrain') => {
    if (!mapInstance.current) return;

    setMapMode(mode);

    // 타일 레이어 교체
    const map = mapInstance.current;

    // 기존 타일 레이어 제거
    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });

    let tileLayer;

    switch (mode) {
      case 'satellite':
        // 실제 위성 이미지 타일 (ESRI World Imagery)
        tileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          attribution: '© Esri, Maxar, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, and the GIS User Community',
          maxZoom: 19
        });
        break;
      case 'terrain':
        // 지형 스타일 (OpenTopoMap)
        tileLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 17
        });
        break;
      default: // street
        // 일반 도로 지도 (OpenStreetMap)
        tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19
        });
    }

    tileLayer.addTo(map);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-1 sm:p-2" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="glass-panel rounded-2xl w-full h-full max-w-6xl flex flex-col mx-1 sm:mx-2 animate-fade-in-up" style={{ maxHeight: 'calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 8px)' }}>
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 sm:p-6 pb-2 sm:pb-4 border-b border-white/10 flex-shrink-0">
          <h2 className="text-xl sm:text-2xl font-bold text-white">
            {flightPath ? `${flightPath.callsign} 항공편 경로` : '항공편 경로'}
          </h2>

          {/* 지도 모드 전환 버튼들 */}
          <div className="glass-panel rounded-xl p-1 flex">
            {(['street', 'satellite', 'terrain'] as const).map((mode) => {
              const isActive = mapMode === mode;
              const labels = { street: '지도', satellite: '위성', terrain: '지형' };
              return (
                <button
                  key={mode}
                  onClick={() => switchMapMode(mode)}
                  className={`relative px-4 py-1.5 rounded-xl text-sm font-bold transition-colors duration-300 z-10 ${isActive
                    ? 'text-white'
                    : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeMapMode"
                      className="absolute inset-0 rounded-xl bg-teal-600 shadow-md shadow-teal-500/30 -z-10"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  {labels[mode]}
                </button>
              );
            })}
            <button
              onClick={onClose}
              className="ml-2 p-1.5 text-slate-400 hover:text-white transition-colors rounded-xl hover:bg-white/10"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* 지도 컨테이너 */}
        <div className="flex-1 p-4 sm:p-6 pt-2 sm:pt-4 overflow-hidden relative">
          <div
            ref={mapRef}
            className="w-full h-full rounded-xl border border-white/10 overflow-hidden bg-slate-900"
            style={{ position: 'absolute', inset: '16px 24px 24px 24px', touchAction: 'none' }}
          >
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm z-10" style={{ display: mapReady ? 'none' : 'flex' }}>
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-slate-300">지도를 불러오는 중...</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default FlightMap;