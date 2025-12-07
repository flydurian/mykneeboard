import React, { useState, useMemo } from 'react';
import { getCityInfo } from '../../utils/cityData';
import { searchFlightSchedulesByCity, searchFlightSchedules } from '../../src/firebase/flightSchedules';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  flights: any[];
  onCityClick?: (cityCode: string) => void;
  onCrewClick?: (crewName: string) => void;
}

interface CrewMember {
  name: string;
  empl: string;
  rank: string;
  flights: number;
}

const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose, flights, onCityClick, onCrewClick }) => {
  const [searchType, setSearchType] = useState<'city' | 'crew'>('city');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const resultsRef = React.useRef<HTMLDivElement>(null);

  const isDarkMode = document.documentElement.classList.contains('dark');

  // Auto-hide scrollbar
  React.useEffect(() => {
    if (!resultsRef.current) return;

    let scrollTimeout: NodeJS.Timeout | null = null;

    const handleScroll = () => {
      resultsRef.current?.classList.add('scrolling');
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        resultsRef.current?.classList.remove('scrolling');
      }, 1000);
    };

    resultsRef.current.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      resultsRef.current?.removeEventListener('scroll', handleScroll);
      if (scrollTimeout) clearTimeout(scrollTimeout);
    };
  }, [showResults]);

  // 도시/항공편 검색 함수 (Firebase DB 포함)
  const searchCities = async (query: string) => {
    if (!query.trim()) return [];

    const searchQuery = query.toUpperCase();
    const results: any[] = [];

    // 입력값이 항공편 번호인지 IATA 코드인지 판단
    // 항공편 번호: 2-3글자 + 숫자 (예: OZ102, AAR102, KE001)
    const isFlightNumber = /^[A-Z]{2,3}\d+$/.test(searchQuery);

    // 시간 입력 판단 (HHMM 형식)
    const isTimeSearch = /^\d{4}$/.test(searchQuery);

    console.log('🔍 검색 쿼리:', searchQuery, '타입:', isFlightNumber ? '항공편 번호' : isTimeSearch ? '시간 검색' : 'IATA 코드');

    if (isTimeSearch) {
      // 시간으로 검색
      const searchHour = parseInt(searchQuery.substring(0, 2), 10);
      const searchMinute = parseInt(searchQuery.substring(2, 4), 10);

      if (searchHour >= 0 && searchHour <= 23 && searchMinute >= 0 && searchMinute <= 59) {
        try {
          // 오늘 날짜 생성
          const today = new Date();
          const targetDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), searchHour, searchMinute);

          // 인천공항 출발편 검색을 위해 백엔드 API 호출 (시간 범위 필터링은 클라이언트 또는 서버에서 수행)
          // 여기서는 기존의 항공편 검색 API를 활용할 수 없으므로, 새로운 엔드포인트나 기존 엔드포인트를 확장해야 함
          // 현재는 임시로 인천공항 출발편 API를 호출하여 클라이언트에서 필터링하는 방식으로 구현

          // TODO: 시간 기반 검색을 위한 전용 API 엔드포인트가 필요함. 
          // 현재 구조상 클라이언트에서 직접 외부 API를 호출하거나, 서버 함수를 통해야 함.
          // 여기서는 서버리스 함수를 호출하여 처리

          const response = await fetch('/api/incheon/flights', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              flightNumber: 'ALL', // 전체 검색을 위한 키워드 (서버 수정 필요할 수 있음)
              searchType: 'departure',
              searchTime: searchQuery // 시간 정보 전달
            })
          });

          if (response.ok) {
            const data = await response.json();
            // 시간 범위 필터링 (앞뒤 30분)
            const filteredResults = data.results.filter((flight: any) => {
              // 시간 파싱 (HHMM 또는 HH:MM)
              let timeStr = '';

              // rawScheduleTime(HHMM)이 있으면 우선 사용
              if (flight.rawScheduleTime && /^\d{4}$/.test(flight.rawScheduleTime)) {
                timeStr = flight.rawScheduleTime;
              } else if (flight.scheduledTime) {
                // 없으면 scheduledTime에서 숫자만 추출하여 뒤에서 4자리 가져옴
                const nums = flight.scheduledTime.replace(/[^0-9]/g, '');
                if (nums.length >= 4) {
                  timeStr = nums.slice(-4);
                }
              }

              if (timeStr.length !== 4) return false;

              const flightHour = parseInt(timeStr.substring(0, 2), 10);
              const flightMinute = parseInt(timeStr.substring(2, 4), 10);

              const flightTimeVal = flightHour * 60 + flightMinute;
              const searchTimeVal = searchHour * 60 + searchMinute;

              let diff = Math.abs(flightTimeVal - searchTimeVal);
              // 자정을 넘어가는 경우 처리 (예: 23:50과 00:10)
              if (diff > 720) { // 12시간 이상 차이나면 반대편으로 계산
                diff = 1440 - diff;
              }

              return diff <= 30; // 30분 이내
            });

            // 결과를 도시 검색 결과 형식으로 변환하여 반환
            const resultMap = new Map<string, { code: string; name: string; flights: any[] }>();

            filteredResults.forEach((flight: any) => {
              // 시간 검색 결과는 항공편명이 중복될 수 있으므로 키에 시간을 포함하거나
              // 별도 항목으로 처리해야 함. 하지만 여기서는 항공편명 기준으로 묶어서 보여줌.
              // 단, 시간 검색의 경우 리스트에 바로 보여주기 위해 가상의 키를 사용할 수도 있음.
              // 여기서는 그냥 flightNumber를 키로 사용하되, 정보가 덮어씌워지지 않도록 처리할 필요가 있음?
              // -> resultMap은 항공편명 기준 그룹핑이므로, 같은 항공편명이면 묶이는 게 맞음 (예: 공동운항)
              // -> 하지만 서로 다른 시간대의 같은 편명이 있을 수 있나? (하루에 여러 번) -> 그럴 수 있음.
              // -> 키에 날짜/시간을 포함시켜 구분

              const key = `${flight.flightNumber}_${flight.rawScheduleTime || flight.scheduledTime}`;

              if (!resultMap.has(key)) {
                // 시간 표시 포맷팅 (HH:MM)
                let displayTime = '';
                if (flight.rawScheduleTime && /^\d{4}$/.test(flight.rawScheduleTime)) {
                  displayTime = `${flight.rawScheduleTime.substring(0, 2)}:${flight.rawScheduleTime.substring(2, 4)}`;
                } else {
                  displayTime = flight.scheduledTime;
                }

                resultMap.set(key, {
                  code: flight.flightNumber,
                  name: `${displayTime} | ${flight.arrival}행 (${flight.airline}) - ${displayTime}`,
                  flights: []
                });
              }
              resultMap.get(key)!.flights.push(flight);
            });

            // 시간순 정렬 (이미 API에서 정렬되어 오지만, 그룹핑 후 다시 정렬)
            return Array.from(resultMap.values()).sort((a, b) => {
              const timeA = a.flights[0]?.rawScheduleTime || '0000';
              const timeB = b.flights[0]?.rawScheduleTime || '0000';
              return timeA.localeCompare(timeB);
            });
          }
        } catch (e) {
          console.error("Time search failed", e);
        }
      }
      return [];
    } else if (isFlightNumber) {
      // 항공편 번호로 검색
      try {
        const dbFlights = await searchFlightSchedules(searchQuery);
        console.log('🔍 Firebase DB 항공편 검색 결과:', dbFlights.length, '개');

        // 항공편별로 결과 구성
        const flightMap = new Map<string, { code: string; name: string; flights: any[] }>();

        dbFlights.forEach(flight => {
          const key = flight.flightNumber;
          const routeName = `${flight.departure} → ${flight.arrival}`;

          if (!flightMap.has(key)) {
            flightMap.set(key, {
              code: flight.flightNumber,
              name: routeName,
              flights: []
            });
          }
          flightMap.get(key)!.flights.push({
            ...flight,
            fromDB: true
          });
        });

        return Array.from(flightMap.values());

      } catch (error) {
        console.error('❌ Firebase DB 항공편 검색 실패:', error);
        return [];
      }
    } else {
      // IATA 코드로 도시 검색
      const cityMap = new Map<string, { code: string; name: string; flights: any[]; isFromDB: boolean }>();

      // 1. 로컬 flights에서 도시 정보 수집
      flights.forEach(flight => {
        let departure, arrival;

        if (flight.route) {
          const routeParts = flight.route.split(/[/\- ]/);
          if (routeParts.length >= 2) {
            departure = routeParts[0];
            arrival = routeParts[1];
          } else if (routeParts.length === 1 && routeParts[0] !== 'RESERVE') {
            departure = routeParts[0];
            arrival = null;
          }
        }

        departure = departure || flight.departure || flight.origin;
        arrival = arrival || flight.arrival || flight.destination;

        [departure, arrival].forEach(cityCode => {
          if (cityCode && cityCode.trim()) {
            const cityInfo = getCityInfo(cityCode.trim());
            if (cityInfo) {
              const key = cityCode.trim().toUpperCase();
              if (!cityMap.has(key)) {
                cityMap.set(key, {
                  code: cityCode.trim().toUpperCase(),
                  name: cityInfo.name,
                  flights: [],
                  isFromDB: false
                });
              }
              cityMap.get(key)!.flights.push(flight);
            }
          }
        });
      });

      // 2. Firebase DB에서 항공편 스케줄 검색 (IATA 코드로 검색)
      try {
        const dbFlights = await searchFlightSchedulesByCity(searchQuery);
        console.log('🔍 Firebase DB 도시 검색 결과:', dbFlights.length, '개 항공편');

        dbFlights.forEach(flight => {
          const departure = flight.departure;
          const arrival = flight.arrival;

          [departure, arrival].forEach(cityCode => {
            if (cityCode && cityCode.trim()) {
              const cityInfo = getCityInfo(cityCode.trim());
              if (cityInfo) {
                const key = cityCode.trim().toUpperCase();
                if (!cityMap.has(key)) {
                  cityMap.set(key, {
                    code: cityCode.trim().toUpperCase(),
                    name: cityInfo.name,
                    flights: [],
                    isFromDB: true
                  });
                }
                cityMap.get(key)!.flights.push({
                  ...flight,
                  fromDB: true
                });
                cityMap.get(key)!.isFromDB = true;
              }
            }
          });
        });
      } catch (error) {
        console.error('❌ Firebase DB 도시 검색 실패:', error);
      }

      // 검색어와 매칭되는 도시 필터링
      Array.from(cityMap.values()).forEach(city => {
        if (city.code.includes(searchQuery) ||
          city.name.toLowerCase().includes(searchQuery.toLowerCase())) {
          results.push(city);
        }
      });

      return results.sort((a, b) => b.flights.length - a.flights.length);
    }
  };

  // CREW 검색 함수
  const searchCrew = (query: string) => {
    if (!query.trim()) return [];

    const searchQuery = query.toLowerCase();
    const crewMap = new Map<string, CrewMember>();

    flights.forEach(flight => {
      if (flight.crew && Array.isArray(flight.crew)) {
        flight.crew.forEach((member: any) => {
          const key = member.name || member.empl || '';
          if (key) {
            if (!crewMap.has(key)) {
              crewMap.set(key, {
                name: member.name || '',
                empl: member.empl || '',
                rank: member.rank || '',
                flights: 0
              });
            }
            crewMap.get(key)!.flights++;
          }
        });
      }
    });

    // 검색어와 매칭되는 CREW 필터링
    const results: CrewMember[] = [];
    Array.from(crewMap.values()).forEach(member => {
      // 이름과 사번 모두에서 검색 (대소문자 구분 없음)
      const nameMatch = member.name.toLowerCase().includes(searchQuery);
      const emplMatch = member.empl.toLowerCase().includes(searchQuery);

      if (nameMatch || emplMatch) {
        results.push(member);
      }
    });

    return results.sort((a, b) => b.flights - a.flights);
  };

  const handleSearch = async () => {
    if (searchType === 'city') {
      const results = await searchCities(searchQuery);
      setSearchResults(results);
    } else {
      setSearchResults(searchCrew(searchQuery));
    }
    setShowResults(true);
  };

  const handleClose = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-40 p-4 pt-safe">
      <div className="glass-panel rounded-lg shadow-lg w-full max-w-md">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white">검색</h3>
          <button
            onClick={handleClose}
            className="p-1 text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 검색 타입 선택 */}
        <div className="p-4 border-b border-white/10">
          <div className="glass-panel rounded-xl p-1 flex">
            <button
              onClick={() => {
                setSearchType('city');
                setSearchResults([]);
                setShowResults(false);
              }}
              className={`relative flex-1 py-1.5 px-4 rounded-xl text-sm font-bold transition-colors duration-300 z-10 ${searchType === 'city'
                ? 'text-white'
                : ('text-gray-400 hover:text-gray-200')
                }`}
            >
              {searchType === 'city' && (
                <div className="absolute inset-0 rounded-xl bg-teal-600 shadow-md shadow-teal-500/30 -z-10"></div>
              )}
              도시 검색
            </button>
            <button
              onClick={() => {
                setSearchType('crew');
                setSearchResults([]);
                setShowResults(false);
              }}
              className={`relative flex-1 py-1.5 px-4 rounded-xl text-sm font-bold transition-colors duration-300 z-10 ${searchType === 'crew'
                ? 'text-white'
                : ('text-gray-400 hover:text-gray-200')
                }`}
            >
              {searchType === 'crew' && (
                <div className="absolute inset-0 rounded-xl bg-teal-600 shadow-md shadow-teal-500/30 -z-10"></div>
              )}
              CREW 검색
            </button>
          </div>
        </div>

        {/* 검색 입력 */}
        <div className="p-4 space-y-4">
          <div>
            <input
              type="text"
              placeholder={searchType === 'city' ? 'IATA 코드 입력 (예: ICN)' : '사번 또는 이름 입력'}
              value={searchQuery}
              onChange={(e) => {
                const value = e.target.value;
                // 한글이 포함된 경우 대문자 변환하지 않음
                const hasKorean = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(value);
                setSearchQuery(hasKorean ? value : value.toUpperCase());
                // 검색어가 변경되면 검색 결과 초기화
                setSearchResults([]);
                setShowResults(false);
              }}
              className="glass-input w-full px-3 py-2 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-white placeholder-slate-400 bg-black/20"
              style={{
                WebkitAppearance: 'none',
                appearance: 'none',
                borderRadius: '0.75rem'
              }}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <button
            onClick={handleSearch}
            className="w-full glass-button bg-blue-600 hover:bg-blue-500 text-white py-2 px-4 rounded-xl transition-colors font-medium"
            style={{
              WebkitAppearance: 'none',
              appearance: 'none',
              borderRadius: '0.75rem'
            }}
          >
            검색
          </button>
        </div>

        {/* 검색 결과 */}
        {showResults && (
          <div ref={resultsRef} className="px-4 pb-4 max-h-96 overflow-y-auto border-t border-white/10 custom-scrollbar">
            {searchResults.length > 0 ? (
              <div className="space-y-3 pt-4">
                {searchResults.map((result, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border border-white/10 ${searchType === 'city'
                      ? 'bg-black/20 hover:bg-white/10 cursor-pointer transition-colors'
                      : 'bg-black/20 hover:bg-white/10 cursor-pointer transition-colors'
                      }`}
                    onClick={searchType === 'city' && onCityClick ? () => {
                      onCityClick(result.code);
                      // 검색 모달은 그대로 유지
                    } : searchType === 'crew' && onCrewClick ? () => {
                      onCrewClick(result.name);
                      // 검색 모달은 그대로 유지
                    } : undefined}
                  >
                    {searchType === 'city' ? (
                      <div>
                        <div className="font-semibold text-white">
                          {result.code} - {result.name}
                        </div>
                        <div className="text-sm text-slate-400">
                          {result.flights.length}개 비행
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="font-semibold text-white">
                          {result.name}({result.empl})
                        </div>
                        <div className="text-sm text-slate-400">
                          {result.rank} • {result.flights}개 비행
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                검색 결과가 없습니다.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchModal;
