export interface Shop {
  id: number;
  name: string;
  adminGroupId: number | null;
  adminUserIds: number[];
  timezone: string;
  prepaymentPercent: number;
  deliveryFee: number;
  inscriptionPrice: number;
  leadTimeHours: number;
  bookingHorizonDays: number;
  dailyCapacityKg: number;
  dailyCapacityOrders: number;
  workingDays: number[];
  timeSlots: string[];
  paymentCard: string | null;
  paymentCardHolder: string | null;
  contactPhone: string | null;
  isActive: boolean;
}

export interface Category {
  id: number;
  name: string;
}

export interface Product {
  id: number;
  categoryId: number;
  name: string;
  description: string | null;
  photoFileId: string | null;
  photoPath: string | null;
  pricePerKg: number;
  minKg: number;
  maxKg: number;
  weightOptions: number[];
  isAvailable: boolean;
}

export interface ProductOption {
  id: number;
  productId: number;
  groupName: string;
  optionName: string;
  extraPrice: number;
  priceType: 'fixed' | 'per_kg';
}

export interface Customer {
  id: number;
  telegramUserId: number;
  phone: string | null;
  firstName: string | null;
  username: string | null;
  notificationsEnabled: boolean;
}

export type CustomerState =
  | 'IDLE'
  | 'PHONE'
  | 'CATALOG'
  | 'PRODUCT'
  | 'WEIGHT'
  | 'WEIGHT_CUSTOM'
  | 'OPTIONS'
  | 'INSCRIPTION'
  | 'INSCRIPTION_TEXT'
  | 'DATE'
  | 'TIME'
  | 'DELIVERY'
  | 'ADDRESS'
  | 'ADDRESS_NOTE'
  | 'SUMMARY'
  | 'PAYMENT'
  | 'ADMIN_PRICE_INPUT'
  | 'ADMIN_QUOTA_INPUT'
  | 'ADMIN_BLOCK_DATE_INPUT';

export interface Draft {
  categoryId?: number;
  productId?: number;
  weightKg?: number;
  /** group_name -> tanlangan option id */
  options?: Record<string, number>;
  optionGroupIndex?: number;
  inscription?: string | null;
  date?: string;
  timeSlot?: string;
  deliveryType?: 'delivery' | 'pickup';
  addressText?: string;
  lat?: number;
  lng?: number;
  addressNote?: string;
  holdId?: number;
  orderId?: number;
  /** admin uchun vaqtinchalik kontekst */
  targetProductId?: number;
  history?: CustomerState[];
}

export interface Session {
  state: CustomerState;
  draft: Draft;
}

export type OrderStatus =
  | 'DRAFT'
  | 'AWAITING_PAYMENT'
  | 'CONFIRMED'
  | 'ACCEPTED'
  | 'BAKING'
  | 'READY'
  | 'DELIVERING'
  | 'COMPLETED'
  | 'CANCELLED';

export interface Order {
  id: number;
  shopId: number;
  customerId: number;
  orderNumber: number;
  status: OrderStatus;
  productSnapshot: { name: string; pricePerKg: number };
  optionsSnapshot: { groupName: string; optionName: string; price: number }[];
  weightKg: number;
  inscriptionText: string | null;
  deliveryType: 'delivery' | 'pickup';
  addressText: string | null;
  addressNote: string | null;
  lat: number | null;
  lng: number | null;
  pickupDate: string;
  pickupTimeSlot: string | null;
  subtotal: number;
  deliveryFee: number;
  total: number;
  prepaidAmount: number;
  remainingAmount: number;
  paymentStatus: 'unpaid' | 'receipt_sent' | 'paid' | 'rejected';
  adminMessageId: number | null;
  /** join orqali keladi */
  customerName?: string | null;
  customerPhone?: string | null;
  customerTelegramId?: number;
}
