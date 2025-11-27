import React, { useEffect, useRef, useState } from 'react';

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
  const [mapLoaded, setMapLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapMode, setMapMode] = useState<'street' | 'satellite' | 'terrain'>('street');
  const mapInstance = useRef<any>(null);

  useEffect(() => {
    if (!isVisible || !mapRef.current) return;

    // Leaflet 스크립트 로드
    const loadLeaflet = () => {
      // 이미 로드되어 있으면 바로 초기화
      if (window.L) {
        setTimeout(() => initializeMap(), 100);
        return;
      }

      // CSS 로드 (중복 방지)
      if (!document.querySelector('link[href*="leaflet.css"]')) {
        const leafletCss = document.createElement('link');
        leafletCss.rel = 'stylesheet';
        leafletCss.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(leafletCss);
      }

      // JS 로드 (중복 방지)
      if (!document.querySelector('script[src*="leaflet.js"]')) {
        const leafletScript = document.createElement('script');
        leafletScript.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        leafletScript.async = true;
        leafletScript.onload = () => {
          setTimeout(() => initializeMap(), 100);
        };
        leafletScript.onerror = () => {
          setError('Leaflet 라이브러리를 로드할 수 없습니다.');
          setMapLoaded(true);
        };
        document.head.appendChild(leafletScript);
      } else {
        // 이미 로드된 경우
        setTimeout(() => {
          if (window.L) {
            initializeMap();
          } else {
            setError('Leaflet 라이브러리 로딩 실패');
            setMapLoaded(true);
          }
        }, 500);
      }
    };

    const initializeMap = () => {
      if (!mapRef.current || !window.L) {
        console.error('Leaflet 초기화 실패: mapRef 또는 L이 없습니다', {
          hasMapRef: !!mapRef.current,
          hasL: !!window.L
        });
        setError('지도 컨테이너 또는 라이브러리를 찾을 수 없습니다.');
        setMapLoaded(true);
        return;
      }

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

        // 컨테이너 크기 확인
        const container = mapRef.current;
        console.log('컨테이너 크기:', {
          width: container.offsetWidth,
          height: container.offsetHeight
        });

        // 기본 지도 생성 (서울 중심)
        const map = window.L.map(mapRef.current, {
          center: [37.5665, 126.9780], // 서울
          zoom: 6,
          zoomControl: false, // 기본 확대/축소 버튼 비활성화
          attributionControl: true,
          preferCanvas: false // 렌더링 방식 설정
        });

        // 커스텀 확대/축소 컨트롤을 오른쪽 하단에 추가
        const zoomControl = window.L.control.zoom({
          position: 'bottomright'
        });
        zoomControl.addTo(map);

        // 지도 크기 강제 업데이트
        setTimeout(() => {
          map.invalidateSize();
        }, 100);

        // 기본 타일 레이어 추가
        addTileLayer(map, mapMode);

        mapInstance.current = map;

        if (flightPath) {
          console.log('🛫 경로 데이터:', {
            callsign: flightPath.callsign,
            pathPoints: flightPath.path?.length || 0,
            samplePoint: flightPath.path?.[0]
          });

          // 출발지/도착지 마커 추가
          const departureIcon = window.L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="background-color: #10b981; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold;">출</div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          });

          const arrivalIcon = window.L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="background-color: #ef4444; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold;">도</div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          });

          // 출발지 마커
          window.L.marker([flightPath.departure.lat, flightPath.departure.lon], {
            icon: departureIcon
          })
            .addTo(map)
            .bindPopup(`<b>${flightPath.departure.icao}</b><br>${flightPath.departure.name}`);

          // 도착지 마커
          window.L.marker([flightPath.arrival.lat, flightPath.arrival.lon], {
            icon: arrivalIcon
          })
            .addTo(map)
            .bindPopup(`<b>${flightPath.arrival.icao}</b><br>${flightPath.arrival.name}`);

          // 실제 경로가 있으면 그리기
          if (flightPath.path && flightPath.path.length > 0) {
            console.log('✅ 실제 ADS-B 경로 사용:', flightPath.path.length, '개 포인트');

            const pathCoords = flightPath.path.map(point => [point.lat, point.lon]);

            // 경로 선 그리기
            window.L.polyline(pathCoords, {
              color: '#3b82f6',
              weight: 3,
              opacity: 0.8,
              smoothFactor: 1
            }).addTo(map);

            // 전체 경로를 볼 수 있도록 지도 범위 조정
            const group = new window.L.featureGroup();
            group.addLayer(window.L.polyline(pathCoords));
            map.fitBounds(group.getBounds().pad(0.1));
          } else {
            console.log('⚠️ 경로 데이터 없음, 직선 연결');

            // 직선 연결
            const directPath = [
              [flightPath.departure.lat, flightPath.departure.lon],
              [flightPath.arrival.lat, flightPath.arrival.lon]
            ];

            window.L.polyline(directPath, {
              color: '#f59e0b',
              weight: 3,
              opacity: 0.8,
              dashArray: '10, 5'
            }).addTo(map);

            // 출발지-도착지를 볼 수 있도록 지도 범위 조정
            const bounds = window.L.latLngBounds(directPath);
            map.fitBounds(bounds.pad(0.1));
          }
        }

        setMapLoaded(true);
        console.log('✅ Leaflet 지도 초기화 완료');

        // 지도 크기 다시 조정
        setTimeout(() => {
          if (mapInstance.current) {
            mapInstance.current.invalidateSize();
          }
        }, 200);
      } catch (err) {
        console.error('Leaflet 초기화 오류:', err);
        const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류';
        setError(`지도를 초기화할 수 없습니다: ${errorMessage}`);
        setMapLoaded(true);
      }
    };

    const addTileLayer = (map: any, mode: string) => {
      // 기존 타일 레이어 제거
      if (map.tileLayer) {
        map.removeLayer(map.tileLayer);
      }

      let tileLayer;
      switch (mode) {
        case 'satellite':
          // 실제 위성 이미지 타일 (ESRI World Imagery)
          tileLayer = window.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: '© Esri, Maxar, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, and the GIS User Community',
            maxZoom: 19
          });
          break;
        case 'terrain':
          // 지형 스타일 (OpenTopoMap)
          tileLayer = window.L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 17
          });
          break;
        default: // street
          // 일반 도로 지도 (OpenStreetMap)
          tileLayer = window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
          });
      }

      tileLayer.addTo(map);
      map.tileLayer = tileLayer;
    };

    loadLeaflet();

    return () => {
      // 지도 정리
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
    let tileLayer;

    switch (mode) {
      case 'satellite':
        // 실제 위성 이미지 타일 (ESRI World Imagery)
        tileLayer = window.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          attribution: '© Esri, Maxar, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, and the GIS User Community',
          maxZoom: 19
        });
        break;
      case 'terrain':
        // 지형 스타일 (OpenTopoMap)
        tileLayer = window.L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 17
        });
        break;
      default: // street
        // 일반 도로 지도 (OpenStreetMap)
        tileLayer = window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19
        });
    }

    // 기존 타일 레이어 제거하고 새로 추가
    if (map.tileLayer) {
      map.removeLayer(map.tileLayer);
    }
    tileLayer.addTo(map);
    map.tileLayer = tileLayer;
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-1 sm:p-2" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full h-full max-w-6xl flex flex-col mx-1 sm:mx-2" style={{ maxHeight: 'calc(100vh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 8px)' }}>
        {/* 헤더 */}
        <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0" style={{ paddingTop: 'max(12px, env(safe-area-inset-top) + 12px)' }}>
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">
            {flightPath ? `${flightPath.callsign} 항공편 경로` : '항공편 경로'}
          </h2>

          {/* 지도 모드 전환 버튼들 */}
          <div className="flex items-center space-x-2">
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => switchMapMode('street')}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${mapMode === 'street'
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white'
                  }`}
                title="일반 지도"
              >
                지도
              </button>
              <button
                onClick={() => switchMapMode('satellite')}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${mapMode === 'satellite'
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white'
                  }`}
                title="위성 이미지"
              >
                위성
              </button>
              <button
                onClick={() => switchMapMode('terrain')}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${mapMode === 'terrain'
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white'
                  }`}
                title="지형 지도"
              >
                지형
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* 지도 컨테이너 */}
        <div className="flex-1 p-1 sm:p-2 overflow-hidden">
          <div
            ref={mapRef}
            className="w-full h-full rounded-lg border border-gray-200 dark:border-gray-700"
            style={{ position: 'relative', minHeight: '400px' }}
          >
            {!mapLoaded && !error && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-900 rounded-lg z-10">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <p className="text-gray-600 dark:text-gray-400">지도를 불러오는 중...</p>
                </div>
              </div>
            )}
            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-900 rounded-lg z-10">
                <div className="text-center">
                  <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-red-600 dark:text-red-400">{error}</p>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

// Window 타입 확장
declare global {
  interface Window {
    L: any;
  }
}

export default FlightMap;