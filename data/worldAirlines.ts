
export interface AirlineInfo {
  iata: string;
  icao: string;
  name: string;
  koreanName: string;
  callsign: string;
  country: string;
}

export const worldAirlines: AirlineInfo[] = [
  // ===== 아시아 항공사 =====
  
  // 대한민국
  {
    iata: "KE",
    icao: "KAL",
    name: "Korean Air",
    koreanName: "대한항공",
    callsign: "KOREAN AIR",
    country: "대한민국"
  },
  {
    iata: "OZ",
    icao: "AAR",
    name: "Asiana Airlines",
    koreanName: "아시아나항공",
    callsign: "ASIANA",
    country: "대한민국"
  },
  {
    iata: "7C",
    icao: "JJA",
    name: "Jeju Air",
    koreanName: "제주항공",
    callsign: "JEJU AIR",
    country: "대한민국"
  },
  {
    iata: "TW",
    icao: "TWB",
    name: "T'way Air",
    koreanName: "티웨이항공",
    callsign: "TEEWAY",
    country: "대한민국"
  },
  {
    iata: "BX",
    icao: "ABL",
    name: "Air Busan",
    koreanName: "에어부산",
    callsign: "AIR BUSAN",
    country: "대한민국"
  },
  {
    iata: "ZE",
    icao: "ESR",
    name: "Eastar Jet",
    koreanName: "이스타항공",
    callsign: "EASTAR",
    country: "대한민국"
  },
  {
    iata: "LJ",
    icao: "JNA",
    name: "Jin Air",
    koreanName: "진에어",
    callsign: "JIN AIR",
    country: "대한민국"
  },
  {
    iata: "RS",
    icao: "ASV",
    name: "Air Seoul",
    koreanName: "에어서울",
    callsign: "AIR SEOUL",
    country: "대한민국"
  },
  {
    iata: "YP",
    icao: "APZ",
    name: "Air Premia",
    koreanName: "에어프레미아",
    callsign: "AIR PREMIA",
    country: "대한민국"
  },
  {
    iata: "RF",
    icao: "EOK",
    name: "Aerokorea",
    koreanName: "에어로케이항공",
    callsign: "AEROHANGUK",
    country: "대한민국"
  },

  // 일본
  {
    iata: "NH",
    icao: "ANA",
    name: "All Nippon Airways",
    koreanName: "전일본공수",
    callsign: "ALL NIPPON",
    country: "일본"
  },
  {
    iata: "JL",
    icao: "JAL",
    name: "Japan Airlines",
    koreanName: "일본항공",
    callsign: "JAPANAIR",
    country: "일본"
  },
  {
    iata: "MM",
    icao: "APJ",
    name: "Peach Aviation",
    koreanName: "피치항공",
    callsign: "AIR PEACH",
    country: "일본"
  },
  {
    iata: "GK",
    icao: "JJP",
    name: "Jetstar Japan",
    koreanName: "제트스타재팬",
    callsign: "ORANGE LINER",
    country: "일본"
  },
  {
    iata: "JW",
    icao: "VNL",
    name: "Vanilla Air",
    koreanName: "바닐라에어",
    callsign: "VANILLA",
    country: "일본"
  },
  {
    iata: "NQ",
    icao: "AJX",
    name: "Air Japan",
    koreanName: "에어재팬",
    callsign: "AIR JAPAN",
    country: "일본"
  },
  {
    iata: "IJ",
    icao: "JJP",
    name: "Spring Airlines Japan",
    koreanName: "스프링항공재팬",
    callsign: "J-SPRING",
    country: "일본"
  },
  {
    iata: "7G",
    icao: "SFJ",
    name: "Star Flyer",
    koreanName: "스타플라이어",
    callsign: "STARFLYER",
    country: "일본"
  },
  {
    iata: "HD",
    icao: "ADO",
    name: "Air Do",
    koreanName: "에어도",
    callsign: "AIR DO",
    country: "일본"
  },
  {
    iata: "BC",
    icao: "SKY",
    name: "Skymark Airlines",
    koreanName: "스카이마크항공",
    callsign: "SKYMARK",
    country: "일본"
  },
  {
    iata: "JD",
    icao: "CBJ",
    name: "Japan Air Commuter",
    koreanName: "일본에어커뮤터",
    callsign: "COMMUTER",
    country: "일본"
  },
  {
    iata: "ZG",
    icao: "TZP",
    name: "ZIPAIR Tokyo",
    koreanName: "집에어도쿄",
    callsign: "ZIPPY",
    country: "일본"
  },

  // 중국
  {
    iata: "CA",
    icao: "CCA",
    name: "Air China",
    koreanName: "중국국제항공",
    callsign: "AIR CHINA",
    country: "중국"
  },
  {
    iata: "OKA",
    icao: "OKA",
    name: "Okay Airways",
    koreanName: "오케이항공",
    callsign: "OKAYJET",
    country: "중국"
  },
  {
    iata: "MU",
    icao: "CES",
    name: "China Eastern Airlines",
    koreanName: "중국동방항공",
    callsign: "CHINA EASTERN",
    country: "중국"
  },
  {
    iata: "CZ",
    icao: "CSN",
    name: "China Southern Airlines",
    koreanName: "중국남방항공",
    callsign: "CHINA SOUTHERN",
    country: "중국"
  },
  {
    iata: "HU",
    icao: "CHH",
    name: "Hainan Airlines",
    koreanName: "하이난항공",
    callsign: "HAINAN",
    country: "중국"
  },
  {
    iata: "3U",
    icao: "CSC",
    name: "Sichuan Airlines",
    koreanName: "사천항공",
    callsign: "SI CHUAN",
    country: "중국"
  },
  {
    iata: "MF",
    icao: "CXA",
    name: "Xiamen Airlines",
    koreanName: "하문항공",
    callsign: "XIAMEN AIR",
    country: "중국"
  },
  {
    iata: "GS",
    icao: "GCR",
    name: "Tianjin Airlines",
    koreanName: "천진항공",
    callsign: "BO HAI",
    country: "중국"
  },
  {
    iata: "9C",
    icao: "CQH",
    name: "Spring Airlines",
    koreanName: "춘추항공",
    callsign: "AIR SPRING",
    country: "중국"
  },
  {
    iata: "KN",
    icao: "CUA",
    name: "China United Airlines",
    koreanName: "중국연합항공",
    callsign: "LIANHANG",
    country: "중국"
  },
  {
    iata: "PN",
    icao: "CHB",
    name: "West Air",
    koreanName: "서부항공",
    callsign: "WEST CHINA",
    country: "중국"
  },

  // 대만
  {
    iata: "BR",
    icao: "EVA",
    name: "EVA Air",
    koreanName: "에바항공",
    callsign: "EVA",
    country: "대만"
  },
  {
    iata: "CI",
    icao: "CAL",
    name: "China Airlines",
    koreanName: "중화항공",
    callsign: "DYNASTY",
    country: "대만"
  },
  {
    iata: "IT",
    icao: "TTW",
    name: "Tigerair Taiwan",
    koreanName: "타이거에어대만",
    callsign: "SMART CAT",
    country: "대만"
  },
  {
    iata: "JX",
    icao: "SJX",
    name: "Starlux Airlines",
    koreanName: "스타룩스항공",
    callsign: "STARWALKER",
    country: "대만"
  },

  // 동남아시아
  {
    iata: "SQ",
    icao: "SIA",
    name: "Singapore Airlines",
    koreanName: "싱가포르항공",
    callsign: "SINGAPORE",
    country: "싱가포르"
  },
  {
    iata: "MI",
    icao: "SLK",
    name: "SilkAir",
    koreanName: "실크에어",
    callsign: "SILKAIR",
    country: "싱가포르"
  },
  {
    iata: "TR",
    icao: "TGW",
    name: "Scoot",
    koreanName: "스쿠트",
    callsign: "SCOOTER",
    country: "싱가포르"
  },
  {
    iata: "TG",
    icao: "THA",
    name: "Thai Airways International",
    koreanName: "타이항공",
    callsign: "THAI",
    country: "태국"
  },
  {
    iata: "FD",
    icao: "AIQ",
    name: "Thai AirAsia",
    koreanName: "타이에어아시아",
    callsign: "THAI ASIA",
    country: "태국"
  },
  {
    iata: "WE",
    icao: "THD",
    name: "Thai Smile",
    koreanName: "타이스마일",
    callsign: "THAI SMILE",
    country: "태국"
  },
  {
    iata: "SL",
    icao: "THM",
    name: "Thai Lion Air",
    koreanName: "타이라이언에어",
    callsign: "MENTARI",
    country: "태국"
  },
  {
    iata: "VN",
    icao: "HVN",
    name: "Vietnam Airlines",
    koreanName: "베트남항공",
    callsign: "VIET NAM AIRLINES",
    country: "베트남"
  },
  {
    iata: "VJ",
    icao: "VJC",
    name: "VietJet Air",
    koreanName: "비엣젯에어",
    callsign: "VIETJET",
    country: "베트남"
  },
  {
    iata: "BL",
    icao: "PAV",
    name: "Pacific Airlines",
    koreanName: "퍼시픽항공",
    callsign: "PACIFIC",
    country: "베트남"
  },
  {
    iata: "QH",
    icao: "BAV",
    name: "Bamboo Airways",
    koreanName: "밤부항공",
    callsign: "BAMBOO",
    country: "베트남"
  },
  {
    iata: "AK",
    icao: "AXM",
    name: "AirAsia",
    koreanName: "에어아시아",
    callsign: "RED CAP",
    country: "말레이시아"
  },
  {
    iata: "MH",
    icao: "MAS",
    name: "Malaysia Airlines",
    koreanName: "말레이시아항공",
    callsign: "MALAYSIAN",
    country: "말레이시아"
  },
  {
    iata: "D7",
    icao: "XAX",
    name: "AirAsia X",
    koreanName: "에어아시아X",
    callsign: "XANADU",
    country: "말레이시아"
  },
  {
    iata: "OD",
    icao: "MXD",
    name: "Malindo Air",
    koreanName: "말린도항공",
    callsign: "MALINDO",
    country: "말레이시아"
  },
  {
    iata: "GA",
    icao: "GIA",
    name: "Garuda Indonesia",
    koreanName: "가루다인도네시아",
    callsign: "INDONESIA",
    country: "인도네시아"
  },
  {
    iata: "JT",
    icao: "LNI",
    name: "Lion Air",
    koreanName: "라이온에어",
    callsign: "LION INTER",
    country: "인도네시아"
  },
  {
    iata: "SJ",
    icao: "SJY",
    name: "Sriwijaya Air",
    koreanName: "스리위자야항공",
    callsign: "SRIWIJAYA",
    country: "인도네시아"
  },
  {
    iata: "QG",
    icao: "CTV",
    name: "Citilink",
    koreanName: "시틀링크",
    callsign: "SUPERGREEN",
    country: "인도네시아"
  },
  {
    iata: "PR",
    icao: "PAL",
    name: "Philippine Airlines",
    koreanName: "필리핀항공",
    callsign: "PHILIPPINE",
    country: "필리핀"
  },
  {
    iata: "5J",
    icao: "CEB",
    name: "Cebu Pacific",
    koreanName: "세부퍼시픽",
    callsign: "CEBU",
    country: "필리핀"
  },
  {
    iata: "DG",
    icao: "SRQ",
    name: "Cebgo",
    koreanName: "세브고",
    callsign: "BLUE JAY",
    country: "필리핀"
  },
  {
    iata: "Z2",
    icao: "EZD",
    name: "AirAsia Zest",
    koreanName: "에어아시아제스트",
    callsign: "ZEST",
    country: "필리핀"
  },
  {
    iata: "6E",
    icao: "IGO",
    name: "IndiGo",
    koreanName: "인디고",
    callsign: "IFLY",
    country: "인도"
  },
  {
    iata: "AI",
    icao: "AIC",
    name: "Air India",
    koreanName: "에어인디아",
    callsign: "AIRINDIA",
    country: "인도"
  },
  {
    iata: "9W",
    icao: "JAI",
    name: "Jet Airways",
    koreanName: "제트항공",
    callsign: "JET AIRWAYS",
    country: "인도"
  },
  {
    iata: "SG",
    icao: "SEJ",
    name: "SpiceJet",
    koreanName: "스파이스젯",
    callsign: "SPICEJET",
    country: "인도"
  },
  {
    iata: "UK",
    icao: "VTI",
    name: "Vistara",
    koreanName: "비스타라",
    callsign: "VISTARA",
    country: "인도"
  },
  {
    iata: "I5",
    icao: "IAD",
    name: "AirAsia India",
    koreanName: "에어아시아인디아",
    callsign: "RED KNIGHT",
    country: "인도"
  },

  // ===== 북미 항공사 =====
  
  // 미국
  {
    iata: "AA",
    icao: "AAL",
    name: "American Airlines",
    koreanName: "아메리칸항공",
    callsign: "AMERICAN",
    country: "미국"
  },
  {
    iata: "DL",
    icao: "DAL",
    name: "Delta Air Lines",
    koreanName: "델타항공",
    callsign: "DELTA",
    country: "미국"
  },
  {
    iata: "UA",
    icao: "UAL",
    name: "United Airlines",
    koreanName: "유나이티드항공",
    callsign: "UNITED",
    country: "미국"
  },
  {
    iata: "WN",
    icao: "SWA",
    name: "Southwest Airlines",
    koreanName: "사우스웨스트항공",
    callsign: "SOUTHWEST",
    country: "미국"
  },
  {
    iata: "B6",
    icao: "JBU",
    name: "JetBlue Airways",
    koreanName: "제트블루항공",
    callsign: "JETBLUE",
    country: "미국"
  },
  {
    iata: "AS",
    icao: "ASA",
    name: "Alaska Airlines",
    koreanName: "알래스카항공",
    callsign: "ALASKA",
    country: "미국"
  },
  {
    iata: "NK",
    icao: "NKS",
    name: "Spirit Airlines",
    koreanName: "스피릿항공",
    callsign: "SPIRIT WINGS",
    country: "미국"
  },
  {
    iata: "F9",
    icao: "FFT",
    name: "Frontier Airlines",
    koreanName: "프론티어항공",
    callsign: "FRONTIER FLIGHT",
    country: "미국"
  },
  {
    iata: "HA",
    icao: "HAL",
    name: "Hawaiian Airlines",
    koreanName: "하와이안항공",
    callsign: "HAWAIIAN",
    country: "미국"
  },
  {
    iata: "VX",
    icao: "VRD",
    name: "Virgin America",
    koreanName: "버진아메리카",
    callsign: "REDWOOD",
    country: "미국"
  },
  {
    iata: "SY",
    icao: "SCX",
    name: "Sun Country Airlines",
    koreanName: "선컨트리항공",
    callsign: "SUN COUNTRY",
    country: "미국"
  },

  // 캐나다
  {
    iata: "AC",
    icao: "ACA",
    name: "Air Canada",
    koreanName: "에어캐나다",
    callsign: "AIR CANADA",
    country: "캐나다"
  },
  {
    iata: "WS",
    icao: "WJA",
    name: "WestJet",
    koreanName: "웨스트젯",
    callsign: "WESTJET",
    country: "캐나다"
  },
  {
    iata: "PD",
    icao: "POE",
    name: "Porter Airlines",
    koreanName: "포터항공",
    callsign: "PORTER",
    country: "캐나다"
  },
  {
    iata: "F8",
    icao: "FLE",
    name: "Flair Airlines",
    koreanName: "플레어항공",
    callsign: "FLAIR",
    country: "캐나다"
  },
  {
    iata: "TS",
    icao: "TSC",
    name: "Air Transat",
    koreanName: "에어트랜샛",
    callsign: "TRANSAT",
    country: "캐나다"
  },

  // ===== 유럽 항공사 =====
  
  // 영국
  {
    iata: "BA",
    icao: "BAW",
    name: "British Airways",
    koreanName: "브리티시항공",
    callsign: "SPEEDBIRD",
    country: "영국"
  },
  {
    iata: "VS",
    icao: "VIR",
    name: "Virgin Atlantic",
    koreanName: "버진애틀랜틱",
    callsign: "VIRGIN",
    country: "영국"
  },
  {
    iata: "U2",
    icao: "EZY",
    name: "easyJet",
    koreanName: "이지젯",
    callsign: "EASY",
    country: "영국"
  },
  {
    iata: "TUI",
    icao: "TOM",
    name: "TUI Airways",
    koreanName: "TUI항공",
    callsign: "TOMCAT",
    country: "영국"
  },

  // 독일
  {
    iata: "LH",
    icao: "DLH",
    name: "Lufthansa",
    koreanName: "루프트한자",
    callsign: "LUFTHANSA",
    country: "독일"
  },
  {
    iata: "EW",
    icao: "EWG",
    name: "Eurowings",
    koreanName: "유로윙스",
    callsign: "EUROWINGS",
    country: "독일"
  },
  {
    iata: "AB",
    icao: "BER",
    name: "Air Berlin",
    koreanName: "에어베를린",
    callsign: "AIR BERLIN",
    country: "독일"
  },
  {
    iata: "DE",
    icao: "CFG",
    name: "Condor",
    koreanName: "콘도르",
    callsign: "CONDOR",
    country: "독일"
  },

  // 프랑스
  {
    iata: "AF",
    icao: "AFR",
    name: "Air France",
    koreanName: "에어프랑스",
    callsign: "AIRFRANS",
    country: "프랑스"
  },
  {
    iata: "A5",
    icao: "AIG",
    name: "Aigle Azur",
    koreanName: "에글아주르",
    callsign: "AIGLE AZUR",
    country: "프랑스"
  },

  // 이탈리아
  {
    iata: "AZ",
    icao: "ITY",
    name: "ITA Airways",
    koreanName: "ITA항공",
    callsign: "ITARROW",
    country: "이탈리아"
  },

  // 아일랜드
  {
    iata: "FR",
    icao: "RYR",
    name: "Ryanair",
    koreanName: "라이언에어",
    callsign: "RYANAIR",
    country: "아일랜드"
  },
  {
    iata: "EI",
    icao: "EIN",
    name: "Aer Lingus",
    koreanName: "에어링구스",
    callsign: "SHAMROCK",
    country: "아일랜드"
  },
  {
    iata: "WX",
    icao: "BCS",
    name: "CityJet",
    koreanName: "시티젯",
    callsign: "CITYJET",
    country: "아일랜드"
  },

  // 네덜란드
  {
    iata: "KL",
    icao: "KLM",
    name: "KLM Royal Dutch Airlines",
    koreanName: "KLM네덜란드항공",
    callsign: "KLM",
    country: "네덜란드"
  },
  {
    iata: "HV",
    icao: "TRA",
    name: "Transavia",
    koreanName: "트랜스아비아",
    callsign: "TRANSAVIA",
    country: "네덜란드"
  },

  // 스페인
  {
    iata: "IB",
    icao: "IBE",
    name: "Iberia",
    koreanName: "이베리아항공",
    callsign: "IBERIA",
    country: "스페인"
  },
  {
    iata: "UX",
    icao: "AEA",
    name: "Air Europa",
    koreanName: "에어유로파",
    callsign: "EUROPA",
    country: "스페인"
  },
  {
    iata: "VY",
    icao: "VLG",
    name: "Vueling",
    koreanName: "뷰링",
    callsign: "VUELING",
    country: "스페인"
  },

  // 스위스
  {
    iata: "LX",
    icao: "SWR",
    name: "Swiss International Air Lines",
    koreanName: "스위스국제항공",
    callsign: "SWISS",
    country: "스위스"
  },

  // 오스트리아
  {
    iata: "OS",
    icao: "AUA",
    name: "Austrian Airlines",
    koreanName: "오스트리아항공",
    callsign: "AUSTRIAN",
    country: "오스트리아"
  },

  // 스칸디나비아
  {
    iata: "SK",
    icao: "SAS",
    name: "Scandinavian Airlines",
    koreanName: "스칸디나비아항공",
    callsign: "SCANDINAVIAN",
    country: "스웨덴"
  },
  {
    iata: "DY",
    icao: "NAX",
    name: "Norwegian Air Shuttle",
    koreanName: "노르웨이언에어셔틀",
    callsign: "NOR SHUTTLE",
    country: "노르웨이"
  },
  {
    iata: "AY",
    icao: "FIN",
    name: "Finnair",
    koreanName: "핀에어",
    callsign: "FINNAIR",
    country: "핀란드"
  },

  // 동유럽
  {
    iata: "LO",
    icao: "LOT",
    name: "LOT Polish Airlines",
    koreanName: "LOT폴란드항공",
    callsign: "POLLOT",
    country: "폴란드"
  },
  {
    iata: "OK",
    icao: "CSA",
    name: "Czech Airlines",
    koreanName: "체코항공",
    callsign: "CSA",
    country: "체코"
  },

  // ===== 러시아/구소련 항공사 =====
  {
    iata: "SU",
    icao: "AFL",
    name: "Aeroflot",
    koreanName: "아에로플로트",
    callsign: "AEROFLOT",
    country: "러시아"
  },
  {
    iata: "S7",
    icao: "SBI",
    name: "S7 Airlines",
    koreanName: "S7항공",
    callsign: "SIBERIAN",
    country: "러시아"
  },
  {
    iata: "UT",
    icao: "UTA",
    name: "UTair Aviation",
    koreanName: "UT에어항공",
    callsign: "UTAIR",
    country: "러시아"
  },
  {
    iata: "U6",
    icao: "SVR",
    name: "Ural Airlines",
    koreanName: "우랄항공",
    callsign: "SVERDLOVSK AIR",
    country: "러시아"
  },
  {
    iata: "FV",
    icao: "SDM",
    name: "Rossiya Airlines",
    koreanName: "로시야항공",
    callsign: "ROSSIYA",
    country: "러시아"
  },
  {
    iata: "DP",
    icao: "PBD",
    name: "Pobeda",
    koreanName: "포베다",
    callsign: "POBEDA",
    country: "러시아"
  },
  {
    iata: "WZ",
    icao: "WSF",
    name: "Red Wings Airlines",
    koreanName: "레드윙스항공",
    callsign: "RED WINGS",
    country: "러시아"
  },
  {
    iata: "N4",
    icao: "NWS",
    name: "Nordwind Airlines",
    koreanName: "노드윈드항공",
    callsign: "NORDWIND",
    country: "러시아"
  },
  {
    iata: "5N",
    icao: "AUL",
    name: "Aeroflot-Nord",
    koreanName: "아에로플로트노르드",
    callsign: "DVINA",
    country: "러시아"
  },
  {
    iata: "D2",
    icao: "SSF",
    name: "Severstal Air Company",
    koreanName: "세베르스탈항공",
    callsign: "SEVERSTAL",
    country: "러시아"
  },

  // ===== 중동 항공사 =====
  {
    iata: "EK",
    icao: "UAE",
    name: "Emirates",
    koreanName: "에미레이트항공",
    callsign: "EMIRATES",
    country: "아랍에미리트"
  },
  {
    iata: "QR",
    icao: "QTR",
    name: "Qatar Airways",
    koreanName: "카타르항공",
    callsign: "QATARI",
    country: "카타르"
  },
  {
    iata: "EY",
    icao: "ETD",
    name: "Etihad Airways",
    koreanName: "에티하드항공",
    callsign: "ETIHAD",
    country: "아랍에미리트"
  },
  {
    iata: "TK",
    icao: "THY",
    name: "Turkish Airlines",
    koreanName: "터키항공",
    callsign: "TURKISH",
    country: "터키"
  },
  {
    iata: "MNG",
    icao: "MNG",
    name: "MNG Airlines",
    koreanName: "MNG항공",
    callsign: "MNG",
    country: "터키"
  },
  {
    iata: "MS",
    icao: "MSR",
    name: "EgyptAir",
    koreanName: "이집트항공",
    callsign: "EGYPTAIR",
    country: "이집트"
  },
  {
    iata: "SV",
    icao: "SVA",
    name: "Saudia",
    koreanName: "사우디아",
    callsign: "SAUDIA",
    country: "사우디아라비아"
  },
  {
    iata: "KU",
    icao: "KAC",
    name: "Kuwait Airways",
    koreanName: "쿠웨이트항공",
    callsign: "KUWAITI",
    country: "쿠웨이트"
  },
  {
    iata: "GF",
    icao: "GFA",
    name: "Gulf Air",
    koreanName: "걸프항공",
    callsign: "GULF AIR",
    country: "바레인"
  },
  {
    iata: "WY",
    icao: "OMA",
    name: "Oman Air",
    koreanName: "오만항공",
    callsign: "OMAN AIR",
    country: "오만"
  },
  {
    iata: "J9",
    icao: "JZR",
    name: "Jazeera Airways",
    koreanName: "자지라항공",
    callsign: "JAZEERA",
    country: "쿠웨이트"
  },
  {
    iata: "FZ",
    icao: "FDB",
    name: "Flydubai",
    koreanName: "플라이두바이",
    callsign: "SKYDUBAI",
    country: "아랍에미리트"
  },
  {
    iata: "XY",
    icao: "FNE",
    name: "flynas",
    koreanName: "플라이나스",
    callsign: "NAS EXPRESS",
    country: "사우디아라비아"
  },

  // ===== 오세아니아 항공사 =====
  {
    iata: "QF",
    icao: "QFA",
    name: "Qantas",
    koreanName: "콴타스항공",
    callsign: "QANTAS",
    country: "호주"
  },
  {
    iata: "VA",
    icao: "VOZ",
    name: "Virgin Australia",
    koreanName: "버진오스트레일리아",
    callsign: "VELOCITY",
    country: "호주"
  },
  {
    iata: "JQ",
    icao: "JST",
    name: "Jetstar Airways",
    koreanName: "제트스타항공",
    callsign: "JETSTAR",
    country: "호주"
  },
  {
    iata: "NZ",
    icao: "ANZ",
    name: "Air New Zealand",
    koreanName: "에어뉴질랜드",
    callsign: "NEW ZEALAND",
    country: "뉴질랜드"
  },

  // ===== 남미 항공사 =====
  {
    iata: "JJ",
    icao: "TAM",
    name: "LATAM Brasil",
    koreanName: "라탐브라질",
    callsign: "TAM",
    country: "브라질"
  },
  {
    iata: "LA",
    icao: "LAN",
    name: "LATAM Airlines",
    koreanName: "라탐항공",
    callsign: "LAN",
    country: "칠레"
  },
  {
    iata: "AR",
    icao: "ARG",
    name: "Aerolíneas Argentinas",
    koreanName: "아에로리네아스아르헨티나스",
    callsign: "ARGENTINA",
    country: "아르헨티나"
  },
  {
    iata: "AV",
    icao: "AVA",
    name: "Avianca",
    koreanName: "아비앙카",
    callsign: "AVIANCA",
    country: "콜롬비아"
  },
  {
    iata: "CM",
    icao: "CMP",
    name: "Copa Airlines",
    koreanName: "코파항공",
    callsign: "COPA",
    country: "파나마"
  },
  {
    iata: "AM",
    icao: "AMX",
    name: "Aeroméxico",
    koreanName: "아에로멕시코",
    callsign: "AEROMEXICO",
    country: "멕시코"
  },

  // ===== 카고 전문 항공사 =====
  {
    iata: "5X",
    icao: "UPS",
    name: "UPS Airlines",
    koreanName: "UPS항공",
    callsign: "UPS",
    country: "미국"
  },
  {
    iata: "XAX",
    icao: "XAX",
    name: "AirAsia X",
    koreanName: "에어아시아X",
    callsign: "XANADU",
    country: "말레이시아"
  },
  {
    iata: "XAX",
    icao: "XAX",
    name: "AirAsia X",
    koreanName: "에어아시아X",
    callsign: "XANADU",
    country: "말레이시아"
  },
  {
    iata: "OKA",
    icao: "OKA",
    name: "Okay Airways",
    koreanName: "오케이항공",
    callsign: "OKAYJET",
    country: "중국"
  },
  {
    iata: "MMA",
    icao: "MMA",
    name: "Myanmar Airways International",
    koreanName: "미얀마항공",
    callsign: "MYANMAR",
    country: "미얀마"
  },
  {
    iata: "MML",
    icao: "MML",
    name: "Myanmar National Airlines",
    koreanName: "미얀마국영항공",
    callsign: "MYANMAR",
    country: "미얀마"
  },
  {
    iata: "MNG",
    icao: "MNG",
    name: "MNG Airlines",
    koreanName: "MNG항공",
    callsign: "MNG",
    country: "터키"
  },
  {
    iata: "MGL",
    icao: "MGL",
    name: "Mongolian Airlines",
    koreanName: "몽골항공",
    callsign: "MONGOL AIR",
    country: "몽골"
  },
  {
    iata: "MFX",
    icao: "MFX",
    name: "Mountain Air Express",
    koreanName: "마운틴에어익스프레스",
    callsign: "MOUNTAIN",
    country: "미국"
  },
  {
    iata: "LHA",
    icao: "LHA",
    name: "Lufthansa",
    koreanName: "루프트한자",
    callsign: "LUFTHANSA",
    country: "독일"
  },
  {
    iata: "KZR",
    icao: "KZR",
    name: "Kazakhstan Airlines",
    koreanName: "카자흐스탄항공",
    callsign: "KAZAKHSTAN",
    country: "카자흐스탄"
  },
  {
    iata: "HKE",
    icao: "HKE",
    name: "Hong Kong Express Airways",
    koreanName: "홍콩익스프레스항공",
    callsign: "HONGKONG SHUTTLE",
    country: "홍콩"
  },
  {
    iata: "GEC",
    icao: "GEC",
    name: "German Cargo",
    koreanName: "독일카고",
    callsign: "GERMAN CARGO",
    country: "독일"
  },
  {
    iata: "FX",
    icao: "FDX",
    name: "FedEx Express",
    koreanName: "페덱스익스프레스",
    callsign: "FEDEX",
    country: "미국"
  },
  {
    iata: "DHL",
    icao: "DHK",
    name: "DHL Aviation",
    koreanName: "DHL항공",
    callsign: "WORLD EXPRESS",
    country: "독일"
  },
  {
    iata: "3S",
    icao: "ABX",
    name: "ABX Air",
    koreanName: "ABX에어",
    callsign: "ABEX",
    country: "미국"
  },
  {
    iata: "AT",
    icao: "AMT",
    name: "Atlas Air",
    koreanName: "아틀라스에어",
    callsign: "GIANT",
    country: "미국"
  },
  {
    iata: "GTI",
    icao: "GTI",
    name: "Atlas Air",
    koreanName: "아틀라스에어",
    callsign: "GIANT",
    country: "미국"
  },
  {
    iata: "PO",
    icao: "PAC",
    name: "Polar Air Cargo",
    koreanName: "폴라에어카고",
    callsign: "POLAR",
    country: "미국"
  },
  {
    iata: "K4",
    icao: "CKS",
    name: "Kalitta Air",
    koreanName: "칼리타에어",
    callsign: "CONNIE",
    country: "미국"
  },
  {
    iata: "WGN",
    icao: "WGN",
    name: "Western Global Airlines",
    koreanName: "웨스턴글로벌항공",
    callsign: "WESTERN GLOBAL",
    country: "미국"
  },
  {
    iata: "QT",
    icao: "TPA",
    name: "Tampa Cargo",
    koreanName: "탐파카고",
    callsign: "TAMPA",
    country: "콜롬비아"
  },
  {
    iata: "CV",
    icao: "CLX",
    name: "Cargolux",
    koreanName: "카고룩스",
    callsign: "CARGOLUX",
    country: "룩셈부르크"
  },
  {
    iata: "CK",
    icao: "CAO",
    name: "China Cargo Airlines",
    koreanName: "중국카고항공",
    callsign: "CARGO KING",
    country: "중국"
  },
  {
    iata: "BR",
    icao: "EVA",
    name: "EVA Air Cargo",
    koreanName: "에바항공카고",
    callsign: "EVA CARGO",
    country: "대만"
  },
  {
    iata: "CI",
    icao: "CAL",
    name: "China Airlines Cargo",
    koreanName: "중화항공카고",
    callsign: "DYNASTY CARGO",
    country: "대만"
  },
  {
    iata: "LH",
    icao: "DLH",
    name: "Lufthansa Cargo",
    koreanName: "루프트한자카고",
    callsign: "LUFTHANSA CARGO",
    country: "독일"
  },
  {
    iata: "AF",
    icao: "AFR",
    name: "Air France Cargo",
    koreanName: "에어프랑스카고",
    callsign: "AIRFRANS CARGO",
    country: "프랑스"
  },
  {
    iata: "BA",
    icao: "BAW",
    name: "British Airways Cargo",
    koreanName: "브리티시항공카고",
    callsign: "SPEEDBIRD CARGO",
    country: "영국"
  },
  {
    iata: "KL",
    icao: "KLM",
    name: "KLM Cargo",
    koreanName: "KLM카고",
    callsign: "KLM CARGO",
    country: "네덜란드"
  },
  {
    iata: "SU",
    icao: "AFL",
    name: "Aeroflot Cargo",
    koreanName: "아에로플로트카고",
    callsign: "AEROFLOT CARGO",
    country: "러시아"
  },
  {
    iata: "QR",
    icao: "QTR",
    name: "Qatar Airways Cargo",
    koreanName: "카타르항공카고",
    callsign: "QATARI CARGO",
    country: "카타르"
  },
  {
    iata: "EK",
    icao: "UAE",
    name: "Emirates SkyCargo",
    koreanName: "에미레이트스카이카고",
    callsign: "EMIRATES CARGO",
    country: "아랍에미리트"
  },
  {
    iata: "EY",
    icao: "ETD",
    name: "Etihad Cargo",
    koreanName: "에티하드카고",
    callsign: "ETIHAD CARGO",
    country: "아랍에미리트"
  },
  {
    iata: "AC",
    icao: "ACA",
    name: "Air Canada Cargo",
    koreanName: "에어캐나다카고",
    callsign: "AIR CANADA CARGO",
    country: "캐나다"
  },
  {
    iata: "QF",
    icao: "QFA",
    name: "Qantas Freight",
    koreanName: "콴타스화물",
    callsign: "QANTAS FREIGHT",
    country: "호주"
  },
  {
    iata: "NZ",
    icao: "ANZ",
    name: "Air New Zealand Cargo",
    koreanName: "에어뉴질랜드카고",
    callsign: "NEW ZEALAND CARGO",
    country: "뉴질랜드"
  },
  {
    iata: "AM",
    icao: "AMX",
    name: "Aeroméxico Cargo",
    koreanName: "아에로멕시코카고",
    callsign: "AEROMEXICO CARGO",
    country: "멕시코"
  }
];

// 데이터 업데이트 날짜
export const AIRLINE_DATA_LAST_MODIFIED = new Date('2025-01-16');

