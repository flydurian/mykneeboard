import { VercelRequest, VercelResponse } from '@vercel/node';

// 압축된 공항 데이터 (cityData.ts와 동일한 전체 데이터 - 152개 공항)
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
  ['SZX', 'ZGSZ', 'Shenzhen', 'Asia/Shanghai', 'CNY', 'China', 22.6393, 113.8106, 1795565],
  ['WUH', 'ZHHH', 'Wuhan', 'Asia/Shanghai', 'CNY', 'China', 30.7838, 114.2081, 1791247],

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
  ['PNH', 'VDPP', 'Phnom Penh', 'Asia/Phnom_Penh', 'KHR', 'Cambodia', 11.5466, 104.8441, 1821306],
  ['VTE', 'VLVT', 'Vientiane', 'Asia/Vientiane', 'LAK', 'Laos', 17.9881, 102.5633, 1651944],
  ['TAG', 'RPVT', 'Tagbilaran', 'Asia/Manila', 'PHP', 'Philippines', 9.6641, 123.8531, 1684016],
  ['PQC', 'VVPQ', 'Phu Quoc', 'Asia/Ho_Chi_Minh', 'VND', 'Vietnam', 10.2270, 103.9672, 1566083],
  ['BKI', 'WBKK', 'Kota Kinabalu', 'Asia/Kuching', 'MYR', 'Malaysia', 5.9372, 116.0512, 1733432],
  ['CNX', 'VTCC', 'Chiang Mai', 'Asia/Bangkok', 'THB', 'Thailand', 18.7669, 98.9631, 1153670],
  ['DPS', 'WADD', 'Denpasar', 'Asia/Makassar', 'IDR', 'Indonesia', -8.7482, 115.1672, 1645528],

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
  ['CAI', 'HECA', 'Cairo', 'Africa/Cairo', 'EGP', 'Egypt', 30.1127, 31.4000, 360630],

  // 중앙아시아
  ['TAS', 'UTTT', 'Tashkent', 'Asia/Tashkent', 'UZS', 'Uzbekistan', 41.2579, 69.2812, 1512569],
  ['ALA', 'UAAA', 'Almaty', 'Asia/Almaty', 'KZT', 'Kazakhstan', 43.3522, 77.0405, 1526384],
];

// 공항 데이터베이스 생성
const AIRPORT_DATABASE: Record<string, { name: string; lat: number; lon: number }> = {};
COMPRESSED_CITY_DATA.forEach(([code, icao, name, timezone, currency, country, lat, lon]) => {
  AIRPORT_DATABASE[code] = { name, lat, lon };
});

// 대원호 경로 생성 함수
function generateGreatCirclePath(lat1: number, lon1: number, lat2: number, lon2: number, numPoints: number = 50): Array<{lat: number, lon: number, altitude?: number, timestamp: number}> {
  const points = [];
  
  // 대원호 계산을 위한 각도 변환
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const toDegrees = (radians: number) => radians * 180 / Math.PI;
  
  const lat1Rad = toRadians(lat1);
  const lon1Rad = toRadians(lon1);
  const lat2Rad = toRadians(lat2);
  const lon2Rad = toRadians(lon2);
  
  const dLon = lon2Rad - lon1Rad;
  const dLat = lat2Rad - lat1Rad;
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1Rad) * Math.cos(lat2Rad) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  
  for (let i = 0; i <= numPoints; i++) {
    const f = i / numPoints;
    
    const A = Math.sin((1-f) * c) / Math.sin(c);
    const B = Math.sin(f * c) / Math.sin(c);
    
    const x = A * Math.cos(lat1Rad) * Math.cos(lon1Rad) + B * Math.cos(lat2Rad) * Math.cos(lon2Rad);
    const y = A * Math.cos(lat1Rad) * Math.sin(lon1Rad) + B * Math.cos(lat2Rad) * Math.sin(lon2Rad);
    const z = A * Math.sin(lat1Rad) + B * Math.sin(lat2Rad);
    
    const lat = toDegrees(Math.atan2(z, Math.sqrt(x*x + y*y)));
    const lon = toDegrees(Math.atan2(y, x));
    
    // 고도 시뮬레이션 (일반적인 항공편 고도 패턴)
    let altitude = 0;
    if (i === 0 || i === numPoints) {
      altitude = 0; // 출발/도착 시 지상
    } else if (i < numPoints * 0.15) {
      altitude = 1000 + (i / (numPoints * 0.15)) * 35000; // 상승
    } else if (i > numPoints * 0.85) {
      altitude = 35000 - ((i - numPoints * 0.85) / (numPoints * 0.15)) * 35000; // 하강
    } else {
      altitude = 35000 + Math.sin((i - numPoints * 0.15) / (numPoints * 0.7) * Math.PI) * 3000; // 순항
    }
    
    points.push({
      lat,
      lon,
      altitude: Math.round(altitude),
      timestamp: Date.now() + (i * 300000) // 5분 간격
    });
  }
  
  return points;
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  // CORS 헤더 설정
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { callsign, departure, arrival, date } = request.body;

    // 입력 검증
    if (!callsign || !departure || !arrival) {
      return response.status(400).json({ 
        error: '항공편명, 출발지, 도착지가 필요합니다.' 
      });
    }

    console.log('🛩️ 항공편 경로 요청:', { callsign, departure, arrival, date });

    // 공항 정보 가져오기
    const departureCode = departure.toUpperCase();
    const arrivalCode = arrival.toUpperCase();
    const departureAirport = AIRPORT_DATABASE[departureCode];
    const arrivalAirport = AIRPORT_DATABASE[arrivalCode];

    console.log('🔍 공항 검색 결과:', {
      departureCode,
      arrivalCode,
      departureFound: !!departureAirport,
      arrivalFound: !!arrivalAirport,
      departureAirport: departureAirport ? `${departureAirport.name} (${departureAirport.lat}, ${departureAirport.lon})` : 'NOT FOUND',
      arrivalAirport: arrivalAirport ? `${arrivalAirport.name} (${arrivalAirport.lat}, ${arrivalAirport.lon})` : 'NOT FOUND'
    });

    if (!departureAirport || !arrivalAirport) {
      // 공항 정보가 없으면 오류 반환
      console.warn(`⚠️ 공항 정보 없음: ${departureCode} 또는 ${arrivalCode}`);
      
      return response.status(404).json({
        success: false,
        error: `공항 정보를 찾을 수 없습니다: ${!departureAirport ? departureCode : ''} ${!arrivalAirport ? arrivalCode : ''}`.trim(),
        message: '지원되지 않는 공항입니다.'
      });
    }

    // 시뮬레이션 경로 생성
    console.log('📍 시뮬레이션 경로 생성:', `${departureAirport.name} → ${arrivalAirport.name}`);
    const path = generateGreatCirclePath(
      departureAirport.lat,
      departureAirport.lon,
      arrivalAirport.lat,
      arrivalAirport.lon
    );

    return response.status(200).json({
      success: true,
      data: {
        callsign,
        path,
        departure: {
          icao: departureCode,
          name: departureAirport.name,
          lat: departureAirport.lat,
          lon: departureAirport.lon
        },
        arrival: {
          icao: arrivalCode,
          name: arrivalAirport.name,
          lat: arrivalAirport.lat,
          lon: arrivalAirport.lon
        }
      },
      message: '시뮬레이션 경로를 생성했습니다.'
    });

  } catch (error) {
    console.error('❌ 항공편 경로 생성 오류:', error);
    return response.status(500).json({ 
      error: '항공편 경로 생성 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}