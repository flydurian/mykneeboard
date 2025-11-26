// ============================================================================
// 도시 정보 데이터 구조 (압축된 형태)
// ============================================================================

export interface CityInfo {
  code: string;           // 공항 코드 (예: ICN, JFK)
  icao: string;          // ICAO 코드 (예: RKSI, KJFK)
  name: string;          // 도시 이름 (예: Incheon, New York)
  timezone: string;      // IANA 타임존 (예: Asia/Seoul, America/New_York)
  currency: string;      // 통화 코드 (예: KRW, USD)
  country: string;       // 국가 이름
  lat?: number;          // 위도 (선택적)
  lon?: number;          // 경도 (선택적)
  openWeatherId?: number; // OpenWeatherMap 도시 ID (선택적)
}

// ============================================================================
// 압축된 공항 데이터 (코드, ICAO, 이름, 타임존, 통화, 국가, 위도, 경도, OpenWeather ID)
// ============================================================================

const COMPRESSED_CITY_DATA: [string, string, string, string, string, string, number, number, number][] = [
  // 한국
  ['ICN', 'RKSI', 'Incheon', 'Asia/Seoul', 'KRW', 'South Korea', 37.4602, 126.4407, 1843564],
  ['GMP', 'RKSS', 'Seoul', 'Asia/Seoul', 'KRW', 'South Korea', 37.5583, 126.7906, 1835848],
  ['PUS', 'RKPK', 'Busan', 'Asia/Seoul', 'KRW', 'South Korea', 35.1796, 128.9382, 1838519],
  ['CJU', 'RKPC', 'Jeju', 'Asia/Seoul', 'KRW', 'South Korea', 33.5120, 126.4929, 1846266],
  ['CJJ', 'RKTU', 'Cheongju', 'Asia/Seoul', 'KRW', 'South Korea', 36.7166, 127.4990, 1845604],
  ['TAE', 'RKTN', 'Daegu', 'Asia/Seoul', 'KRW', 'South Korea', 35.8969, 128.6553, 1835329],
  ['RSU', 'RKJY', 'Yeosu', 'Asia/Seoul', 'KRW', 'South Korea', 34.8423, 127.6169, 1832508],
  ['WJU', 'RKNW', 'Wonju', 'Asia/Seoul', 'KRW', 'South Korea', 37.4416, 127.9639, 1833108],
  ['YNY', 'RKNY', 'Yangyang', 'Asia/Seoul', 'KRW', 'South Korea', 38.0613, 128.6692, 1835848],
  ['HIN', 'RKPS', 'Sacheon', 'Asia/Seoul', 'KRW', 'South Korea', 35.0885, 128.0704, 1838519],
  ['KPO', 'RKTH', 'Pohang', 'Asia/Seoul', 'KRW', 'South Korea', 35.9879, 129.4205, 1838519],
  ['MWX', 'RKJB', 'Muan', 'Asia/Seoul', 'KRW', 'South Korea', 34.9914, 126.3828, 1841610],
  ['KWJ', 'RKJJ', 'Gwangju', 'Asia/Seoul', 'KRW', 'South Korea', 35.1264, 126.8089, 1841610],

  // 미국
  ['JFK', 'KJFK', 'New York', 'America/New_York', 'USD', 'United States', 40.6413, -73.7781, 5128581],
  ['LAX', 'KLAX', 'Los Angeles', 'America/Los_Angeles', 'USD', 'United States', 33.9425, -118.4081, 5368361],
  ['SFO', 'KSFO', 'San Francisco', 'America/Los_Angeles', 'USD', 'United States', 37.6213, -122.3790, 5391959],
  ['SEA', 'KSEA', 'Seattle', 'America/Los_Angeles', 'USD', 'United States', 47.4502, -122.3088, 5809844],
  ['ATL', 'KATL', 'Atlanta', 'America/New_York', 'USD', 'United States', 33.6407, -84.4277, 4180439],
  ['DFW', 'KDFW', 'Dallas', 'America/Chicago', 'USD', 'United States', 32.8968, -97.0380, 4684888],
  ['BOS', 'KBOS', 'Boston', 'America/New_York', 'USD', 'United States', 42.3656, -71.0096, 4930956],
  ['DTW', 'KDTW', 'Detroit', 'America/New_York', 'USD', 'United States', 42.2162, -83.3554, 4990729],
  ['MSP', 'KMSP', 'Minneapolis', 'America/Chicago', 'USD', 'United States', 44.8848, -93.2223, 5037649],
  ['IAD', 'KIAD', 'Washington', 'America/New_York', 'USD', 'United States', 38.9531, -77.4565, 4791259],
  ['IAH', 'KIAH', 'Houston', 'America/Chicago', 'USD', 'United States', 29.9902, -95.3368, 4699066],
  ['ORD', 'KORD', 'Chicago', 'America/Chicago', 'USD', 'United States', 41.9786, -87.9048, 4887398],
  ['LAS', 'KLAS', 'Las Vegas', 'America/Los_Angeles', 'USD', 'United States', 36.0840, -115.1537, 5506956],
  ['HNL', 'PHNL', 'Honolulu', 'Pacific/Honolulu', 'USD', 'United States', 21.3245, -157.9251, 5856195],
  ['EWR', 'KEWR', 'Newark', 'America/New_York', 'USD', 'United States', 40.6895, -74.1745, 5101798],

  // 유럽
  ['LHR', 'EGLL', 'London', 'Europe/London', 'GBP', 'United Kingdom', 51.4700, -0.4543, 2643743],
  ['CDG', 'LFPG', 'Paris', 'Europe/Paris', 'EUR', 'France', 49.0097, 2.5479, 2988507],
  ['FCO', 'LIRF', 'Rome', 'Europe/Rome', 'EUR', 'Italy', 41.8003, 12.2389, 3169070],
  ['BCN', 'LEBL', 'Barcelona', 'Europe/Madrid', 'EUR', 'Spain', 41.2974, 2.0833, 3128760],
  ['FRA', 'EDDF', 'Frankfurt', 'Europe/Berlin', 'EUR', 'Germany', 50.0379, 8.5622, 2925533],
  ['MAD', 'LEMD', 'Madrid', 'Europe/Madrid', 'EUR', 'Spain', 40.4839, -3.5680, 3117735],
  ['PRG', 'LKPR', 'Prague', 'Europe/Prague', 'CZK', 'Czech Republic', 50.1008, 14.2638, 3067696],
  ['MUC', 'EDDM', 'Munich', 'Europe/Berlin', 'EUR', 'Germany', 48.3538, 11.7861, 2867714],
  ['ZRH', 'LSZH', 'Zurich', 'Europe/Zurich', 'CHF', 'Switzerland', 47.4647, 8.5492, 2657896],
  ['VIE', 'LOWW', 'Vienna', 'Europe/Vienna', 'EUR', 'Austria', 48.1103, 16.5697, 2761369],
  ['MXP', 'LIMC', 'Milan', 'Europe/Rome', 'EUR', 'Italy', 45.6306, 8.7281, 3173435],
  ['IST', 'LTFM', 'Istanbul', 'Europe/Istanbul', 'TRY', 'Turkey', 41.2753, 28.7519, 745044],
  ['BUD', 'LHBP', 'Budapest', 'Europe/Budapest', 'HUF', 'Hungary', 47.4369, 19.2556, 3054643],
  ['TLV', 'LLBG', 'Tel Aviv', 'Asia/Jerusalem', 'ILS', 'Israel', 32.0114, 34.8867, 293397],
  ['DOH', 'OTHH', 'Doha', 'Asia/Qatar', 'QAR', 'Qatar', 25.2611, 51.5651, 290030],

  // 일본
  ['NRT', 'RJAA', 'Tokyo', 'Asia/Tokyo', 'JPY', 'Japan', 35.7720, 140.3928, 1850147],
  ['KIX', 'RJBB', 'Osaka', 'Asia/Tokyo', 'JPY', 'Japan', 34.4273, 135.2441, 1853909],
  ['HND', 'RJTT', 'Tokyo', 'Asia/Tokyo', 'JPY', 'Japan', 35.5494, 139.7798, 1850147],
  ['FUK', 'RJFF', 'Fukuoka', 'Asia/Tokyo', 'JPY', 'Japan', 33.5859, 130.4511, 1863967],
  ['NGO', 'RJGG', 'Nagoya', 'Asia/Tokyo', 'JPY', 'Japan', 35.2554, 136.9244, 1856057],
  ['OKA', 'ROAH', 'Okinawa', 'Asia/Tokyo', 'JPY', 'Japan', 26.1958, 127.6458, 1854345],
  ['CTS', 'RJCC', 'Sapporo', 'Asia/Tokyo', 'JPY', 'Japan', 43.0642, 141.3469, 2127436],
  ['TFU', 'RJFO', 'Tokyo', 'Asia/Tokyo', 'JPY', 'Japan', 35.7647, 140.3863, 1850147],
  ['UKB', 'RJBE', 'Kobe', 'Asia/Tokyo', 'JPY', 'Japan', 34.6328, 135.2239, 1859176],
  ['HIJ', 'RJOA', 'Hiroshima', 'Asia/Tokyo', 'JPY', 'Japan', 34.4361, 132.9194, 1862415],
  ['KMJ', 'RJFT', 'Kumamoto', 'Asia/Tokyo', 'JPY', 'Japan', 32.8373, 130.8550, 1858421],
  ['MYJ', 'RJOM', 'Matsuyama', 'Asia/Tokyo', 'JPY', 'Japan', 33.8272, 132.6997, 1857550],
  ['KKJ', 'RJFR', 'Kitakyushu', 'Asia/Tokyo', 'JPY', 'Japan', 33.8455, 131.0344, 1859307],
  ['KIJ', 'RJSN', 'Niigata', 'Asia/Tokyo', 'JPY', 'Japan', 37.9558, 139.1117, 0],
  ['TKS', 'RJOS', 'Tokushima', 'Asia/Tokyo', 'JPY', 'Japan', 34.1322, 134.6092, 0],
  ['KOJ', 'RJFK', 'Kagoshima', 'Asia/Tokyo', 'JPY', 'Japan', 31.8033, 130.7169, 0],
  ['TAK', 'RJOT', 'Takamatsu', 'Asia/Tokyo', 'JPY', 'Japan', 34.2142, 134.0156, 0],
  ['SDJ', 'RJSS', 'Sendai', 'Asia/Tokyo', 'JPY', 'Japan', 38.1397, 140.9169, 0],
  ['ISG', 'ROIG', 'Ishigaki', 'Asia/Tokyo', 'JPY', 'Japan', 24.3964, 124.2450, 0],
  ['KMQ', 'RJNK', 'Komatsu', 'Asia/Tokyo', 'JPY', 'Japan', 36.3939, 136.4075, 0],
  ['NGS', 'RJFU', 'Nagasaki', 'Asia/Tokyo', 'JPY', 'Japan', 32.9169, 129.9136, 0],

  // 중국
  ['PEK', 'ZBAA', 'Beijing', 'Asia/Shanghai', 'CNY', 'China', 40.0799, 116.6031, 1816670],
  ['PVG', 'ZSPD', 'Shanghai', 'Asia/Shanghai', 'CNY', 'China', 31.1434, 121.8052, 1796236],
  ['SHA', 'ZSSS', 'Shanghai', 'Asia/Shanghai', 'CNY', 'China', 31.1979, 121.3363, 1796236],
  ['TAO', 'ZSQD', 'Qingdao', 'Asia/Shanghai', 'CNY', 'China', 36.2661, 120.3744, 1797929],
  ['CSX', 'ZGHA', 'Changsha', 'Asia/Shanghai', 'CNY', 'China', 28.1892, 113.2196, 1815577],
  ['HGH', 'ZSHC', 'Hangzhou', 'Asia/Shanghai', 'CNY', 'China', 30.2294, 120.4344, 1808926],
  ['NKG', 'ZSNJ', 'Nanjing', 'Asia/Shanghai', 'CNY', 'China', 31.7420, 118.8620, 1799962],
  ['CGO', 'ZHCC', 'Zhengzhou', 'Asia/Shanghai', 'CNY', 'China', 34.5197, 113.8408, 1784658],
  ['YNJ', 'ZYYJ', 'Yanji', 'Asia/Shanghai', 'CNY', 'China', 42.8828, 129.4514, 2033370],
  ['SHE', 'ZYTX', 'Shenyang', 'Asia/Shanghai', 'CNY', 'China', 41.6398, 123.4834, 2034937],
  ['CKG', 'ZUCK', 'Chongqing', 'Asia/Shanghai', 'CNY', 'China', 29.7192, 106.6417, 1814906],
  ['CAN', 'ZGGG', 'Guangzhou', 'Asia/Shanghai', 'CNY', 'China', 23.3924, 113.2988, 1809858],
  ['DLC', 'ZYTL', 'Dalian', 'Asia/Shanghai', 'CNY', 'China', 38.9657, 121.5386, 1814087],
  ['HRB', 'ZYHB', 'Harbin', 'Asia/Shanghai', 'CNY', 'China', 45.6234, 126.2503, 2037013],
  ['TSN', 'ZBTJ', 'Tianjin', 'Asia/Shanghai', 'CNY', 'China', 39.1244, 117.3464, 1792947],
  ['WEH', 'ZSWH', 'Weihai', 'Asia/Shanghai', 'CNY', 'China', 37.5100, 122.1208, 0],
  ['SYX', 'ZJSY', 'Sanya', 'Asia/Shanghai', 'CNY', 'China', 18.2431, 109.5050, 0],
  ['CGQ', 'ZYCC', 'Changchun', 'Asia/Shanghai', 'CNY', 'China', 43.8800, 125.3228, 0],
  ['XIY', 'ZLXY', 'Xi\'an', 'Asia/Shanghai', 'CNY', 'China', 34.2667, 108.9333, 0],
  ['YNZ', 'ZSYN', 'Yancheng', 'Asia/Shanghai', 'CNY', 'China', 33.3575, 120.1573, 0],
  ['PKX', 'ZBAD', 'Beijing', 'Asia/Shanghai', 'CNY', 'China', 39.5099, 116.4109, 0],

  // 대만
  ['TPE', 'RCTP', 'Taipei', 'Asia/Taipei', 'TWD', 'Taiwan', 25.0777, 121.2328, 1668341],
  ['RMQ', 'RCMQ', 'Taichung', 'Asia/Taipei', 'TWD', 'Taiwan', 24.2647, 120.6208, 1668355],
  ['TSA', 'RCSS', 'Taipei', 'Asia/Taipei', 'TWD', 'Taiwan', 25.0694, 121.5519, 1668341],
  ['KHH', 'RCKH', 'Kaohsiung', 'Asia/Taipei', 'TWD', 'Taiwan', 22.5771, 120.3499, 1673820],
  ['CCK', 'RCKU', 'Chiayi', 'Asia/Taipei', 'TWD', 'Taiwan', 23.4618, 120.3928, 1673820],

  // 동남아시아
  ['HKG', 'VHHH', 'Hong Kong', 'Asia/Hong_Kong', 'HKD', 'Hong Kong', 22.3080, 113.9185, 1819729],
  ['BKK', 'VTBS', 'Bangkok', 'Asia/Bangkok', 'THB', 'Thailand', 13.6900, 100.7501, 1609350],
  ['SIN', 'WSSS', 'Singapore', 'Asia/Singapore', 'SGD', 'Singapore', 1.3644, 103.9915, 1880252],
  ['CGK', 'WIII', 'Jakarta', 'Asia/Jakarta', 'IDR', 'Indonesia', -6.1256, 106.6558, 1642911],
  ['SGN', 'VVTS', 'Ho Chi Minh City', 'Asia/Ho_Chi_Minh', 'VND', 'Vietnam', 10.8188, 106.6520, 1566083],
  ['HAN', 'VVNB', 'Hanoi', 'Asia/Ho_Chi_Minh', 'VND', 'Vietnam', 21.2212, 105.8072, 1581130],
  ['DAD', 'VVDN', 'Da Nang', 'Asia/Ho_Chi_Minh', 'VND', 'Vietnam', 16.0439, 108.1994, 1583992],
  ['HKT', 'VTSP', 'Phuket', 'Asia/Bangkok', 'THB', 'Thailand', 8.1132, 98.3169, 1609350],
  ['MNL', 'RPLL', 'Manila', 'Asia/Manila', 'PHP', 'Philippines', 14.5086, 121.0196, 1701668],
  ['CEB', 'RPVM', 'Cebu', 'Asia/Manila', 'PHP', 'Philippines', 10.3075, 123.9794, 1717511],
  ['CRK', 'RPLC', 'Clark', 'Asia/Manila', 'PHP', 'Philippines', 15.1860, 120.5603, 1717511],
  ['KUL', 'WMKK', 'Kuala Lumpur', 'Asia/Kuala_Lumpur', 'MYR', 'Malaysia', 2.7456, 101.7099, 1735161],
  ['MFM', 'VMMC', 'Macau', 'Asia/Macau', 'MOP', 'Macau', 22.1496, 113.5916, 1821274],
  ['RGN', 'VYYY', 'Yangon', 'Asia/Yangon', 'MMK', 'Myanmar', 16.9073, 96.1332, 1298824],
  ['CXR', 'VVCR', 'Nha Trang', 'Asia/Ho_Chi_Minh', 'VND', 'Vietnam', 11.9982, 109.2194, 1572151],
  ['KLO', 'RPVK', 'Kalibo', 'Asia/Manila', 'PHP', 'Philippines', 11.6892, 122.3674, 0],

  // 인도
  ['BOM', 'VABB', 'Mumbai', 'Asia/Kolkata', 'INR', 'India', 19.0887, 72.8681, 1275339],
  ['DEL', 'VIDP', 'Delhi', 'Asia/Kolkata', 'INR', 'India', 28.5562, 77.1000, 1273294],

  // 오세아니아
  ['SYD', 'YSSY', 'Sydney', 'Australia/Sydney', 'AUD', 'Australia', -33.9399, 151.1753, 2147714],
  ['AKL', 'NZAA', 'Auckland', 'Pacific/Auckland', 'NZD', 'New Zealand', -37.0082, 174.7850, 2193733],
  ['MEL', 'YMML', 'Melbourne', 'Australia/Melbourne', 'AUD', 'Australia', -37.6733, 144.8433, 2158177],
  ['BNE', 'YBBN', 'Brisbane', 'Australia/Brisbane', 'AUD', 'Australia', -27.3842, 153.1175, 2174003],
  ['PER', 'YPPH', 'Perth', 'Australia/Perth', 'AUD', 'Australia', -31.9403, 115.9669, 2063523],

  // 북미
  ['YVR', 'CYVR', 'Vancouver', 'America/Vancouver', 'CAD', 'Canada', 49.1967, -123.1815, 6173331],
  ['YYZ', 'CYYZ', 'Toronto', 'America/Toronto', 'CAD', 'Canada', 43.6777, -79.6248, 6167865],

  // 태평양/중동
  ['GUM', 'PGUM', 'Guam', 'Pacific/Guam', 'USD', 'Guam', 13.4839, 144.7960, 4043909],
  ['DXB', 'OMDB', 'Dubai', 'Asia/Dubai', 'AED', 'United Arab Emirates', 25.2528, 55.3644, 292223],
  ['AUH', 'OMAA', 'Abu Dhabi', 'Asia/Dubai', 'AED', 'United Arab Emirates', 24.4330, 54.6511, 292968],

  // 기타 아시아
  ['PNH', 'VDPP', 'Phnom Penh', 'Asia/Phnom_Penh', 'KHR', 'Cambodia', 11.5466, 104.8441, 1821306],
  ['VTE', 'VLVT', 'Vientiane', 'Asia/Vientiane', 'LAK', 'Laos', 17.9881, 102.5633, 1651944],
  ['TAG', 'RPVT', 'Tagbilaran', 'Asia/Manila', 'PHP', 'Philippines', 9.6641, 123.8531, 1684016],
  ['PQC', 'VVPQ', 'Phu Quoc', 'Asia/Ho_Chi_Minh', 'VND', 'Vietnam', 10.2270, 103.9672, 1566083],
  ['KTI', 'VDKT', 'Kratie', 'Asia/Phnom_Penh', 'KHR', 'Cambodia', 12.4889, 106.0311, 1831065],
  ['TAS', 'UTTT', 'Tashkent', 'Asia/Tashkent', 'UZS', 'Uzbekistan', 41.2579, 69.2812, 1512569],
  ['ALA', 'UAAA', 'Almaty', 'Asia/Almaty', 'KZT', 'Kazakhstan', 43.3522, 77.0405, 1526384],
  ['BKI', 'WBKK', 'Kota Kinabalu', 'Asia/Kuching', 'MYR', 'Malaysia', 5.9372, 116.0512, 1733432],
  ['CNX', 'VTCC', 'Chiang Mai', 'Asia/Bangkok', 'THB', 'Thailand', 18.7669, 98.9631, 1153670],
  ['CAI', 'HECA', 'Cairo', 'Africa/Cairo', 'EGP', 'Egypt', 30.1127, 31.4000, 360630],
  ['DPS', 'WADD', 'Denpasar', 'Asia/Makassar', 'IDR', 'Indonesia', -8.7482, 115.1672, 1645528],
  ['SZX', 'ZGSZ', 'Shenzhen', 'Asia/Shanghai', 'CNY', 'China', 22.6393, 113.8106, 1795565],
  ['FOC', 'ZSFZ', 'Fuzhou', 'Asia/Shanghai', 'CNY', 'China', 25.9344, 119.6633, 1810845],
  ['WUH', 'ZHHH', 'Wuhan', 'Asia/Shanghai', 'CNY', 'China', 30.7838, 114.2081, 1791247],
  ['UBN', 'ZMCK', 'Ulaanbaatar', 'Asia/Ulaanbaatar', 'MNT', 'Mongolia', 47.6466, 106.8226, 2028462]
];

// 압축된 데이터를 CityInfo 객체로 변환
export const CITY_DATA: Record<string, CityInfo> = Object.fromEntries(
  COMPRESSED_CITY_DATA.map(([code, icao, name, timezone, currency, country, lat, lon, openWeatherId]) => [
    code,
    {
      code,
      icao,
      name,
      timezone,
      currency,
      country,
      lat,
      lon,
      openWeatherId
    }
  ])
);

// ============================================================================
// 비행 시간 정보 (압축된 형태)
// ============================================================================

const COMPRESSED_FLIGHT_TIMES: [string, number, number][] = [
  // 기존 주요 노선
  ['JFK/ICN', 15, 40], ['ICN/JFK', 14, 50],
  ['LAX/ICN', 12, 30], ['ICN/LAX', 11, 40],
  ['LHR/ICN', 11, 30], ['ICN/LHR', 10, 40],
  ['KIX/ICN', 2, 0], ['ICN/KIX', 2, 0],
  ['ICN/HIJ', 1, 55], ['HIJ/ICN', 1, 25],
  ['FCO/ICN', 10, 30], ['ICN/FCO', 9, 40],
  ['TPE/ICN', 2, 30], ['ICN/TPE', 2, 30],
  ['SFO/ICN', 12, 0], ['ICN/SFO', 10, 40],
  ['NRT/ICN', 2, 30], ['ICN/NRT', 2, 30],
  ['BCN/ICN', 11, 0], ['ICN/BCN', 10, 10],
  ['SEA/ICN', 10, 30], ['ICN/SEA', 9, 40],
  ['SIN/ICN', 6, 30], ['ICN/SIN', 6, 30],
  ['CDG/ICN', 10, 30], ['ICN/CDG', 9, 40],

  // 미국 노선
  ['ICN/ATL', 14, 30], ['ATL/ICN', 15, 30],
  ['ICN/DFW', 13, 30], ['DFW/ICN', 14, 30],
  ['ICN/BOS', 14, 0], ['BOS/ICN', 15, 0],
  ['ICN/DTW', 13, 30], ['DTW/ICN', 14, 30],
  ['ICN/MSP', 13, 0], ['MSP/ICN', 14, 0],
  ['ICN/IAD', 14, 30], ['IAD/ICN', 15, 30],
  ['ICN/IAH', 14, 0], ['IAH/ICN', 15, 0],
  ['ICN/ORD', 13, 45], ['ORD/ICN', 14, 45],
  ['ICN/LAS', 12, 30], ['LAS/ICN', 13, 30],
  ['ICN/HNL', 8, 30], ['HNL/ICN', 9, 30],
  ['ICN/EWR', 14, 30], ['EWR/ICN', 15, 30],

  // 유럽 노선
  ['ICN/ZRH', 11, 0], ['ZRH/ICN', 12, 0],
  ['ICN/BUD', 11, 30], ['BUD/ICN', 10, 30],
  ['ICN/TLV', 10, 30], ['TLV/ICN', 11, 30],
  ['ICN/DOH', 8, 30], ['DOH/ICN', 9, 30],


  // 동남아시아 노선
  ['ICN/HKT', 5, 30], ['HKT/ICN', 5, 30],
  ['ICN/MNL', 3, 0], ['MNL/ICN', 3, 0],
  ['ICN/CEB', 3, 30], ['CEB/ICN', 3, 30],
  ['ICN/CRK', 3, 0], ['CRK/ICN', 3, 0],
  ['ICN/KUL', 6, 0], ['KUL/ICN', 6, 0],

  // 인도 노선
  ['ICN/BOM', 7, 30], ['BOM/ICN', 7, 30],
  ['ICN/DEL', 7, 0], ['DEL/ICN', 7, 0],


  // 기타 아시아 노선
  ['ICN/PNH', 4, 30], ['PNH/ICN', 4, 30],
  ['ICN/VTE', 4, 30], ['VTE/ICN', 4, 30],
  ['ICN/TAG', 3, 0], ['TAG/ICN', 3, 0],
  ['ICN/PQC', 4, 30], ['PQC/ICN', 4, 30],
  ['ICN/TAS', 6, 0], ['TAS/ICN', 6, 0],
  ['ICN/ALA', 5, 0], ['ALA/ICN', 5, 0],
  ['ICN/BKI', 4, 0], ['BKI/ICN', 4, 0],
  ['ICN/CNX', 4, 0], ['CNX/ICN', 4, 0],
  ['ICN/CAI', 10, 0], ['CAI/ICN', 10, 0],

  // 오세아니아 노선
  ['ICN/BNE', 9, 30], ['BNE/ICN', 9, 30],
  ['ICN/PER', 8, 30], ['PER/ICN', 8, 30],

  // 북미 노선
  ['ICN/YVR', 10, 30], ['YVR/ICN', 11, 30],
  ['ICN/YYZ', 13, 30], ['YYZ/ICN', 14, 30],

  // 태평양 노선
  ['ICN/GUM', 4, 30], ['GUM/ICN', 4, 30],

  // 중동 노선
  ['ICN/DXB', 9, 0], ['DXB/ICN', 9, 0],

  // 기존 아시아 노선
  ['ICN/DAD', 4, 30], ['DAD/ICN', 4, 30],
  ['ICN/WUH', 2, 30], ['WUH/ICN', 2, 30],
  ['ICN/DPS', 6, 0], ['DPS/ICN', 6, 0],
  ['ICN/SZX', 3, 30], ['SZX/ICN', 3, 30],
  ['ICN/TAO', 1, 30], ['TAO/ICN', 1, 30],
  ['ICN/SGN', 5, 30], ['SGN/ICN', 5, 30]
];

// 압축된 비행 시간 데이터를 객체로 변환
export const FLIGHT_TIMES: Record<string, { hours: number; minutes: number }> = Object.fromEntries(
  COMPRESSED_FLIGHT_TIMES.map(([route, hours, minutes]) => [
    route,
    { hours, minutes }
  ])
);

// ============================================================================
// 유틸리티 함수들
// ============================================================================

export const getCityInfo = (airportCode: string): CityInfo | null => {
  return CITY_DATA[airportCode] || null;
};

export const getTimezone = (airportCode: string): string | null => {
  return CITY_DATA[airportCode]?.timezone || null;
};

export const getICAO = (airportCode: string): string | null => {
  return CITY_DATA[airportCode]?.icao || null;
};

export const getCityName = (airportCode: string): string | null => {
  return CITY_DATA[airportCode]?.name || null;
};

export const getCurrency = (airportCode: string): string | null => {
  return CITY_DATA[airportCode]?.currency || null;
};

export const getCountry = (airportCode: string): string | null => {
  return CITY_DATA[airportCode]?.country || null;
};

export const getFlightTime = (route: string): { hours: number; minutes: number } | null => {
  return FLIGHT_TIMES[route] || null;
};

// 모든 공항 코드 목록 가져오기
export const getAllAirportCodes = (): string[] => {
  return Object.keys(CITY_DATA);
};

// 특정 국가의 공항 코드들 가져오기
export const getAirportsByCountry = (country: string): string[] => {
  return Object.entries(CITY_DATA)
    .filter(([_, cityInfo]) => cityInfo.country === country)
    .map(([code, _]) => code);
};

// 특정 통화를 사용하는 공항 코드들 가져오기
export const getAirportsByCurrency = (currency: string): string[] => {
  return Object.entries(CITY_DATA)
    .filter(([_, cityInfo]) => cityInfo.currency === currency)
    .map(([code, _]) => code);
};

// ============================================================================
// API 설정
// ============================================================================

// 환율 API 키 (환경 변수에서 가져오기)
export const EXCHANGE_API_KEY = (import.meta as any).env?.VITE_EXCHANGE_API_KEY;

// 환율 API URL 생성 함수
export const getExchangeRateUrl = (fromCurrency: string, toCurrency: string = 'KRW'): string => {
  if (!EXCHANGE_API_KEY) {
    console.warn('환율 API 키가 설정되지 않았습니다. VITE_EXCHANGE_API_KEY 환경변수를 확인해주세요.');
    console.warn('환경변수 확인:', {
      hasEnv: !!(import.meta as any).env,
      hasViteEnv: !!(import.meta as any).env?.VITE_EXCHANGE_API_KEY,
      envKeys: Object.keys((import.meta as any).env || {})
    });
    throw new Error('환율 API 키가 설정되지 않았습니다.');
  }
  return `https://v6.exchangerate-api.com/v6/${EXCHANGE_API_KEY}/pair/${fromCurrency}/${toCurrency}`;
};

// UTC 오프셋 계산 함수
export const getUTCOffset = (airportCode: string): string | null => {
  const cityInfo = CITY_DATA[airportCode];
  if (!cityInfo) return null;

  try {
    const now = new Date();
    const utcTime = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
    const localTime = new Date(now.toLocaleString("en-US", { timeZone: cityInfo.timezone }));
    const offset = (localTime.getTime() - utcTime.getTime()) / (1000 * 60 * 60);

    if (offset === 0) return '(UTC)';
    if (offset > 0) return `(UTC+${offset})`;
    return `(UTC${offset})`;
  } catch (error) {
    return null;
  }
};
