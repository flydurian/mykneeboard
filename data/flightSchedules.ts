// ============================================================================
// 압축된 항공편 스케줄 데이터 (용량 최적화)
// ============================================================================

import { FlightSchedule, CompressedFlightSchedule } from '../types';

// 압축된 스케줄 데이터 (배열 형태로 용량 대폭 절약)
export const COMPRESSED_FLIGHT_SCHEDULES: CompressedFlightSchedule[] = [
  // ============================================================================
  // FSC (전통항공사) 항공편
  // ============================================================================
  
  // KE (대한항공) - [항공편번호, 경로]
  ["ke35", "icn/atl"],
  ["ke36", "atl/icn"],
  ["ke37", "icn/ord"],
  ["ke38", "ord/icn"],
  ["ke31", "icn/dfw"],
  ["ke32", "dfw/icn"],
  ["ke53", "icn/hnl"],
  ["ke54", "hnl/icn"],
  ["ke5", "icn/las"],
  ["ke6", "las/icn"],
  ["ke11", "icn/lax"],
  ["ke12", "lax/icn"],
  ["ke17", "icn/lax"],
  ["ke18", "lax/icn"],
  ["ke81", "icn/jfk"],
  ["ke82", "jfk/icn"],
  ["ke85", "icn/jfk"],
  ["ke86", "jfk/icn"],
  ["ke23", "icn/sfo"],
  ["ke24", "sfo/icn"],
  ["ke25", "icn/sfo"],
  ["ke26", "sfo/icn"],
  ["ke213", "icn/sfo"],
  ["ke214", "sfo/icn"],
  ["ke19", "icn/sea"],
  ["ke20", "sea/icn"],
  ["ke93", "icn/iad"],
  ["ke94", "iad/icn"],
  ["ke89", "icn/bos"],
  ["ke90", "bos/icn"],
  ["ke901", "icn/syd"],
  ["ke902", "syd/icn"],
  ["ke913", "icn/akl"],
  ["ke914", "akl/icn"],
  ["ke521", "icn/lhr"],
  ["ke522", "lhr/icn"],
  ["ke501", "icn/cdg"],
  ["ke502", "cdg/icn"],
  ["ke541", "icn/fra"],
  ["ke542", "fra/icn"],
  ["ke511", "icn/bcn"],
  ["ke512", "bcn/icn"],
  ["ke545", "icn/prg"],
  ["ke546", "prg/icn"],
  ["ke547", "icn/mad"],
  ["ke548", "mad/icn"],
  ["ke531", "icn/ist"],
  ["ke532", "ist/icn"],
  ["ke951", "icn/dxb"],
  ["ke952", "dxb/icn"],
  ["ke955", "icn/tlv"],
  ["ke956", "tlv/icn"],
  ["ke731", "icn/tfu"],
  ["ke732", "tfu/icn"],
  ["ke423", "icn/nrt"],
  ["ke424", "nrt/icn"],
  ["ke425", "icn/gum"],
  ["ke426", "gum/icn"],
  ["ke733", "icn/ukb"],
  ["ke734", "ukb/icn"],
  ["ke625", "icn/mnl"],
  ["ke626", "mnl/icn"],
  ["ke657", "icn/bkk"],
  ["ke658", "bkk/icn"],
  ["ke453", "icn/han"],
  ["ke454", "han/icn"],
  ["ke477", "icn/sgn"],
  ["ke478", "sgn/icn"],
  ["ke841", "icn/pnh"],
  ["ke842", "pnh/icn"],
  ["ke861", "icn/hkg"],
  ["ke862", "hkg/icn"],
  ["ke851", "icn/pek"],
  ["ke852", "pek/icn"],
  ["ke831", "icn/sin"],
  ["ke832", "sin/icn"],
  ["ke843", "icn/tao"],
  ["ke844", "tao/icn"],
  ["ke895", "icn/pvg"],
  ["ke896", "pvg/icn"],
  ["ke2105", "gmp/hnd"],
  ["ke2106", "hnd/gmp"],
  ["ke2119", "gmp/kix"],
  ["ke2120", "kix/gmp"],
  ["ke2209", "gmp/sha"],
  ["ke2210", "sha/gmp"],
  ["ke2135", "pus/fuk"],
  ["ke2136", "fuk/pus"],
  ["ke2249", "pus/tpe"],
  ["ke2250", "tpe/pus"],
  ["ke189", "icn/rmq"],
  ["ke190", "rmq/icn"],
  ["ke169", "icn/mfm"],
  ["ke170", "mfm/icn"],
  ["ke634", "icn/dps"],
  ["ke633", "dps/icn"],
  ["ke721", "icn/ckg"],
  ["ke722", "ckg/icn"],
  ["ke711", "icn/ngo"],
  ["ke712", "ngo/icn"],
  ["ke713", "icn/csx"],
  ["ke714", "csx/icn"],
  ["ke751", "icn/hgh"],
  ["ke752", "hgh/icn"],
  ["ke791", "icn/nkg"],
  ["ke792", "nkg/icn"],
  ["ke811", "icn/ceb"],
  ["ke812", "ceb/icn"],
  ["ke813", "icn/she"],
  ["ke814", "she/icn"],
  ["ke871", "icn/ynj"],
  ["ke872", "ynj/icn"],
  ["ke891", "icn/cgo"],
  ["ke892", "cgo/icn"],
  ["ke939", "icn/del"],
  ["ke940", "del/icn"],
  ["ke943", "icn/mxp"],
  ["ke944", "mxp/icn"],
  ["ke911", "icn/vie"],
  ["ke912", "vie/icn"],
  ["ke917", "icn/yvr"],
  ["ke918", "yvr/icn"],
  ["ke915", "icn/yyz"],
  ["ke916", "yyz/icn"],
  ["ke671", "icn/kul"],
  ["ke672", "kul/icn"],
  ["ke957", "icn/bom"],
  ["ke958", "bom/icn"],
  ["ke549", "icn/muc"],
  ["ke550", "muc/icn"],
  ["ke821", "icn/crk"],
  ["ke822", "crk/icn"],
  ["ke561", "icn/zrh"],
  ["ke562", "zrh/icn"],
  ["ke909", "icn/bne"],
  ["ke910", "bne/icn"],
  ["ke681", "icn/cgk"],
  ["ke682", "cgk/icn"],
  ["ke761", "icn/cts"],
  ["ke762", "cts/icn"],
  
  // ============================================================================
  // 외국 항공사 항공편
  // ============================================================================
  
  // AA (아메리칸항공)
  ["aa177", "lax/icn"],
  ["aa178", "icn/lax"],
  ["aa281", "dfw/icn"],
  ["aa282", "icn/dfw"],
  
  // AF (에어프랑스)
  ["af264", "cdg/icn"],
  ["af267", "icn/cdg"],
  ["af508", "jfk/cdg"],
  ["af509", "cdg/jfk"],
  ["af552", "cdg/dxb"],
  ["af553", "dxb/cdg"],
  
  // DL (델타항공)
  ["dl157", "dtw/icn"],
  ["dl158", "icn/dtw"],
  ["dl171", "icn/msp"],
  ["dl172", "msp/icn"],
  ["dl196", "icn/sea"],
  ["dl197", "sea/icn"],
  ["dl27", "atl/icn"],
  ["dl28", "icn/atl"],
  
  // EK (에미레이트항공)
  ["ek322", "dxb/icn"],
  ["ek323", "icn/dxb"],
  ["ek348", "dxb/sin"],
  ["ek349", "sin/dxb"],
  ["ek404", "dxb/mel"],
  ["ek405", "mel/dxb"],
  
  // LH (루프트한자)
  ["lh222", "fra/jfk"],
  ["lh223", "jfk/fra"],
  ["lh712", "fra/icn"],
  ["lh713", "icn/fra"],
  ["lh716", "muc/icn"],
  ["lh717", "icn/muc"],
  
  // QR (카타르항공)
  ["qr705", "doh/jfk"],
  ["qr706", "jfk/doh"],
  ["qr858", "doh/icn"],
  ["qr859", "icn/doh"],
  ["qr900", "doh/per"],
  ["qr901", "per/doh"],
  
  // UA (유나이티드항공)
  ["ua7", "iah/icn"],
  ["ua8", "icn/iah"],
  ["ua731", "nrt/icn"],
  ["ua732", "icn/nrt"],
  ["ua803", "icn/ord"],
  ["ua804", "ord/icn"],
  ["ua891", "sfo/icn"],
  ["ua892", "icn/sfo"],
  
  // OZ (아시아나항공)
  ["oz521", "icn/lhr"],
  ["oz522", "lhr/icn"],
  ["oz501", "icn/cdg"],
  ["oz502", "cdg/icn"],
  ["oz541", "icn/fra"],
  ["oz542", "fra/icn"],
  ["oz511", "icn/bcn"],
  ["oz512", "bcn/icn"],
  ["oz545", "icn/prg"],
  ["oz546", "prg/icn"],
  ["oz561", "icn/fco"],
  ["oz562", "fco/icn"],
  ["oz761", "icn/cgk"],
  ["oz762", "cgk/icn"],
  ["oz1165", "gmp/kix"],
  ["oz1155", "kix/gmp"],
  ["oz3615", "gmp/sha"],
  ["oz3625", "sha/gmp"],
  ["oz1055", "gmp/hnd"],
  ["oz1065", "hnd/gmp"],
  ["oz703", "icn/mnl"],
  ["oz704", "mnl/icn"],
  ["oz707", "icn/crk"],
  ["oz708", "crk/icn"],
  ["oz709", "icn/ceb"],
  ["oz710", "ceb/icn"],
  ["oz741", "icn/bkk"],
  ["oz742", "bkk/icn"],
  ["oz725", "icn/hkt"],
  ["oz726", "hkt/icn"],
  ["oz377", "icn/dlc"],
  ["oz378", "dlc/icn"],
  ["oz339", "icn/hrb"],
  ["oz340", "hrb/icn"],
  ["oz367", "icn/pvg"],
  ["oz368", "pvg/icn"],
  ["oz177", "hnd/icn"],
  ["oz178", "icn/hnd"],
  ["oz112", "icn/kix"],
  ["oz111", "kix/icn"],
  ["oz102", "icn/nrt"],
  ["oz101", "nrt/icn"],
  ["oz573", "icn/tas"],
  ["oz574", "tas/icn"],
  ["oz751", "icn/sin"],
  ["oz752", "sin/icn"],
  ["oz212", "icn/sfo"],
  ["oz211", "sfo/icn"],
  ["oz222", "icn/jfk"],
  ["oz221", "jfk/icn"],
  ["oz731", "icn/hkg"],
  ["oz732", "hkg/icn"],
  ["oz735", "icn/sgn"],
  ["oz736", "sgn/icn"],
  ["oz737", "icn/pnh"],
  ["oz738", "pnh/icn"],
  ["oz571", "icn/ala"],
  ["oz572", "ala/icn"],
  ["oz601", "icn/syd"],
  ["oz602", "syd/icn"],
  ["oz701", "icn/pek"],
  ["oz702", "pek/icn"],
  ["oz711", "icn/cck"],
  ["oz712", "cck/icn"],
  ["oz721", "icn/csx"],
  ["oz722", "csx/icn"],
  ["oz731", "icn/tfu"],
  ["oz732", "tfu/icn"],
  ["oz741", "icn/ckg"],
  ["oz742", "ckg/icn"],
  ["oz751", "icn/dlc"],
  ["oz752", "dlc/icn"],
  ["oz761", "icn/can"],
  ["oz762", "can/icn"],
  ["oz771", "icn/kwl"],
  ["oz772", "kwl/icn"],
  ["oz781", "icn/hgh"],
  ["oz782", "hgh/icn"],
  ["oz791", "icn/hrb"],
  ["oz792", "hrb/icn"],
  ["oz801", "icn/nkg"],
  ["oz802", "nkg/icn"],
  ["oz811", "icn/tao"],
  ["oz812", "tao/icn"],
  ["oz821", "icn/pvg"],
  ["oz822", "pvg/icn"],
  ["oz831", "icn/szx"],
  ["oz832", "szx/icn"],
  ["oz841", "icn/tsn"],
  ["oz842", "tsn/icn"],
  ["oz851", "icn/ync"],
  ["oz852", "ync/icn"],
  ["oz861", "icn/ynj"],
  ["oz862", "ynj/icn"],
  ["oz871", "icn/cai"],
  ["oz872", "cai/icn"],
  ["oz881", "icn/ath"],
  ["oz882", "ath/icn"],
  ["oz891", "icn/akj"],
  ["oz892", "akj/icn"],
  ["oz901", "icn/fuk"],
  ["oz902", "fuk/icn"],
  ["oz911", "icn/kmj"],
  ["oz912", "kmj/icn"],
  ["oz921", "icn/myj"],
  ["oz922", "myj/icn"],
  ["oz931", "icn/ngo"],
  ["oz932", "ngo/icn"],
  ["oz941", "icn/oka"],
  ["oz942", "oka/icn"],
  ["oz951", "icn/kix"],
  ["oz952", "kix/icn"],
  ["oz961", "icn/asj"],
  ["oz962", "asj/icn"],
  ["oz971", "icn/fuk"],
  ["oz972", "fuk/icn"],
  ["oz981", "icn/kmj"],
  ["oz982", "kmj/icn"],
  ["oz991", "icn/myj"],
  ["oz992", "myj/icn"],
  ["oz1001", "icn/ngo"],
  ["oz1002", "ngo/icn"],
  ["oz1003", "icn/oka"],
  ["oz1004", "oka/icn"],
  ["oz1005", "icn/kix"],
  ["oz1006", "kix/icn"],
  ["oz1007", "icn/asj"],
  ["oz1008", "asj/icn"],
  ["oz1009", "icn/fuk"],
  ["oz1010", "fuk/icn"],
  ["oz1011", "icn/kmj"],
  ["oz1012", "kmj/icn"],
  ["oz1013", "icn/myj"],
  ["oz1014", "myj/icn"],
  ["oz1015", "icn/ngo"],
  ["oz1016", "ngo/icn"],
  ["oz1017", "icn/oka"],
  ["oz1018", "oka/icn"],
  ["oz1019", "icn/kix"],
  ["oz1020", "kix/icn"],
  ["oz1021", "icn/asj"],
  ["oz1022", "asj/icn"],
  ["oz1023", "icn/fuk"],
  ["oz1024", "fuk/icn"],
  ["oz1025", "icn/kmj"],
  ["oz1026", "kmj/icn"],
  ["oz1027", "icn/myj"],
  ["oz1028", "myj/icn"],
  ["oz1029", "icn/ngo"],
  ["oz1030", "ngo/icn"],
  ["oz1031", "icn/oka"],
  ["oz1032", "oka/icn"],
  ["oz1033", "icn/kix"],
  ["oz1034", "kix/icn"],
  ["oz1035", "icn/asj"],
  ["oz1036", "asj/icn"],
  ["oz1037", "icn/fuk"],
  ["oz1038", "fuk/icn"],
  ["oz1039", "icn/kmj"],
  ["oz1040", "kmj/icn"],
  ["oz1041", "icn/myj"],
  ["oz1042", "myj/icn"],
  ["oz1043", "icn/ngo"],
  ["oz1044", "ngo/icn"],
  ["oz1045", "icn/oka"],
  ["oz1046", "oka/icn"],
  ["oz1047", "icn/kix"],
  ["oz1048", "kix/icn"],
  ["oz1049", "icn/asj"],
  ["oz1050", "asj/icn"],
  ["oz1051", "icn/fuk"],
  ["oz1052", "fuk/icn"],
  ["oz1053", "icn/kmj"],
  ["oz1054", "kmj/icn"],
  ["oz1055", "icn/myj"],
  ["oz1056", "myj/icn"],
  ["oz1057", "icn/ngo"],
  ["oz1058", "ngo/icn"],
  ["oz1059", "icn/oka"],
  ["oz1060", "oka/icn"],
  ["oz1061", "icn/kix"],
  ["oz1062", "kix/icn"],
  ["oz1063", "icn/asj"],
  ["oz1064", "asj/icn"],
  
  // OZ SIM 스케줄 (시뮬레이터 훈련)
  ["ozsim1", "icn/icn"],
  ["ozsim2", "icn/icn"],
  ["ozsim3", "icn/icn"],
  ["ozsim4", "icn/icn"],
  ["ozsim5", "icn/icn"],
  
  // ============================================================================
  // LCC (저비용항공사) 항공편
  // ============================================================================
  
  // LJ (진에어)
  ["lj201", "icn/nrt"],
  ["lj202", "nrt/icn"],
  ["lj231", "icn/kix"],
  ["lj236", "kix/icn"],
  ["lj261", "icn/fuk"],
  ["lj262", "fuk/icn"],
  ["lj291", "pus/fuk"],
  ["lj292", "fuk/pus"],
  ["lj223", "pus/nrt"],
  ["lj224", "nrt/pus"],
  ["lj253", "pus/kix"],
  ["lj254", "kix/pus"],
  ["lj375", "pus/ngo"],
  ["lj376", "ngo/pus"],
  ["lj311", "pus/cts"],
  ["lj312", "cts/pus"],
  ["lj371", "pus/oka"],
  ["lj372", "oka/pus"],
  ["lj111", "pus/dad"],
  ["lj112", "dad/pus"],
  ["lj115", "pus/cxr"],
  ["lj116", "cxr/pus"],
  ["lj65", "pus/crk"],
  ["lj66", "crk/pus"],
  ["lj731", "icn/tpe"],
  ["lj732", "tpe/icn"],
  ["lj9", "icn/cnx"],
  ["lj10", "cnx/icn"],
  ["lj81", "icn/dad"],
  ["lj82", "dad/icn"],
  ["lj357", "icn/shi"],
  ["lj358", "shi/icn"],
  ["lj361", "icn/isg"],
  ["lj362", "isg/icn"],
  ["lj819", "cju/pvg"],
  ["lj820", "pvg/cju"],
  ["lj919", "icn/gum"],
  ["lj920", "gum/icn"],
  ["lj921", "pus/gum"],
  ["lj922", "gum/pus"],
  ["lj861", "icn/tao"],
  ["lj862", "tao/icn"],
  ["lj701", "icn/sin"],
  ["lj702", "sin/icn"],
  ["lj711", "icn/hkg"],
  ["lj712", "hkg/icn"],
  ["lj721", "icn/bkk"],
  ["lj722", "bkk/icn"],
  
  // TW (티웨이항공)
  ["tw977", "gmp/pus"],
  ["tw971", "gmp/pus"],
  ["tw923", "gmp/pus"],
  ["tw973", "gmp/pus"],
  ["tw925", "gmp/pus"],
  ["tw975", "gmp/pus"],
  ["tw927", "gmp/pus"],
  ["tw922", "pus/gmp"],
  ["tw972", "pus/gmp"],
  ["tw924", "pus/gmp"],
  ["tw974", "pus/gmp"],
  ["tw926", "pus/gmp"],
  ["tw976", "pus/gmp"],
  ["tw978", "pus/gmp"],
  ["tw701", "gmp/cju"],
  ["tw703", "gmp/cju"],
  ["tw751", "gmp/cju"],
  ["tw707", "gmp/cju"],
  ["tw709", "gmp/cju"],
  ["tw713", "gmp/cju"],
  ["tw715", "gmp/cju"],
  ["tw717", "gmp/cju"],
  ["tw723", "gmp/cju"],
  ["tw721", "gmp/cju"],
  ["tw725", "gmp/cju"],
  ["tw755", "gmp/cju"],
  ["tw727", "gmp/cju"],
  ["tw731", "gmp/cju"],
  ["tw733", "gmp/cju"],
  ["tw735", "gmp/cju"],
  ["tw702", "cju/gmp"],
  ["tw706", "cju/gmp"],
  ["tw708", "cju/gmp"],
  ["tw710", "cju/gmp"],
  ["tw712", "cju/gmp"],
  ["tw718", "cju/gmp"],
  ["tw716", "cju/gmp"],
  ["tw720", "cju/gmp"],
  ["tw754", "cju/gmp"],
  ["tw722", "cju/gmp"],
  ["tw724", "cju/gmp"],
  ["tw726", "cju/gmp"],
  ["tw728", "cju/gmp"],
  ["tw734", "cju/gmp"],
  ["tw736", "cju/gmp"],
  ["tw752", "cju/gmp"],
  ["tw801", "tae/cju"],
  ["tw803", "tae/cju"],
  ["tw805", "tae/cju"],
  ["tw807", "tae/cju"],
  ["tw809", "tae/cju"],
  ["tw811", "tae/cju"],
  ["tw813", "tae/cju"],
  ["tw802", "cju/tae"],
  ["tw804", "cju/tae"],
  ["tw806", "cju/tae"],
  ["tw808", "cju/tae"],
  ["tw810", "cju/tae"],
  ["tw812", "cju/tae"],
  ["tw814", "cju/tae"],
  ["tw841", "cjj/cju"],
  ["tw843", "cjj/cju"],
  ["tw835", "cjj/cju"],
  ["tw837", "cjj/cju"],
  ["tw839", "cjj/cju"],
  ["tw845", "cjj/cju"],
  ["tw842", "cju/cjj"],
  ["tw836", "cju/cjj"],
  ["tw838", "cju/cjj"],
  ["tw844", "cju/cjj"],
  ["tw840", "cju/cjj"],
  ["tw846", "cju/cjj"],
  ["tw901", "kwj/cju"],
  ["tw903", "kwj/cju"],
  ["tw905", "kwj/cju"],
  ["tw907", "kwj/cju"],
  ["tw902", "cju/kwj"],
  ["tw904", "cju/kwj"],
  ["tw906", "cju/kwj"],
  ["tw908", "cju/kwj"],
  ["tw671", "icn/khh"],
  ["tw672", "khh/icn"],
  ["tw505", "icn/gum"],
  ["tw506", "gum/icn"],
  ["tw287", "icn/kmj"],
  ["tw288", "kmj/icn"],
  ["tw187", "icn/cxr"],
  ["tw188", "cxr/icn"],
  ["tw173", "icn/dad"],
  ["tw175", "icn/dad"],
  ["tw176", "dad/icn"],
  ["tw172", "dad/icn"],
  ["tw174", "dad/icn"],
  ["tw241", "icn/nrt"],
  ["tw243", "icn/nrt"],
  ["tw245", "icn/nrt"],
  ["tw242", "nrt/icn"],
  ["tw244", "nrt/icn"],
  ["tw246", "nrt/icn"],
  ["tw405", "icn/fco"],
  ["tw406", "fco/icn"],
  ["tw407", "icn/bcn"],
  ["tw408", "bcn/icn"],
  ["tw101", "icn/bkk"],
  ["tw102", "bkk/icn"],
  ["tw531", "icn/yvr"],
  ["tw532", "yvr/icn"],
  ["tw125", "icn/klo"],
  ["tw126", "klo/icn"],
  ["tw437", "icn/fru"],
  ["tw438", "fru/icn"],
  ["tw285", "icn/hsg"],
  ["tw286", "hsg/icn"],
  ["tw263", "icn/cts"],
  ["tw264", "cts/icn"],
  ["tw613", "icn/she"],
  ["tw614", "she/icn"],
  ["tw501", "icn/syd"],
  ["tw502", "syd/icn"],
  ["tw161", "icn/sin"],
  ["tw162", "sin/icn"],
  ["tw301", "icn/kix"],
  ["tw303", "icn/kix"],
  ["tw305", "icn/kix"],
  ["tw302", "kix/icn"],
  ["tw304", "kix/icn"],
  ["tw306", "kix/icn"],
  ["tw281", "icn/oka"],
  ["tw282", "oka/icn"],
  ["tw615", "icn/wuh"],
  ["tw616", "wuh/icn"],
  ["tw421", "icn/uln"],
  ["tw422", "uln/icn"],
  ["tw409", "icn/zag"],
  ["tw410", "zag/icn"],
  ["tw149", "icn/bki"],
  ["tw150", "bki/icn"],
  ["tw431", "icn/tas"],
  ["tw432", "tas/icn"],
  ["tw669", "icn/rmq"],
  ["tw670", "rmq/icn"],
  ["tw401", "icn/cdg"],
  ["tw402", "cdg/icn"],
  ["tw403", "icn/fra"],
  ["tw404", "fra/icn"],
  ["tw643", "icn/hkg"],
  ["tw644", "hkg/icn"],
  ["tw203", "icn/fuk"],
  ["tw201", "icn/fuk"],
  ["tw205", "icn/fuk"],
  ["tw207", "icn/fuk"],
  ["tw204", "fuk/icn"],
  ["tw202", "fuk/icn"],
  ["tw206", "fuk/icn"],
  ["tw208", "fuk/icn"],
  ["tw651", "gmp/khh"],
  ["tw652", "khh/gmp"],
  ["tw667", "gmp/tsa"],
  ["tw668", "tsa/gmp"],
  ["tw689", "cju/khh"],
  ["tw690", "khh/cju"],
  ["tw165", "cju/sin"],
  ["tw166", "sin/cju"],
  ["tw331", "cju/kix"],
  ["tw332", "kix/cju"],
  ["tw687", "cju/tpe"],
  ["tw688", "tpe/cju"],
  ["tw191", "tae/cxr"],
  ["tw192", "cxr/tae"],
  ["tw183", "tae/dad"],
  ["tw184", "dad/tae"],
  ["tw251", "tae/nrt"],
  ["tw253", "tae/nrt"],
  ["tw252", "nrt/tae"],
  ["tw254", "nrt/tae"],
  ["tw105", "tae/bkk"],
  ["tw106", "bkk/tae"],
  ["tw509", "tae/kix"],
  ["tw313", "tae/kix"],
  ["tw314", "kix/tae"],
  ["tw510", "kix/tae"],
  ["tw423", "tae/uln"],
  ["tw424", "uln/tae"],
  ["tw681", "tae/dyg"],
  ["tw682", "dyg/tae"],
  ["tw663", "tae/tpe"],
  ["tw664", "tpe/tae"],
  ["tw213", "tae/fuk"],
  ["tw215", "tae/fuk"],
  ["tw214", "fuk/tae"],
  ["tw216", "fuk/tae"],
  ["tw195", "cjj/cxr"],
  ["tw196", "cxr/cjj"],
  ["tw181", "cjj/dad"],
  ["tw182", "dad/cjj"],
  ["tw327", "cjj/kix"],
  ["tw328", "kix/cjj"],
  ["tw425", "cjj/uln"],
  ["tw426", "uln/cjj"],
  ["tw225", "cjj/fuk"],
  ["tw226", "fuk/cjj"],
  ["tw319", "pus/kix"],
  ["tw320", "kix/pus"],
  ["tw509", "kix/gum"],
  ["tw510", "gum/kix"],
  
  // 7C (제주항공)
  ["7c1121", "icn/nrt"],
  ["7c1122", "nrt/icn"],
  ["7c1154", "nrt/pus"],
  ["7c1203", "icn/ngo"],
  ["7c1204", "ngo/icn"],
  ["7c1301", "icn/kix"],
  ["7c1302", "kix/icn"],
  ["7c1327", "gmp/kix"],
  ["7c1328", "kix/gmp"],
  ["7c1354", "kix/pus"],
  ["7c1405", "icn/fuk"],
  ["7c1408", "fuk/icn"],
  ["7c1454", "fuk/pus"],
  ["7c1501", "icn/cts"],
  ["7c1504", "cts/icn"],
  ["7c1603", "icn/fsz"],
  ["7c1604", "fsz/icn"],
  ["7c1611", "icn/hij"],
  ["7c1703", "icn/myj"],
  ["7c1704", "myj/icn"],
  ["7c1801", "icn/oka"],
  ["7c1802", "oka/icn"],
  ["7c2103", "icn/mnl"],
  ["7c2104", "mnl/icn"],
  ["7c2113", "icn/ceb"],
  ["7c2125", "icn/tag"],
  ["7c2126", "tag/icn"],
  ["7c2201", "icn/han"],
  ["7c2202", "han/icn"],
  ["7c2217", "icn/dad"],
  ["7c2218", "dad/icn"],
  ["7c2303", "icn/cxr"],
  ["7c2304", "cxr/icn"],
  ["7c2401", "icn/vte"],
  ["7c2402", "vte/icn"],
  ["7c2621", "icn/sin"],
  ["7c2622", "sin/icn"],
  ["7c2662", "sin/pus"],
  ["7c6001", "icn/mfm"],
  ["7c6002", "mfm/icn"],
  ["7c6011", "icn/hkg"],
  ["7c6012", "hkg/icn"],
  ["7c6101", "icn/tpe"],
  ["7c6156", "tpe/pus"],
  ["7c8401", "icn/tao"],
  ["7c8402", "tao/icn"],
  ["7c8501", "icn/weh"],
  ["7c8502", "weh/icn"],
  ["7c8906", "hrb/icn"],
  ["7c701", "icn/sgn"],
  ["7c702", "sgn/icn"],
  
  // ZE (이스타항공)
  ["ze511", "icn/bkk"],
  ["ze512", "bkk/icn"],
  ["ze517", "icn/cnx"],
  ["ze518", "cnx/icn"],
  ["ze561", "icn/cxr"],
  ["ze562", "cxr/icn"],
  ["ze581", "icn/pqc"],
  ["ze582", "pqc/icn"],
  ["ze593", "icn/dad"],
  ["ze594", "dad/icn"],
  ["ze603", "icn/nrt"],
  ["ze604", "nrt/icn"],
  ["ze611", "icn/kix"],
  ["ze612", "kix/icn"],
  ["ze621", "icn/cts"],
  ["ze624", "cts/icn"],
  ["ze631", "icn/oka"],
  ["ze632", "oka/icn"],
  ["ze643", "icn/fuk"],
  ["ze644", "fuk/icn"],
  ["ze671", "icn/tks"],
  ["ze672", "tks/icn"],
  ["ze853", "icn/cgo"],
  ["ze854", "cgo/icn"],
  ["ze871", "icn/pvg"],
  ["ze872", "pvg/icn"],
  ["ze881", "icn/tpe"],
  ["ze882", "tpe/icn"],
  ["ze885", "cju/tpe"],
  ["ze886", "tpe/cju"],
  ["ze887", "gmp/tsa"],
  ["ze888", "tsa/gmp"],
  ["ze135", "icn/ala"],
  ["ze136", "ala/icn"],
  ["ze701", "icn/hkg"],
  ["ze702", "hkg/icn"],
  ["ze711", "icn/sin"],
  ["ze712", "sin/icn"],
  
  // BX (에어부산)
  ["bx748", "bkk/icn"],
  ["bx747", "icn/bkk"],
  ["bx793", "pus/tpe"],
  ["bx794", "tpe/pus"],
  ["bx165", "nrt/icn"],
  ["bx166", "icn/nrt"],
  ["bx173", "kix/icn"],
  ["bx174", "icn/kix"],
  ["bx158", "icn/fuk"],
  ["bx157", "fuk/icn"],
  ["bx602", "dps/pus"],
  ["bx601", "pus/dps"],
  ["bx788", "cxr/icn"],
  ["bx112", "pus/nrt"],
  ["bx111", "nrt/pus"],
  ["bx145", "fuk/pus"],
  ["bx146", "pus/fuk"],
  ["bx411", "pus/ubn"],
  ["bx711", "pus/ceb"],
  ["bx774", "dad/pus"],
  ["bx773", "pus/dad"],
  ["bx121", "kix/pus"],
  ["bx122", "pus/kix"],
  ["bx725", "pus/bkk"],
  ["bx726", "bkk/pus"],
  ["bx182", "pus/cts"],
  ["bx181", "cts/pus"],
  ["bx712", "ceb/pus"],
  ["bx372", "dyg/pus"],
  ["bx371", "pus/dyg"],
  ["bx795", "pus/khh"],
  ["bx796", "khh/pus"],
  ["bx752", "cxr/pus"],
  ["bx751", "pus/cxr"],
  ["bx746", "vte/pus"],
  ["bx762", "bki/pus"],
  ["bx761", "pus/bki"],
  ["bx381", "pus/mfm"],
  ["bx382", "mfm/pus"],
  ["bx322", "tao/pus"],
  ["bx321", "pus/tao"],
  ["bx701", "icn/sgn"],
  ["bx702", "sgn/icn"],
  ["bx731", "icn/hkt"],
  ["bx732", "hkt/icn"],
  
  // RS (에어서울)
  ["rs801", "icn/kix"],
  ["rs802", "kix/icn"],
  ["rs811", "icn/nrt"],
  ["rs812", "nrt/icn"],
  ["rs821", "icn/fuk"],
  ["rs822", "fuk/icn"],
  ["rs831", "icn/cxr"],
  ["rs832", "cxr/icn"],
  ["rs841", "icn/dad"],
  ["rs842", "dad/icn"],
  ["rs851", "icn/tag"],
  ["rs852", "tag/icn"],
  ["rs861", "icn/tao"],
  ["rs862", "tao/icn"],
  ["rs871", "icn/pvg"],
  ["rs872", "pvg/icn"],
  ["rs881", "icn/hkt"],
  ["rs882", "hkt/icn"],
  ["rs891", "icn/ygj"],
  ["rs892", "ygj/icn"],
  ["rs901", "icn/sin"],
  ["rs902", "sin/icn"],
  ["rs911", "icn/hkg"],
  ["rs912", "hkg/icn"],
  
  // YP (에어프레미아)
  ["yp601", "icn/lax"],
  ["yp602", "lax/icn"],
  ["yp611", "icn/sfo"],
  ["yp612", "sfo/icn"],
  ["yp621", "icn/ewr"],
  ["yp622", "ewr/icn"],
  ["yp651", "icn/hnl"],
  ["yp652", "hnl/icn"],
  ["yp701", "icn/nrt"],
  ["yp702", "nrt/icn"],
  ["yp731", "icn/bkk"],
  ["yp732", "bkk/icn"],
  ["yp741", "icn/hkg"],
  ["yp742", "hkg/icn"],
  ["yp751", "icn/dad"],
  ["yp752", "dad/icn"],
  ["yp761", "icn/sin"],
  ["yp762", "sin/icn"],
  ["yp771", "icn/syd"],
  ["yp772", "syd/icn"],
  
  // RF (에어로케이항공)
  ["rf201", "cjj/nrt"],
  ["rf202", "nrt/cjj"],
  ["rf211", "cjj/kix"],
  ["rf212", "kix/cjj"],
  ["rf221", "cjj/cts"],
  ["rf222", "cts/cjj"],
  ["rf301", "cjj/tpe"],
  ["rf302", "tpe/cjj"],
  ["rf311", "cjj/crk"],
  ["rf312", "crk/cjj"],
  ["rf321", "cjj/dad"],
  ["rf322", "dad/cjj"],
  ["rf331", "cjj/tao"],
  ["rf332", "tao/cjj"],
  ["rf341", "cjj/ngo"],
  ["rf342", "ngo/cjj"],
  ["rf351", "cjj/fuk"],
  ["rf352", "fuk/cjj"],
  ["rf361", "cjj/ibr"],
  ["rf362", "ibr/cjj"],
  ["rf371", "cjj/obo"],
  ["rf372", "obo/cjj"],
  ["rf381", "cjj/ubn"],
  ["rf382", "ubn/cjj"],
  ["rf401", "cjj/sin"],
  ["rf402", "sin/cjj"],
  ["rf411", "cjj/hkg"],
  ["rf412", "hkg/cjj"]
];

// 압축된 데이터를 FlightSchedule 객체로 변환하는 함수
export function decompressSchedule(compressed: CompressedFlightSchedule): FlightSchedule {
  return {
    airlineFlightNumber: compressed[0],
    route: compressed[1],
    std: '', // 시간 정보 제거
    sta: ''  // 시간 정보 제거
  };
}

// 압축된 데이터 배열을 FlightSchedule 객체 배열로 변환
export function decompressSchedules(compressed: CompressedFlightSchedule[]): FlightSchedule[] {
  return compressed.map(decompressSchedule);
}

// IATA/ICAO 코드 변환 맵
const IATA_TO_ICAO_MAP: { [key: string]: string } = {
  'OZ': 'AAR',  // Asiana Airlines
  'KE': 'KAL',  // Korean Air
  '7C': 'JJA',  // Jeju Air
  'TW': 'TWB',  // T'way Air
  'BX': 'ABL',  // Air Busan
  'ZE': 'ESR',  // Eastar Jet
  'LJ': 'JNA',  // Jin Air
  'RS': 'ASV',  // Air Seoul
  'YP': 'APZ',  // Air Premia
  'RF': 'EOK',  // Aerokorea
  'NH': 'ANA',  // All Nippon Airways
  'JL': 'JAL',  // Japan Airlines
  'MM': 'APJ',  // Peach Aviation
};

// ICAO/IATA 코드를 정규화하는 함수
const normalizeAirlineCode = (code: string): string[] => {
  const upperCode = code.toUpperCase();
  
  // 이미 ICAO 코드인 경우 (3글자)
  if (upperCode.length === 3) {
    return [upperCode];
  }
  
  // IATA 코드인 경우 ICAO로 변환
  const icaoCode = IATA_TO_ICAO_MAP[upperCode];
  if (icaoCode) {
    return [upperCode, icaoCode]; // IATA와 ICAO 모두 반환
  }
  
  return [upperCode];
};

// 압축된 데이터에서 검색
export function searchCompressedSchedules(query: string): FlightSchedule[] {
  if (!query.trim()) return [];
  
  const searchTerm = query.toLowerCase();
  console.log('🔍 searchCompressedSchedules 호출:', searchTerm);
  const results = COMPRESSED_FLIGHT_SCHEDULES.filter(compressed => {
    const [flightNumber, route] = compressed; // 시간 정보 제거
    const [departure, arrival] = route.split('/');
    const airline = flightNumber.replace(/[0-9]/g, '').toUpperCase();
    const flightNum = flightNumber.replace(/[A-Za-z]/g, '');
    
    // 항공사 코드 정규화
    const normalizedCodes = normalizeAirlineCode(airline);
    
    // 검색어에서 항공사 코드와 번호 분리
    const searchMatch = searchTerm.match(/^([a-z]+)(\d+)$/);
    if (searchMatch) {
      const [, searchAirline, searchNumber] = searchMatch;
      const searchAirlineUpper = searchAirline.toUpperCase();
      
      // 검색어의 항공사 코드도 정규화
      const searchNormalizedCodes = normalizeAirlineCode(searchAirlineUpper);
      
      // 항공사 코드와 번호가 모두 일치하는지 확인
      const airlineMatch = normalizedCodes.some(code => 
        searchNormalizedCodes.some(searchCode => code === searchCode)
      );
      const numberMatch = flightNum === searchNumber;
      
      if (airlineMatch && numberMatch) {
        return true;
      }
    }
    
    // 기존 검색 로직 (부분 일치)
    return flightNumber.toLowerCase().includes(searchTerm) ||
           route.toLowerCase().includes(searchTerm) ||
           departure?.toLowerCase().includes(searchTerm) ||
           arrival?.toLowerCase().includes(searchTerm) ||
           normalizedCodes.some(code => code.toLowerCase().includes(searchTerm));
  });
  
  console.log('🔍 searchCompressedSchedules 결과:', results.length, '개');
  return results.map(decompressSchedule);
}

// SIM 스케줄 구분 함수
export function isSimSchedule(flightNumber: string): boolean {
  return flightNumber.toLowerCase().includes('sim');
}

// OZ 스케줄에서 SIM과 일반 스케줄을 구분하는 함수
export function categorizeOzSchedules(schedules: FlightSchedule[]): {
  simSchedules: FlightSchedule[];
  regularSchedules: FlightSchedule[];
} {
  const simSchedules: FlightSchedule[] = [];
  const regularSchedules: FlightSchedule[] = [];
  
  schedules.forEach(schedule => {
    if (schedule.airlineFlightNumber.toLowerCase().startsWith('oz') && 
        isSimSchedule(schedule.airlineFlightNumber)) {
      simSchedules.push(schedule);
    } else {
      regularSchedules.push(schedule);
    }
  });
  
  return { simSchedules, regularSchedules };
}

// 압축된 데이터에서 SIM 스케줄만 필터링하는 함수
export function getSimSchedules(): FlightSchedule[] {
  const simSchedules = COMPRESSED_FLIGHT_SCHEDULES.filter(compressed => {
    const [flightNumber] = compressed;
    return flightNumber.toLowerCase().startsWith('oz') && 
           isSimSchedule(flightNumber);
  });
  
  return simSchedules.map(decompressSchedule);
}

// 압축된 데이터에서 일반 OZ 스케줄만 필터링하는 함수
export function getRegularOzSchedules(): FlightSchedule[] {
  const regularOzSchedules = COMPRESSED_FLIGHT_SCHEDULES.filter(compressed => {
    const [flightNumber] = compressed;
    return flightNumber.toLowerCase().startsWith('oz') && 
           !isSimSchedule(flightNumber);
  });
  
  return regularOzSchedules.map(decompressSchedule);
}

// 달력 표시를 위한 스케줄 타입 구분 함수
export function getScheduleType(flightNumber: string): 'SIM' | 'REGULAR' | 'OTHER' {
  if (flightNumber.toLowerCase().startsWith('oz') && isSimSchedule(flightNumber)) {
    return 'SIM';
  } else if (flightNumber.toLowerCase().startsWith('oz')) {
    return 'REGULAR';
  } else {
    return 'OTHER';
  }
}

// 달력에서 사용할 스케줄 정보를 확장하는 함수
export function enhanceScheduleForCalendar(schedule: FlightSchedule): FlightSchedule & {
  scheduleType: 'SIM' | 'REGULAR' | 'OTHER';
  isSimSchedule: boolean;
} {
  const scheduleType = getScheduleType(schedule.airlineFlightNumber);
  
  return {
    ...schedule,
    scheduleType,
    isSimSchedule: scheduleType === 'SIM'
  };
}

// 특정 날짜의 SIM 스케줄을 검색하는 함수 (달력용)
export function searchSimSchedulesForDate(date: string, schedules: FlightSchedule[]): FlightSchedule[] {
  return schedules.filter(schedule => 
    schedule.airlineFlightNumber.toLowerCase().startsWith('oz') && 
    isSimSchedule(schedule.airlineFlightNumber)
  );
}

// 달력에서 스케줄을 그룹화하는 함수
export function groupSchedulesForCalendar(schedules: FlightSchedule[]): {
  simSchedules: FlightSchedule[];
  regularOzSchedules: FlightSchedule[];
  otherSchedules: FlightSchedule[];
} {
  const simSchedules: FlightSchedule[] = [];
  const regularOzSchedules: FlightSchedule[] = [];
  const otherSchedules: FlightSchedule[] = [];
  
  schedules.forEach(schedule => {
    const scheduleType = getScheduleType(schedule.airlineFlightNumber);
    
    switch (scheduleType) {
      case 'SIM':
        simSchedules.push(schedule);
        break;
      case 'REGULAR':
        regularOzSchedules.push(schedule);
        break;
      default:
        otherSchedules.push(schedule);
        break;
    }
  });
  
  return { simSchedules, regularOzSchedules, otherSchedules };
}

// SIM 스케줄의 시각적 표시를 위한 스타일 정보를 반환하는 함수
export function getSimScheduleStyle(flightNumber: string): {
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  label: string;
} {
  if (isSimSchedule(flightNumber)) {
    return {
      backgroundColor: '#e3f2fd', // 연한 파란색 배경
      textColor: '#1976d2',       // 진한 파란색 텍스트
      borderColor: '#2196f3',     // 파란색 테두리
      label: 'SIM'                // SIM 라벨
    };
  }
  
  return {
    backgroundColor: '#f5f5f5',   // 기본 회색 배경
    textColor: '#333333',         // 기본 검은색 텍스트
    borderColor: '#cccccc',       // 기본 회색 테두리
    label: 'REGULAR'              // 일반 라벨
  };
}

// 통계 정보
export function getCompressedStats() {
  const simCount = getSimSchedules().length;
  const regularOzCount = getRegularOzSchedules().length;
  
  return {
    totalFlights: COMPRESSED_FLIGHT_SCHEDULES.length,
    simSchedules: simCount,
    regularOzSchedules: regularOzCount,
    estimatedSize: JSON.stringify(COMPRESSED_FLIGHT_SCHEDULES).length,
    compressionRatio: '약 60-70% 용량 절약'
  };
}
