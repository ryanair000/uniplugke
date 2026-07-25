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
};

export type MemberProfile = {
  userId: string;
  email: string;
  displayName: string | null;
  username: string;
  role: "client" | "support" | "admin";
  status: "active" | "suspended" | "pending";
};

export type CartItem = {
  planId: string;
  serviceSlug: string;
  serviceName: string;
  planName: string;
  priceKes: number;
  billingCycle: MemberPlan["billingCycle"];
};
