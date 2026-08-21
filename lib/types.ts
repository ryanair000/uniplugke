import type { PlanDurationMonths, PlanDurationOffer } from "@/lib/plan-durations";

export type ServiceCategory =
  | "streaming"
  | "music"
  | "creative"
  | "ai"
  | "productivity"
  | "cloud"
  | "security"
  | "gaming"
  | "learning";

export type CatalogFaq = { question: string; answer: string };

export type CatalogService = {
  id: string;
  slug: string;
  category: ServiceCategory;
  name: string;
  shortDescription: string;
  description: string;
  logoText: string;
  accentColor: string;
  features: string[];
  supportedDevices: string[];
  setupRequirements: string[];
  fulfillmentLabel: string;
  activationWindow: string;
  replacementSummary: string;
  faqs: CatalogFaq[];
  availabilityStatus: "available" | "limited" | "coming_soon";
  featured: boolean;
  startingPriceUsd?: number | null;
};

export type MemberPlan = {
  id: string;
  serviceId: string;
  serviceSlug: string;
  serviceName: string;
  planName: string;
  planCode: string;
  priceKes: number;
  compareAtKes: number | null;
  billingCycle: "monthly" | "quarterly" | "yearly";
  features: string[];
  availabilityStatus: "available" | "limited" | "unavailable";
  durationOffers: PlanDurationOffer[];
};

export type MemberProfile = {
  userId: string;
  email: string;
  displayName: string | null;
  username: string;
  phone: string | null;
  role: "client" | "support" | "admin";
  status: "active" | "suspended" | "pending";
  renewalRemindersEnabled: boolean;
  marketingOptIn: boolean;
  clientId: string | null;
  mustChangePassword: boolean;
};

export type CartItem = {
  planId: string;
  serviceSlug: string;
  serviceName: string;
  planName: string;
  monthlyPriceKes: number;
  priceKes: number;
  billingCycle: MemberPlan["billingCycle"];
  durationMonths: PlanDurationMonths;
};

export type MemberOrderSummary = {
  id: string;
  orderNumber: string;
  totalKes: number;
  paymentStatus: string;
  fulfillmentStatus: string;
  createdAt: string;
};

export type SubscriptionRequestStatus = "pending" | "completed" | "declined";
export type SubscriptionRequestType = "pause" | "cancel";

export type MemberEvent = {
  id: string;
  eventType: string;
  title: string;
  detail: string | null;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
};
