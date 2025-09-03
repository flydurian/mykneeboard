import React, { useState, useEffect, useRef } from 'react';
import { Flight } from '../../types';
import { XIcon, InfoIcon, MetarIcon } from '../icons';
import { networkDetector } from '../../utils/networkDetector';
import { getICAO, getCityName, getCurrency, getExchangeRateUrl, getUTCOffset, getCityInfo } from '../../utils/cityData';
import { 
    SunIcon as HeroSunIcon,
    MoonIcon as HeroMoonIcon,
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
}



const CityScheduleModal: React.FC<CityScheduleModalProps> = ({ isOpen, onClose, city, flights, onFlightClick }) => {
    const [showWeather, setShowWeather] = useState(false);
    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [loadingWeather, setLoadingWeather] = useState(false);
    const [weatherError, setWeatherError] = useState<string | null>(null);
    const [exchangeRate, setExchangeRate] = useState<string | null>(null);
    const [loadingExchangeRate, setLoadingExchangeRate] = useState(false);
    const [exchangeRateError, setExchangeRateError] = useState<string | null>(null);
    const [forecast, setForecast] = useState<any[] | null>(null);
    const [threeHourForecast, setThreeHourForecast] = useState<any[] | null>(null);
    const [loadingForecast, setLoadingForecast] = useState(false);
    const [forecastError, setForecastError] = useState<string | null>(null);
    const [showMetar, setShowMetar] = useState(false);
    const [metar, setMetar] = useState<string | null>(null);
    const [taf, setTaf] = useState<string | null>(null);
    const [loadingMetarTaf, setLoadingMetarTaf] = useState(false);
    const [metarTafError, setMetarTafError] = useState<string | null>(null);
    const [showDecoded, setShowDecoded] = useState(false);
    const [zuluTime, setZuluTime] = useState('');
    const [showScrollbar, setShowScrollbar] = useState(false);
    const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // METAR 해석 함수
    const decodeMetar = (metarText: string) => {
        const parts = metarText.split(' ');
        let wind = '';
        let visibility = '';
        let clouds = '';
        let temp = '';
        let pressure = '';
        
        parts.forEach((part) => {
            if (/^\d{3}\d{2,3}KT$/.test(part)) {
                const direction = part.substring(0, 3);
                const speed = part.substring(3, part.length - 2);
                wind = `${direction}° ${speed}kt`;
            } else if (/^\d{4}$/.test(part)) {
                if (part === '9999') {
                    visibility = '10km+';
                } else {
                    visibility = `${part}m`;
                }
            } else if (/^(FEW|SCT|BKN|OVC)\d{3}$/.test(part)) {
                const type = part.substring(0, 3);
                const height = parseInt(part.substring(3)) * 100;
                const typeMap: { [key: string]: string } = {
                    'FEW': 'Few',
                    'SCT': 'Scattered',
                    'BKN': 'Broken',
                    'OVC': 'Overcast'
                };
                clouds += `${typeMap[type]} ${height}ft `;
            } else if (/^\d{2}\/\d{2}$/.test(part)) {
                const tempVal = part.split('/')[0];
                const dewVal = part.split('/')[1];
                temp = `${tempVal}°C / ${dewVal}°C`;
            } else if (/^Q\d{4}$/.test(part)) {
                pressure = `${part.substring(1)} hPa`;
            }
        });
        
        return { wind, visibility, clouds: clouds.trim(), temp, pressure };
    };

    // TAF 해석 함수
    const decodeTaf = (tafText: string) => {
        const parts = tafText.split(' ');
        let wind = '';
        let visibility = '';
        let clouds = '';
        let maxTemp = '';
        let minTemp = '';
        
        parts.forEach((part, index) => {
            if (/^\d{3}\d{2,3}KT$/.test(part)) {
                const direction = part.substring(0, 3);
                const speed = part.substring(3, part.length - 2);
                wind = `${direction}° ${speed}kt`;
            } else if (/^\d{4}$/.test(part)) {
                if (part === '9999') {
                    visibility = '10km+';
                } else {
                    visibility = `${part}m`;
                }
            } else if (/^(FEW|SCT|BKN|OVC)\d{3}$/.test(part)) {
                const type = part.substring(0, 3);
                const height = parseInt(part.substring(3)) * 100;
                const typeMap: { [key: string]: string } = {
                    'FEW': 'Few',
                    'SCT': 'Scattered',
                    'BKN': 'Broken',
                    'OVC': 'Overcast'
                };
                clouds += `${typeMap[type]} ${height}ft `;
            } else if (/^TX\d{2}\/\d{4}Z$/.test(part)) {
                const temp = part.substring(2, 4);
                const day = part.substring(5, 7);
                const hour = part.substring(7, 9);
                maxTemp = `${temp}°C (${day} ${hour}00)`;
            } else if (/^TN\d{2}\/\d{4}Z$/.test(part)) {
                const temp = part.substring(2, 4);
                const day = part.substring(5, 7);
                const hour = part.substring(7, 9);
                minTemp = `${temp}°C (${day} ${hour}00)`;
            }
        });
        
        return { wind, visibility, clouds: clouds.trim(), maxTemp, minTemp };
    };

    // 일출/일몰 시간을 현지시간으로 변환하는 함수
    const getLocalSunTime = (timestamp: number, cityCode: string) => {
        try {
            const cityInfo = getCityInfo(cityCode);
            if (!cityInfo) return null;
            
            // UTC 시간을 해당 도시의 현지시간으로 변환
            const utcDate = new Date(timestamp * 1000);
            const localDate = new Date(utcDate.toLocaleString("en-US", { timeZone: cityInfo.timezone }));
            
            return localDate.toLocaleTimeString('ko-KR', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false 
            });
        } catch (error) {
            console.error('현지시간 변환 오류:', error);
            return null;
        }
    };

    const WeatherIcon = ({ icon, className, size = '' }: { icon: string; className?: string; size?: '' | '@2x' | '@4x' }) => {
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

    const API_KEY = '0bd6961a7147dd577607789285c3a30c';
    const CHECKWX_API_KEY = "0b2ff44a840748d48e8edb039bb181a1";

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
                    // 먼저 로컬 스토리지에서 확인
                    const cachedWeather = localStorage.getItem(`weather_${city}`);
                    if (cachedWeather) {
                        const { data, timestamp } = JSON.parse(cachedWeather);
                        // 30분 이내 데이터면 캐시 사용
                        if (Date.now() - timestamp < 30 * 60 * 1000) {
                            setWeather(data);
                            setLoadingWeather(false);
                            return;
                        }
                    }

                    // 온라인 상태에서만 API 호출
                    if (networkDetector.getStatus().isOnline) {
                        const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${cityName}&appid=${API_KEY}&units=metric`);
                        if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(errorData.message || '날씨 정보를 가져올 수 없습니다.');
                        }
                        const data = await response.json();
                        setWeather(data);
                        
                        // 로컬 스토리지에 저장
                        localStorage.setItem(`weather_${city}`, JSON.stringify({
                            data,
                            timestamp: Date.now()
                        }));
                    } else {
                        // 오프라인 상태에서 캐시된 데이터가 있으면 사용
                        if (cachedWeather) {
                            const { data } = JSON.parse(cachedWeather);
                            setWeather(data);
                            setWeatherError('오프라인 모드: 캐시된 데이터를 표시합니다.');
                        } else {
                            setWeatherError('오프라인 상태에서 캐시된 날씨 정보가 없습니다.');
                        }
                    }
                } catch (err) {
                    // 오프라인 상태에서 캐시된 데이터가 있으면 사용
                    const cachedWeather = localStorage.getItem(`weather_${city}`);
                    if (cachedWeather && !networkDetector.getStatus().isOnline) {
                        const { data } = JSON.parse(cachedWeather);
                        setWeather(data);
                        setWeatherError('오프라인 모드: 캐시된 데이터를 표시합니다.');
                    } else {
                        setWeatherError('날씨 정보를 불러오는 데 실패했습니다.');
                    }
                } finally {
                    setLoadingWeather(false);
                }
            };
            fetchWeather();
        }
    }, [showWeather, city, weather]);

    useEffect(() => {
        if (showWeather && city && !forecast && !forecastError) {
            const fetchForecast = async () => {
                setLoadingForecast(true);
                setForecastError(null);
                const cityName = getCityNameFromCode(city);
                
                try {
                    // 먼저 로컬 스토리지에서 확인
                    const cachedForecast = localStorage.getItem(`forecast_${city}`);
                    if (cachedForecast) {
                        const { data, timestamp } = JSON.parse(cachedForecast);
                        // 30분 이내 데이터면 캐시 사용
                        if (Date.now() - timestamp < 30 * 60 * 1000) {
                            // 캐시된 데이터를 현지시간으로 다시 계산
                            const cityInfo = getCityInfo(city);
                            if (data.next24hForecast && cityInfo) {
                                const updatedNext24hForecast = data.next24hForecast.map((item: any) => {
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
                                setThreeHourForecast(data.next24hForecast);
                            }
                            setForecast(data.processedForecast);
                            setLoadingForecast(false);
                            return;
                        }
                    }

                    // 온라인 상태에서만 API 호출
                    if (networkDetector.getStatus().isOnline) {
                        const response = await fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${cityName}&appid=${API_KEY}&units=metric`);
                        if (!response.ok) throw new Error('예보 정보를 가져올 수 없습니다.');
                        const data = await response.json();

                        const next24hForecast = data.list.slice(0, 8).map((item: any) => {
                            const cityInfo = getCityInfo(city);
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

                        const dailyData: { [key: string]: { temps: number[], icon?: string } } = {};
                        const today = new Date().toISOString().split('T')[0];

                        data.list.forEach((item: any) => {
                            const date = item.dt_txt.split(' ')[0];
                            if (date === today) return; // 오늘 데이터는 제외

                            if (!dailyData[date]) {
                                dailyData[date] = { temps: [] };
                            }
                            dailyData[date].temps.push(item.main.temp);
                            if (item.dt_txt.includes("12:00:00")) {
                                dailyData[date].icon = item.weather[0].icon;
                            }
                        });

                        const processedForecast = Object.keys(dailyData).slice(0, 5).map(date => {
                            const dayData = dailyData[date];
                            return {
                                date,
                                day: new Date(date).toLocaleDateString('ko-KR', { weekday: 'short' }),
                                minTemp: Math.round(Math.min(...dayData.temps)),
                                maxTemp: Math.round(Math.max(...dayData.temps)),
                                icon: dayData.icon || data.list.find((item: any) => item.dt_txt.startsWith(date)).weather[0].icon,
                            };
                        });
                        
                        setForecast(processedForecast);

                        // 로컬 스토리지에 저장
                        localStorage.setItem(`forecast_${city}`, JSON.stringify({
                            data: {
                                processedForecast,
                                next24hForecast
                            },
                            timestamp: Date.now()
                        }));
                    } else {
                        // 오프라인 상태에서 캐시된 데이터가 있으면 사용
                        if (cachedForecast) {
                            const { data } = JSON.parse(cachedForecast);
                            // 캐시된 데이터를 현지시간으로 다시 계산
                            const cityInfo = getCityInfo(city);
                            if (data.next24hForecast && cityInfo) {
                                const updatedNext24hForecast = data.next24hForecast.map((item: any) => {
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
                                setThreeHourForecast(data.next24hForecast);
                            }
                            setForecast(data.processedForecast);
                            setForecastError('오프라인 모드: 캐시된 데이터를 표시합니다.');
                        } else {
                            setForecastError('오프라인 상태에서 캐시된 예보 정보가 없습니다.');
                        }
                    }

                } catch (err) {
                    // 오프라인 상태에서 캐시된 데이터가 있으면 사용
                    const cachedForecast = localStorage.getItem(`forecast_${city}`);
                    if (cachedForecast && !networkDetector.getStatus().isOnline) {
                        const { data } = JSON.parse(cachedForecast);
                        // 캐시된 데이터를 현지시간으로 다시 계산
                        const cityInfo = getCityInfo(city);
                        if (data.next24hForecast && cityInfo) {
                            const updatedNext24hForecast = data.next24hForecast.map((item: any) => {
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
                            setThreeHourForecast(data.next24hForecast);
                        }
                        setForecast(data.processedForecast);
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
                    // 먼저 로컬 스토리지에서 확인
                    const cachedMetar = localStorage.getItem(`metar_${city}`);
                    const cachedTaf = localStorage.getItem(`taf_${city}`);
                    
                    if (cachedMetar && cachedTaf) {
                        const { data: metarData, timestamp: metarTimestamp } = JSON.parse(cachedMetar);
                        const { data: tafData, timestamp: tafTimestamp } = JSON.parse(cachedTaf);
                        
                        // 15분 이내 데이터면 캐시 사용
                        if (Date.now() - metarTimestamp < 15 * 60 * 1000 && 
                            Date.now() - tafTimestamp < 15 * 60 * 1000) {
                            setMetar(metarData);
                            setTaf(tafData);
                            setLoadingMetarTaf(false);
                            return;
                        }
                    }

                    // 온라인 상태에서만 API 호출
                    if (networkDetector.getStatus().isOnline) {
                        const metarResponse = await fetch(`https://api.checkwx.com/metar/${icaoCode}/decoded`, {
                            headers: { 'X-API-Key': CHECKWX_API_KEY }
                        });
                        if (!metarResponse.ok) throw new Error('METAR 정보를 가져올 수 없습니다.');
                        const metarData = await metarResponse.json();
                        const metarText = metarData.data.length > 0 ? metarData.data[0].raw_text : 'METAR 정보 없음';
                        setMetar(metarText);
                        
                        // 로컬 스토리지에 저장
                        localStorage.setItem(`metar_${city}`, JSON.stringify({
                            data: metarText,
                            timestamp: Date.now()
                        }));

                        const tafResponse = await fetch(`https://api.checkwx.com/taf/${icaoCode}/decoded`, {
                            headers: { 'X-API-Key': CHECKWX_API_KEY }
                        });
                        if (!tafResponse.ok) throw new Error('TAF 정보를 가져올 수 없습니다.');
                        const tafData = await tafResponse.json();
                        const tafText = tafData.data.length > 0 ? tafData.data[0].raw_text : 'TAF 정보 없음';
                        setTaf(tafText);
                        
                        // 로컬 스토리지에 저장
                        localStorage.setItem(`taf_${city}`, JSON.stringify({
                            data: tafText,
                            timestamp: Date.now()
                        }));
                    } else {
                        // 오프라인 상태에서 캐시된 데이터가 있으면 사용
                        if (cachedMetar && cachedTaf) {
                            const { data: metarData } = JSON.parse(cachedMetar);
                            const { data: tafData } = JSON.parse(cachedTaf);
                            setMetar(metarData);
                            setTaf(tafData);
                            setMetarTafError('오프라인 모드: 캐시된 데이터를 표시합니다.');
                        } else {
                            setMetarTafError('오프라인 상태에서 캐시된 METAR/TAF 정보가 없습니다.');
                        }
                    }
                } catch (err) {
                    // 오프라인 상태에서 캐시된 데이터가 있으면 사용
                    const cachedMetar = localStorage.getItem(`metar_${city}`);
                    const cachedTaf = localStorage.getItem(`taf_${city}`);
                    if (cachedMetar && cachedTaf && !networkDetector.getStatus().isOnline) {
                        const { data: metarData } = JSON.parse(cachedMetar);
                        const { data: tafData } = JSON.parse(cachedTaf);
                        setMetar(metarData);
                        setTaf(tafData);
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

    useEffect(() => {
        if (showWeather && city && !exchangeRate && !exchangeRateError) {
            const fetchExchangeRate = async () => {
                const targetCurrency = getCurrencyFromCode(city);
                if (!targetCurrency || targetCurrency === 'KRW') return;

                setLoadingExchangeRate(true);
                setExchangeRateError(null);
                
                try {
                    // 먼저 로컬 스토리지에서 확인
                    const cachedExchange = localStorage.getItem(`exchange_${city}`);
                    if (cachedExchange) {
                        const { data, timestamp } = JSON.parse(cachedExchange);
                        // 1시간 이내 데이터면 캐시 사용
                        if (Date.now() - timestamp < 60 * 60 * 1000) {
                            setExchangeRate(data);
                            setLoadingExchangeRate(false);
                            return;
                        }
                    }

                    // 온라인 상태에서만 API 호출
                    if (networkDetector.getStatus().isOnline) {
                        const response = await fetch(getExchangeRateUrl(targetCurrency));
                        if (!response.ok) throw new Error('환율 정보를 가져올 수 없습니다.');
                        const data = await response.json();
                        if (data.result === 'success') {
                            const exchangeRateText = `1 ${targetCurrency} ≈ ${Math.round(data.conversion_rate).toLocaleString('ko-KR')} KRW`;
                            setExchangeRate(exchangeRateText);
                            
                            // 로컬 스토리지에 저장
                            localStorage.setItem(`exchange_${city}`, JSON.stringify({
                                data: exchangeRateText,
                                timestamp: Date.now()
                            }));
                        } else {
                            throw new Error(data['error-type'] || '환율 API 오류');
                        }
                    } else {
                        // 오프라인 상태에서 캐시된 데이터가 있으면 사용
                        if (cachedExchange) {
                            const { data } = JSON.parse(cachedExchange);
                            setExchangeRate(data);
                            setExchangeRateError('오프라인 모드: 캐시된 데이터를 표시합니다.');
                        } else {
                            setExchangeRateError('오프라인 상태에서 캐시된 환율 정보가 없습니다.');
                        }
                    }
                } catch (err) {
                    // 오프라인 상태에서 캐시된 데이터가 있으면 사용
                    const cachedExchange = localStorage.getItem(`exchange_${city}`);
                    if (cachedExchange && !networkDetector.getStatus().isOnline) {
                        const { data } = JSON.parse(cachedExchange);
                        setExchangeRate(data);
                        setExchangeRateError('오프라인 모드: 캐시된 데이터를 표시합니다.');
                    } else {
                        setExchangeRateError('환율 정보 로딩 실패');
                        console.error(err);
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
            setExchangeRateError(null);
            setForecast(null);
            setForecastError(null);
            setThreeHourForecast(null);
            setShowMetar(false);
            setMetar(null);
            setTaf(null);
            setMetarTafError(null);
        setShowDecoded(false);
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

    const sortedFlights = [...flights].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[90] p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg p-6 relative animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    <XIcon className="w-6 h-6" />
                </button>
                
                <div className="mb-4">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center">
                        <span>{city} 정보 {city ? getUTCOffset(city) || '(UTC)' : '(UTC)'}</span>
                        <button 
                            onClick={() => setShowWeather(!showWeather)} 
                            title="날씨 정보 보기/숨기기" 
                            className="ml-2"
                        >
                            <InfoIcon className="w-5 h-5 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors" />
                        </button>
                        <button
                            onClick={() => setShowMetar(!showMetar)}
                            title="METAR/TAF 정보 보기/숨기기"
                            className="ml-2"
                        >
                            <MetarIcon className="w-5 h-5 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors" />
                        </button>
                    </h2>
                </div>

                <div 
                    className={`max-h-[70vh] overflow-y-auto ${showScrollbar ? 'scrollbar-show' : 'scrollbar-hide'}`}
                    onScroll={handleScroll}
                >
                    {showMetar && (
                        <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                            <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center space-x-2">
                                    <h3 className="font-bold text-gray-800 dark:text-gray-200 text-sm">METAR / TAF</h3>
                                    {(metar || taf) && (
                                        <button
                                            onClick={() => setShowDecoded(!showDecoded)}
                                            className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                                        >
                                            {showDecoded ? 'RAW' : 'DECODE'}
                                        </button>
                                    )}
                                </div>
                                {zuluTime && <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{zuluTime}</span>}
                            </div>
                            {loadingMetarTaf && <p className="text-center text-sm text-gray-600 dark:text-gray-400">METAR/TAF 정보를 불러오는 중...</p>}
                            {metarTafError && <p className="text-red-500 dark:text-red-400 text-center text-sm">{metarTafError}</p>}
                            {(metar || taf) && (
                                <div className="space-y-2 text-xs bg-gray-100 dark:bg-gray-900/50 p-3 rounded text-gray-800 dark:text-gray-300">
                                    {showDecoded ? (
                                        <div className="space-y-4">
                                            {metar && (
                                                <div>
                                                    <h4 className="font-semibold text-blue-600 dark:text-blue-400 mb-2">METAR</h4>
                                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                                        {(() => {
                                                            const decoded = decodeMetar(metar);
                                                            return (
                                                                <>
                                                                    {decoded.wind && (
                                                                        <div className="bg-blue-100 dark:bg-blue-900/20 p-2 rounded">
                                                                            <span className="text-gray-600 dark:text-gray-400">Wind:</span>
                                                                            <span className="ml-1 font-semibold">{decoded.wind}</span>
                                                                        </div>
                                                                    )}
                                                                    {decoded.visibility && (
                                                                        <div className="bg-blue-100 dark:bg-blue-900/20 p-2 rounded">
                                                                            <span className="text-gray-600 dark:text-gray-400">Visibility:</span>
                                                                            <span className="ml-1 font-semibold">{decoded.visibility}</span>
                                                                        </div>
                                                                    )}
                                                                    {decoded.temp && (
                                                                        <div className="bg-blue-100 dark:bg-blue-900/20 p-2 rounded">
                                                                            <span className="text-gray-600 dark:text-gray-400">Temp/Dew:</span>
                                                                            <span className="ml-1 font-semibold">{decoded.temp}</span>
                                                                        </div>
                                                                    )}
                                                                    {decoded.pressure && (
                                                                        <div className="bg-blue-100 dark:bg-blue-900/20 p-2 rounded">
                                                                            <span className="text-gray-600 dark:text-gray-400">Pressure:</span>
                                                                            <span className="ml-1 font-semibold">{decoded.pressure}</span>
                                                                        </div>
                                                                    )}
                                                                    {decoded.clouds && (
                                                                        <div className="bg-blue-100 dark:bg-blue-900/20 p-2 rounded col-span-2">
                                                                            <span className="text-gray-600 dark:text-gray-400">Clouds:</span>
                                                                            <span className="ml-1 font-semibold">{decoded.clouds}</span>
                                                                        </div>
                                                                    )}
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            )}
                                            {taf && (
                                                <div>
                                                    <h4 className="font-semibold text-green-600 dark:text-green-400 mb-2">TAF</h4>
                                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                                        {(() => {
                                                            const decoded = decodeTaf(taf);
                                                            return (
                                                                <>
                                                                    {decoded.wind && (
                                                                        <div className="bg-green-100 dark:bg-green-900/20 p-2 rounded">
                                                                            <span className="text-gray-600 dark:text-gray-400">Wind:</span>
                                                                            <span className="ml-1 font-semibold">{decoded.wind}</span>
                                                                        </div>
                                                                    )}
                                                                    {decoded.visibility && (
                                                                        <div className="bg-green-100 dark:bg-green-900/20 p-2 rounded">
                                                                            <span className="text-gray-600 dark:text-gray-400">Visibility:</span>
                                                                            <span className="ml-1 font-semibold">{decoded.visibility}</span>
                                                                        </div>
                                                                    )}
                                                                    {decoded.maxTemp && (
                                                                        <div className="bg-green-100 dark:bg-green-900/20 p-2 rounded">
                                                                            <span className="text-gray-600 dark:text-gray-400">Max Temp:</span>
                                                                            <span className="ml-1 font-semibold break-words">{decoded.maxTemp}</span>
                                                                        </div>
                                                                    )}
                                                                    {decoded.minTemp && (
                                                                        <div className="bg-green-100 dark:bg-green-900/20 p-2 rounded">
                                                                            <span className="text-gray-600 dark:text-gray-400">Min Temp:</span>
                                                                            <span className="ml-1 font-semibold break-words">{decoded.minTemp}</span>
                                                                        </div>
                                                                    )}
                                                                    {decoded.clouds && (
                                                                        <div className="bg-green-100 dark:bg-green-900/20 p-2 rounded col-span-2">
                                                                            <span className="text-gray-600 dark:text-gray-400">Clouds:</span>
                                                                            <span className="ml-1 font-semibold">{decoded.clouds}</span>
                                                                        </div>
                                                                    )}

                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="font-mono text-base">
                                            {metar && (
                                                <div>
                                                    <span className="font-semibold">METAR:</span>
                                                    <br />
                                                    <span className="break-all">{metar}</span>
                                                </div>
                                            )}
                                            {taf && (
                                                <div className="mt-3">
                                                    <span className="font-semibold">TAF:</span>
                                                    <br />
                                                    <span className="break-all whitespace-pre-line">
                                                        {taf.replace(/BECMG/g, '\nBECMG').replace(/FM/g, '\nFM').replace(/TEMPO/g, '\nTEMPO')}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                    {showWeather && (
                        <div className="mb-4 p-4 bg-gray-100 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 relative">
                            {loadingWeather && <p className="text-center text-gray-600 dark:text-gray-400">날씨 정보를 불러오는 중...</p>}
                            {weatherError && <p className="text-red-500 dark:text-red-400 text-center">{weatherError}</p>}
                            {weather && (
                                <>
                                    <div className="space-y-4">
                                        <div className={`flex items-center text-center space-x-2 sm:space-x-4 ${window.innerWidth >= 400 ? 'justify-center' : 'justify-end'}`}>
                                            <WeatherIcon 
                                                icon={weather.weather[0].icon}
                                                size="@4x"
                                                className="w-20 h-20 sm:w-32 sm:h-32 -my-2 sm:-my-4"
                                            />
                                            <div className={`${window.innerWidth >= 400 ? 'text-center' : 'text-right'}`}>
                                                <p className="text-3xl sm:text-5xl font-bold dark:text-gray-100">{Math.round(weather.main.temp)}°C</p>
                                                <p className="text-sm sm:text-lg text-gray-600 dark:text-gray-400 capitalize">{weather.weather[0].description}</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 text-center text-sm">
                                            <div className="bg-gray-200 dark:bg-gray-900/50 p-2 rounded-lg">
                                                <p className="font-semibold text-gray-500 dark:text-gray-400">체감</p>
                                                <p className="text-lg font-bold dark:text-gray-200">{Math.round(weather.main.feels_like)}°C</p>
                                            </div>
                                            <div className="bg-gray-200 dark:bg-gray-900/50 p-2 rounded-lg">
                                                <p className="font-semibold text-gray-500 dark:text-gray-400">최저/최고</p>
                                                <p className="text-lg font-bold dark:text-gray-200">{Math.round(weather.main.temp_min)}°/{Math.round(weather.main.temp_max)}°</p>
                                            </div>
                                            <div className="bg-gray-200 dark:bg-gray-900/50 p-2 rounded-lg">
                                                <p className="font-semibold text-gray-500 dark:text-gray-400">습도</p>
                                                <p className="text-lg font-bold dark:text-gray-200">{weather.main.humidity}%</p>
                                            </div>
                                        </div>
                                        
                                        {/* 일출/일몰 시간 - 좌측 상단 세로로 배치 */}
                                        <div className="absolute top-2 left-2 flex flex-col space-y-1 text-xs">
                                            <div className="flex items-center space-x-1 bg-orange-100 dark:bg-orange-900/30 px-2 py-1 rounded-md border border-orange-200 dark:border-orange-800">
                                                <HeroSunIcon className="w-3 h-3 text-orange-500" />
                                                <span className="text-orange-700 dark:text-orange-300 font-medium">
                                                    {getLocalSunTime(weather.sys.sunrise, city) || 
                                                     new Date(weather.sys.sunrise * 1000).toLocaleTimeString('ko-KR', { 
                                                        hour: '2-digit', 
                                                        minute: '2-digit',
                                                        hour12: false 
                                                    })}
                                                </span>
                                            </div>
                                            <div className="flex items-center space-x-1 bg-purple-100 dark:bg-purple-900/30 px-2 py-1 rounded-md border border-purple-200 dark:border-purple-800">
                                                <HeroMoonIcon className="w-3 h-3 text-purple-500" />
                                                <span className="text-purple-700 dark:text-purple-300 font-medium">
                                                    {getLocalSunTime(weather.sys.sunset, city) || 
                                                     new Date(weather.sys.sunset * 1000).toLocaleTimeString('ko-KR', { 
                                                        hour: '2-digit', 
                                                        minute: '2-digit',
                                                        hour12: false 
                                                    })}
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
                                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 text-center">
                                            {loadingExchangeRate && <p className="text-sm text-gray-500 dark:text-gray-400">환율 정보 로딩 중...</p>}
                                            {exchangeRateError && <p className="text-sm text-red-500 dark:text-red-400">{exchangeRateError}</p>}
                                            {exchangeRate && <p className="text-sm text-gray-700 dark:text-gray-300 font-semibold">{exchangeRate}</p>}
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
                                        className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                        onClick={() => onFlightClick(flight)}
                                    >
                                        <p className="font-semibold text-gray-800 dark:text-gray-200">{flight.date}</p>
                                        <p className="text-base text-gray-600 dark:text-gray-400">{flight.flightNumber}편: {flight.route.replace('/', ' → ')}</p>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-gray-500 dark:text-gray-400 text-center py-8">관련 비행 기록이 없습니다.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CityScheduleModal;
