import React, { useState, useMemo } from 'react';
import { getCityInfo } from '../../utils/cityData';

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

  const isDarkMode = document.documentElement.classList.contains('dark');

  // 도시 검색 함수
  const searchCities = (query: string) => {
    if (!query.trim()) return [];
    
    const searchQuery = query.toLowerCase();
    const results: any[] = [];
    
    // 모든 비행에서 도시 정보 수집
    const cityMap = new Map<string, { code: string; name: string; flights: any[] }>();
    
    flights.forEach(flight => {
      // route 필드에서 출발지와 도착지 파싱 (예: "ICN-LAX" 또는 "ICN LAX")
      let departure, arrival;
      
      if (flight.route) {
        // 다양한 구분자 지원: /, -, 공백
        const routeParts = flight.route.split(/[/\- ]/);
        if (routeParts.length >= 2) {
          departure = routeParts[0];
          arrival = routeParts[1];
        } else if (routeParts.length === 1 && routeParts[0] !== 'RESERVE') {
          // 단일 도시인 경우 (예: "ICN", "GMP")
          departure = routeParts[0];
          arrival = null;
        }
      }
      
      // 기존 필드들도 확인
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
                flights: []
              });
            }
            cityMap.get(key)!.flights.push(flight);
          }
        }
      });
    });
    
    // 검색어와 매칭되는 도시 필터링
    Array.from(cityMap.values()).forEach(city => {
      if (city.code.toLowerCase().includes(searchQuery) || 
          city.name.toLowerCase().includes(searchQuery)) {
        results.push(city);
      }
    });
    return results.sort((a, b) => b.flights.length - a.flights.length);
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

  const handleSearch = () => {
    if (searchType === 'city') {
      setSearchResults(searchCities(searchQuery));
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
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-40 p-4 pt-safe">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-md">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-600">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">검색</h3>
          <button
            onClick={handleClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 검색 타입 선택 */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-600">
          <div className="flex justify-center">
            <div className="flex w-full max-w-xs">
              <button
                onClick={() => {
                  setSearchType('city');
                  setSearchResults([]);
                  setShowResults(false);
                }}
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors relative ${
                  searchType === 'city'
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                도시 검색
                {searchType === 'city' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400"></div>
                )}
              </button>
              <button
                onClick={() => {
                  setSearchType('crew');
                  setSearchResults([]);
                  setShowResults(false);
                }}
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors relative ${
                  searchType === 'crew'
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                CREW 검색
                {searchType === 'crew' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400"></div>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 검색 입력 */}
        <div className="p-4 space-y-4">
          <div>
            <input
              type="text"
              placeholder={searchType === 'city' ? 'IATA code로 입력해주세요. 예) ICN, LAX..' : '사번 또는 이름 입력'}
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
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 bg-white dark:bg-gray-700"
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <button
            onClick={handleSearch}
            className="w-full bg-blue-500 dark:bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors font-medium"
          >
            검색
          </button>
        </div>

        {/* 검색 결과 */}
        {showResults && (
          <div className="px-4 pb-4 max-h-96 overflow-y-auto border-t border-gray-200 dark:border-gray-600">
            {searchResults.length > 0 ? (
              <div className="space-y-3 pt-4">
                {searchResults.map((result, index) => (
                  <div 
                    key={index} 
                    className={`p-3 rounded-lg border border-gray-200 dark:border-gray-600 ${
                      searchType === 'city' 
                        ? 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer transition-colors' 
                        : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer transition-colors'
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
                        <div className="font-semibold text-gray-700 dark:text-gray-200">
                          {result.code} - {result.name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {result.flights.length}개 비행
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="font-semibold text-gray-700 dark:text-gray-200">
                          {result.name}({result.empl})
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {result.rank} • {result.flights}개 비행
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
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
