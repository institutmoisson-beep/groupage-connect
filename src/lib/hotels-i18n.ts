/** Minimal i18n for the travel module (6 languages). */

export const LANGUAGES = ["FR", "EN", "ZH", "ES", "PT", "AR"] as const;
export type Language = (typeof LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<Language, string> = {
  FR: "Français",
  EN: "English",
  ZH: "中文",
  ES: "Español",
  PT: "Português",
  AR: "العربية",
};

type Key =
  | "title"
  | "subtitle"
  | "destination"
  | "checkIn"
  | "checkOut"
  | "rooms"
  | "guests"
  | "search"
  | "results"
  | "nights"
  | "perNight"
  | "total"
  | "compare"
  | "book"
  | "myBookings"
  | "filters"
  | "sort"
  | "cheapest"
  | "stars"
  | "voucher"
  | "cancel"
  | "payNow"
  | "payAtHotel"
  | "noResults";

const DICT: Record<Language, Record<Key, string>> = {
  FR: {
    title: "Hôtels & Voyages d'affaires",
    subtitle: "Comparez et réservez vos séjours d'achat en Chine et ailleurs",
    destination: "Destination",
    checkIn: "Arrivée",
    checkOut: "Départ",
    rooms: "Chambres",
    guests: "Voyageurs",
    search: "Rechercher",
    results: "résultat(s)",
    nights: "nuit(s)",
    perNight: "par nuit",
    total: "Total",
    compare: "Comparer",
    book: "Réserver",
    myBookings: "Mes réservations",
    filters: "Filtres",
    sort: "Trier",
    cheapest: "Prix croissant",
    stars: "Étoiles",
    voucher: "Bon de réservation",
    cancel: "Annuler",
    payNow: "Payer maintenant",
    payAtHotel: "Payer à l'hôtel",
    noResults: "Aucun hôtel ne correspond à votre recherche.",
  },
  EN: {
    title: "Hotels & Business Travel",
    subtitle: "Compare and book your sourcing trips to China and beyond",
    destination: "Destination",
    checkIn: "Check-in",
    checkOut: "Check-out",
    rooms: "Rooms",
    guests: "Guests",
    search: "Search",
    results: "result(s)",
    nights: "night(s)",
    perNight: "per night",
    total: "Total",
    compare: "Compare",
    book: "Book",
    myBookings: "My bookings",
    filters: "Filters",
    sort: "Sort",
    cheapest: "Lowest price",
    stars: "Stars",
    voucher: "Booking voucher",
    cancel: "Cancel",
    payNow: "Pay now",
    payAtHotel: "Pay at hotel",
    noResults: "No hotel matches your search.",
  },
  ZH: {
    title: "酒店与商务旅行",
    subtitle: "比较并预订您的中国采购之旅",
    destination: "目的地",
    checkIn: "入住",
    checkOut: "退房",
    rooms: "房间",
    guests: "客人",
    search: "搜索",
    results: "个结果",
    nights: "晚",
    perNight: "每晚",
    total: "总计",
    compare: "比较",
    book: "预订",
    myBookings: "我的预订",
    filters: "筛选",
    sort: "排序",
    cheapest: "价格从低到高",
    stars: "星级",
    voucher: "预订凭证",
    cancel: "取消",
    payNow: "立即付款",
    payAtHotel: "到店付款",
    noResults: "没有符合条件的酒店。",
  },
  ES: {
    title: "Hoteles y viajes de negocios",
    subtitle: "Compare y reserve sus viajes de compras a China y más allá",
    destination: "Destino",
    checkIn: "Entrada",
    checkOut: "Salida",
    rooms: "Habitaciones",
    guests: "Huéspedes",
    search: "Buscar",
    results: "resultado(s)",
    nights: "noche(s)",
    perNight: "por noche",
    total: "Total",
    compare: "Comparar",
    book: "Reservar",
    myBookings: "Mis reservas",
    filters: "Filtros",
    sort: "Ordenar",
    cheapest: "Precio más bajo",
    stars: "Estrellas",
    voucher: "Bono de reserva",
    cancel: "Cancelar",
    payNow: "Pagar ahora",
    payAtHotel: "Pagar en el hotel",
    noResults: "Ningún hotel coincide con su búsqueda.",
  },
  PT: {
    title: "Hotéis e viagens de negócios",
    subtitle: "Compare e reserve as suas viagens de compras na China",
    destination: "Destino",
    checkIn: "Entrada",
    checkOut: "Saída",
    rooms: "Quartos",
    guests: "Hóspedes",
    search: "Pesquisar",
    results: "resultado(s)",
    nights: "noite(s)",
    perNight: "por noite",
    total: "Total",
    compare: "Comparar",
    book: "Reservar",
    myBookings: "As minhas reservas",
    filters: "Filtros",
    sort: "Ordenar",
    cheapest: "Preço mais baixo",
    stars: "Estrelas",
    voucher: "Voucher de reserva",
    cancel: "Cancelar",
    payNow: "Pagar agora",
    payAtHotel: "Pagar no hotel",
    noResults: "Nenhum hotel corresponde à sua pesquisa.",
  },
  AR: {
    title: "الفنادق ورحلات العمل",
    subtitle: "قارن واحجز رحلات الشراء إلى الصين",
    destination: "الوجهة",
    checkIn: "الوصول",
    checkOut: "المغادرة",
    rooms: "الغرف",
    guests: "المسافرون",
    search: "بحث",
    results: "نتيجة",
    nights: "ليلة",
    perNight: "لكل ليلة",
    total: "المجموع",
    compare: "مقارنة",
    book: "احجز",
    myBookings: "حجوزاتي",
    filters: "التصفية",
    sort: "ترتيب",
    cheapest: "الأقل سعراً",
    stars: "النجوم",
    voucher: "قسيمة الحجز",
    cancel: "إلغاء",
    payNow: "ادفع الآن",
    payAtHotel: "الدفع في الفندق",
    noResults: "لا يوجد فندق مطابق لبحثك.",
  },
};

export function t(lang: Language, key: Key): string {
  return DICT[lang][key];
}
