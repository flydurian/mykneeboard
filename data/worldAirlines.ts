// ============================================================================
// 압축된 항공사 데이터 구조
// ============================================================================

export interface AirlineInfo {
  iata: string;
  icao: string;
  name: string;
  koreanName: string;
  callsign: string;
  country: string;
}

// 압축된 항공사 데이터 (배열 형태)
// [iata, icao, name, koreanName, callsign, country]
export const compressedAirlines: string[][] = [
  // ===== 대한민국 =====
  ["KE", "KAL", "Korean Air", "대한항공", "KOREAN AIR", "대한민국"],
  ["OZ", "AAR", "Asiana Airlines", "아시아나항공", "ASIANA", "대한민국"],
  ["7C", "JJA", "Jeju Air", "제주항공", "JEJU AIR", "대한민국"],
  ["TW", "TWB", "T'way Air", "티웨이항공", "TEEWAY", "대한민국"],
  ["BX", "ABL", "Air Busan", "에어부산", "AIR BUSAN", "대한민국"],
  ["ZE", "ESR", "Eastar Jet", "이스타항공", "EASTAR", "대한민국"],
  ["LJ", "JNA", "Jin Air", "진에어", "JIN AIR", "대한민국"],
  ["RS", "ASV", "Air Seoul", "에어서울", "AIR SEOUL", "대한민국"],
  ["YP", "APZ", "Air Premia", "에어프레미아", "AIR PREMIA", "대한민국"],
  ["RF", "EOK", "Aerokorea", "에어로케이항공", "AEROHANGUK", "대한민국"],

  // ===== 아시아 =====
  
  // 일본
  ["NH", "ANA", "All Nippon Airways", "전일본공수", "ALL NIPPON", "일본"],
  ["JL", "JAL", "Japan Airlines", "일본항공", "JAPANAIR", "일본"],
  ["MM", "APJ", "Peach Aviation", "피치항공", "AIR PEACH", "일본"],
  ["GK", "JJP", "Jetstar Japan", "제트스타재팬", "ORANGE LINER", "일본"],
  ["JW", "VNL", "Vanilla Air", "바닐라에어", "VANILLA", "일본"],
  ["NQ", "AJX", "Air Japan", "에어재팬", "AIR JAPAN", "일본"],
  ["IJ", "JJP", "Spring Airlines Japan", "스프링항공재팬", "J-SPRING", "일본"],
  ["7G", "SFJ", "Star Flyer", "스타플라이어", "STARFLYER", "일본"],
  ["HD", "ADO", "Air Do", "에어도", "AIR DO", "일본"],
  ["BC", "SKY", "Skymark Airlines", "스카이마크항공", "SKYMARK", "일본"],
  ["JD", "CBJ", "Japan Air Commuter", "일본에어커뮤터", "COMMUTER", "일본"],
  ["ZG", "TZP", "ZIPAIR Tokyo", "집에어도쿄", "ZIPPY", "일본"],

  // 중국
  ["CA", "CCA", "Air China", "중국국제항공", "AIR CHINA", "중국"],
  ["MU", "CES", "China Eastern Airlines", "중국동방항공", "CHINA EASTERN", "중국"],
  ["CZ", "CSN", "China Southern Airlines", "중국남방항공", "CHINA SOUTHERN", "중국"],
  ["HU", "CHH", "Hainan Airlines", "하이난항공", "HAINAN", "중국"],
  ["3U", "CSC", "Sichuan Airlines", "사천항공", "SI CHUAN", "중국"],
  ["MF", "CXA", "Xiamen Airlines", "하문항공", "XIAMEN AIR", "중국"],
  ["GS", "GCR", "Tianjin Airlines", "천진항공", "BO HAI", "중국"],
  ["9C", "CQH", "Spring Airlines", "춘추항공", "AIR SPRING", "중국"],
  ["KN", "CUA", "China United Airlines", "중국연합항공", "LIANHANG", "중국"],
  ["PN", "CHB", "West Air", "서부항공", "WEST CHINA", "중국"],
  ["8L", "LKE", "Lucky Air", "럭키에어", "LUCKY AIR", "중국"],
  ["JD", "CBJ", "Beijing Capital Airlines", "베이징캐피털항공", "CAPITAL JET", "중국"],
  ["G5", "HXA", "China Express Airlines", "중국익스프레스항공", "CHINA EXPRESS", "중국"],
  ["A6", "CBG", "Chang An Airlines", "창안항공", "CHANG AN", "중국"],
  ["GJ", "CDC", "Loong Air", "룽에어", "LOONG AIR", "중국"],
  ["HO", "DKH", "Juneyao Airlines", "준야오항공", "JUNEYAO AIRLINES", "중국"],
  ["UQ", "CUH", "Urumqi Air", "우루무치항공", "LANCHOU", "중국"],
  ["QW", "QDA", "Qingdao Airlines", "칭다오항공", "SKY LEGEND", "중국"],
  ["RY", "RYA", "Ruili Airlines", "루이리항공", "SENDI", "중국"],
  ["TV", "TBA", "Tibet Airlines", "티베트항공", "TIBET", "중국"],
  ["Y8", "YZR", "Suparna Airlines", "수파르나항공", "YANGTZE RIVER", "중국"],
  ["OKA", "OKA", "Okay Airways", "오케이항공", "OKAYJET", "중국"],

  // 대만
  ["BR", "EVA", "EVA Air", "에바항공", "EVA", "대만"],
  ["CI", "CAL", "China Airlines", "중화항공", "DYNASTY", "대만"],
  ["IT", "TTW", "Tigerair Taiwan", "타이거에어대만", "SMART CAT", "대만"],
  ["JX", "SJX", "Starlux Airlines", "스타룩스항공", "STARWALKER", "대만"],

  // 동남아시아
  ["SQ", "SIA", "Singapore Airlines", "싱가포르항공", "SINGAPORE", "싱가포르"],
  ["MI", "SLK", "SilkAir", "실크에어", "SILKAIR", "싱가포르"],
  ["TR", "TGW", "Scoot", "스쿠트", "SCOOTER", "싱가포르"],
  ["3K", "JSA", "Jetstar Asia Airways", "제트스타아시아항공", "JETSTAR ASIA", "싱가포르"],
  ["TZ", "SCO", "Scoot Tigerair", "스쿠트타이거에어", "SCOOT TIGER", "싱가포르"],
  ["8Q", "OHY", "Flynas", "플라이나스", "NAS EXPRESS", "싱가포르"],
  ["TG", "THA", "Thai Airways International", "타이항공", "THAI", "태국"],
  ["FD", "AIQ", "Thai AirAsia", "타이에어아시아", "THAI ASIA", "태국"],
  ["WE", "THD", "Thai Smile", "타이스마일", "THAI SMILE", "태국"],
  ["SL", "THM", "Thai Lion Air", "타이라이언에어", "MENTARI", "태국"],
  ["XJ", "TSE", "Thai AirAsia X", "타이에어아시아X", "EXPRESS WING", "태국"],
  ["DD", "NOK", "Nok Air", "녹에어", "NOK AIR", "태국"],
  ["VN", "HVN", "Vietnam Airlines", "베트남항공", "VIET NAM AIRLINES", "베트남"],
  ["VJ", "VJC", "VietJet Air", "비엣젯에어", "VIETJET", "베트남"],
  ["BL", "PAV", "Pacific Airlines", "퍼시픽항공", "PACIFIC", "베트남"],
  ["QH", "BAV", "Bamboo Airways", "밤부항공", "BAMBOO", "베트남"],
  ["VU", "VUN", "Vietravel Airlines", "비엣트래블항공", "VIETRAVEL AIR", "베트남"],
  ["VH", "VHC", "Vietnam Air Service Company", "베트남항공서비스", "VIETNAM SERVICE", "베트남"],
  ["AK", "AXM", "AirAsia", "에어아시아", "RED CAP", "말레이시아"],
  ["MH", "MAS", "Malaysia Airlines", "말레이시아항공", "MALAYSIAN", "말레이시아"],
  ["D7", "XAX", "AirAsia X", "에어아시아X", "XANADU", "말레이시아"],
  ["OD", "MXD", "Malindo Air", "말린도항공", "MALINDO", "말레이시아"],
  ["FY", "FWM", "Firefly", "파이어플라이", "FIREFLY", "말레이시아"],
  ["9M", "GLM", "Gading Sari Aviation Services", "가딩사리항공", "GADING SARI", "말레이시아"],
  ["GA", "GIA", "Garuda Indonesia", "가루다인도네시아", "INDONESIA", "인도네시아"],
  ["JT", "LNI", "Lion Air", "라이온에어", "LION INTER", "인도네시아"],
  ["SJ", "SJY", "Sriwijaya Air", "스리위자야항공", "SRIWIJAYA", "인도네시아"],
  ["QG", "CTV", "Citilink", "시틀링크", "SUPERGREEN", "인도네시아"],
  ["ID", "BTK", "Batik Air", "바틱에어", "BATIK", "인도네시아"],
  ["IW", "WON", "Wings Air", "윙스에어", "WINGS ABADI", "인도네시아"],
  ["XN", "XAR", "Express Air", "익스프레스에어", "EXPRESS", "인도네시아"],
  ["PR", "PAL", "Philippine Airlines", "필리핀항공", "PHILIPPINE", "필리핀"],
  ["5J", "CEB", "Cebu Pacific", "세부퍼시픽", "CEBU", "필리핀"],
  ["DG", "SRQ", "Cebgo", "세브고", "BLUE JAY", "필리핀"],
  ["Z2", "EZD", "AirAsia Zest", "에어아시아제스트", "ZEST", "필리핀"],
  ["2P", "GAP", "Air Philippines", "에어필리핀", "ORIENT PACIFIC", "필리핀"],
  ["6K", "RIT", "Royal Air Philippines", "로얄에어필리핀", "ROYAL AIR", "필리핀"],

  // 인도
  ["6E", "IGO", "IndiGo", "인디고", "IFLY", "인도"],
  ["AI", "AIC", "Air India", "에어인디아", "AIRINDIA", "인도"],
  ["9W", "JAI", "Jet Airways", "제트항공", "JET AIRWAYS", "인도"],
  ["SG", "SEJ", "SpiceJet", "스파이스젯", "SPICEJET", "인도"],
  ["UK", "VTI", "Vistara", "비스타라", "VISTARA", "인도"],
  ["I5", "IAD", "AirAsia India", "에어아시아인디아", "RED KNIGHT", "인도"],
  ["G8", "GOW", "GoAir", "고에어", "GOAIR", "인도"],
  ["S2", "LLR", "Air India Express", "에어인디아익스프레스", "EXPRESS INDIA", "인도"],

  // ===== 유럽 =====
  
  // 영국
  ["BA", "BAW", "British Airways", "브리티시항공", "SPEEDBIRD", "영국"],
  ["VS", "VIR", "Virgin Atlantic", "버진애틀랜틱", "VIRGIN", "영국"],
  ["U2", "EZY", "easyJet", "이지젯", "EASY", "영국"],
  ["TUI", "TOM", "TUI Airways", "TUI항공", "TOMCAT", "영국"],
  ["BE", "BEE", "Flybe", "플라이비", "JERSEY", "영국"],
  ["LS", "EXS", "Jet2.com", "젯2닷컴", "CHANNEX", "영국"],
  ["MT", "TCX", "Thomas Cook Airlines", "토마스쿡항공", "KESTREL", "영국"],

  // 독일
  ["LH", "DLH", "Lufthansa", "루프트한자", "LUFTHANSA", "독일"],
  ["EW", "EWG", "Eurowings", "유로윙스", "EUROWINGS", "독일"],
  ["AB", "BER", "Air Berlin", "에어베를린", "AIR BERLIN", "독일"],
  ["DE", "CFG", "Condor", "콘도르", "CONDOR", "독일"],
  ["4U", "GWI", "Germanwings", "저먼윙스", "GERMAN WINGS", "독일"],

  // 프랑스
  ["AF", "AFR", "Air France", "에어프랑스", "AIRFRANS", "프랑스"],
  ["A5", "AIG", "Aigle Azur", "에글아주르", "AIGLE AZUR", "프랑스"],
  ["TO", "TVF", "Transavia France", "트랜스아비아프랑스", "FRANCE SOLEIL", "프랑스"],

  // 이탈리아
  ["AZ", "ITY", "ITA Airways", "ITA항공", "ITARROW", "이탈리아"],
  ["IG", "ISS", "Meridiana", "메리디아나", "MERIDIANA", "이탈리아"],

  // 아일랜드
  ["FR", "RYR", "Ryanair", "라이언에어", "RYANAIR", "아일랜드"],
  ["EI", "EIN", "Aer Lingus", "에어링구스", "SHAMROCK", "아일랜드"],

  // 네덜란드
  ["KL", "KLM", "KLM Royal Dutch Airlines", "KLM네덜란드항공", "KLM", "네덜란드"],
  ["HV", "TRA", "Transavia", "트랜스아비아", "TRANSAVIA", "네덜란드"],

  // 스페인
  ["IB", "IBE", "Iberia", "이베리아항공", "IBERIA", "스페인"],
  ["UX", "AEA", "Air Europa", "에어유로파", "EUROPA", "스페인"],
  ["VY", "VLG", "Vueling", "뷰링", "VUELING", "스페인"],

  // 스위스
  ["LX", "SWR", "Swiss International Air Lines", "스위스국제항공", "SWISS", "스위스"],

  // 오스트리아
  ["OS", "AUA", "Austrian Airlines", "오스트리아항공", "AUSTRIAN", "오스트리아"],

  // 스칸디나비아
  ["SK", "SAS", "Scandinavian Airlines", "스칸디나비아항공", "SCANDINAVIAN", "스웨덴"],
  ["DY", "NAX", "Norwegian Air Shuttle", "노르웨이언에어셔틀", "NOR SHUTTLE", "노르웨이"],
  ["AY", "FIN", "Finnair", "핀에어", "FINNAIR", "핀란드"],

  // 동유럽
  ["LO", "LOT", "LOT Polish Airlines", "LOT폴란드항공", "POLLOT", "폴란드"],
  ["OK", "CSA", "Czech Airlines", "체코항공", "CSA", "체코"],

  // 러시아/구소련
  ["SU", "AFL", "Aeroflot", "아에로플로트", "AEROFLOT", "러시아"],
  ["S7", "SBI", "S7 Airlines", "S7항공", "SIBERIAN", "러시아"],
  ["UT", "UTA", "UTair Aviation", "UT에어항공", "UTAIR", "러시아"],
  ["U6", "SVR", "Ural Airlines", "우랄항공", "SVERDLOVSK AIR", "러시아"],
  ["FV", "SDM", "Rossiya Airlines", "로시야항공", "ROSSIYA", "러시아"],
  ["DP", "PBD", "Pobeda", "포베다", "POBEDA", "러시아"],
  ["WZ", "WSF", "Red Wings Airlines", "레드윙스항공", "RED WINGS", "러시아"],
  ["N4", "NWS", "Nordwind Airlines", "노드윈드항공", "NORDWIND", "러시아"],
  ["5N", "AUL", "Aeroflot-Nord", "아에로플로트노르드", "DVINA", "러시아"],
  ["D2", "SSF", "Severstal Air Company", "세베르스탈항공", "SEVERSTAL", "러시아"],

  // ===== 북미 =====
  
  // 미국
  ["AA", "AAL", "American Airlines", "아메리칸항공", "AMERICAN", "미국"],
  ["DL", "DAL", "Delta Air Lines", "델타항공", "DELTA", "미국"],
  ["UA", "UAL", "United Airlines", "유나이티드항공", "UNITED", "미국"],
  ["WN", "SWA", "Southwest Airlines", "사우스웨스트항공", "SOUTHWEST", "미국"],
  ["B6", "JBU", "JetBlue Airways", "제트블루항공", "JETBLUE", "미국"],
  ["AS", "ASA", "Alaska Airlines", "알래스카항공", "ALASKA", "미국"],
  ["NK", "NKS", "Spirit Airlines", "스피릿항공", "SPIRIT WINGS", "미국"],
  ["F9", "FFT", "Frontier Airlines", "프론티어항공", "FRONTIER FLIGHT", "미국"],
  ["HA", "HAL", "Hawaiian Airlines", "하와이안항공", "HAWAIIAN", "미국"],
  ["VX", "VRD", "Virgin America", "버진아메리카", "REDWOOD", "미국"],
  ["SY", "SCX", "Sun Country Airlines", "선컨트리항공", "SUN COUNTRY", "미국"],
  ["G4", "AAY", "Allegiant Air", "알레지언트에어", "ALLEGIANT", "미국"],
  ["YX", "MEP", "Mesa Airlines", "메사항공", "AIR SHUTTLE", "미국"],
  ["9E", "FLG", "Endeavor Air", "엔데버에어", "ENDEAVOR", "미국"],
  ["CP", "CPZ", "Compass Airlines", "컴패스항공", "COMPASS", "미국"],
  ["OH", "JIA", "PSA Airlines", "PSA항공", "BLUE STREAK", "미국"],
  ["MQ", "ENY", "Envoy Air", "엔보이에어", "ENVOY", "미국"],
  ["OO", "SKW", "SkyWest Airlines", "스카이웨스트항공", "SKYWEST", "미국"],
  ["EV", "ASQ", "ExpressJet Airlines", "익스프레스젯항공", "ACEY", "미국"],
  ["YV", "ASH", "Mesa Airlines", "메사항공", "AIR SHUTTLE", "미국"],
  ["ZW", "WSW", "SkyWest Airlines", "스카이웨스트항공", "SKYWEST", "미국"],
  ["QX", "QXE", "Horizon Air", "호라이즌에어", "HORIZON AIR", "미국"],
  ["9K", "KAP", "Cape Air", "케이프에어", "CAIR", "미국"],
  ["3M", "JIA", "Silver Airways", "실버항공", "SILVER WINGS", "미국"],
  ["4B", "BKA", "Boutique Air", "부티크에어", "BOUTIQUE", "미국"],
  ["5Y", "GTI", "Atlas Air", "아틀라스에어", "GIANT", "미국"],
  ["7H", "RYR", "Ryan Air Service", "라이언에어서비스", "RYAN AIR", "미국"],
  ["8E", "BRG", "Bering Air", "베링에어", "BERING AIR", "미국"],
  ["9L", "CJC", "Colgan Air", "콜건에어", "COLGAN", "미국"],
  ["C5", "UCA", "CommutAir", "커뮤테어", "COMMUTAIR", "미국"],

  // 캐나다
  ["AC", "ACA", "Air Canada", "에어캐나다", "AIR CANADA", "캐나다"],
  ["WS", "WJA", "WestJet", "웨스트젯", "WESTJET", "캐나다"],
  ["PD", "POE", "Porter Airlines", "포터항공", "PORTER", "캐나다"],
  ["F8", "FLE", "Flair Airlines", "플레어항공", "FLAIR", "캐나다"],
  ["TS", "TSC", "Air Transat", "에어트랜샛", "TRANSAT", "캐나다"],

  // ===== 중동 =====
  ["EK", "UAE", "Emirates", "에미레이트항공", "EMIRATES", "아랍에미리트"],
  ["QR", "QTR", "Qatar Airways", "카타르항공", "QATARI", "카타르"],
  ["EY", "ETD", "Etihad Airways", "에티하드항공", "ETIHAD", "아랍에미리트"],
  ["TK", "THY", "Turkish Airlines", "터키항공", "TURKISH", "터키"],
  ["MNG", "MNG", "MNG Airlines", "MNG항공", "MNG", "터키"],
  ["MS", "MSR", "EgyptAir", "이집트항공", "EGYPTAIR", "이집트"],
  ["SV", "SVA", "Saudia", "사우디아", "SAUDIA", "사우디아라비아"],
  ["KU", "KAC", "Kuwait Airways", "쿠웨이트항공", "KUWAITI", "쿠웨이트"],
  ["GF", "GFA", "Gulf Air", "걸프항공", "GULF AIR", "바레인"],
  ["WY", "OMA", "Oman Air", "오만항공", "OMAN AIR", "오만"],
  ["J9", "JZR", "Jazeera Airways", "자지라항공", "JAZEERA", "쿠웨이트"],
  ["FZ", "FDB", "Flydubai", "플라이두바이", "SKYDUBAI", "아랍에미리트"],
  ["XY", "FNE", "flynas", "플라이나스", "NAS EXPRESS", "사우디아라비아"],

  // ===== 남미 =====
  ["JJ", "TAM", "LATAM Brasil", "라탐브라질", "TAM", "브라질"],
  ["LA", "LAN", "LATAM Airlines", "라탐항공", "LAN", "칠레"],
  ["AR", "ARG", "Aerolíneas Argentinas", "아에로리네아스아르헨티나스", "ARGENTINA", "아르헨티나"],
  ["AV", "AVA", "Avianca", "아비앙카", "AVIANCA", "콜롬비아"],
  ["CM", "CMP", "Copa Airlines", "코파항공", "COPA", "파나마"],
  ["AM", "AMX", "Aeroméxico", "아에로멕시코", "AEROMEXICO", "멕시코"],

  // ===== 오세아니아 =====
  ["QF", "QFA", "Qantas", "콴타스항공", "QANTAS", "호주"],
  ["VA", "VOZ", "Virgin Australia", "버진오스트레일리아", "VELOCITY", "호주"],
  ["JQ", "JST", "Jetstar Airways", "제트스타항공", "JETSTAR", "호주"],
  ["NZ", "ANZ", "Air New Zealand", "에어뉴질랜드", "NEW ZEALAND", "뉴질랜드"],

  // ===== 아프리카 =====
  ["ET", "ETH", "Ethiopian Airlines", "에티오피아항공", "ETHIOPIAN", "에티오피아"],
  ["SA", "SAA", "South African Airways", "사우스아프리카항공", "SPRINGBOK", "남아프리카공화국"],
  ["KQ", "KQA", "Kenya Airways", "케냐항공", "KENYA", "케냐"],
  ["AT", "RAM", "Royal Air Maroc", "로얄에어모로코", "ROYALAIR MAROC", "모로코"],
  ["WB", "RWD", "RwandAir", "르완다에어", "RWANDAIR", "르완다"],
  ["UL", "ALK", "SriLankan Airlines", "스리랑카항공", "SRILANKAN", "스리랑카"],

  // ===== 카고 전문 =====
  ["5X", "UPS", "UPS Airlines", "UPS항공", "UPS", "미국"],
  ["FX", "FDX", "FedEx Express", "페덱스익스프레스", "FEDEX", "미국"],
  ["3S", "ABX", "ABX Air", "ABX에어", "ABEX", "미국"],
  ["AT", "AMT", "Atlas Air", "아틀라스에어", "GIANT", "미국"],
  ["GTI", "GTI", "Atlas Air", "아틀라스에어", "GIANT", "미국"],
  ["PO", "PAC", "Polar Air Cargo", "폴라에어카고", "POLAR", "미국"],
  ["K4", "CKS", "Kalitta Air", "칼리타에어", "CONNIE", "미국"],
  ["WGN", "WGN", "Western Global Airlines", "웨스턴글로벌항공", "WESTERN GLOBAL", "미국"],
  ["QT", "TPA", "Tampa Cargo", "탐파카고", "TAMPA", "콜롬비아"],
  ["CV", "CLX", "Cargolux", "카고룩스", "CARGOLUX", "룩셈부르크"],
  ["CK", "CAO", "China Cargo Airlines", "중국카고항공", "CARGO KING", "중국"],
  ["DHL", "DHK", "DHL Aviation", "DHL항공", "WORLD EXPRESS", "독일"],
  ["GEC", "GEC", "German Cargo", "독일카고", "GERMAN CARGO", "독일"],
  ["LHA", "LHA", "Lufthansa Cargo", "루프트한자카고", "LUFTHANSA CARGO", "독일"],
  ["MFX", "MFX", "Mountain Air Express", "마운틴에어익스프레스", "MOUNTAIN", "미국"],
  ["HKE", "HKE", "Hong Kong Express Airways", "홍콩익스프레스항공", "HONGKONG SHUTTLE", "홍콩"],
  ["KZR", "KZR", "Kazakhstan Airlines", "카자흐스탄항공", "KAZAKHSTAN", "카자흐스탄"],
  ["MGL", "MGL", "Mongolian Airlines", "몽골항공", "MONGOL AIR", "몽골"],
  ["MMA", "MMA", "Myanmar Airways International", "미얀마항공", "MYANMAR", "미얀마"],
  ["MML", "MML", "Myanmar National Airlines", "미얀마국영항공", "MYANMAR", "미얀마"]
];

// ============================================================================
// 헬퍼 함수들
// ============================================================================

// 압축된 데이터를 AirlineInfo 객체로 변환
export function decompressAirline(compressed: string[]): AirlineInfo {
  return {
    iata: compressed[0],
    icao: compressed[1],
    name: compressed[2],
    koreanName: compressed[3],
    callsign: compressed[4],
    country: compressed[5]
  };
}

// 모든 항공사 데이터를 AirlineInfo 배열로 변환
export const worldAirlines: AirlineInfo[] = compressedAirlines.map(decompressAirline);

// IATA 코드로 항공사 찾기
export function getAirlineByIATA(iata: string): AirlineInfo | null {
  const compressed = compressedAirlines.find(airline => airline[0] === iata);
  return compressed ? decompressAirline(compressed) : null;
}

// ICAO 코드로 항공사 찾기
export function getAirlineByICAO(icao: string): AirlineInfo | null {
  const compressed = compressedAirlines.find(airline => airline[1] === icao);
  return compressed ? decompressAirline(compressed) : null;
}

// 국가별 항공사 찾기
export function getAirlinesByCountry(country: string): AirlineInfo[] {
  return compressedAirlines
    .filter(airline => airline[5] === country)
    .map(decompressAirline);
}

// 항공사명으로 검색
export function searchAirlines(query: string): AirlineInfo[] {
  const lowerQuery = query.toLowerCase();
  return compressedAirlines
    .filter(airline => 
      airline[0].toLowerCase().includes(lowerQuery) ||
      airline[1].toLowerCase().includes(lowerQuery) ||
      airline[2].toLowerCase().includes(lowerQuery) ||
      airline[3].toLowerCase().includes(lowerQuery) ||
      airline[4].toLowerCase().includes(lowerQuery)
    )
    .map(decompressAirline);
}

// 데이터 업데이트 날짜
export const AIRLINE_DATA_LAST_MODIFIED = new Date('2025-01-16');