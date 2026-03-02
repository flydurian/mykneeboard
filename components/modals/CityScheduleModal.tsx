import React, { useState, useEffect, useRef } from 'react';
import { Flight } from '../../types';
import { XIcon, InfoIcon, MetarIcon, MemoIcon } from '../icons';
import { networkDetector } from '../../utils/networkDetector';
import { decodeDatis, formatDatisInfo, DatisDecodedInfo } from '../../utils/datisDecoder';
import { decodeTaf, formatTafInfo, TafDecodedInfo } from '../../utils/tafDecoder';
import { getICAO, getCityName, getCurrency, getExchangeRateUrl, getUTCOffset, getCityInfo, getCountry } from '../../utils/cityData';
import { isActualFlight } from '../../utils/helpers';
import { formatInTimeZone } from 'date-fns-tz';
import {
    SunIcon as HeroSunIcon,
    CloudIcon,
    BoltIcon,
    EyeSlashIcon,
    EyeIcon
} from '@heroicons/react/24/outline';
import {
    WiRain,
    WiSnow,
    WiFog,
    WiDaySunny,
    WiNightClear,
    WiCloudy,
    WiCloudyGusts
} from 'react-icons/wi';
import ExchangeChartModal from './ExchangeChartModal';

interface WeatherData {
    main: {
        temp: number;
        feels_like: number;
        temp_min: number;
        temp_max: number;
        humidity: number;
    };
    weather: {
        main: string;
        description: string;
        icon: string;
    }[];
    wind: {
        speed: number;
    };
    sys: {
        sunrise: number;
        sunset: number;
    };
    name: string;
}

interface CityScheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
    city: string | null;
    flights: Flight[];
    onFlightClick: (flight: Flight) => void;
    onMemoClick?: (cityCode: string) => void;
}



// 국기 아이콘을 가져오는 함수
const getCountryFlag = (country: string | null): string => {
    if (!country) return '🏳️';

    const flagMap: { [key: string]: string } = {
        'South Korea': '🇰🇷',
        'United States': '🇺🇸',
        'United Kingdom': '🇬🇧',
        'Netherlands': '🇳🇱',
        'Spain': '🇪🇸',
        'France': '🇫🇷',
        'Italy': '🇮🇹',
        'Germany': '🇩🇪',
        'Czech Republic': '🇨🇿',
        'Switzerland': '🇨🇭',
        'Austria': '🇦🇹',
        'Belgium': '🇧🇪',
        'Denmark': '🇩🇰',
        'Sweden': '🇸🇪',
        'Norway': '🇳🇴',
        'Finland': '🇫🇮',
        'Ireland': '🇮🇪',
        'Portugal': '🇵🇹',
        'Greece': '🇬🇷',
        'Turkey': '🇹🇷',
        'Poland': '🇵🇱',
        'Hungary': '🇭🇺',
        'Bulgaria': '🇧🇬',
        'Romania': '🇷🇴',
        'Croatia': '🇭🇷',
        'Slovenia': '🇸🇮',
        'Russia': '🇷🇺',
        'Japan': '🇯🇵',
        'Hong Kong': '🇭🇰',
        'Thailand': '🇹🇭',
        'China': '🇨🇳',
        'Taiwan': '🇹🇼',
        'Singapore': '🇸🇬',
        'Indonesia': '🇮🇩',
        'Vietnam': '🇻🇳',
        'Australia': '🇦🇺',
        'New Zealand': '🇳🇿',
        'Malaysia': '🇲🇾',
        'Israel': '🇮🇱',
        'Qatar': '🇶🇦',
        'Philippines': '🇵🇭',
        'Macau': '🇲🇴',
        'India': '🇮🇳',
        'Canada': '🇨🇦',
        'Guam': '🇬🇺',
        'United Arab Emirates': '🇦🇪',
        'Cambodia': '🇰🇭',
        'Laos': '🇱🇦',
        'Uzbekistan': '🇺🇿',
        'Kazakhstan': '🇰🇿',
        'Egypt': '🇪🇬'
    };

    return flagMap[country] || '🏳️';
};

const CityScheduleModal: React.FC<CityScheduleModalProps> = ({ isOpen, onClose, city, flights, onFlightClick, onMemoClick }) => {
    // 도시 정보 가져오기
    const cityInfo = city ? getCityInfo(city) : null;

    // 캐시 관련 유틸리티 함수들
    const getCachedData = (key: string, maxAge: number = 30 * 60 * 1000) => {
        try {
            const cached = localStorage.getItem(key);
            if (cached) {
                const { data, timestamp } = JSON.parse(cached);
                if (Date.now() - timestamp < maxAge) {
                    return data;
                }
            }
        } catch (error) {
            console.warn(`캐시 데이터 읽기 실패: ${key}`, error);
        }
        return null;
    };

    const setCachedData = (key: string, data: any) => {
        try {
            localStorage.setItem(key, JSON.stringify({
                data,
                timestamp: Date.now()
            }));
        } catch (error) {
            console.warn(`캐시 데이터 저장 실패: ${key}`, error);
        }
    };

    const [showWeather, setShowWeather] = useState(false);
    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [loadingWeather, setLoadingWeather] = useState(false);
    const [weatherError, setWeatherError] = useState<string | null>(null);
    const [exchangeRate, setExchangeRate] = useState<string | null>(null);
    const [usdExchangeRate, setUsdExchangeRate] = useState<string | null>(null);
    const [loadingExchangeRate, setLoadingExchangeRate] = useState(false);
    const [exchangeRateError, setExchangeRateError] = useState<string | null>(null);
    const [showChartModal, setShowChartModal] = useState(false);
    const [chartData, setChartData] = useState<any[]>([]);
    const [loadingChart, setLoadingChart] = useState(false);
    const [chartError, setChartError] = useState<string | null>(null);
    const [forecast, setForecast] = useState<any[] | null>(null);
    const [threeHourForecast, setThreeHourForecast] = useState<any[] | null>(null);
    const [loadingForecast, setLoadingForecast] = useState(false);
    const [forecastError, setForecastError] = useState<string | null>(null);
    const [showMetar, setShowMetar] = useState(false);
    const [metar, setMetar] = useState<string | null>(null);
    const [taf, setTaf] = useState<string | null>(null);
    const [loadingMetarTaf, setLoadingMetarTaf] = useState(false);
    const [metarTafError, setMetarTafError] = useState<string | null>(null);
    const [showDecoded, setShowDecoded] = useState(false); // 기본적으로 RAW 정보 표시
    const [showDatis, setShowDatis] = useState(false);
    const [datisInfo, setDatisInfo] = useState<string | null>(null);
    const [loadingDatis, setLoadingDatis] = useState(false);
    const [datisError, setDatisError] = useState<string | null>(null);
    const [zuluTime, setZuluTime] = useState('');
    const [showScrollbar, setShowScrollbar] = useState(false);
    const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [airPollution, setAirPollution] = useState<any | null>(null);
    const [loadingAirPollution, setLoadingAirPollution] = useState(false);
    const [airPollutionError, setAirPollutionError] = useState<string | null>(null);

    // AQI 데이터 가져오기 함수
    const fetchAQIData = async (city: string, cityInfo: any) => {
        if (cityInfo?.lat && cityInfo?.lon) {
            try {
                // 캐시된 데이터 확인
                const cachedData = getCachedData(`air_pollution_${city}`);
                if (cachedData) {
                    setAirPollution(cachedData);
                    return;
                }

                const aqiResponse = await fetch(`/api/air-pollution?lat=${cityInfo.lat}&lon=${cityInfo.lon}`);

                if (aqiResponse.ok) {
                    const aqiData = await aqiResponse.json();
                    setAirPollution(aqiData);

                    setCachedData(`air_pollution_${city}`, aqiData);
                } else {
                    const errorText = await aqiResponse.text();
                    console.error('🔍 AQI API 오류:', {
                        city,
                        status: aqiResponse.status,
                        statusText: aqiResponse.statusText,
                        error: errorText,
                        lat: cityInfo.lat,
                        lon: cityInfo.lon
                    });
                }
            } catch (error) {
                console.error('🔍 AQI 데이터를 가져올 수 없습니다:', {
                    city,
                    error: error instanceof Error ? error.message : error,
                    lat: cityInfo?.lat,
                    lon: cityInfo?.lon
                });
            }
        } else {
            console.warn('도시 정보에 위도/경도가 없습니다:', { city, cityInfo });
        }
    };

    // RMK 섹션 디코딩 함수
    const decodeRemarks = (rmkParts: string[]) => {
        let decodedRemarks: string[] = [];

        rmkParts.forEach(part => {
            // AO1, AO2 - 자동 관측 장비
            if (/^AO[12]$/.test(part)) {
                decodedRemarks.push(`${part}: Automatic observation ${part === 'AO1' ? 'without precipitation sensor' : 'with precipitation sensor'}`);
            }
            // SLP - 해면기압
            else if (/^SLP\d{3}$/.test(part)) {
                const pressure = part.substring(3);
                // SLP236 -> 1023.6 hPa (앞자리 10, 뒤 2자리.마지막자리)
                const hPa = `10${pressure.substring(0, 2)}.${pressure.substring(2)}`;
                decodedRemarks.push(`SLP: Sea level pressure ${hPa} hPa`);
            }
            // T - 상세 기온/이슬점
            else if (/^T\d{4}\d{4}$/.test(part)) {
                const temp = part.substring(1, 5);
                const dew = part.substring(5, 9);
                // T01780156 -> 17.8°C, 15.6°C (첫 자리가 0이면 양수, 1이면 음수)
                const tempC = temp.startsWith('0') ? `${temp.substring(1, 3)}.${temp.substring(3)}` : `-${temp.substring(1, 3)}.${temp.substring(3)}`;
                const dewC = dew.startsWith('0') ? `${dew.substring(1, 3)}.${dew.substring(3)}` : `-${dew.substring(1, 3)}.${dew.substring(3)}`;
                decodedRemarks.push(`T: Temperature ${tempC}°C, Dew point ${dewC}°C`);
            }
            // 5 - 기압 변화
            else if (/^5\d{4}$/.test(part)) {
                const change = part.substring(1);
                const direction = change.startsWith('0') ? 'rising' : 'falling';
                const amount = change.substring(1);
                decodedRemarks.push(`5: Pressure ${direction} ${amount} hPa in last 3 hours`);
            }
            // 6 - 강수량
            else if (/^6\d{4}$/.test(part)) {
                const amount = part.substring(1);
                decodedRemarks.push(`6: Precipitation ${amount} mm in last 3 hours`);
            }
            // 7 - 강수량 (24시간)
            else if (/^7\d{4}$/.test(part)) {
                const amount = part.substring(1);
                decodedRemarks.push(`7: Precipitation ${amount} mm in last 24 hours`);
            }
            // 8 - 구름 형태
            else if (/^8\d{3}$/.test(part)) {
                const cloudType = part.substring(1);
                const cloudTypes: { [key: string]: string } = {
                    '000': 'No clouds',
                    '001': 'Cumulonimbus',
                    '002': 'Cumulonimbus with anvil',
                    '003': 'Cumulonimbus mammatus',
                    '004': 'Cumulonimbus with funnel cloud',
                    '005': 'Cumulonimbus with tornado',
                    '010': 'Cumulus',
                    '011': 'Cumulus congestus',
                    '012': 'Cumulus with tower',
                    '020': 'Stratocumulus',
                    '021': 'Stratocumulus cumulogenitus',
                    '022': 'Stratocumulus stratiformis',
                    '030': 'Stratus',
                    '031': 'Stratus fractus',
                    '032': 'Stratus nebulosus',
                    '040': 'Altocumulus',
                    '041': 'Altocumulus castellanus',
                    '042': 'Altocumulus floccus',
                    '043': 'Altocumulus stratiformis',
                    '050': 'Altostratus',
                    '051': 'Altostratus translucidus',
                    '052': 'Altostratus opacus',
                    '060': 'Nimbostratus',
                    '070': 'Cirrus',
                    '071': 'Cirrus fibratus',
                    '072': 'Cirrus uncinus',
                    '073': 'Cirrus spissatus',
                    '080': 'Cirrostratus',
                    '090': 'Cirrocumulus'
                };
                decodedRemarks.push(`8: Cloud type ${cloudTypes[cloudType] || cloudType}`);
            }
            // 9 - 구름 높이
            else if (/^9\d{3}$/.test(part)) {
                const height = part.substring(1);
                const heightFt = parseInt(height) * 100;
                decodedRemarks.push(`9: Cloud base ${heightFt} ft`);
            }
            // PWINO - 강수량 센서 고장
            else if (part === 'PWINO') {
                decodedRemarks.push('PWINO: Precipitation sensor inoperative');
            }
            // PNO - 강수량 센서 없음
            else if (part === 'PNO') {
                decodedRemarks.push('PNO: No precipitation sensor');
            }
            // FZRANO - 동결비 센서 고장
            else if (part === 'FZRANO') {
                decodedRemarks.push('FZRANO: Freezing rain sensor inoperative');
            }
            // TSNO - 천둥 센서 없음
            else if (part === 'TSNO') {
                decodedRemarks.push('TSNO: No thunderstorm sensor');
            }
            // VISNO - 시정 센서 고장
            else if (part === 'VISNO') {
                decodedRemarks.push('VISNO: Visibility sensor inoperative');
            }
            // CHINO - 구름 높이 센서 고장
            else if (part === 'CHINO') {
                decodedRemarks.push('CHINO: Cloud height sensor inoperative');
            }
            // $ - 정비 필요
            else if (part === '$') {
                decodedRemarks.push('$: Maintenance needed');
            }
            // 1 - 기압 변화 (1시간)
            else if (/^1\d{4}$/.test(part)) {
                const change = part.substring(1);
                const direction = change.startsWith('0') ? 'rising' : 'falling';
                const amount = change.substring(1);
                decodedRemarks.push(`1: Pressure ${direction} ${amount} hPa in last 1 hour`);
            }
            // 2 - 기압 변화 (3시간)
            else if (/^2\d{4}$/.test(part)) {
                const change = part.substring(1);
                const direction = change.startsWith('0') ? 'rising' : 'falling';
                const amount = change.substring(1);
                decodedRemarks.push(`2: Pressure ${direction} ${amount} hPa in last 3 hours`);
            }
            // 3 - 기압 변화 (24시간)
            else if (/^3\d{4}$/.test(part)) {
                const change = part.substring(1);
                const direction = change.startsWith('0') ? 'rising' : 'falling';
                const amount = change.substring(1);
                decodedRemarks.push(`3: Pressure ${direction} ${amount} hPa in last 24 hours`);
            }
            // 4 - 기압 변화 (기타)
            else if (/^4\d{4}$/.test(part)) {
                const change = part.substring(1);
                const direction = change.startsWith('0') ? 'rising' : 'falling';
                const amount = change.substring(1);
                decodedRemarks.push(`4: Pressure ${direction} ${amount} hPa`);
            }
            // 4 - 온도 정보 (최고/최저 기온) - 북미 표준화된 규칙
            else if (/^4\d{8}$/.test(part)) {
                const tempData = part.substring(1);
                // 402610183 -> 02610183
                // 4 / 0 261 / 0 183
                // ① 4: 그룹 식별자 (지난 6시간 동안의 최고/최저 기온)
                // ② 0: 최고 기온의 부호 (0=영상, 1=영하)
                // ③ 261: 최고 기온 값 (26.1℃)
                // ④ 0: 최저 기온의 부호 (0=영상, 1=영하)
                // ⑤ 183: 최저 기온 값 (18.3℃)

                const maxTempSign = tempData.substring(0, 1); // 0
                const maxTempValue = tempData.substring(1, 4); // 261
                const minTempSign = tempData.substring(4, 5); // 0
                const minTempValue = tempData.substring(5, 8); // 183

                // 최고 기온: 부호 + 값
                const maxTempC = maxTempSign === '0'
                    ? `${(parseInt(maxTempValue) / 10).toFixed(1)}`
                    : `-${(parseInt(maxTempValue) / 10).toFixed(1)}`;

                // 최저 기온: 부호 + 값
                const minTempC = minTempSign === '0'
                    ? `${(parseInt(minTempValue) / 10).toFixed(1)}`
                    : `-${(parseInt(minTempValue) / 10).toFixed(1)}`;

                decodedRemarks.push(`4: 지난 6시간 동안의 최고 기온은 ${maxTempC}℃, 최저 기온은 ${minTempC}℃였음`);
            }
            // R - 활주로 시정
            else if (/^R\d{2}\/\d{4}$/.test(part)) {
                const runway = part.substring(1, 3);
                const visibility = part.substring(4);
                decodedRemarks.push(`R: Runway ${runway} visibility ${visibility}m`);
            }
            // P - 활주로 시정 (분수형)
            else if (/^R\d{2}\/\d+\/\d+$/.test(part)) {
                const runway = part.substring(1, 3);
                const visibility = part.substring(4);
                decodedRemarks.push(`R: Runway ${runway} visibility ${visibility}`);
            }
            // W - 활주로 상태
            else if (/^W\d{2}\/\d+$/.test(part)) {
                const runway = part.substring(1, 3);
                const condition = part.substring(4);
                const conditions: { [key: string]: string } = {
                    '0': 'Clear and dry',
                    '1': 'Damp',
                    '2': 'Wet',
                    '3': 'Rime or frost covered',
                    '4': 'Dry snow',
                    '5': 'Wet snow',
                    '6': 'Slush',
                    '7': 'Ice',
                    '8': 'Compacted or rolled snow',
                    '9': 'Frozen ruts or ridges'
                };
                decodedRemarks.push(`W: Runway ${runway} condition ${conditions[condition] || condition}`);
            }
            // 기타 알려진 코드들
            else if (part === 'NOSIG') {
                decodedRemarks.push('NOSIG: No significant change expected');
            }
            else if (part === 'CAVOK') {
                decodedRemarks.push('CAVOK: Ceiling and visibility OK');
            }
            else if (part === 'NSW') {
                decodedRemarks.push('NSW: No significant weather');
            }
            else if (part === 'AUTO') {
                decodedRemarks.push('AUTO: Automatic observation');
            }
            else if (part === 'COR') {
                decodedRemarks.push('COR: Corrected observation');
            }
            else if (part === 'AMD') {
                decodedRemarks.push('AMD: Amended observation');
            }
            else if (part === 'NIL') {
                decodedRemarks.push('NIL: No significant weather');
            }
            // 알 수 없는 코드는 그대로 표시
            else {
                decodedRemarks.push(part);
            }
        });

        return decodedRemarks.join('; ');
    };

    // METAR 완전 해석 함수
    const decodeMetar = (metarText: string) => {
        const parts = metarText.split(' ');
        let airport = '';
        let time = '';
        let wind = '';
        let visibility = '';
        let weather = '';
        let clouds = '';
        let temp = '';
        let pressure = '';
        let remarks = '';
        let auto = false;
        let corrected = false;

        parts.forEach((part, index) => {
            // 공항 코드 (METAR 다음 부분)
            if (index === 1 && /^[A-Z]{4}$/.test(part)) {
                airport = part;
            }
            // 시간 (Z로 끝나는 6자리 숫자)
            else if (/^\d{6}Z$/.test(part)) {
                const day = part.substring(0, 2);
                const hour = part.substring(2, 4);
                const minute = part.substring(4, 6);
                time = `${day}일 ${hour}:${minute} UTC`;
            }
            // AUTO 표시
            else if (part === 'AUTO') {
                auto = true;
            }
            // COR 표시 (수정된 관측)
            else if (part === 'COR') {
                corrected = true;
            }
            // 바람 (3자리 방향 + 2-3자리 속도 + KT)
            else if (/^\d{3}\d{2,3}KT$/.test(part)) {
                const direction = part.substring(0, 3);
                const speed = part.substring(3, part.length - 2);
                wind = `${direction}° ${speed}kt`;
            }
            // 바람 (G 포함 - 돌풍)
            else if (/^\d{3}\d{2,3}G\d{2,3}KT$/.test(part)) {
                const direction = part.substring(0, 3);
                const speed = part.substring(3, part.indexOf('G'));
                const gust = part.substring(part.indexOf('G') + 1, part.length - 2);
                wind = `${direction}° ${speed}G${gust}kt`;
            }
            // 바람 (VRB - 가변)
            else if (/^VRB\d{2,3}KT$/.test(part)) {
                const speed = part.substring(3, part.length - 2);
                wind = `Variable ${speed}kt`;
            }
            // 시정 (4자리 숫자)
            else if (/^\d{4}$/.test(part)) {
                if (part === '9999') {
                    visibility = '10km+';
                } else {
                    visibility = `${part}m`;
                }
            }
            // 시정 (SM 단위)
            else if (/^\d+SM$/.test(part)) {
                const value = part.substring(0, part.length - 2);
                visibility = `${value}SM`;
            }
            // 시정 (분수형)
            else if (/^\d+\/\d+SM$/.test(part)) {
                visibility = `${part}`;
            }
            // 시정 (M으로 시작 - 1000m 미만)
            else if (/^M\d{4}$/.test(part)) {
                const value = part.substring(1);
                visibility = `<${value}m`;
            }
            // WS - 윈드시어 (돌풍) 경보
            else if (part === 'WS') {
                // 다음 부분이 활주로 정보인지 확인
                if (index + 1 < parts.length && /^R\d{2}[LCR]?$/.test(parts[index + 1])) {
                    const runway = parts[index + 1];
                    weather += `WS ${runway}: ${runway}번 활주로 부근에 윈드시어(Wind Shear, 돌풍) 경보가 있습니다. `;
                } else {
                    weather += 'WS: Wind Shear warning ';
                }
            }
            // NOSIG - 특별한 기상 변화 없음
            else if (part === 'NOSIG') {
                weather += 'NOSIG ';
            }
            // RMK는 날씨 현상이 아니므로 건너뛰기
            else if (part === 'RMK') {
                const rmkParts = parts.slice(index + 1);
                remarks = decodeRemarks(rmkParts);
            }
            // 날씨 현상 (강도 + 현상)
            else if (/^[+-]?[A-Z]{2,3}$/.test(part)) {
                const weatherMap: { [key: string]: string } = {
                    // 강수
                    'RA': 'Rain', 'SN': 'Snow', 'DZ': 'Drizzle', 'SG': 'Snow Grains',
                    'IC': 'Ice Crystals', 'PL': 'Ice Pellets', 'GR': 'Hail', 'GS': 'Small Hail',
                    'UP': 'Unknown Precipitation', 'PE': 'Ice Pellets',
                    // 안개/시정
                    'BR': 'Mist', 'FG': 'Fog', 'FU': 'Smoke', 'VA': 'Volcanic Ash',
                    'DU': 'Dust', 'SA': 'Sand', 'HZ': 'Haze', 'PY': 'Spray',
                    // 폭풍/바람
                    'PO': 'Dust/Sand Whirls', 'SQ': 'Squalls', 'FC': 'Funnel Cloud',
                    'SS': 'Sandstorm', 'DS': 'Duststorm', 'SH': 'Shower', 'TS': 'Thunderstorm',
                    // 수식어
                    'FZ': 'Freezing', 'MI': 'Shallow', 'PR': 'Partial', 'BC': 'Patches',
                    'DR': 'Low Drifting', 'BL': 'Blowing', 'VC': 'In Vicinity',
                    'RE': 'Recent', 'NSW': 'No Significant Weather'
                };
                const intensity = part.startsWith('+') ? 'Heavy ' : part.startsWith('-') ? 'Light ' : '';
                const code = part.replace(/^[+-]/, '');
                weather += intensity + (weatherMap[code] || code) + ' ';
            }
            // 복합 날씨 현상 (예: -TSRA, +SHSN 등)
            else if (/^[+-]?[A-Z]{2,3}[A-Z]{2,3}$/.test(part)) {
                const intensity = part.startsWith('+') ? 'Heavy ' : part.startsWith('-') ? 'Light ' : '';
                const code = part.replace(/^[+-]/, '');
                const weatherMap: { [key: string]: string } = {
                    'TSRA': 'Thunderstorm with Rain', 'TSSN': 'Thunderstorm with Snow',
                    'SHRA': 'Shower Rain', 'SHSN': 'Shower Snow', 'SHDZ': 'Shower Drizzle',
                    'FZRA': 'Freezing Rain', 'FZDZ': 'Freezing Drizzle', 'FZFG': 'Freezing Fog',
                    'BLSN': 'Blowing Snow', 'BLSA': 'Blowing Sand', 'BLDU': 'Blowing Dust'
                };
                weather += intensity + (weatherMap[code] || code) + ' ';
            }
            // 구름 (FEW, SCT, BKN, OVC + 높이 + CB/TCU)
            else if (/^(FEW|SCT|BKN|OVC)\d{3}(CB|TCU)?$/.test(part)) {
                const type = part.substring(0, 3);
                const height = parseInt(part.substring(3, 6)) * 100;
                const cloudType = part.substring(6);
                const typeMap: { [key: string]: string } = {
                    'FEW': 'Few',
                    'SCT': 'Scattered',
                    'BKN': 'Broken',
                    'OVC': 'Overcast'
                };
                const cloudTypeMap: { [key: string]: string } = {
                    'CB': ' Cumulonimbus', 'TCU': ' Towering Cumulus'
                };
                clouds += `${typeMap[type]} ${height}ft${cloudTypeMap[cloudType] || ''} `;
            }
            // 구름 (CAVOK)
            else if (part === 'CAVOK') {
                clouds = 'CAVOK (Ceiling and Visibility OK)';
            }
            // 구름 (NSC - No Significant Clouds)
            else if (part === 'NSC') {
                clouds = 'NSC (No Significant Clouds)';
            }
            // 구름 (NCD - No Cloud Detected)
            else if (part === 'NCD') {
                clouds = 'NCD (No Cloud Detected)';
            }
            // 기온/이슬점
            else if (/^M?\d{2}\/M?\d{2}$/.test(part)) {
                const [tempVal, dewVal] = part.split('/');
                const tempC = tempVal.startsWith('M') ? `-${tempVal.substring(1)}` : tempVal;
                const dewC = dewVal.startsWith('M') ? `-${dewVal.substring(1)}` : dewVal;
                temp = `${tempC}°C / ${dewC}°C`;
            }
            // 기압 (QNH - hPa)
            else if (/^Q\d{4}$/.test(part)) {
                pressure = `QNH ${part.substring(1)} hPa`;
            }
            // 기압 (A - inHg)
            else if (/^A\d{4}$/.test(part)) {
                const value = part.substring(1);
                const inHg = `${value.substring(0, 2)}.${value.substring(2)}`;
                pressure = `Altimeter ${inHg} inHg`;
            }
        });

        return {
            airport,
            time,
            wind: wind || '',
            visibility: visibility || '',
            weather: weather.trim() || 'No significant weather',
            clouds: clouds.trim() || '',
            temp: temp || '',
            pressure: pressure || '',
            remarks: remarks || '',
            auto,
            corrected
        };
    };

    // TAF 디코딩은 이제 별도 모듈에서 처리
    /*
    const decodeTaf = (tafText: string) => {
        const parts = tafText.split(' ');
        let airport = '';
        let issueTime = '';
        let validPeriod = '';
        let forecasts: any[] = [];
        
        // TAF를 구간별로 분리 - 더 정확한 파싱
        let sections: string[] = [];
        let currentSection = '';
        let i = 0;
        
        while (i < parts.length) {
            const part = parts[i];
            
            if (/^[A-Z]{4}$/.test(part) && !['TAF', 'AMD', 'COR', 'AUTO'].includes(part)) {
                airport = part;
                i++;
            } else if (/^\d{6}Z$/.test(part)) {
                const day = part.substring(0, 2);
                const hour = part.substring(2, 4);
                const minute = part.substring(4, 6);
                issueTime = `${day}일 ${hour}:${minute} UTC`;
                i++;
            } else if (/^\d{4}\/\d{4}$/.test(part)) {
                const startDay = part.substring(0, 2);
                const startHour = part.substring(2, 4);
                const endDay = part.substring(5, 7);
                const endHour = part.substring(7, 9);
                validPeriod = `${startDay}일 ${startHour}00 - ${endDay}일 ${endHour}00 UTC`;
                
                // 메인 구간 시작 (유효 기간 + 메인 예보 데이터)
                if (currentSection) {
                    sections.push(currentSection.trim());
                }
                currentSection = part;
                i++;
                
                // 유효 기간 다음에 오는 메인 예보 데이터를 같은 구간에 포함
                while (i < parts.length && !/^(FM|TEMPO|BECMG|PROB)/.test(parts[i])) {
                    currentSection += ' ' + parts[i];
                    i++;
                }
                
            } else if (/^(FM|TEMPO|BECMG|PROB)/.test(part)) {
                // 새로운 구간 시작
                if (currentSection) {
                    sections.push(currentSection.trim());
                }
                
                // FM, TEMPO, BECMG, PROB 다음에 시간 정보가 올 수 있음
                let sectionStart = part;
                i++;
                
                // 다음 토큰이 시간 형식인지 확인
                if (i < parts.length && /^\d{4}\/\d{4}$/.test(parts[i])) {
                    sectionStart += ' ' + parts[i];
                    i++;
                } else if (i < parts.length && /^\d{4}$/.test(parts[i])) {
                    sectionStart += ' ' + parts[i];
                    i++;
                }
                
                currentSection = sectionStart;
                    } else {
                // 현재 구간에 추가
                currentSection += ' ' + part;
                i++;
            }
        }
        
        // 마지막 구간 추가
        if (currentSection) {
            sections.push(currentSection.trim());
        }
        
        // 각 구간 파싱
        let mainForecast: any = null;
        
        sections.forEach((section, index) => {
            const sectionParts = section.split(' ');
            let forecast: any = {
                wind: '',
                visibility: '',
                weather: '',
                clouds: '',
                probability: '',
                type: 'Main'
            };
            
            // 구간 타입 결정
            if (index === 0) {
                // 첫 번째 구간은 메인 예보 (유효 기간 + 메인 예보 데이터)
                forecast.time = validPeriod;
                forecast.type = 'Main';
                mainForecast = forecast;
                
                // 메인 예보 데이터 파싱 - 유효 기간 다음의 메인 예보 부분만 파싱
                // TAF KJFK 190527Z 1906/2012 26006KT P6SM SKC 에서 메인 예보는 26006KT P6SM SKC
                const validPeriodIndex = sectionParts.findIndex(part => /^\d{4}\/\d{4}$/.test(part));
                const mainForecastParts = validPeriodIndex >= 0 
                    ? sectionParts.slice(validPeriodIndex + 1)
                    : sectionParts.slice(1); // 유효 기간이 없으면 첫 번째 이후부터
                
                // BECMG, TEMPO, FM, PROB로 시작하는 부분은 제외
                const filteredParts = mainForecastParts.filter(part => 
                    !part.startsWith('BECMG') && 
                    !part.startsWith('TEMPO') && 
                    !part.startsWith('FM') && 
                    !part.startsWith('PROB')
                );
                
                filteredParts.forEach(part => {
                    // 공항 코드, TAF 키워드, AMD, 유효 기간, 발표 시간은 건너뛰기
                    if (/^[A-Z]{4}$/.test(part) || part === 'TAF' || part === 'AMD' || /^\d{4}\/\d{4}$/.test(part) || /^\d{6}Z$/.test(part)) {
                        return;
                    }
                        
                    // 바람
                    if (/^\d{3}\d{2,3}KT$/.test(part)) {
                        const direction = part.substring(0, 3);
                        const speed = part.substring(3, part.length - 2);
                        mainForecast.wind = `${direction}° ${speed}kt`;
                    } else if (/^\d{3}\d{2,3}G\d{2,3}KT$/.test(part)) {
                        const direction = part.substring(0, 3);
                        const speed = part.substring(3, part.indexOf('G'));
                        const gust = part.substring(part.indexOf('G') + 1, part.length - 2);
                        mainForecast.wind = `${direction}° ${speed}G${gust}kt`;
                    } else if (/^VRB\d{2,3}KT$/.test(part)) {
                        const speed = part.substring(3, part.length - 2);
                        mainForecast.wind = `Variable ${speed}kt`;
                    }
                    // 시정
                    else if (/^\d{4}$/.test(part)) {
                        if (part === '9999') {
                            mainForecast.visibility = '10km+';
                    } else {
                            mainForecast.visibility = `${part}m`;
                        }
                    } else if (/^\d+SM$/.test(part)) {
                        const value = part.substring(0, part.length - 2);
                        mainForecast.visibility = `${value}SM`;
                    } else if (/^\d+\/\d+SM$/.test(part)) {
                        mainForecast.visibility = `${part}`;
                    } else if (/^P\d+SM$/.test(part)) {
                        const value = part.substring(1, part.length - 2);
                        mainForecast.visibility = `>${value}SM`;
                    }
                    // 날씨 현상 (AMD, COR 등은 제외)
                    else if (/^[+-]?[A-Z]{2,3}$/.test(part) && !['AMD', 'COR', 'AUTO'].includes(part)) {
                    const weatherMap: { [key: string]: string } = {
                            'RA': 'Rain', 'SN': 'Snow', 'DZ': 'Drizzle', 'SG': 'Snow Grains',
                            'IC': 'Ice Crystals', 'PL': 'Ice Pellets', 'GR': 'Hail', 'GS': 'Small Hail',
                            'UP': 'Unknown Precipitation', 'BR': 'Mist', 'FG': 'Fog', 'FU': 'Smoke',
                        'VA': 'Volcanic Ash', 'DU': 'Dust', 'SA': 'Sand', 'HZ': 'Haze',
                            'PY': 'Spray', 'PO': 'Dust/Sand Whirls', 'SQ': 'Squalls', 'FC': 'Funnel Cloud',
                            'SS': 'Sandstorm', 'DS': 'Duststorm', 'SH': 'Shower', 'TS': 'Thunderstorm',
                            'FZ': 'Freezing', 'MI': 'Shallow', 'PR': 'Partial', 'BC': 'Patches',
                            'DR': 'Low Drifting', 'BL': 'Blowing', 'VC': 'In Vicinity', 'NSW': 'No Significant Weather'
                        };
                        const intensity = part.startsWith('+') ? 'Heavy ' : part.startsWith('-') ? 'Light ' : '';
                        const code = part.replace(/^[+-]/, '');
                        mainForecast.weather += intensity + (weatherMap[code] || code) + ' ';
                    } else if (/^[+-]?[A-Z]{2,3}[A-Z]{2,3}$/.test(part)) {
                        const intensity = part.startsWith('+') ? 'Heavy ' : part.startsWith('-') ? 'Light ' : '';
                        const code = part.replace(/^[+-]/, '');
                        const weatherMap: { [key: string]: string } = {
                            'TSRA': 'Thunderstorm with Rain', 'TSSN': 'Thunderstorm with Snow',
                            'SHRA': 'Shower Rain', 'SHSN': 'Shower Snow', 'SHDZ': 'Shower Drizzle',
                            'FZRA': 'Freezing Rain', 'FZDZ': 'Freezing Drizzle', 'FZFG': 'Freezing Fog',
                            'BLSN': 'Blowing Snow', 'BLSA': 'Blowing Sand', 'BLDU': 'Blowing Dust'
                        };
                        mainForecast.weather += intensity + (weatherMap[code] || code) + ' ';
                    }
                    // 구름
                    else if (/^(FEW|SCT|BKN|OVC)\d{3}(CB|TCU)?$/.test(part)) {
                        const type = part.substring(0, 3);
                        const height = parseInt(part.substring(3, 6)) * 100;
                        const cloudType = part.substring(6);
                    const typeMap: { [key: string]: string } = {
                            'FEW': 'Few', 'SCT': 'Scattered', 'BKN': 'Broken', 'OVC': 'Overcast'
                        };
                        const cloudTypeMap: { [key: string]: string } = {
                            'CB': ' Cumulonimbus', 'TCU': ' Towering Cumulus'
                        };
                        mainForecast.clouds += `${typeMap[type]} ${height}ft${cloudTypeMap[cloudType] || ''} `;
                    } else if (part === 'CAVOK') {
                        mainForecast.clouds = 'CAVOK';
                    } else if (part === 'NSC') {
                        mainForecast.clouds = 'NSC';
                    } else if (part === 'SKC') {
                        mainForecast.clouds = 'SKC (Sky Clear)';
                    }
                    // 기온
                    else if (/^TX\d{2}\/\d{4}Z$/.test(part)) {
                        const temp = part.substring(2, 4);
                        const day = part.substring(5, 7);
                        const hour = part.substring(7, 9);
                        mainForecast.maxTemp = `Max ${temp}°C (${day}일 ${hour}00 UTC)`;
                    } else if (/^TN\d{2}\/\d{4}Z$/.test(part)) {
                        const temp = part.substring(2, 4);
                        const day = part.substring(5, 7);
                        const hour = part.substring(7, 9);
                        mainForecast.minTemp = `Min ${temp}°C (${day}일 ${hour}00 UTC)`;
                    }
                });
                
                // 메인 예보는 실제 데이터만 표시 (기본값 제거)
                mainForecast.wind = mainForecast.wind || '';
                mainForecast.visibility = mainForecast.visibility || '';
                mainForecast.weather = (mainForecast.weather || '').trim() || '';
                mainForecast.clouds = (mainForecast.clouds || '').trim() || '';
                
            } else if (sectionParts[0].startsWith('FM')) {
                const day = sectionParts[0].substring(2, 4);
                const hour = sectionParts[0].substring(4, 6);
                forecast.time = `From ${day}일 ${hour}00 UTC`;
                forecast.type = 'From';
            } else if (sectionParts[0].startsWith('TEMPO')) {
                // TEMPO 다음에 시간 정보가 있는지 확인
                if (sectionParts.length > 1 && /^\d{4}\/\d{4}$/.test(sectionParts[1])) {
                    const timeRange = sectionParts[1];
                    const startDay = timeRange.substring(0, 2);
                    const startHour = timeRange.substring(2, 4);
                    const endDay = timeRange.substring(5, 7);
                    const endHour = timeRange.substring(7, 9);
                    forecast.time = `Temporary ${startDay}일 ${startHour}00 - ${endDay}일 ${endHour}00 UTC`;
                } else {
                    forecast.time = 'Temporary';
                }
                forecast.type = 'Temporary';
            } else if (sectionParts[0].startsWith('BECMG')) {
                // BECMG 다음에 시간 정보가 있는지 확인
                if (sectionParts.length > 1 && /^\d{4}\/\d{4}$/.test(sectionParts[1])) {
                    // BECMG DDHH/DDHH 형식
                    const timePart = sectionParts[1];
                    const startDay = timePart.substring(0, 2);
                    const startHour = timePart.substring(2, 4);
                    const endDay = timePart.substring(5, 7);
                    const endHour = timePart.substring(7, 9);
                    forecast.time = `Becoming ${startDay}일 ${startHour}00 - ${endDay}일 ${endHour}00 UTC`;
                } else if (sectionParts.length > 1 && /^\d{4}$/.test(sectionParts[1])) {
                    // BECMG DDHH 형식 (시작 시간만)
                    const timePart = sectionParts[1];
                    const startDay = timePart.substring(0, 2);
                    const startHour = timePart.substring(2, 4);
                    forecast.time = `Becoming from ${startDay}일 ${startHour}00 UTC`;
                } else {
                    // BECMG만 있는 경우
                    forecast.time = 'Becoming (gradual change)';
                }
                forecast.type = 'Becoming';
            } else if (sectionParts[0].startsWith('PROB')) {
                // PROB30 1701/1706 형식
                const probValue = sectionParts[0].substring(4, 6);
                if (sectionParts.length > 1 && /^\d{4}\/\d{4}$/.test(sectionParts[1])) {
                    const timePart = sectionParts[1];
                    const startDay = timePart.substring(0, 2);
                    const startHour = timePart.substring(2, 4);
                    const endDay = timePart.substring(5, 7);
                    const endHour = timePart.substring(7, 9);
                    forecast.time = `Probability ${probValue}% ${startDay}일 ${startHour}00 - ${endDay}일 ${endHour}00 UTC`;
                } else {
                    forecast.time = `Probability ${probValue}%`;
                }
                forecast.type = 'Probability';
                forecast.probability = `${probValue}% probability`;
            }
            
            // 기상 요소 파싱을 위한 weatherParts 설정
            let weatherParts = sectionParts.slice(1);
            
            // BECMG, TEMPO, FM, PROB 다음에 시간 정보가 있으면 건너뛰기
            if (sectionParts[0].startsWith('BECMG') || sectionParts[0].startsWith('TEMPO') || sectionParts[0].startsWith('FM') || sectionParts[0].startsWith('PROB')) {
                if (weatherParts.length > 0 && /^\d{4}(\/\d{4})?$/.test(weatherParts[0])) {
                    weatherParts = weatherParts.slice(1);
                }
            }
            
            // 기상 요소 파싱
            weatherParts.forEach(part => {
                // 공항 코드와 TAF 키워드, AMD는 건너뛰기
                if (/^[A-Z]{4}$/.test(part) || part === 'TAF' || part === 'AMD') {
                    return;
                }
                
                // 바람
                if (/^\d{3}\d{2,3}KT$/.test(part)) {
                    const direction = part.substring(0, 3);
                    const speed = part.substring(3, part.length - 2);
                    forecast.wind = `${direction}° ${speed}kt`;
                } else if (/^\d{3}\d{2,3}G\d{2,3}KT$/.test(part)) {
                    const direction = part.substring(0, 3);
                    const speed = part.substring(3, part.indexOf('G'));
                    const gust = part.substring(part.indexOf('G') + 1, part.length - 2);
                    forecast.wind = `${direction}° ${speed}G${gust}kt`;
                } else if (/^VRB\d{2,3}KT$/.test(part)) {
                    const speed = part.substring(3, part.length - 2);
                    forecast.wind = `Variable ${speed}kt`;
                }
                // 시정
                else if (/^\d{4}$/.test(part)) {
                    if (part === '9999') {
                        forecast.visibility = '10km+';
                    } else {
                        forecast.visibility = `${part}m`;
                    }
                } else if (/^\d+SM$/.test(part)) {
                    const value = part.substring(0, part.length - 2);
                    forecast.visibility = `${value}SM`;
                } else if (/^\d+\/\d+SM$/.test(part)) {
                    forecast.visibility = `${part}`;
                } else if (/^P\d+SM$/.test(part)) {
                    const value = part.substring(1, part.length - 2);
                    forecast.visibility = `>${value}SM`;
                }
                // 날씨 현상 (AMD, COR 등은 제외)
                else if (/^[+-]?[A-Z]{2,3}$/.test(part) && !['AMD', 'COR', 'AUTO'].includes(part)) {
                    const weatherMap: { [key: string]: string } = {
                        'RA': 'Rain', 'SN': 'Snow', 'DZ': 'Drizzle', 'SG': 'Snow Grains',
                        'IC': 'Ice Crystals', 'PL': 'Ice Pellets', 'GR': 'Hail', 'GS': 'Small Hail',
                        'UP': 'Unknown Precipitation', 'BR': 'Mist', 'FG': 'Fog', 'FU': 'Smoke',
                        'VA': 'Volcanic Ash', 'DU': 'Dust', 'SA': 'Sand', 'HZ': 'Haze',
                        'PY': 'Spray', 'PO': 'Dust/Sand Whirls', 'SQ': 'Squalls', 'FC': 'Funnel Cloud',
                        'SS': 'Sandstorm', 'DS': 'Duststorm', 'SH': 'Shower', 'TS': 'Thunderstorm',
                        'FZ': 'Freezing', 'MI': 'Shallow', 'PR': 'Partial', 'BC': 'Patches',
                        'DR': 'Low Drifting', 'BL': 'Blowing', 'VC': 'In Vicinity', 'NSW': 'No Significant Weather'
                    };
                    const intensity = part.startsWith('+') ? 'Heavy ' : part.startsWith('-') ? 'Light ' : '';
                    const code = part.replace(/^[+-]/, '');
                    forecast.weather += intensity + (weatherMap[code] || code) + ' ';
                } else if (/^[+-]?[A-Z]{2,3}[A-Z]{2,3}$/.test(part)) {
                    const intensity = part.startsWith('+') ? 'Heavy ' : part.startsWith('-') ? 'Light ' : '';
                    const code = part.replace(/^[+-]/, '');
                    const weatherMap: { [key: string]: string } = {
                        'TSRA': 'Thunderstorm with Rain', 'TSSN': 'Thunderstorm with Snow',
                        'SHRA': 'Shower Rain', 'SHSN': 'Shower Snow', 'SHDZ': 'Shower Drizzle',
                        'FZRA': 'Freezing Rain', 'FZDZ': 'Freezing Drizzle', 'FZFG': 'Freezing Fog',
                        'BLSN': 'Blowing Snow', 'BLSA': 'Blowing Sand', 'BLDU': 'Blowing Dust'
                    };
                    forecast.weather += intensity + (weatherMap[code] || code) + ' ';
                }
                // 구름
                else if (/^(FEW|SCT|BKN|OVC)\d{3}(CB|TCU)?$/.test(part)) {
                    const type = part.substring(0, 3);
                    const height = parseInt(part.substring(3, 6)) * 100;
                    const cloudType = part.substring(6);
                    const typeMap: { [key: string]: string } = {
                        'FEW': 'Few', 'SCT': 'Scattered', 'BKN': 'Broken', 'OVC': 'Overcast'
                    };
                    const cloudTypeMap: { [key: string]: string } = {
                        'CB': ' Cumulonimbus', 'TCU': ' Towering Cumulus'
                    };
                    forecast.clouds += `${typeMap[type]} ${height}ft${cloudTypeMap[cloudType] || ''} `;
                } else if (part === 'CAVOK') {
                    forecast.clouds = 'CAVOK';
                } else if (part === 'NSC') {
                    forecast.clouds = 'NSC';
                }
                // 기온
                else if (/^TX\d{2}\/\d{4}Z$/.test(part)) {
                    const temp = part.substring(2, 4);
                    const day = part.substring(5, 7);
                    const hour = part.substring(7, 9);
                    forecast.maxTemp = `Max ${temp}°C (${day}일 ${hour}00 UTC)`;
                } else if (/^TN\d{2}\/\d{4}Z$/.test(part)) {
                    const temp = part.substring(2, 4);
                    const day = part.substring(5, 7);
                    const hour = part.substring(7, 9);
                    forecast.minTemp = `Min ${temp}°C (${day}일 ${hour}00 UTC)`;
                }
            });
            
            // 메인 예보가 아닌 구간들만 추가
            if (index !== 0 && !(index === 1 && !sectionParts[0].startsWith('FM') && !sectionParts[0].startsWith('TEMPO') && !sectionParts[0].startsWith('BECMG') && !sectionParts[0].startsWith('PROB'))) {
                forecasts.push({
                    ...forecast,
                    wind: forecast.wind || '',
                    visibility: forecast.visibility || '',
                    weather: (forecast.weather || '').trim() || '',
                    clouds: (forecast.clouds || '').trim() || ''
                });
            }
        });
        
        // 메인 예보가 있으면 맨 앞에 추가 (데이터가 없어도 표시)
        if (mainForecast) {
            forecasts.unshift(mainForecast);
            } else {
            // 메인 예보가 없으면 기본 메인 예보 생성
            forecasts.unshift({
                time: validPeriod,
                type: 'Main',
                wind: '',
                visibility: '',
                weather: '',
                clouds: '',
                    probability: ''
            });
        }
        
        return {
            airport,
            issueTime,
            validPeriod,
            forecasts
        };
    };
    */

    // Sub-functions for efficiency and readability
    const parseRmk = (rmkContent: string) => {
        const decoded = [];
        if (rmkContent.includes('AO2')) decoded.push('Automated Weather Station (AO2)');

        const pkWndMatch = rmkContent.match(/PK\s+WND\s+(\d{3})(\d{2})\/(\d{4})/i);
        if (pkWndMatch) decoded.push(`Peak Wind: ${pkWndMatch[1]}° at ${pkWndMatch[2]}kt at ${pkWndMatch[3]}Z`);

        const slpMatch = rmkContent.match(/SLP(\d{3})/i);
        if (slpMatch) {
            const pressure = (parseInt(slpMatch[1], 10) / 10 + (parseInt(slpMatch[1], 10) < 500 ? 1000 : 900)).toFixed(1); // FAA standard for SLP
            decoded.push(`Sea Level Pressure: ${pressure} hPa`);
        }

        // FAA AIM 7-1-9 기준: T 코드는 온도/이슬점을 나타냄 (T02110178 = 온도 2.1°C, 이슬점 1.8°C)
        const tMatch = rmkContent.match(/T(\d{4})(\d{4})/i);
        if (tMatch) {
            const temp = parseInt(tMatch[1], 10) / 10;
            const dew = parseInt(tMatch[2], 10) / 10;
            decoded.push(`Temperature: ${temp.toFixed(1)}°C, Dew Point: ${dew.toFixed(1)}°C`);
        }

        // Pressure Tendency (5xxxx) per FAA AIM
        const pressureMatch = rmkContent.match(/5(\d)(\d{3})/);
        if (pressureMatch) {
            const tendencyCode = pressureMatch[1];
            const change = (parseInt(pressureMatch[2], 10) / 10).toFixed(1);
            const tendencies = ['Increasing then decreasing', 'Increasing then steady', 'Increasing', 'Decreasing or steady then increasing', 'Steady', 'Decreasing then increasing', 'Decreasing then steady', 'Decreasing', 'Steady or increasing then decreasing', 'Unsteady'];
            decoded.push(`Pressure Tendency: ${tendencies[parseInt(tendencyCode)] || 'Unknown'}, Change: ${change} hPa`);
        }

        return [...new Set(decoded)]; // Deduplicate
    };

    const parseApproach = (text: string) => {
        // FAA AIM 7-1-9 기준: ATIS Approach 정보 디코딩
        const approachPatterns = [
            // 복합 패턴 (활주로 번호 포함)
            { type: 'INST APCHS AND RNAV RNP APCHS', pattern: /INST\s+APCHS?\s+AND\s+RNAV\s+RNP\s+APCHS?\s+R(?:WY?|Y)\s+([0-9]{2}[LRC]?\s+(?:AND|and)\s+[0-9]{2}[LRC]?)/gi },
            { type: 'RNAV RNP APCHS', pattern: /RNAV\s+RNP\s+APCHS?\s+R(?:WY?|Y)\s+([0-9]{2}[LRC]?\s+(?:AND|and)\s+[0-9]{2}[LRC]?)/gi },

            // 개별 ILS 패턴
            { type: 'ILS', pattern: /ILS\s+R(?:WY?|Y)\s+([0-9]{2}[LRC]?)/gi },

            // Visual Approach 패턴
            { type: 'VISUAL APCH', pattern: /VISUAL\s+APCH\s+R(?:WY?|Y)\s+([0-9]{2}[LRC]?)/gi },

            // 일반적인 패턴 (활주로 번호 없음)
            { type: 'OR VCTR FOR VISUAL APCH', pattern: /OR\s+VCTR\s+FOR\s+VISUAL\s+APCH\s+WILL\s+BE\s+PROVIDED/gi },
            { type: 'SIMUL VISUAL APCHS TO ALL RWYS', pattern: /SIMUL\s+VISUAL\s+APCHS?\s+TO\s+ALL\s+RWYS\s+ARE\s+IN\s+PROG/gi }
        ];

        const approaches: string[] = [];
        approachPatterns.forEach(({ type, pattern }) => {
            const matches = [...text.matchAll(pattern)];
            matches.forEach(match => {
                if (match[1]) {
                    // 활주로 번호가 있는 경우
                    const runways = match[1].replace(/\s+AND\s+/gi, ' and ').trim();
                    approaches.push(`${type} RWY ${runways}`);
                } else {
                    // 활주로 번호가 없는 경우
                    approaches.push(type);
                }
            });
        });

        return [...new Set(approaches)]; // Deduplicate
    };

    const parseDeparture = (text: string) => {
        // FAA AIM 7-1-9 기준: ATIS Departure 정보 디코딩
        const matches = [...text.matchAll(/SIMUL\s+INSTR\s+DEPARTURES\s+IN\s+PROG\s+RWYS\s+([^\.]+)/gi)];
        return matches.map(m => m[1].replace(/\s+AND\s+/gi, ' and ').trim());
    };

    const parseNotams = (text: string, matchedTexts: Set<string>) => {
        // FAA AIM 7-1-9 기준: NOTAM 정보 디코딩
        const notamContent: string[] = [];

        // TWY CLSD BTN 패턴 (FAA AIM 표준) - 더 정확한 패턴
        const twyClsdBtwnMatches = [...text.matchAll(/\bTWY\s+([A-Z0-9]+)\s+(?:CLSD|CLOSED)\s+(?:BTN|BETWEEN)\s+([^\.]+?)(?=\s*,\s*|\.|$)/gi)];
        twyClsdBtwnMatches.forEach(match => {
            const fullMatch = match[0];
            if (!matchedTexts.has(fullMatch)) {
                matchedTexts.add(fullMatch);
                let cleanedText = match[2].replace(/\s+/g, ' ').replace(/,\s*/g, ' ').replace(/\bAND\b/g, 'and').trim();
                notamContent.push(`TWY ${match[1]} Closed Between ${cleanedText}`);
            }
        });

        // PAPI OTS (FAA AIM 표준)
        const papiOtsMatches = [...text.matchAll(/\bPAPI\s+OTS\s+([0-9]{2}[LRC]?)/gi)];
        papiOtsMatches.forEach(match => {
            const fullMatch = match[0];
            if (!matchedTexts.has(fullMatch)) {
                matchedTexts.add(fullMatch);
                notamContent.push(`PAPI OTS on RWY ${match[1]}`);
            }
        });

        // VOR OTS (FAA AIM 표준)
        const vorOtsMatches = [...text.matchAll(/\b([A-Z]+)\s+VOR\s+OTS\b/gi)];
        vorOtsMatches.forEach(match => {
            const fullMatch = match[0];
            if (!matchedTexts.has(fullMatch)) {
                matchedTexts.add(fullMatch);
                notamContent.push(`${match[1]} VOR OTS`);
            }
        });

        return notamContent;
    };

    const parseAdvisories = (text: string) => {
        // FAA AIM 7-1-9 기준: ATIS Advisory 정보 디코딩
        const advisoryPatterns = [
            /HAZD\s+WX\s+INFO\s+FOR\s+[A-Z]+\s+AREA\s+AVBL\s+FM\s+FSS/i,
            /BIRD\s+ACTIVITY\s+VICINITY\s+ARPT/i,
            /CAUTION/i,
            /RUNWAY\s+INCURSIONS\s+HAVE\s+OCCURRED\s+AT\s+TAXIWAYS\s+([^\.]+)/i,
            /PILOTS\s+MUST\s+HOLD\s+SHORT\s+WHEN\s+INSTRUCTED/i,
            /READBACK\s+ALL\s+HOLD\s+SHORT\s+CLEARANCES/i,
            /REMAIN\s+ALERT\s+AND\s+EXERCISE\s+EXTREME\s+CAUTION/i
        ];
        const advisories = advisoryPatterns.map(p => text.match(p)?.[0]?.trim()).filter(Boolean);
        return [...new Set(advisories)]; // Deduplicate
    };


    // DATIS 디코딩은 이제 별도 모듈에서 처리
    /*
    const decodeDatis = (datisText: string) => {
        const text = (datisText || '').replace(/\n/g, ' ').trim();
        
        // FAA 표준 정규화: RWY, RY → RWY, 표준 구두점 처리
        const normText = text
            .replace(/\bRY\b/gi, 'RWY')
            .replace(/\bRWYS?\b/gi, 'RWY')
            .replace(/AND,/gi, 'AND')
            .replace(/\s+,/g, ',')
            .replace(/,\s+/g, ', ')
            .replace(/\s{2,}/g, ' ')
            .replace(/\bAPCH\b/gi, 'APPROACH')
            .replace(/\bDEPG\b/gi, 'DEPARTURES')
            .replace(/\bTWY\b/gi, 'TAXIWAY')
            .replace(/\bCLSD\b/gi, 'CLOSED')
            .replace(/\bBTN\b/gi, 'BETWEEN')
            .replace(/\bCTC\b/gi, 'CONTACT')
            .replace(/\bGC\b/gi, 'GROUND CONTROL');

        // FAA 표준 ATIS 정보 헤더 파싱 (INFO [LETTER] [TIME]Z)
        const infoMatch = text.match(/\bINFO\s+([A-Z])\s+(\d{3,4})Z/i);
        
        // FAA 표준 바람 정보 (VRB 또는 3자리 방향 + 2-3자리 속도 + 선택적 GUST)
        const windParts = text.match(/\b(VRB|\d{3})(\d{2,3})(?:G(\d{2,3}))?KT\b/);
        
        // FAA 표준 가시거리 (P6SM = 6마일 이상, 또는 1-2자리 + SM)
        const visMatch = text.match(/\b(P6|\d{1,2})SM\b/);
        
        // FAA 표준 구름 정보 (FEW/SCT/BKN/OVC + 3자리 높이)
        const cloudMatches = [...text.matchAll(/\b(FEW|SCT|BKN|OVC)(\d{3})\b/gi)].map(m => ({
            amount: m[1].toUpperCase(), 
            heightFt: parseInt(m[2], 10) * 100
        }));
        
        // FAA 표준 온도/이슬점 (온도/이슬점)
        const tempDewMatch = text.match(/\b(\d{1,2})\/(\d{1,2})\b/);
        
        // FAA 표준 기압 (A = inHg, Q = hPa/mb)
        const altimMatchA = text.match(/\bA(\d{4})\b/i); // inHg (미국 표준)
        const altimMatchQ = text.match(/\bQ(\d{4})\b/i); // hPa (국제 표준)
        // FAA 표준 접근 방식 패턴 검색
        // APPROACH IN USE 패턴 (FAA 표준)
        const approachMatch = text.match(/APPROACH\s+IN\s+USE\s+([^\.]+?)(?=\s*\.|$)/i);
        
        // ILS APPROACH 패턴 (FAA 표준)
        const ilsApproachMatch = text.match(/ILS\s+APPROACH\s+([^\.,]+)/i);
        
        // ILS RWY XX APPROACH IN USE 패턴 (FAA 표준)
        const ilsRwyAppMatch = text.match(/ILS\s+RWY\s+([0-9]{2}[LRC]?)\s+APPROACH\s+IN\s+USE/i);
        
        // VISUAL APPROACH 패턴 (FAA 표준)
        const visualApproachMatch = text.match(/VISUAL\s+APPROACH\s+([^\.,]+)/i);
        
        // RNAV APPROACH 패턴 (FAA 표준)
        const rnavApproachMatch = text.match(/RNAV\s+APPROACH\s+([^\.,]+)/i);
        
        // SIMULTANEOUS CHARTED VISUAL FLIGHT PROCEDURES (FAA 표준)
        const simulVisualMatch = text.match(/SIMULTANEOUS\s+CHARTED\s+VISUAL\s+FLIGHT\s+PROCEDURES\s+RWYS?\s+([^\.]+)/i);
        
        // INSTRUMENT APPROACHES AND RNAV RNP APPROACHES (FAA 표준)
        const instRnavApchsMatch = text.match(/INSTRUMENT\s+APPROACHES\s+AND\s+RNAV\s+RNP\s+APPROACHES\s+RWY\s+([^\.]+)/i);
        
        // FAA 표준 복합 접근 방식 정보 파싱
        const approachInfo = {
            simulInstApchs: null,
            rnavRnp: null,
            simulApchsBtwn: null,
            simulInstrDep: null
        };
        
        // SIMULTANEOUS INSTRUMENT APPROACHES AND RNAV RNP RWYS 패턴 (FAA 표준)
        const simulInstRnavMatch = text.match(/SIMULTANEOUS\s+INSTRUMENT\s+APPROACHES\s+AND\s+RNAV\s+RNP\s+RWYS?\s+([^\.]+)/i);
        
        if (simulInstRnavMatch) {
            approachInfo.simulInstApchs = simulInstRnavMatch[1];
            approachInfo.rnavRnp = simulInstRnavMatch[1];
        } else {
            // 개별 패턴 매칭 (FAA 표준)
            const simulInstMatch = text.match(/SIMULTANEOUS\s+INSTRUMENT\s+APPROACHES[^\.]*?RWYS?\s+([^\.]+?)(?:\s+APPROACHES?)?/i);
            if (simulInstMatch) approachInfo.simulInstApchs = simulInstMatch[1];
            
            const rnavMatch = text.match(/RNAV\s+RNP\s+RWYS?\s+([^\.]+?)(?:\s+APPROACHES?)?/i);
            if (rnavMatch) approachInfo.rnavRnp = rnavMatch[1];
        }
        
        // SIMULTANEOUS APPROACHES IN PROGRESS BETWEEN (FAA 표준)
        const simulApchsBtwnMatch = text.match(/SIMULTANEOUS\s+APPROACHES\s+IN\s+PROGRESS\s+BETWEEN\s+([^\.]+?)(?:\s+APPROACHES?)?/i);
        if (simulApchsBtwnMatch) approachInfo.simulApchsBtwn = simulApchsBtwnMatch[1];
        
        // SIMULTANEOUS INSTRUMENT DEPARTURES (FAA 표준)
        const simulInstrDepMatch = text.match(/SIMULTANEOUS\s+INSTRUMENT\s+DEPARTURES[^\.]*?RWYS?\s+([^\.]+?)(?:\s+IN\s+PROGRESS)?/i);
        
        // SIMULTANEOUS INSTRUMENT DEPARTURES IN PROGRESS RWYS (FAA 표준)
        const simulInstrDepProgMatch = text.match(/SIMULTANEOUS\s+INSTRUMENT\s+DEPARTURES\s+IN\s+PROGRESS\s+RWYS\s+([^\.]+)/i);
        if (simulInstrDepMatch) approachInfo.simulInstrDep = simulInstrDepMatch[1];
        
        // CONTACT LOCAL GROUND CONTROL (FAA 표준)
        const ctcGcMatch = text.match(/CONTACT\s+LOCAL\s+GROUND\s+CONTROL\s+ON\s+([^\.]+)/i);
        
        // DEPARTURES (이륙 활주로) 추출 (FAA 표준)
        const depgMatch = text.match(/DEPARTURES\s+RWYS?\s+([^\.]*)/i) || 
                         text.match(/DEPARTURES\s+IN\s+PROGRESS\s+RWYS?\s+([^\.]*)/i) || 
                         text.match(/DEPARTURES\s+RWY[S]?\s+([^\.]*)/i);
        
        // RMK (비고) 섹션 추출 및 디코딩
        const rmkMatch = text.match(/\bRMK\s+([^\.]+)/i);
        const rmkContent = rmkMatch ? rmkMatch[1] : null;
        
        // 전체 텍스트에서 기압 경향 코드 검색 (RMK 외부에서도)
        const allPressureChangeMatches = [...text.matchAll(/(\d{5})/g)];
        
        // 기압 경향 코드가 있는지 확인
        const pressureTendencyCodes = allPressureChangeMatches.filter(m => m[1].startsWith('5'));
        
        
        // CLOSED (폐쇄) 패턴 추출 (FAA 표준)
        const clsdMatches = [...normText.matchAll(/\b(TAXIWAY|RWY|RWY)\s+([A-Z0-9]+)\s+(?:CLOSED)[^\.]*\.?/gi)];
        
        // TAXIWAY CLOSED 상세 정보 추출 (FAA 표준)
        const twyClsdMatches = [...normText.matchAll(/\bTAXIWAY\s+([A-Z0-9]+)\s+(?:CLOSED)\s+(?:BETWEEN)\s+([^\.]+)/gi)];
        
        // ILS RWY 매칭 (FAA 표준)
        const ilsRunwayMatches = [...text.matchAll(/\bILS\s+RWY\s+([0-9]{2}[LRC]?)/gi)].map(m => m[1]);
        
        // VISUAL APPROACH RWY 매칭 (FAA 표준)
        const visualApproachMatches = [...normText.matchAll(/\bVISUAL\s+APPROACH\s+RWY\s+([0-9]{2}[LRC]?)/gi)].map(m => m[1]);
        
        // RNAV GPS APPROACH 매칭 (FAA 표준)
        const rnavGpsMatches = [...normText.matchAll(/\bRNAV\s+GPS\s+([A-Z]?)\s*RWY\s+([0-9]{2}[LRC]?)/gi)].map(m => ({ type: m[1] || 'Z', runway: m[2] }));
        
        // DEPARTURE RWY 매칭 (FAA 표준)
        const depRunwayMatches = [...normText.matchAll(/\bDEPARTURE\s+RWY\s+([0-9]{2}[LRC]?)/gi)].map(m => m[1]);

        // NOTAM 정보 검사 (FAA 표준)
        const hasNotamsWord = /\bNOTAMS?\b/i.test(normText);
        const explicitNoNotams = /\bNO\s+NOTAMS?\b/i.test(normText);
        
        // 폐쇄 정보 검사 (FAA 표준)
        const hasClsdInfo = /\b(TAXIWAY|RWY|GATE|HELIPAD)[^\.]*\b(CLOSED)\b/i.test(normText);
        
        // NOTAM은 반드시 디코딩 - CLSD 정보가 있으면 NOTAM으로 처리
        const hasNotams = hasClsdInfo || (hasNotamsWord && !explicitNoNotams);
        
        // NOTAM 내용 추출 (시설/장비 관련 공식 통지만)
        const notamContent = [];
        if (hasNotams) {
            // 중복을 방지하기 위해 매칭된 텍스트를 추적
            const matchedTexts = new Set();
            
            // TWY CLSD BTN 패턴을 개별적으로 처리
            // 더 정확한 패턴: TWY N CLSD BTN RY 28L AND F 형태
            // 쉼표로 구분된 여러 TWY CLSD 정보를 각각 처리
            const twyClsdBtwnMatches = [...normText.matchAll(/\bTWY\s+([A-Z0-9]+)\s+(?:CLSD|CLOSED)\s+(?:BTN|BETWEEN)\s+([^\.]+?)(?=\s*,\s*|\.|$)/gi)];
            console.log('TWY CLSD BTN Matches:', twyClsdBtwnMatches);
            
            // 추가로 쉼표로 연결된 TWY CLSD 패턴도 처리
            const twyClsdCommaMatches = [...normText.matchAll(/\bTWY\s+([A-Z0-9]+)\s+(?:CLSD|CLOSED)\s+(?:BTN|BETWEEN)\s+([^,]+?),\s*TWY\s+([A-Z0-9]+)\s+(?:CLSD|CLOSED)\s+(?:BTN|BETWEEN)\s+([^\.]+?)(?:\.|$)/gi)];
            console.log('TWY CLSD Comma Matches:', twyClsdCommaMatches);
            // 개별 TWY CLSD BTN 처리
            twyClsdBtwnMatches.forEach(match => {
                const fullMatch = match[0];
                if (!matchedTexts.has(fullMatch)) {
                    matchedTexts.add(fullMatch);
                    // 텍스트 정리: 불필요한 공백 제거하고 일관된 형식으로 변환
                    let cleanedText = match[2].replace(/\s+/g, ' ').trim();
                    // "AND"를 "and"로 통일
                    cleanedText = cleanedText.replace(/\bAND\b/g, 'and');
                    const finalText = `TWY ${match[1]} Closed Between ${cleanedText}`;
                    notamContent.push(finalText);
                }
            });
            
            // 쉼표로 연결된 TWY CLSD BTN 처리
            twyClsdCommaMatches.forEach(match => {
                const fullMatch = match[0];
                if (!matchedTexts.has(fullMatch)) {
                    matchedTexts.add(fullMatch);
                    
                    // 첫 번째 TWY CLSD
                    let cleanedText1 = match[2].replace(/\s+/g, ' ').trim();
                    cleanedText1 = cleanedText1.replace(/\bAND\b/g, 'and');
                    const finalText1 = `TWY ${match[1]} Closed Between ${cleanedText1}`;
                    notamContent.push(finalText1);
                    
                    // 두 번째 TWY CLSD
                    let cleanedText2 = match[4].replace(/\s+/g, ' ').trim();
                    cleanedText2 = cleanedText2.replace(/\bAND\b/g, 'and');
                    const finalText2 = `TWY ${match[3]} Closed Between ${cleanedText2}`;
                    notamContent.push(finalText2);
                }
            });
            
            // RWY CLSD/CLOSED 패턴 처리
            const rwyClsdMatches = [...normText.matchAll(/\bRWY\s+([0-9]{2}[LRC]?)\s+CLSD\b/gi)];
            const rwyClosedMatches2 = [...normText.matchAll(/\bRWY\s+([0-9]{2}[LRC]?)\s+CLOSED\b/gi)];
            rwyClsdMatches.forEach(match => {
                const fullMatch = match[0];
                if (!matchedTexts.has(fullMatch)) {
                    matchedTexts.add(fullMatch);
                    notamContent.push(`RWY ${match[1]} Closed`);
                }
            });
            rwyClosedMatches2.forEach(match => {
                const fullMatch = match[0];
                if (!matchedTexts.has(fullMatch)) {
                    matchedTexts.add(fullMatch);
                    notamContent.push(`RWY ${match[1]} Closed`);
                }
            });
            
            // 기타 NOTAM 패턴들 - 동적 추출
            const otherPatterns = [
                { pattern: /\bGAT\s+([A-Z0-9\s]+?)\s+(?:CLSD|CLOSED)\b/gi, text: 'GAT $1 Closed' },
                { pattern: /\b(TERMINAL\s+HELIPAD|HELIPAD)\b[^\.]*\b(?:CLSD|CLOSED)\b/gi, text: 'Helipad Closed' },
                { pattern: /\bRY\s+([0-9]{2}[LRC]?)\s+SFL\s+OTS\b/gi, text: 'RWY $1 SFL OTS' },
                { pattern: /\b([A-Z]+)\s+VOR\s+OTS\b/gi, text: '$1 VOR OTS' },
                { pattern: /\bRWY\s+([0-9]{2}[LRC]?)\s+LOC\s+OTS\b/gi, text: 'RWY $1 LOC OTS' },
                { pattern: /\bRWY\s+([0-9]{2}[LRC]?)\s+GS\s+OTS\b/gi, text: 'RWY $1 GS OTS' },
                { pattern: /\bRWY\s+([0-9]{2}[LRC]?)\s+ALS\s+OTS\b/gi, text: 'RWY $1 ALS OTS' },
                { pattern: /\bRWY\s+([0-9]{2}[LRC]?)\s+PAPI\s+OTS\b/gi, text: 'RWY $1 PAPI OTS' },
                { pattern: /\bRUNWAY INCURSIONS HAVE OCCURRED AT TAXIWAYS\s+([^\.]+?)(?:\.|$)/gi, text: 'Runway Incursions at Taxiways $1' }
            ];
            
            otherPatterns.forEach(({ pattern, text: notamText }) => {
                const matches = [...normText.matchAll(pattern)];
                matches.forEach(match => {
                    const fullMatch = match[0];
                    if (!matchedTexts.has(fullMatch)) {
                        matchedTexts.add(fullMatch);
                        let finalText = notamText;
                        if (finalText.includes('$1') && match[1]) {
                            finalText = finalText.replace('$1', match[1]);
                        }
                        notamContent.push(finalText);
                    }
                });
            });
        }
        
        
        const birdActivity = /\bBIRD ACTIVITY\b/i.test(text);
        const readbackRequired = /READBACK ALL RWY ASSIGNMENTS/i.test(text);
        const hazardWx = /HAZD WX/i.test(text) || /HAZARDOUS WEATHER/i.test(text);
        const cranesLine = text.match(/NUM CRANES[^\.]*\./i)?.[0]?.replace(/\.$/, '') || null;
        const cranesOperating = /NUM CRANES OPERATING/i.test(text);
        
        // 추가 Advisories 패턴
        const runwayIncursion = /RUNWAY INCURSIONS HAVE OCCURRED/i.test(text);
        const holdShortRequired = /HOLD SHORT WHEN INSTRUCTED/i.test(text);
        const readbackClearances = /READBACK ALL HOLD SHORT CLEARANCES/i.test(text);
        const remainAlert = /REMAIN ALERT AND EXERCISE EXTREME CAUTION/i.test(text);
        const fssInfo = /HAZD WX INFO.*?AVBL FM FSS/i.test(text);

        // 추가 키워드 매칭 (항공 약어 디코딩 포함)
        const llwsMatches = [...text.matchAll(/\b(LLWS|LOW LEVEL WIND SHEAR)[^\.]*?(?:RWY\s*([0-9]{2}[LRC]?))?/gi)];
        const microburst = /\bMICROBURST\b/i.test(text);
        const windshearGeneric = /\bWIND SHEAR\b/i.test(text);
        const brakingMatches = [...text.matchAll(/\bBRAKING ACTION\s+(GOOD|FAIR|POOR|NIL)[^\.]*?(?:RWY\s*([0-9]{2}[LRC]?))?/gi)];
        const rvrMatches = [...text.matchAll(/\bRVR\s*(?:RWY\s*)?([0-9]{2}[LRC]?)\s*(\d{3,4})(?:V(\d{3,4}))?\s*FT\b/gi)];
        const rwyClosedMatches = [...text.matchAll(/\bRWY\s*([0-9]{2}[LRC]?)\s*(?:CLSD|CLOSED)\b/gi)];
        const navaidOtsMatches = [...text.matchAll(/\b(ILS|GLIDESLOPE|LOCALIZER)\s*(?:FOR\s*RWY\s*([0-9]{2}[LRC]?))?\s*(?:OUT OF SERVICE|OTS)\b/gi)];
        const runwayCondMatches = [...text.matchAll(/\bRWY\s*([0-9]{2}[LRC]?).*?\b(WET|DRY|SLIPPERY)\b/gi)];
        const lightningVicinity = /\bLIGHTNING\b/i.test(text);
        const thunderstorm = /\bTHUNDERSTORM\b|\bTS\b/i.test(text);
        const windShearOnFinal = [...text.matchAll(/WIND SHEAR.*?(FINAL|DEPARTURE).*?RWY\s*([0-9]{2}[LRC]?)/gi)];
        const cautionSnippets = [...text.matchAll(/USE CAUTION[^\.]*\./gi)].map(m => m[0].replace(/\.$/, ''));
        
        // FAA 표준 항공 약어 디코딩 (AIM 7-1-9 기준)
        const aviationAbbreviations = {
            'SFL': 'Sequenced Flashing Lights',
            'OTS': 'Out of Service',
            'CLOSED': 'Closed',
            'RWY': 'Runway',
            'TAXIWAY': 'Taxiway',
            'GATE': 'Gate',
            'RVR': 'Runway Visual Range',
            'ILS': 'Instrument Landing System',
            'LLWS': 'Low Level Wind Shear',
            'TS': 'Thunderstorm',
            'SM': 'Statute Miles',
            'KT': 'Knots',
            'VRB': 'Variable',
            'SCT': 'Scattered',
            'BKN': 'Broken',
            'OVC': 'Overcast',
            'FEW': 'Few',
            'APPROACH': 'Approach',
            'DEPARTURE': 'Departure',
            'CONTACT': 'Contact',
            'GROUND CONTROL': 'Ground Control',
            'SIMULTANEOUS': 'Simultaneous',
            'INSTRUMENT': 'Instrument',
            'VISUAL': 'Visual',
            'RNAV': 'Area Navigation',
            'RNP': 'Required Navigation Performance',
            'GPS': 'Global Positioning System'
        };

        // FAA 표준 바람 정보 포맷팅
        let wind: string | null = null;
        if (windParts) {
            const dir = windParts[1];
            const spd = windParts[2];
            const gust = windParts[3];
            // FAA 표준: VRB 또는 방향각 + 속도 + 선택적 GUST
            wind = dir === 'VRB' ? 
                `Variable ${spd} knots${gust ? ` gusting to ${gust} knots` : ''}` : 
                `${dir} degrees at ${spd} knots${gust ? ` gusting to ${gust} knots` : ''}`;
        }

        // FAA 표준 가시거리 포맷팅
        let visibility: string | null = null;
        if (visMatch) {
            visibility = visMatch[1] === 'P6' ? 
                'Greater than 6 statute miles' : 
                `${visMatch[1]} statute miles`;
        }

        // FAA 표준 구름 정보 포맷팅
        const clouds = cloudMatches.length > 0
            ? cloudMatches.map(c => {
                const amount = c.amount === 'FEW' ? 'Few' :
                              c.amount === 'SCT' ? 'Scattered' :
                              c.amount === 'BKN' ? 'Broken' :
                              c.amount === 'OVC' ? 'Overcast' : c.amount;
                return `${amount} at ${c.heightFt.toLocaleString()} feet`;
            }).join(', ')
            : null;

        // FAA 표준 기압 정보 포맷팅 (미국은 inHg 우선)
        let altimeterInHg: string | null = null;
        let altimeterHpa: string | null = null;
        if (altimMatchA) {
            const inHg = (parseInt(altimMatchA[1], 10) / 100).toFixed(2);
            altimeterInHg = `Altimeter ${inHg} inches of mercury`;
        } else if (altimMatchQ) {
            altimeterHpa = `Altimeter ${parseInt(altimMatchQ[1], 10)} hectopascals`;
        }

        // FAA 표준 온도/이슬점 포맷팅 (섭씨)
        const temperature = tempDewMatch ? `Temperature ${tempDewMatch[1]} degrees Celsius` : null;
        const dewpoint = tempDewMatch ? `Dewpoint ${tempDewMatch[2]} degrees Celsius` : null;

        // Use sub-functions for better organization
        const rmkDecoded = parseRmk(rmkContent || '');
        
        const matchedTexts = new Set<string>();
        const approaches = parseApproach(normText);
        const departures = parseDeparture(normText);
        const notams = parseNotams(normText, matchedTexts);
        const advisories = parseAdvisories(normText);

        return {
            infoLetter: infoMatch ? infoMatch[1] : null,
            timeZulu: infoMatch ? `${infoMatch[2]}Z` : null,
            wind,
            visibility,
            clouds,
            temperature,
            dewpoint,
            altimeterInHg,
            altimeterHpa,
            rmkContent,
            rmkDecoded,
            approach: approachMatch ? approachMatch[1] : (ilsRwyAppMatch ? `ILS RWY ${ilsRwyAppMatch[1]}` : (instRnavApchsMatch ? `INST APCHS AND RNAV RNP APCHS RWY ${instRnavApchsMatch[1]}` : null)),
            simulVisual: simulVisualMatch ? simulVisualMatch[1] : null,
            simulInstApchs: approachInfo.simulInstApchs,
            rnavRnp: approachInfo.rnavRnp,
            simulApchsBtwn: approachInfo.simulApchsBtwn,
            simulInstrDep: approachInfo.simulInstrDep || (simulInstrDepProgMatch ? `SIMUL INSTR DEPARTURES IN PROG RWYS ${simulInstrDepProgMatch[1]}` : null),
            ctcGc: (() => {
                if (!ctcGcMatch) return null;
                // 주파수만 추출 (예: 121.75, 121, 121.7 등) → 원본 그대로 유지
                const freq = (ctcGcMatch[1] || '').match(/(\d{3}(?:\.\d{1,2})?)/);
                if (!freq) return ctcGcMatch[1];
                return freq[1];
            })(),
            departureRunways: depgMatch ? depgMatch[1].replace(/\s+/g, ' ').replace(/\band\b/gi, 'and').trim() : null,
            runways: { 
                ils: ilsRunwayMatches, 
                visual: visualApproachMatches,
                rnavGps: rnavGpsMatches,
                dep: depRunwayMatches 
            },
            hasNotams,
            notams,
            advisories,
            approaches,
            departures: departures.length > 0 ? departures.join(', ') : null,
        } as const;
    };
    */


    // 일출/일몰 시간 상태
    const [sunTimes, setSunTimes] = useState<{ sunrise: string | null, sunset: string | null }>({ sunrise: null, sunset: null });
    const [loadingSun, setLoadingSun] = useState(false);


    // 일출/일몰 시간을 API로 가져오기
    const fetchSunTimes = async (cityCode: string) => {
        try {
            setLoadingSun(true);
            const cityInfo = getCityInfo(cityCode);
            if (!cityInfo) {
                setSunTimes({ sunrise: null, sunset: null });
                return;
            }

            // 온라인 상태에서만 API 호출
            if (networkDetector.getStatus().isOnline) {
                const currentDate = new Date().toISOString().split('T')[0];
                const targetTimezone = cityInfo.timezone || 'UTC';
                const response = await fetch(`/api/sunrise?lat=${cityInfo.lat}&lng=${cityInfo.lon}&date=${currentDate}&timezone=${encodeURIComponent(targetTimezone)}`);

                if (!response.ok) {
                    throw new Error('일출/일몰 API 호출 실패');
                }

                const data = await response.json();

                if (data.results) {
                    const sunriseTime = data.results.sunrise;
                    const sunsetTime = data.results.sunset;

                    if (sunriseTime && sunsetTime) {
                        const sunriseDate = new Date(sunriseTime);
                        const sunsetDate = new Date(sunsetTime);

                        const sunriseFormatted = formatInTimeZone(sunriseDate, targetTimezone, 'HH:mm');
                        const sunsetFormatted = formatInTimeZone(sunsetDate, targetTimezone, 'HH:mm');

                        setSunTimes({ sunrise: sunriseFormatted, sunset: sunsetFormatted });
                    } else {
                        setSunTimes({ sunrise: null, sunset: null });
                    }
                } else {
                    throw new Error('API 응답에 results가 없습니다');
                }
            } else {
                // 오프라인 상태에서는 일출/일몰 정보 없음
                setSunTimes({ sunrise: null, sunset: null });
            }
        } catch (error) {
            console.error('일출/일몰 API 오류:', error);
            // API 실패 시 일출/일몰 정보 없음
            setSunTimes({ sunrise: null, sunset: null });
        } finally {
            setLoadingSun(false);
        }
    };

    // 일출/일몰 직접 계산 함수 삭제됨

    // 타임존 오프셋 계산 함수 (cityData.ts의 getUTCOffset 사용)
    const getTimezoneOffset = (cityCode: string): number => {
        try {
            const cityInfo = getCityInfo(cityCode);
            if (!cityInfo) return 0;

            const now = new Date();
            const utcTime = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
            const localTime = new Date(now.toLocaleString('en-US', { timeZone: cityInfo.timezone }));
            const offset = (localTime.getTime() - utcTime.getTime()) / (1000 * 60 * 60);
            return offset;
        } catch (error) {
            console.error('타임존 오프셋 계산 오류:', error);
            return 0;
        }
    };


    // 월출/월몰 함수 삭제됨

    const WeatherIcon = ({ icon, className, size = '' }: { icon: string; className?: string; size?: '' | '@2x' | '@4x' }) => {
        // icon 값이 없거나 undefined인 경우 기본 아이콘 반환
        if (!icon) {
            return <WiDaySunny size={48} color="#9ca3af" />;
        }

        // 현재 날씨 아이콘인지 확인 (size prop이 '@4x'인 경우)
        const isCurrentWeather = size === '@4x';
        // 작은 화면에서는 더 작은 크기 사용
        const iconSize = isCurrentWeather ? 64 : 48; // 현재 날씨는 64px (작은 화면), 예보는 48px

        // 맑음 (낮)
        if (icon === '01d') {
            return <WiDaySunny size={iconSize} color="#f59e0b" />;
        }
        // 맑음 (밤)
        if (icon === '01n') {
            return <WiNightClear size={iconSize} color="#60a5fa" />;
        }
        // 구름 조금 (02)
        if (icon.startsWith('02')) {
            return <WiCloudy size={iconSize} color="#9ca3af" />;
        }
        // 구름 많음 (03, 04)
        if (icon.startsWith('03') || icon.startsWith('04')) {
            return <WiCloudyGusts size={iconSize} color="#6b7280" />;
        }
        // 비 (09, 10)
        if (icon.startsWith('09') || icon.startsWith('10')) {
            return <WiRain size={iconSize} color="#3b82f6" />;
        }
        // 천둥번개 (11)
        if (icon.startsWith('11')) {
            return <BoltIcon className={`${className} text-yellow-500 dark:text-yellow-400 ${isCurrentWeather ? 'w-16 h-16 sm:w-24 sm:h-24' : 'w-12 h-12'}`} />;
        }
        // 눈 (13)
        if (icon.startsWith('13')) {
            return <WiSnow size={iconSize} color="#93c5fd" />;
        }
        // 안개 (50)
        if (icon.startsWith('50')) {
            return <WiFog size={iconSize} color="#6b7280" />;
        }
        // 기본값: OpenWeatherMap 아이콘 사용
        return (
            <div className={`bg-white dark:bg-gray-800 rounded-lg p-1 ${className}`}>
                <img
                    src={`https://openweathermap.org/img/wn/${icon}${size}.png`}
                    alt="weather icon"
                    className="w-full h-full"
                />
            </div>
        );
    };

    // API 키는 이제 Vercel 서버리스 함수에서 환경변수로 관리됩니다

    // 도시 정보를 가져오는 함수들
    const getIcaoCode = (airportCode: string): string => {
        return getICAO(airportCode) || airportCode;
    };

    const getCityNameFromCode = (airportCode: string): string => {
        return getCityName(airportCode) || airportCode;
    };

    const getCurrencyFromCode = (airportCode: string): string => {
        return getCurrency(airportCode) || 'USD';
    };

    // 스크롤 이벤트 핸들러
    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        setShowScrollbar(true);

        if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current);
        }

        scrollTimeoutRef.current = setTimeout(() => {
            setShowScrollbar(false);
        }, 1000);
    };



    useEffect(() => {
        if (showWeather && city && !weather) {
            const fetchWeather = async () => {
                setLoadingWeather(true);
                setWeatherError(null);
                const cityName = getCityNameFromCode(city);

                try {
                    // 캐시된 데이터 확인
                    const cachedData = getCachedData(`weather_${city}`);
                    if (cachedData) {
                        setWeather(cachedData);
                        setLoadingWeather(false);
                        return;
                    }

                    // 온라인 상태에서만 API 호출
                    if (networkDetector.getStatus().isOnline) {
                        // Vercel 서버리스 함수 사용 (OpenWeatherMap 2.5 Forecast API)
                        const cityInfo = getCityInfo(city);
                        const cityId = cityInfo?.openWeatherId || 1843564; // 기본값: 인천

                        const response = await fetch(`/api/weather?id=${cityId}`);
                        if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(errorData.error || '날씨 정보를 가져올 수 없습니다.');
                        }
                        const weatherData = await response.json();

                        setWeather(weatherData);

                        // AQI 데이터도 가져오기
                        await fetchAQIData(city, cityInfo);

                        setCachedData(`weather_${city}`, weatherData);
                    } else {
                        // 오프라인 상태에서 캐시된 데이터가 있으면 사용
                        const offlineCachedData = getCachedData(`weather_${city}`, 24 * 60 * 60 * 1000); // 24시간
                        if (offlineCachedData) {
                            setWeather(offlineCachedData);
                            setWeatherError('오프라인 모드: 캐시된 데이터를 표시합니다.');
                        } else {
                            setWeatherError('오프라인 상태에서 캐시된 날씨 정보가 없습니다.');
                        }

                        // 캐시된 AQI 데이터도 확인
                        const cachedAQIData = getCachedData(`air_pollution_${city}`, 24 * 60 * 60 * 1000); // 24시간
                        if (cachedAQIData) {
                            setAirPollution(cachedAQIData);
                        }
                    }
                } catch (err) {
                    // 오프라인 상태에서 캐시된 데이터가 있으면 사용
                    const offlineCachedData = getCachedData(`weather_${city}`, 24 * 60 * 60 * 1000); // 24시간
                    if (offlineCachedData && !networkDetector.getStatus().isOnline) {
                        setWeather(offlineCachedData);
                        setWeatherError('오프라인 모드: 캐시된 데이터를 표시합니다.');

                        // 캐시된 AQI 데이터도 확인
                        const cachedAQIData = getCachedData(`air_pollution_${city}`, 24 * 60 * 60 * 1000); // 24시간
                        if (cachedAQIData) {
                            setAirPollution(cachedAQIData);
                        }
                    } else {
                        setWeatherError('날씨 정보를 불러오는 데 실패했습니다.');
                    }
                } finally {
                    setLoadingWeather(false);
                }
            };
            fetchWeather();
            // 일출/일몰 시간 가져오기
            fetchSunTimes(city);
        }
    }, [showWeather, city, weather]);

    // AQI 데이터를 별도로 관리하는 useEffect
    useEffect(() => {
        if (showWeather && city && !airPollution) {
            const cityInfo = getCityInfo(city);
            fetchAQIData(city, cityInfo);
        }
    }, [showWeather, city, airPollution]);

    useEffect(() => {
        if (showWeather && city && !forecast && !forecastError) {
            const fetchForecast = async () => {
                setLoadingForecast(true);
                setForecastError(null);
                const cityName = getCityNameFromCode(city);

                try {
                    // 캐시된 데이터 확인
                    const cachedData = getCachedData(`forecast_${city}`);
                    if (cachedData) {
                        // 캐시된 데이터를 현지시간으로 다시 계산
                        const cityInfo = getCityInfo(city);
                        if (cachedData.next24hForecast && cityInfo) {
                            const updatedNext24hForecast = cachedData.next24hForecast.map((item: any) => {
                                // 원본 UTC 시간을 현지시간으로 변환
                                const localTime = new Date(item.dt * 1000).toLocaleString("en-US", { timeZone: cityInfo.timezone });
                                const localHour = new Date(localTime).getHours();
                                return {
                                    ...item,
                                    time: localHour + '시'
                                };
                            });
                            setThreeHourForecast(updatedNext24hForecast);
                        } else {
                            setThreeHourForecast(cachedData.next24hForecast);
                        }
                        setForecast(cachedData.processedForecast);
                        setLoadingForecast(false);
                        return;
                    }

                    // 온라인 상태에서만 API 호출
                    if (networkDetector.getStatus().isOnline) {
                        // Vercel 서버리스 함수 사용 (OpenWeatherMap 2.5 Forecast API)
                        const cityInfo = getCityInfo(city);
                        const cityId = cityInfo?.openWeatherId || 1843564; // 기본값: 인천


                        const response = await fetch(`/api/weather?id=${cityId}`);

                        if (!response.ok) {
                            const errorText = await response.text();
                            console.error('API 오류 응답:', errorText);
                            throw new Error(`예보 정보를 가져올 수 없습니다. (${response.status})`);
                        }

                        const weatherData = await response.json();

                        // 현재 날씨 정보 설정
                        if (weatherData.main && weatherData.weather) {
                            setWeather(weatherData);
                        }

                        const data = weatherData.forecastData; // Forecast API 원본 데이터

                        // Forecast API의 list 데이터를 사용 (24시간 예보)
                        const next24hForecast = data.list.slice(0, 8).map((item: any) => {
                            const localTime = cityInfo ?
                                new Date(item.dt * 1000).toLocaleString("en-US", { timeZone: cityInfo.timezone }) :
                                new Date(item.dt * 1000);
                            const localHour = new Date(localTime).getHours();

                            return {
                                time: localHour + '시',
                                icon: item.weather[0].icon,
                                temp: Math.round(item.main.temp),
                                dt: item.dt, // 원본 UTC 시간 저장
                            };
                        });
                        setThreeHourForecast(next24hForecast);

                        // Forecast API의 list 데이터를 일별로 그룹화
                        const dailyData: { [key: string]: { temps: number[], icon?: string } } = {};
                        const today = new Date().toISOString().split('T')[0];

                        data.list.forEach((item: any) => {
                            const date = new Date(item.dt * 1000).toISOString().split('T')[0];
                            if (date === today) return; // 오늘 데이터는 제외

                            if (!dailyData[date]) {
                                dailyData[date] = { temps: [] };
                            }
                            dailyData[date].temps.push(item.main.temp);
                            if (item.dt_txt.includes("12:00:00")) {
                                dailyData[date].icon = item.weather[0].icon;
                            }
                        });

                        const processedForecast = Object.entries(dailyData).map(([date, dayData]) => {
                            return {
                                date,
                                day: new Date(date).toLocaleDateString('ko-KR', { weekday: 'short' }),
                                minTemp: Math.round(Math.min(...dayData.temps)),
                                maxTemp: Math.round(Math.max(...dayData.temps)),
                                icon: dayData.icon || data.list.find((item: any) => item.dt_txt.startsWith(date)).weather[0].icon,
                            };
                        });

                        setForecast(processedForecast);

                        setCachedData(`forecast_${city}`, {
                            processedForecast,
                            next24hForecast
                        });

                    } else {
                        // 오프라인 상태에서 캐시된 데이터가 있으면 사용
                        const offlineCachedData = getCachedData(`forecast_${city}`, 24 * 60 * 60 * 1000); // 24시간
                        if (offlineCachedData) {
                            // 캐시된 데이터를 현지시간으로 다시 계산
                            const cityInfo = getCityInfo(city);
                            if (offlineCachedData.next24hForecast && cityInfo) {
                                const updatedNext24hForecast = offlineCachedData.next24hForecast.map((item: any) => {
                                    if (item.dt) {
                                        // 원본 UTC 시간을 현지시간으로 변환
                                        const localTime = new Date(item.dt * 1000).toLocaleString("en-US", { timeZone: cityInfo.timezone });
                                        const localHour = new Date(localTime).getHours();
                                        return {
                                            ...item,
                                            time: localHour + '시'
                                        };
                                    }
                                    return item;
                                });
                                setThreeHourForecast(updatedNext24hForecast);
                            } else {
                                setThreeHourForecast(offlineCachedData.next24hForecast);
                            }
                            setForecast(offlineCachedData.processedForecast);
                            setForecastError('오프라인 모드: 캐시된 데이터를 표시합니다.');
                        } else {
                            setForecastError('오프라인 상태에서 캐시된 예보 정보가 없습니다.');
                        }
                    }

                } catch (err) {
                    console.error('날씨 API 오류:', err);
                    // 오프라인 상태에서 캐시된 데이터가 있으면 사용
                    const offlineCachedData = getCachedData(`forecast_${city}`, 24 * 60 * 60 * 1000); // 24시간
                    if (offlineCachedData && !networkDetector.getStatus().isOnline) {
                        // 캐시된 데이터를 현지시간으로 다시 계산
                        const cityInfo = getCityInfo(city);
                        if (offlineCachedData.next24hForecast && cityInfo) {
                            const updatedNext24hForecast = offlineCachedData.next24hForecast.map((item: any) => {
                                if (item.dt) {
                                    // 원본 UTC 시간을 현지시간으로 변환
                                    const localTime = new Date(item.dt * 1000).toLocaleString("en-US", { timeZone: cityInfo.timezone });
                                    const localHour = new Date(localTime).getHours();
                                    return {
                                        ...item,
                                        time: localHour + '시'
                                    };
                                }
                                return item;
                            });
                            setThreeHourForecast(updatedNext24hForecast);
                        } else {
                            setThreeHourForecast(offlineCachedData.next24hForecast);
                        }
                        setForecast(offlineCachedData.processedForecast);
                        setForecastError('오프라인 모드: 캐시된 데이터를 표시합니다.');
                    } else {
                        setForecastError('예보 정보 로딩 실패');
                        console.error(err);
                    }
                } finally {
                    setLoadingForecast(false);
                }
            };
            fetchForecast();
        }
    }, [showWeather, city, forecast, forecastError]);

    useEffect(() => {
        if (showMetar && city && !metar && !taf) {
            const fetchMetarTaf = async () => {
                setLoadingMetarTaf(true);
                setMetarTafError(null);
                const icaoCode = getIcaoCode(city); // ICAO 코드로 변환

                try {
                    // 캐시된 데이터 확인 (15분 캐시)
                    const cachedMetarData = getCachedData(`metar_${city}`, 15 * 60 * 1000);
                    const cachedTafData = getCachedData(`taf_${city}`, 15 * 60 * 1000);

                    if (cachedMetarData && cachedTafData) {
                        setMetar(cachedMetarData);
                        setTaf(cachedTafData);
                        setLoadingMetarTaf(false);
                        return;
                    }

                    // 온라인 상태에서만 API 호출
                    if (networkDetector.getStatus().isOnline) {
                        // Vercel 서버리스 함수 사용 (API 키 보호)
                        const response = await fetch(`/api/metar?icao=${icaoCode}`);
                        if (!response.ok) throw new Error('METAR/TAF 정보를 가져올 수 없습니다.');
                        const data = await response.json();

                        const metarText = data.metar ? data.metar.raw_text : 'METAR 정보 없음';
                        const tafText = data.taf ? data.taf.raw_text : 'TAF 정보 없음';

                        setMetar(metarText);
                        setTaf(tafText);

                        setCachedData(`metar_${city}`, metarText);
                        setCachedData(`taf_${city}`, tafText);
                    } else {
                        // 오프라인 상태에서 캐시된 데이터가 있으면 사용
                        const offlineCachedMetarData = getCachedData(`metar_${city}`, 24 * 60 * 60 * 1000); // 24시간
                        const offlineCachedTafData = getCachedData(`taf_${city}`, 24 * 60 * 60 * 1000); // 24시간
                        if (offlineCachedMetarData && offlineCachedTafData) {
                            setMetar(offlineCachedMetarData);
                            setTaf(offlineCachedTafData);
                            setMetarTafError('오프라인 모드: 캐시된 데이터를 표시합니다.');
                        } else {
                            setMetarTafError('오프라인 상태에서 캐시된 METAR/TAF 정보가 없습니다.');
                        }
                    }
                } catch (err) {
                    // 오프라인 상태에서 캐시된 데이터가 있으면 사용
                    const offlineCachedMetarData = getCachedData(`metar_${city}`, 24 * 60 * 60 * 1000); // 24시간
                    const offlineCachedTafData = getCachedData(`taf_${city}`, 24 * 60 * 60 * 1000); // 24시간
                    if (offlineCachedMetarData && offlineCachedTafData && !networkDetector.getStatus().isOnline) {
                        setMetar(offlineCachedMetarData);
                        setTaf(offlineCachedTafData);
                        setMetarTafError('오프라인 모드: 캐시된 데이터를 표시합니다.');
                    } else {
                        setMetarTafError('METAR/TAF 정보를 불러올 수 없습니다. (오프라인 또는 서버 오류)');
                    }
                } finally {
                    setLoadingMetarTaf(false);
                }
            };
            fetchMetarTaf();
        }
    }, [showMetar, city, metar, taf]);

    // DATIS API를 사용한 정보 가져오기
    useEffect(() => {
        if (showDatis && city && !datisInfo && cityInfo?.country === 'United States') {
            const fetchDatis = async () => {
                setLoadingDatis(true);
                setDatisError(null);

                try {
                    // Vercel 서버리스 함수(프록시) 사용
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 10000);

                    const response = await fetch(`/api/datis?icao=${cityInfo.icao}`, {
                        signal: controller.signal
                    });

                    clearTimeout(timeoutId);

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
                    }

                    const data = await response.json();

                    // 디버깅: 실제 응답 구조 확인
                    console.log('DATIS API Response:', data);

                    // DATIS 정보 포맷팅 (실제 DATIS API 응답)
                    if (Array.isArray(data) && data.length > 0) {
                        // DATIS API는 배열 형태로 응답
                        const datisItem = data[0];
                        if (datisItem.datis) {
                            // RAW 데이터 저장
                            setDatisInfo(datisItem.datis);
                        } else {
                            setDatisError('정보를 사용할 수 없습니다.');
                        }
                    } else if (data.error) {
                        setDatisError(data.error);
                    } else {
                        setDatisError('정보를 사용할 수 없습니다. (예상치 못한 응답 형식)');
                    }
                } catch (err) {
                    // API 호출 실패 시 대체 메시지 표시
                    console.error('❌ DATIS API 오류:', err);
                    const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류';
                    setDatisError(`DATIS 정보를 가져올 수 없습니다: ${errorMessage}`);
                } finally {
                    setLoadingDatis(false);
                }
            };
            fetchDatis();
        }
    }, [showDatis, city, datisInfo, cityInfo]);

    // 공항이 변경될 때 DATIS 정보 초기화
    useEffect(() => {
        if (city) {
            setDatisInfo(null);
            setDatisError(null);
        }
    }, [city]);

    useEffect(() => {
        if (showWeather && city && !exchangeRate && !exchangeRateError) {
            const fetchExchangeRate = async () => {
                const targetCurrency = getCurrencyFromCode(city);
                if (!targetCurrency || targetCurrency === 'KRW') return;

                setLoadingExchangeRate(true);
                setExchangeRateError(null);

                try {
                    // 캐시된 데이터 확인 (1시간 캐시) - v2 키 사용으로 기존 캐시 무효화
                    const cachedData = getCachedData(`exchange_v2_${city}`, 60 * 60 * 1000);
                    if (cachedData) {
                        setExchangeRate(cachedData);
                        setLoadingExchangeRate(false);
                        // USD 환율이 아직 없으면 별도 조회
                        if (!usdExchangeRate && targetCurrency !== 'USD' && networkDetector.getStatus().isOnline) {
                            try {
                                const usdResponse = await fetch(`/api/exchange?fromCurrency=${targetCurrency}&toCurrency=USD`);
                                const usdData = await usdResponse.json();
                                if (usdData.success && usdData.conversion_rate) {
                                    const rate = usdData.conversion_rate;
                                    let displayUnit = 1;
                                    let displayRate = rate;
                                    if (targetCurrency === 'VND') {
                                        displayUnit = 10000;
                                        displayRate = rate * 10000;
                                    }
                                    const usdText = `${displayUnit.toLocaleString()} ${targetCurrency} ≈ ${displayRate.toFixed(4)} USD`;
                                    setUsdExchangeRate(usdText);
                                }
                            } catch (e) {
                                console.warn('달러 환율 가져오기 실패', e);
                            }
                        }
                        return;
                    }

                    // 온라인 상태에서만 API 호출
                    if (networkDetector.getStatus().isOnline) {
                        try {
                            // Vercel API 엔드포인트를 통해 환율 정보 가져오기
                            const response = await fetch(`/api/exchange?fromCurrency=${targetCurrency}&toCurrency=KRW`, {
                                method: 'GET',
                                headers: {
                                    'Accept': 'application/json',
                                },
                                // 10초 타임아웃 설정
                                signal: AbortSignal.timeout(10000)
                            });

                            if (!response.ok) {
                                throw new Error(`환율 API 응답 오류: ${response.status} ${response.statusText}`);
                            }

                            const data = await response.json();

                            if (data.success && data.conversion_rate) {
                                // API에서 포맷팅된 텍스트를 직접 사용 (VND 10,000 단위 등 처리됨)
                                const exchangeRateText = data.exchangeRateText || `1 ${targetCurrency} ≈ ${Math.round(data.conversion_rate).toLocaleString('ko-KR')} KRW`;

                                setExchangeRate(exchangeRateText);
                                setCachedData(`exchange_v2_${city}`, exchangeRateText);
                            } else {
                                throw new Error(data['error-type'] || `환율 API 오류: ${JSON.stringify(data)}`);
                            }
                        } catch (apiError) {
                            // API 키 관련 오류 처리
                            if (apiError instanceof Error && apiError.message.includes('환율 API 키가 설정되지 않았습니다')) {
                                setExchangeRateError('환율 API 키가 설정되지 않았습니다.');
                                return;
                            }
                            throw apiError; // 다른 오류는 상위 catch로 전달
                        }

                        // 달러화 환율 정보 가져오기 (원화가 기축이거나 요청이 USD가 아닐 경우)
                        if (targetCurrency !== 'USD') {
                            try {
                                const usdResponse = await fetch(`/api/exchange?fromCurrency=${targetCurrency}&toCurrency=USD`);
                                const usdData = await usdResponse.json();
                                if (usdData.success && usdData.conversion_rate) {
                                    const rate = usdData.conversion_rate;
                                    let displayUnit = 1;
                                    let displayRate = rate;
                                    if (targetCurrency === 'VND') {
                                        displayUnit = 10000;
                                        displayRate = rate * 10000;
                                    }
                                    const usdText = `${displayUnit.toLocaleString()} ${targetCurrency} ≈ ${displayRate.toFixed(4)} USD`;
                                    setUsdExchangeRate(usdText);
                                }
                            } catch (e) {
                                console.warn('달러 환율 가져오기 실패', e);
                            }
                        }
                    } else {
                        // 오프라인 상태에서 캐시된 데이터가 있으면 사용
                        const offlineCachedData = getCachedData(`exchange_v2_${city}`, 24 * 60 * 60 * 1000); // 24시간
                        if (offlineCachedData) {
                            setExchangeRate(offlineCachedData);
                            setExchangeRateError('오프라인 모드: 캐시된 데이터를 표시합니다.');
                        } else {
                            setExchangeRateError('오프라인 상태에서 캐시된 환율 정보가 없습니다.');
                        }
                    }
                } catch (err) {
                    console.error('환율 API 호출 실패:', err);

                    // 오프라인 상태에서 캐시된 데이터가 있으면 사용
                    const offlineCachedData = getCachedData(`exchange_${city}`, 24 * 60 * 60 * 1000); // 24시간
                    if (offlineCachedData && !networkDetector.getStatus().isOnline) {
                        setExchangeRate(offlineCachedData);
                        setExchangeRateError('오프라인 모드: 캐시된 데이터를 표시합니다.');
                    } else if (offlineCachedData) {
                        // 온라인 상태이지만 API 실패 시 캐시된 데이터 사용
                        setExchangeRate(offlineCachedData);
                        setExchangeRateError('네트워크 오류: 캐시된 데이터를 표시합니다.');
                    } else {
                        // 캐시된 데이터도 없는 경우
                        if (err instanceof Error) {
                            if (err.name === 'TimeoutError') {
                                setExchangeRateError('환율 정보 로딩 시간 초과');
                            } else if (err.message.includes('Failed to fetch')) {
                                setExchangeRateError('네트워크 연결 실패');
                            } else {
                                setExchangeRateError(`환율 정보 로딩 실패: ${err.message}`);
                            }
                        } else {
                            setExchangeRateError('환율 정보 로딩 실패');
                        }
                    }
                } finally {
                    setLoadingExchangeRate(false);
                }
            };
            fetchExchangeRate();
        }
    }, [showWeather, city]); // exchangeRate, exchangeRateError 제거로 성능 최적화

    useEffect(() => {
        if (!isOpen) {
            setShowWeather(false);
            setWeather(null);
            setExchangeRate(null);
            setUsdExchangeRate(null);
            setExchangeRateError(null);
            setChartData([]);
            setChartError(null);
            setForecast(null);
            setForecastError(null);
            setThreeHourForecast(null);
            setShowMetar(false);
            setMetar(null);
            setTaf(null);
            setMetarTafError(null);
            setShowDecoded(false);
            setAirPollution(null);
            setAirPollutionError(null);
        }
    }, [isOpen]);

    useEffect(() => {
        let intervalId: NodeJS.Timeout;

        const updateZuluTime = () => {
            const now = new Date();
            const day = now.getUTCDate().toString().padStart(2, '0');
            const hours = now.getUTCHours().toString().padStart(2, '0');
            const minutes = now.getUTCMinutes().toString().padStart(2, '0');
            setZuluTime(`${day} ${hours}${minutes}Z`);
        };

        if (showMetar) {
            updateZuluTime();
            intervalId = setInterval(updateZuluTime, 60000);
        }

        return () => {
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [showMetar]);

    if (!isOpen || !city) {
        return null;
    }

    // 실제 비행만 필터링하고 날짜 내림차순으로 정렬
    const sortedFlights = [...flights]
        .filter(isActualFlight)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[100] p-4 pt-safe" onClick={onClose}>
            <div className="glass-panel rounded-2xl shadow-xl w-full max-w-lg p-6 relative animate-fade-in-up z-[101] city-schedule-modal-container" onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
                    <XIcon className="w-6 h-6" />
                </button>


                <div className="mb-4">
                    <h2 className="text-xl font-bold text-white flex items-center">
                        <span className="mr-2">{getCountryFlag(city ? getCountry(city) : null)}</span>
                        <span><span className="text-xl">{city} 정보</span> <span className="text-sm text-slate-400">{city ? getUTCOffset(city) || '(UTC)' : '(UTC)'}</span></span>
                        <button
                            onClick={() => onMemoClick && onMemoClick(city || '')}
                            title="도시 메모 작성/수정"
                            className="ml-2"
                        >
                            <MemoIcon className="w-5 h-5 text-slate-400 hover:text-white transition-colors" />
                        </button>
                        <button
                            onClick={() => setShowWeather(!showWeather)}
                            title="날씨 정보 보기/숨기기"
                            className="ml-2"
                        >
                            <InfoIcon className="w-5 h-5 text-slate-400 hover:text-white transition-colors" />
                        </button>
                        <button
                            onClick={() => setShowMetar(!showMetar)}
                            title="METAR/TAF 정보 보기/숨기기"
                            className="ml-2 px-2 py-1 text-xs font-medium bg-emerald-500/20 text-emerald-400 rounded hover:bg-emerald-500/30 transition-colors"
                        >
                            TAF
                        </button>
                        {/* 미국 도시에만 DATIS 버튼 표시 */}
                        {(() => {
                            const shouldShowDatis = cityInfo?.country === 'United States';
                            // DATIS 버튼 표시 조건 확인
                            return shouldShowDatis;
                        })() && (
                                <button
                                    onClick={() => {
                                        // DATIS 버튼 클릭됨

                                        // DATIS 토글 시 기존 데이터 초기화
                                        if (!showDatis) {
                                            setDatisInfo(null);
                                            setDatisError(null);
                                        }

                                        setShowDatis(!showDatis);
                                    }}
                                    title="DATIS 정보 보기/숨기기"
                                    className="ml-2 px-2 py-1 text-xs font-medium bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors"
                                >
                                    DATIS
                                </button>
                            )}
                    </h2>
                </div>

                <div
                    className={`max-h-[70vh] overflow-y-auto ${showScrollbar ? 'scrollbar-show' : 'scrollbar-hide'}`}
                    onScroll={handleScroll}
                >

                    {showMetar && (
                        <div className="mb-4 p-4 bg-black/20 rounded-lg border border-white/10">
                            <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center space-x-2">
                                    <h3 className="font-bold text-white text-sm">METAR / TAF</h3>
                                    {(metar || taf) && (
                                        <button
                                            onClick={() => setShowDecoded(!showDecoded)}
                                            className="px-2 py-1 text-xs bg-blue-600 text-white rounded"
                                        >
                                            {showDecoded ? 'RAW' : 'DECODE'}
                                        </button>
                                    )}
                                </div>
                                {zuluTime && <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{zuluTime}</span>}
                            </div>
                            {loadingMetarTaf && <p className="text-center text-sm text-slate-400">METAR/TAF 정보를 불러오는 중...</p>}
                            {metarTafError && <p className="text-rose-400 text-center text-sm">{metarTafError}</p>}
                            {(metar || taf) && (
                                <div className="space-y-2 text-xs bg-black/40 p-3 rounded text-slate-300">
                                    {showDecoded ? (
                                        <div className="space-y-4">
                                            {metar && (
                                                <div>
                                                    <h4 className="font-semibold text-blue-400 mb-2">METAR</h4>
                                                    {(() => {
                                                        const d = decodeMetar(metar);
                                                        return (
                                                            <div className="space-y-3">
                                                                {d.time && (
                                                                    <div className="bg-blue-500/10 p-2 rounded border border-blue-500/20">
                                                                        <div className="text-slate-400 text-xs">Observation Time</div>
                                                                        <div className="font-semibold text-blue-300 text-sm">{d.time}</div>
                                                                    </div>
                                                                )}
                                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                                    {d.wind && (
                                                                        <div className="bg-blue-500/10 p-2 rounded">
                                                                            <div className="text-slate-400">Wind</div>
                                                                            <div className="font-semibold text-blue-300">{d.wind}</div>
                                                                        </div>
                                                                    )}
                                                                    {d.visibility && (
                                                                        <div className="bg-blue-500/10 p-2 rounded">
                                                                            <div className="text-slate-400">Visibility</div>
                                                                            <div className="font-semibold text-blue-300">{d.visibility}</div>
                                                                        </div>
                                                                    )}
                                                                    {d.temp && (
                                                                        <div className="bg-blue-500/10 p-2 rounded">
                                                                            <div className="text-slate-400">Temperature</div>
                                                                            <div className="font-semibold text-blue-300">{d.temp}</div>
                                                                        </div>
                                                                    )}
                                                                    {d.pressure && (
                                                                        <div className="bg-blue-500/10 p-2 rounded">
                                                                            <div className="text-slate-400">Pressure</div>
                                                                            <div className="font-semibold text-blue-300 text-xs">{d.pressure}</div>
                                                                        </div>
                                                                    )}
                                                                    {d.weather && d.weather !== 'No significant weather' && (
                                                                        <div className="bg-blue-500/10 p-2 rounded col-span-2">
                                                                            <div className="text-slate-400">Weather</div>
                                                                            <div className="font-semibold text-blue-300 text-xs">{d.weather}</div>
                                                                        </div>
                                                                    )}
                                                                    {d.clouds && (
                                                                        <div className="bg-blue-500/10 p-2 rounded col-span-2">
                                                                            <div className="text-slate-400">Clouds</div>
                                                                            <div className="font-semibold text-blue-300 text-xs">{d.clouds}</div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                {d.remarks && (
                                                                    <div className="bg-yellow-500/10 p-2 rounded border border-yellow-500/20 col-span-2">
                                                                        <div className="text-slate-400">Remarks (RMK)</div>
                                                                        <ul className="list-disc ml-4 space-y-1 text-yellow-300">
                                                                            {d.remarks.split('; ').map((remark, idx) => (
                                                                                <li key={idx}>{remark}</li>
                                                                            ))}
                                                                        </ul>
                                                                    </div>
                                                                )}
                                                                {(d.auto || d.corrected) && (
                                                                    <div className="bg-black/20 p-2 rounded border border-white/10">
                                                                        <div className="text-slate-400 text-xs">Status</div>
                                                                        <div className="font-semibold text-slate-200 text-xs">
                                                                            {d.auto && <span className="text-blue-400">AUTO</span>}
                                                                            {d.auto && d.corrected && <span className="mx-1">•</span>}
                                                                            {d.corrected && <span className="text-emerald-400">COR</span>}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            )}
                                            {taf && (
                                                <div>
                                                    <h4 className="font-semibold text-green-600 dark:text-green-400 mb-2">TAF</h4>
                                                    {(() => {
                                                        // TAF 디코딩 (새로운 모듈 사용)
                                                        const d = decodeTaf(taf);
                                                        const formattedTaf = formatTafInfo(d);
                                                        return (
                                                            <div className="space-y-3">
                                                                <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded border border-green-200 dark:border-green-700">
                                                                    <div className="text-gray-600 dark:text-gray-400 text-xs">Valid Period</div>
                                                                    <div className="font-semibold text-green-800 dark:text-green-200 text-sm">{d.validFrom && d.validTo ? `${d.validFrom} - ${d.validTo}` : 'N/A'}</div>
                                                                </div>
                                                                {d.forecasts.map((f: any, idx: number) => (
                                                                    <div key={idx} className={`p-3 rounded border ${f.type === 'Main' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700' :
                                                                        f.type === 'Temporary' ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700' :
                                                                            f.type === 'Becoming' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700' :
                                                                                f.type === 'Probability' ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700' :
                                                                                    f.type === 'From' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700' :
                                                                                        'bg-green-100 dark:bg-green-900/20 border-green-200 dark:border-green-700'
                                                                        }`}>
                                                                        <div className="flex justify-between items-center mb-2">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className={`font-semibold text-sm ${f.type === 'Main' ? 'text-green-800 dark:text-green-200' :
                                                                                    f.type === 'Temporary' ? 'text-purple-800 dark:text-purple-200' :
                                                                                        f.type === 'Becoming' ? 'text-green-800 dark:text-green-200' :
                                                                                            f.type === 'Probability' ? 'text-purple-800 dark:text-purple-200' :
                                                                                                f.type === 'From' ? 'text-green-800 dark:text-green-200' :
                                                                                                    'text-green-800 dark:text-green-200'
                                                                                    }`}>
                                                                                    {f.time}
                                                                                </span>
                                                                                {f.type && (
                                                                                    <span className={`text-xs px-1 py-0.5 rounded ${f.type === 'Main' ? 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200' :
                                                                                        f.type === 'Temporary' ? 'bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-200' :
                                                                                            f.type === 'Becoming' ? 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200' :
                                                                                                f.type === 'Probability' ? 'bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-200' :
                                                                                                    f.type === 'From' ? 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200' :
                                                                                                        'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200'
                                                                                        }`}>
                                                                                        {f.type}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                        <div className="grid grid-cols-3 gap-2 text-xs">
                                                                            {f.wind && (
                                                                                <div className="bg-white dark:bg-gray-800 p-2 rounded">
                                                                                    <div className="text-gray-600 dark:text-gray-400">Wind</div>
                                                                                    <div className={`font-semibold ${f.type === 'Main' ? 'text-green-800 dark:text-green-200' :
                                                                                        f.type === 'Temporary' ? 'text-purple-800 dark:text-purple-200' :
                                                                                            f.type === 'Becoming' ? 'text-green-800 dark:text-green-200' :
                                                                                                f.type === 'Probability' ? 'text-purple-800 dark:text-purple-200' :
                                                                                                    f.type === 'From' ? 'text-green-800 dark:text-green-200' :
                                                                                                        'text-green-800 dark:text-green-200'
                                                                                        }`}>
                                                                                        {f.wind}
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                            {f.visibility && (
                                                                                <div className="bg-white dark:bg-gray-800 p-2 rounded">
                                                                                    <div className="text-gray-600 dark:text-gray-400">Visibility</div>
                                                                                    <div className={`font-semibold ${f.type === 'Main' ? 'text-green-800 dark:text-green-200' :
                                                                                        f.type === 'Temporary' ? 'text-purple-800 dark:text-purple-200' :
                                                                                            f.type === 'Becoming' ? 'text-green-800 dark:text-green-200' :
                                                                                                f.type === 'Probability' ? 'text-purple-800 dark:text-purple-200' :
                                                                                                    f.type === 'From' ? 'text-green-800 dark:text-green-200' :
                                                                                                        'text-green-800 dark:text-green-200'
                                                                                        }`}>
                                                                                        {f.visibility}
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                            {f.weather && (
                                                                                <div className="bg-white dark:bg-gray-800 p-2 rounded">
                                                                                    <div className="text-gray-600 dark:text-gray-400">Weather</div>
                                                                                    <div className={`font-semibold ${f.type === 'Main' ? 'text-green-800 dark:text-green-200' :
                                                                                        f.type === 'Temporary' ? 'text-purple-800 dark:text-purple-200' :
                                                                                            f.type === 'Becoming' ? 'text-green-800 dark:text-green-200' :
                                                                                                f.type === 'Probability' ? 'text-purple-800 dark:text-purple-200' :
                                                                                                    f.type === 'From' ? 'text-green-800 dark:text-green-200' :
                                                                                                        'text-green-800 dark:text-green-200'
                                                                                        }`}>
                                                                                        {f.weather}
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                            {f.clouds && (
                                                                                <div className="bg-white dark:bg-gray-800 p-2 rounded col-span-3">
                                                                                    <div className="text-gray-600 dark:text-gray-400">Clouds</div>
                                                                                    <div className={`font-semibold ${f.type === 'Main' ? 'text-green-800 dark:text-green-200' :
                                                                                        f.type === 'Temporary' ? 'text-purple-800 dark:text-purple-200' :
                                                                                            f.type === 'Becoming' ? 'text-green-800 dark:text-green-200' :
                                                                                                f.type === 'Probability' ? 'text-purple-800 dark:text-purple-200' :
                                                                                                    f.type === 'From' ? 'text-green-800 dark:text-green-200' :
                                                                                                        'text-green-800 dark:text-green-200'
                                                                                        }`}>
                                                                                        {f.clouds}
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="font-mono text-sm">
                                            {metar && (
                                                <div className="mb-2">
                                                    <span className="font-semibold">METAR</span>: <span className="break-all">{metar}</span>
                                                </div>
                                            )}
                                            {taf && (
                                                <div className="whitespace-pre-line break-words">
                                                    <span className="font-semibold">TAF</span>: {taf.replace(/BECMG/g, '\nBECMG').replace(/FM/g, '\nFM').replace(/TEMPO/g, '\nTEMPO')}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                    {/* DATIS 정보 섹션 */}
                    {showDatis && (
                        <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                            <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center space-x-2">
                                    <h3 className="font-bold text-gray-800 dark:text-gray-200 text-sm">DATIS</h3>
                                    {datisInfo && (
                                        <button
                                            onClick={() => setShowDecoded(!showDecoded)}
                                            className="px-2 py-1 text-xs bg-blue-600 text-white rounded"
                                        >
                                            {showDecoded ? 'RAW' : 'DECODE'}
                                        </button>
                                    )}
                                </div>
                                {zuluTime && <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{zuluTime}</span>}
                            </div>
                            {loadingDatis && <p className="text-center text-sm text-gray-600 dark:text-gray-400">DATIS 정보를 불러오는 중...</p>}
                            {datisError && <p className="text-red-500 dark:text-red-400 text-center text-sm">{datisError}</p>}
                            {datisInfo && (
                                <div className="space-y-2 text-xs bg-gray-100 dark:bg-gray-900/50 p-3 rounded text-gray-800 dark:text-gray-300">
                                    {showDecoded ? (
                                        <div className="space-y-4">
                                            <div>
                                                <h4 className="font-semibold text-blue-600 dark:text-blue-400 mb-2">DATIS Information</h4>
                                                <div className="space-y-2">
                                                    {(() => {
                                                        // DATIS 디코딩 (새로운 모듈 사용)
                                                        const decoded = decodeDatis(datisInfo || '');
                                                        // const formattedDatis = formatDatisInfo(decoded); // Not used in this view anymore
                                                        return (
                                                            <>
                                                                <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded border border-blue-200 dark:border-blue-700">
                                                                    <div className="flex justify-between items-center">
                                                                        <span className="font-bold text-blue-800 dark:text-blue-200">
                                                                            {cityInfo?.icao}
                                                                        </span>
                                                                        {decoded.infoLetter && decoded.infoTime && (
                                                                            <span className="text-sm font-normal text-blue-600 dark:text-blue-300">
                                                                                INFO {decoded.infoLetter} {decoded.infoTime}Z
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                                    {decoded.wind && (
                                                                        <div className="bg-blue-100 dark:bg-blue-900/20 p-2 rounded">
                                                                            <div className="text-gray-600 dark:text-gray-400">Wind</div>
                                                                            <div className="font-semibold text-blue-800 dark:text-blue-200">{decoded.wind}</div>
                                                                        </div>
                                                                    )}
                                                                    {decoded.visibility && (
                                                                        <div className="bg-blue-100 dark:bg-blue-900/20 p-2 rounded">
                                                                            <div className="text-gray-600 dark:text-gray-400">Visibility</div>
                                                                            <div className="font-semibold text-blue-800 dark:text-blue-200">{decoded.visibility}</div>
                                                                        </div>
                                                                    )}
                                                                    {decoded.temperature && (
                                                                        <div className="bg-blue-100 dark:bg-blue-900/20 p-2 rounded">
                                                                            <div className="text-gray-600 dark:text-gray-400">Temp</div>
                                                                            <div className="font-semibold text-blue-800 dark:text-blue-200">{decoded.temperature}</div>
                                                                        </div>
                                                                    )}
                                                                    {decoded.dewpoint && (
                                                                        <div className="bg-blue-100 dark:bg-blue-900/20 p-2 rounded">
                                                                            <div className="text-gray-600 dark:text-gray-400">Dew</div>
                                                                            <div className="font-semibold text-blue-800 dark:text-blue-200">{decoded.dewpoint}</div>
                                                                        </div>
                                                                    )}
                                                                    {decoded.altimeter && (
                                                                        <div className="bg-blue-100 dark:bg-blue-900/20 p-2 rounded col-span-2">
                                                                            <div className="text-gray-600 dark:text-gray-400">Altimeter</div>
                                                                            <div className="font-semibold text-blue-800 dark:text-blue-200 text-xs">
                                                                                {decoded.altimeter}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    {decoded.remarks && decoded.remarks.length > 0 && (
                                                                        <div className="bg-gray-100 dark:bg-gray-900/20 p-2 rounded col-span-2">
                                                                            <div className="text-gray-600 dark:text-gray-400">Remarks (RMK)</div>
                                                                            <div className="font-semibold text-gray-800 dark:text-gray-200 text-xs whitespace-pre-line">
                                                                                {decoded.remarks.join('\n')}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    {decoded.clouds && (
                                                                        <div className="bg-blue-100 dark:bg-blue-900/20 p-2 rounded col-span-2">
                                                                            <div className="text-gray-600 dark:text-gray-400">Clouds</div>
                                                                            <div className="font-semibold text-blue-800 dark:text-blue-200 text-xs">{decoded.clouds.join(', ')}</div>
                                                                        </div>
                                                                    )}
                                                                    {(decoded.departures?.length > 0 || decoded.approaches?.length > 0) && (
                                                                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded border border-indigo-200 dark:border-indigo-700 col-span-2">
                                                                            <div className="text-gray-600 dark:text-gray-400">Runways</div>
                                                                            <div className="text-xs text-indigo-800 dark:text-indigo-200 font-semibold space-y-1">
                                                                                {decoded.departures?.length > 0 && (
                                                                                    <div>Departure: {decoded.departures.join(', ')}</div>
                                                                                )}
                                                                                {decoded.approaches?.length > 0 && (
                                                                                    <div>Approach: {decoded.approaches.join(', ')}</div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    {(decoded.notams?.length > 0 || decoded.closedRunways?.length > 0 || decoded.closedTaxiways?.length > 0) && (
                                                                        <div className="bg-orange-50 dark:bg-orange-900/20 p-2 rounded border border-orange-200 dark:border-orange-700 col-span-2">
                                                                            <div className="text-gray-600 dark:text-gray-400">NOTAMs (Notices to Airmen)</div>
                                                                            <ul className="list-disc ml-4 space-y-1 text-orange-800 dark:text-orange-200">
                                                                                {[
                                                                                    ...(decoded.closedRunways || []),
                                                                                    ...(decoded.closedTaxiways || []),
                                                                                    ...(decoded.notams || [])
                                                                                ].map((notam, i) => (
                                                                                    <li key={i}>{notam}</li>
                                                                                ))}
                                                                            </ul>
                                                                        </div>
                                                                    )}
                                                                    {decoded.advisories.length > 0 && (
                                                                        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded border border-yellow-200 dark:border-yellow-700 col-span-2">
                                                                            <div className="text-gray-600 dark:text-gray-400">Advisories (Operational Information)</div>
                                                                            <ul className="list-disc ml-4 space-y-1 text-yellow-800 dark:text-yellow-200">
                                                                                {decoded.advisories.map((a, i) => (
                                                                                    <li key={i}>{a}</li>
                                                                                ))}
                                                                            </ul>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="whitespace-pre-line font-mono text-sm">{datisInfo}</div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {showWeather && (
                        <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 relative">
                            {loadingWeather && <p className="text-center text-gray-600 dark:text-gray-400">날씨 정보를 불러오는 중...</p>}
                            {weatherError && <p className="text-red-500 dark:text-red-400 text-center">{weatherError}</p>}
                            {weather && (
                                <>
                                    <div className="space-y-4">
                                        {/* 현재 날씨 정보 - 가운데 정렬 */}
                                        <div className="flex items-center justify-center text-center space-x-2 sm:space-x-4">
                                            <WeatherIcon
                                                icon={weather.weather[0].icon}
                                                size="@4x"
                                                className="w-20 h-20 sm:w-32 sm:h-32 -my-2 sm:-my-4"
                                            />
                                            <div className="text-center">
                                                <p className="text-3xl sm:text-5xl font-bold dark:text-gray-100">{Math.round(weather.main.temp)}°C</p>
                                                <p className="text-sm sm:text-lg text-gray-600 dark:text-gray-400 capitalize">{weather.weather[0].description}</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-sm">
                                            <div className="bg-gray-200 dark:bg-gray-900/50 p-2 rounded-lg">
                                                <p className="font-semibold text-gray-500 dark:text-gray-400">체감</p>
                                                <p className="text-lg font-bold dark:text-gray-200">{Math.round(weather.main.feels_like)}°C</p>
                                            </div>
                                            <div className="bg-gray-200 dark:bg-gray-900/50 p-2 rounded-lg">
                                                <p className="font-semibold text-gray-500 dark:text-gray-400">최고/최저</p>
                                                <p className="text-lg font-bold dark:text-gray-200">
                                                    {forecast && forecast.length > 0
                                                        ? `${Math.round(forecast[0].maxTemp)}°/${Math.round(forecast[0].minTemp)}°`
                                                        : `${Math.round(weather.main.temp_max)}°/${Math.round(weather.main.temp_min)}°`
                                                    }
                                                </p>
                                            </div>
                                            <div className="bg-gray-200 dark:bg-gray-900/50 p-2 rounded-lg">
                                                <p className="font-semibold text-gray-500 dark:text-gray-400">습도</p>
                                                <p className="text-lg font-bold dark:text-gray-200">{weather.main.humidity}%</p>
                                            </div>
                                            <div className="bg-gray-200 dark:bg-gray-900/50 p-2 rounded-lg">
                                                <p className="font-semibold text-gray-500 dark:text-gray-400">AQI</p>
                                                <p className={`text-lg font-bold ${airPollution?.aqiInfo?.color === 'green' ? 'text-green-600 dark:text-green-400' :
                                                    airPollution?.aqiInfo?.color === 'yellow' ? 'text-yellow-600 dark:text-yellow-400' :
                                                        airPollution?.aqiInfo?.color === 'orange' ? 'text-orange-600 dark:text-orange-400' :
                                                            airPollution?.aqiInfo?.color === 'red' ? 'text-red-600 dark:text-red-400' :
                                                                airPollution?.aqiInfo?.color === 'purple' ? 'text-purple-600 dark:text-purple-400' :
                                                                    airPollution?.aqiInfo?.color === 'brown' ? 'text-amber-800 dark:text-amber-600' :
                                                                        'text-gray-600 dark:text-gray-400'
                                                    }`}>
                                                    {airPollution ? (
                                                        <>
                                                            {airPollution.aqiInfo.description}
                                                            <span className="text-xs opacity-75">({airPollution.internationalAQI || airPollution.aqiInfo.value})</span>
                                                        </>
                                                    ) : '--'}
                                                </p>
                                                {airPollution && (
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                        PM2.5: {airPollution.components.pm2_5} | PM10: {airPollution.components.pm10}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {/* 일출/일몰 시간 - 좌측 상단 세로로 배치 */}
                                        <div className="absolute top-2 left-2 flex flex-col space-y-1 text-xs">
                                            <div className="flex items-center space-x-1 bg-orange-100 dark:bg-orange-900/30 px-2 py-1 rounded-md border border-orange-200 dark:border-orange-800">
                                                <HeroSunIcon className="w-3 h-3 text-orange-500" />
                                                <span className="text-orange-700 dark:text-orange-300 font-medium">
                                                    {loadingSun ? '로딩중...' : (sunTimes.sunrise || '--:--')}
                                                </span>
                                            </div>
                                            <div className="flex items-center space-x-1 bg-purple-100 dark:bg-purple-900/30 px-2 py-1 rounded-md border border-purple-200 dark:border-purple-800">
                                                <HeroSunIcon className="w-3 h-3 text-purple-500" />
                                                <span className="text-purple-700 dark:text-purple-300 font-medium">
                                                    {loadingSun ? '로딩중...' : (sunTimes.sunset || '--:--')}
                                                </span>
                                            </div>
                                        </div>

                                    </div>

                                    {(loadingForecast || forecastError || threeHourForecast) && (
                                        <div className="hidden md:block mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                                            {loadingForecast && <p className="text-xs text-gray-500 dark:text-gray-400 text-center">시간별 예보 로딩 중...</p>}
                                            {forecastError && !loadingForecast && <p className="text-xs text-red-500 dark:text-red-400 text-center">{forecastError}</p>}
                                            {threeHourForecast && (
                                                <div className="flex justify-around text-center">
                                                    {threeHourForecast.map((item, index) => (
                                                        <div key={index} className="flex flex-col items-center space-y-1">
                                                            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">{item.time}</p>
                                                            <WeatherIcon
                                                                icon={item.icon}
                                                                className="w-8 h-8"
                                                            />
                                                            <p className="text-xs text-gray-800 dark:text-gray-200 font-bold">{item.temp}°</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {(loadingForecast || forecastError || forecast) && (
                                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                                            {loadingForecast && <p className="text-xs text-gray-500 dark:text-gray-400 text-center">주간 예보 로딩 중...</p>}
                                            {forecastError && !loadingForecast && <p className="text-xs text-red-500 dark:text-red-400 text-center">{forecastError}</p>}
                                            {forecast && (
                                                <div className="flex justify-around text-center">
                                                    {forecast.map(day => (
                                                        <div key={day.date} className="flex flex-col items-center space-y-1">
                                                            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">{day.day}</p>
                                                            <WeatherIcon
                                                                icon={day.icon}
                                                                className="w-8 h-8"
                                                            />
                                                            <p className="text-xs text-gray-800 dark:text-gray-200">
                                                                <span className="font-bold">{day.maxTemp}°</span>
                                                                <span className="text-gray-500 dark:text-gray-400 ml-1">{day.minTemp}°</span>
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {getCurrencyFromCode(city) && getCurrencyFromCode(city) !== 'KRW' && (
                                        <div
                                            className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 text-center cursor-pointer group hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-lg p-2 transition-all"
                                            onClick={async () => {
                                                setShowChartModal(true);
                                                setLoadingChart(true);
                                                setChartError(null);
                                                try {
                                                    const targetCurrency = getCurrencyFromCode(city);
                                                    if (targetCurrency) {
                                                        const res = await fetch(`/api/exchange?type=chart&currency=${targetCurrency}`);
                                                        const json = await res.json();
                                                        if (res.ok && json.success && json.data) {
                                                            setChartData(json.data);
                                                        } else {
                                                            throw new Error(json.error || '차트 데이터를 불러오지 못했습니다.');
                                                        }
                                                    }
                                                } catch (err: any) {
                                                    setChartError('1개월 변동 추이를 가져오는데 실패했습니다.');
                                                } finally {
                                                    setLoadingChart(false);
                                                }
                                            }}
                                            title="1개월 환율 변동 추이 보기"
                                        >
                                            {loadingExchangeRate ? (
                                                <div className="flex items-center justify-center space-x-2">
                                                    <div className="w-3 h-3 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                                                    <span className="text-sm text-gray-500 font-medium">환율 정보 로딩 중...</span>
                                                </div>
                                            ) : exchangeRateError ? (
                                                <p className="text-sm text-red-500 dark:text-red-400">{exchangeRateError}</p>
                                            ) : (
                                                <div className="flex flex-col items-center space-y-1">
                                                    {exchangeRate && (
                                                        <p className="text-sm text-gray-700 dark:text-gray-300 font-semibold group-hover:text-blue-500 transition-colors">
                                                            {exchangeRate}
                                                        </p>
                                                    )}
                                                    {usdExchangeRate && (
                                                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium group-hover:text-green-500 transition-colors">
                                                            {usdExchangeRate}
                                                        </p>
                                                    )}
                                                    <p className="text-[10px] text-gray-400 hidden group-hover:block transition-all mt-1">
                                                        👉 클릭하여 1개월 변동 차트 보기
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    <div>
                        {sortedFlights.length > 0 ? (
                            <ul className="space-y-3">
                                {sortedFlights.map(flight => (
                                    <li
                                        key={flight.id}
                                        className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer"
                                        onClick={() => onFlightClick(flight)}
                                    >
                                        <p className="font-semibold text-gray-800 dark:text-gray-200">{flight.date}</p>
                                        <p className="text-base text-gray-600 dark:text-gray-400">{flight.flightNumber}편: {flight.route?.replace('/', ' → ')}</p>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-gray-500 dark:text-gray-400 text-center py-8">관련 비행 기록이 없습니다.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* 환율 변동 추이 모달 */}
            <ExchangeChartModal
                isOpen={showChartModal}
                onClose={() => setShowChartModal(false)}
                city={city || ''}
                currency={getCurrencyFromCode(city || '') || ''}
                chartData={chartData}
                loading={loadingChart}
                error={chartError}
            />
        </div>
    );
};

export default CityScheduleModal;
