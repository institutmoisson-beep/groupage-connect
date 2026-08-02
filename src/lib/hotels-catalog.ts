/**
 * Supplier-agnostic hotel inventory.
 *
 * The shapes below mirror what a real aggregator (RateHawk / Hotelbeds / EPS)
 * returns, so `src/lib/hotels.functions.ts` can swap this local catalog for a
 * live supplier call without touching the UI.
 */

export interface HotelRate {
  id: string;
  room_type: string;
  room_type_zh: string;
  board_type: "room_only" | "breakfast" | "half_board";
  /** Supplier net rate per night, in XOF. */
  net_per_night_xof: number;
  refundable: boolean;
  free_cancellation_until_days: number;
  /** Whether the supplier allows paying at the hotel (Model 2). */
  pay_at_hotel: boolean;
  amenities: string[];
}

export interface Hotel {
  id: string;
  name: string;
  name_zh: string;
  address: string;
  address_zh: string;
  city: string;
  city_zh: string;
  country: string;
  lat: number;
  lng: number;
  star_rating: number;
  contact: string;
  description: string;
  /** Trade-oriented tags used by the filters. */
  trade_tags: TradeTag[];
  rates: HotelRate[];
  /** True for in-house "direct contracting" hotels managed from /admin/hotels. */
  is_direct_partner?: boolean;
  cover_image_url?: string;
  gallery_urls?: string[];
}

export type TradeTag =
  | "canton_fair_shuttle"
  | "english_staff"
  | "french_staff"
  | "fast_wifi"
  | "near_market"
  | "airport_shuttle"
  | "business_center"
  | "halal_food";

export const TRADE_TAG_LABELS: Record<TradeTag, string> = {
  canton_fair_shuttle: "Navette Foire de Canton",
  english_staff: "Personnel anglophone",
  french_staff: "Personnel francophone",
  fast_wifi: "Wi-Fi haut débit",
  near_market: "Proche marché de gros",
  airport_shuttle: "Navette aéroport",
  business_center: "Centre d'affaires",
  halal_food: "Restauration halal",
};

export const DESTINATIONS: Array<{ city: string; city_zh: string; country: string; trade: boolean }> = [
  { city: "Guangzhou", city_zh: "广州", country: "Chine", trade: true },
  { city: "Yiwu", city_zh: "义乌", country: "Chine", trade: true },
  { city: "Shenzhen", city_zh: "深圳", country: "Chine", trade: true },
  { city: "Shanghai", city_zh: "上海", country: "Chine", trade: true },
  { city: "Beijing", city_zh: "北京", country: "Chine", trade: true },
  { city: "Foshan", city_zh: "佛山", country: "Chine", trade: true },
  { city: "Hong Kong", city_zh: "香港", country: "Chine", trade: true },
  { city: "Dubaï", city_zh: "迪拜", country: "Émirats arabes unis", trade: false },
  { city: "Istanbul", city_zh: "伊斯坦布尔", country: "Turquie", trade: false },
  { city: "Paris", city_zh: "巴黎", country: "France", trade: false },
  { city: "Abidjan", city_zh: "阿比让", country: "Côte d'Ivoire", trade: false },
];

function rate(
  id: string,
  room_type: string,
  room_type_zh: string,
  net: number,
  opts: Partial<HotelRate> = {},
): HotelRate {
  return {
    id,
    room_type,
    room_type_zh,
    board_type: "breakfast",
    net_per_night_xof: net,
    refundable: true,
    free_cancellation_until_days: 3,
    pay_at_hotel: false,
    amenities: ["Climatisation", "Wi-Fi", "Coffre-fort"],
    ...opts,
  };
}

export const HOTELS: Hotel[] = [
  {
    id: "cn-gz-canton-trade",
    name: "Canton Trade Center Hotel",
    name_zh: "广州贸易中心酒店",
    address: "No. 380 Yuejiang Middle Road, Haizhu, Guangzhou",
    address_zh: "广东省广州市海珠区阅江中路380号",
    city: "Guangzhou",
    city_zh: "广州",
    country: "Chine",
    lat: 23.1032,
    lng: 113.3245,
    star_rating: 5,
    contact: "+86 20 8989 1000",
    description:
      "À 5 minutes du Complexe Pazhou (Foire de Canton). Navette gratuite pendant la foire, personnel anglophone et francophone, salles de réunion.",
    trade_tags: ["canton_fair_shuttle", "english_staff", "french_staff", "fast_wifi", "business_center"],
    rates: [
      rate("gz1-std", "Chambre Standard Lit King", "标准大床房", 48000, { free_cancellation_until_days: 5 }),
      rate("gz1-biz", "Chambre Business + bureau", "商务房", 62000, { amenities: ["Bureau", "Wi-Fi", "Lounge"] }),
      rate("gz1-suite", "Suite Négociant", "商贸套房", 96000, { board_type: "half_board" }),
    ],
  },
  {
    id: "cn-gz-baiyun-express",
    name: "Baiyun Express Trade Inn",
    name_zh: "白云商贸快捷酒店",
    address: "No. 12 Jichang Road, Baiyun District, Guangzhou",
    address_zh: "广东省广州市白云区机场路12号",
    city: "Guangzhou",
    city_zh: "广州",
    country: "Chine",
    lat: 23.1875,
    lng: 113.2611,
    star_rating: 3,
    contact: "+86 20 3620 7788",
    description: "Économique, à 10 min du marché de gros de Baiyun et navette aéroport 24h.",
    trade_tags: ["near_market", "airport_shuttle", "fast_wifi", "english_staff"],
    rates: [
      rate("gz2-eco", "Chambre Éco Double", "经济双床房", 21000, {
        board_type: "room_only",
        pay_at_hotel: true,
        refundable: true,
        free_cancellation_until_days: 1,
      }),
      rate("gz2-std", "Chambre Standard", "标准房", 27500, { pay_at_hotel: true }),
    ],
  },
  {
    id: "cn-yiwu-market-plaza",
    name: "Yiwu Market Plaza Hotel",
    name_zh: "义乌国际商贸城广场酒店",
    address: "No. 105 Chouzhou North Road, Yiwu, Zhejiang",
    address_zh: "浙江省义乌市稠州北路105号",
    city: "Yiwu",
    city_zh: "义乌",
    country: "Chine",
    lat: 29.3111,
    lng: 120.0742,
    star_rating: 4,
    contact: "+86 579 8555 6666",
    description:
      "En face du District 1 du marché international de Yiwu. Interprètes disponibles, service d'expédition de colis.",
    trade_tags: ["near_market", "english_staff", "fast_wifi", "halal_food", "business_center"],
    rates: [
      rate("yw1-std", "Chambre Standard", "标准房", 32000),
      rate("yw1-twin", "Chambre Twin Négociants", "商务双床房", 38500, { pay_at_hotel: true }),
      rate("yw1-suite", "Suite Familiale", "家庭套房", 58000),
    ],
  },
  {
    id: "cn-sz-huaqiang",
    name: "Huaqiangbei Electronics Hotel",
    name_zh: "华强北电子酒店",
    address: "No. 2003 Huaqiang North Road, Futian, Shenzhen",
    address_zh: "广东省深圳市福田区华强北路2003号",
    city: "Shenzhen",
    city_zh: "深圳",
    country: "Chine",
    lat: 22.5476,
    lng: 114.0899,
    star_rating: 4,
    contact: "+86 755 8309 2222",
    description: "Au cœur du plus grand marché d'électronique au monde. Idéal pour l'achat de téléphones et gadgets.",
    trade_tags: ["near_market", "english_staff", "fast_wifi", "business_center"],
    rates: [
      rate("sz1-std", "Chambre Standard", "标准房", 41000),
      rate("sz1-deluxe", "Chambre Deluxe vue ville", "豪华城景房", 55000),
    ],
  },
  {
    id: "cn-sh-bund-business",
    name: "Bund Business Suites",
    name_zh: "外滩商务套房酒店",
    address: "No. 66 Nanjing East Road, Huangpu, Shanghai",
    address_zh: "上海市黄浦区南京东路66号",
    city: "Shanghai",
    city_zh: "上海",
    country: "Chine",
    lat: 31.2359,
    lng: 121.4809,
    star_rating: 5,
    contact: "+86 21 6350 8888",
    description: "Suites d'affaires sur le Bund, salles de négociation privées et service de traduction.",
    trade_tags: ["english_staff", "french_staff", "business_center", "fast_wifi", "airport_shuttle"],
    rates: [
      rate("sh1-std", "Chambre Executive", "行政房", 72000),
      rate("sh1-suite", "Suite Bund", "外滩套房", 118000, { board_type: "half_board" }),
    ],
  },
  {
    id: "cn-bj-capital-trade",
    name: "Capital Trade Hotel Beijing",
    name_zh: "北京首都商贸酒店",
    address: "No. 8 Jianguomenwai Avenue, Chaoyang, Beijing",
    address_zh: "北京市朝阳区建国门外大街8号",
    city: "Beijing",
    city_zh: "北京",
    country: "Chine",
    lat: 39.9085,
    lng: 116.4441,
    star_rating: 5,
    contact: "+86 10 6505 2266",
    description: "Quartier des affaires de Guomao, proche des ambassades africaines et du CBD.",
    trade_tags: ["english_staff", "business_center", "fast_wifi", "airport_shuttle", "halal_food"],
    rates: [
      rate("bj1-std", "Chambre Supérieure", "高级房", 66000),
      rate("bj1-exec", "Suite Executive", "行政套房", 105000),
    ],
  },
  {
    id: "ae-dxb-deira-souk",
    name: "Deira Souk Business Hotel",
    name_zh: "德拉集市商务酒店",
    address: "Al Ras Street, Deira, Dubaï",
    address_zh: "迪拜德拉区阿尔拉斯街",
    city: "Dubaï",
    city_zh: "迪拜",
    country: "Émirats arabes unis",
    lat: 25.2697,
    lng: 55.2969,
    star_rating: 4,
    contact: "+971 4 226 1111",
    description: "Escale idéale entre Abidjan et la Chine, proche des souks de Deira.",
    trade_tags: ["near_market", "english_staff", "french_staff", "halal_food", "airport_shuttle"],
    rates: [
      rate("dxb1-std", "Chambre Standard", "标准房", 58000, { pay_at_hotel: true }),
      rate("dxb1-fam", "Chambre Familiale", "家庭房", 79000),
    ],
  },
  {
    id: "tr-ist-laleli",
    name: "Laleli Textile Trade Hotel",
    name_zh: "拉莱利纺织贸易酒店",
    address: "Ordu Caddesi 42, Laleli, Fatih, Istanbul",
    address_zh: "伊斯坦布尔法提赫区拉莱利奥尔杜大街42号",
    city: "Istanbul",
    city_zh: "伊斯坦布尔",
    country: "Turquie",
    lat: 41.0106,
    lng: 28.9502,
    star_rating: 4,
    contact: "+90 212 517 4444",
    description: "Au centre du quartier textile de Laleli, à 10 minutes du Grand Bazar.",
    trade_tags: ["near_market", "english_staff", "french_staff", "halal_food", "fast_wifi"],
    rates: [
      rate("ist1-std", "Chambre Standard", "标准房", 36000, { pay_at_hotel: true }),
      rate("ist1-dlx", "Chambre Deluxe", "豪华房", 47000),
    ],
  },
  {
    id: "fr-par-opera",
    name: "Opéra Business Residence",
    name_zh: "歌剧院商务公寓",
    address: "14 Rue de la Chaussée d'Antin, 75009 Paris",
    address_zh: "法国巴黎第九区昂坦大道14号",
    city: "Paris",
    city_zh: "巴黎",
    country: "France",
    lat: 48.8722,
    lng: 2.3336,
    star_rating: 4,
    contact: "+33 1 42 65 90 00",
    description: "Résidence d'affaires proche des grands magasins et de la gare Saint-Lazare.",
    trade_tags: ["french_staff", "english_staff", "business_center", "fast_wifi"],
    rates: [
      rate("par1-std", "Chambre Classique", "经典房", 88000),
      rate("par1-apt", "Appartement 1 chambre", "一居室公寓", 132000),
    ],
  },
  {
    id: "ci-abj-plateau",
    name: "Plateau Cargo Hotel",
    name_zh: "普拉托货运酒店",
    address: "Boulevard de la République, Plateau, Abidjan",
    address_zh: "科特迪瓦阿比让普拉托共和国大道",
    city: "Abidjan",
    city_zh: "阿比让",
    country: "Côte d'Ivoire",
    lat: 5.3239,
    lng: -4.0165,
    star_rating: 4,
    contact: "+225 27 20 30 40 50",
    description: "Base arrière pour les importateurs à leur retour, proche du port et des banques.",
    trade_tags: ["french_staff", "business_center", "fast_wifi", "airport_shuttle", "halal_food"],
    rates: [
      rate("abj1-std", "Chambre Standard", "标准房", 45000, { pay_at_hotel: true }),
      rate("abj1-suite", "Suite Affaires", "商务套房", 72000),
    ],
  },
];

export const BOARD_LABELS: Record<HotelRate["board_type"], string> = {
  room_only: "Chambre seule",
  breakfast: "Petit-déjeuner inclus",
  half_board: "Demi-pension",
};
