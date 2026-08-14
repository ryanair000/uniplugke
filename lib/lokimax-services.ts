import { kesToUsd } from "@/lib/currency";
import type { CatalogService, ServiceCategory } from "@/lib/types";

export type LokimaxCatalogSource = {
  id: string;
  name: string;
  selling_price_1_month: number | null;
  selling_price_3_months: number | null;
  selling_price_1_year: number | null;
  stock_quantity: number | null;
};
type ServiceProfile = {
  name: string;
  category: ServiceCategory;
  shortDescription: string;
  features: string[];
  devices: string[];
  logoText: string;
  accentColor: string;
};

const profiles: Record<string, ServiceProfile> = {
  adobecc: profile("Adobe Creative Cloud", "creative", "Creative apps for design, photography, video, and documents.", ["Creative applications", "Cloud workflows", "Member support"], ["Windows", "Mac", "Mobile", "Browser"], "A", "#e92831"),
  amc: profile("AMC+", "streaming", "Movies, original series, and premium entertainment in one service.", ["Premium series", "Movie library", "Streaming access"], standardStreamingDevices(), "A+", "#111111"),
  appletv: profile("Apple TV+", "streaming", "Apple Original films and series across supported devices.", ["Apple Originals", "Family viewing", "Multi-device access"], standardStreamingDevices(), "TV+", "#111111"),
  applemusic: profile("Apple Music", "music", "Ad-free music, curated playlists, and listening across supported devices.", ["Ad-free listening", "Curated playlists", "Multi-device access"], ["Mobile", "Tablet", "Desktop", "Browser"], "AM", "#fa243c"),
  betplus: profile("BET+", "streaming", "BET originals, films, comedy, and culture-focused entertainment.", ["BET originals", "Movie library", "Comedy and series"], standardStreamingDevices(), "B+", "#111111"),
  capcut: profile("CapCut Pro", "creative", "Premium video editing tools for social and professional content.", ["Premium editing tools", "Creative effects", "Cloud projects"], ["Windows", "Mac", "Mobile", "Browser"], "C", "#111111"),
  chatgpt: profile("ChatGPT", "ai", "AI assistance for writing, research, planning, and everyday work.", ["AI assistance", "Writing support", "Research workflows"], ["Mobile", "Desktop", "Browser"], "AI", "#10a37f"),
  chatgptplus: profile("ChatGPT Plus", "ai", "Expanded ChatGPT access with premium tools and higher limits.", ["Premium AI models", "Higher usage limits", "Advanced tools"], ["Mobile", "Desktop", "Browser"], "AI+", "#10a37f"),
  crunchyroll: profile("Crunchyroll", "streaming", "Anime series, films, and simulcasts on supported devices.", ["Anime library", "Simulcasts", "Multi-device streaming"], ["Smart TV", "Console", "Mobile", "Browser"], "CR", "#f47521"),
  cinemax: profile("Cinemax", "streaming", "Films, original series, and premium entertainment on supported devices.", ["Movie library", "Original series", "Streaming access"], standardStreamingDevices(), "C", "#111111"),
  directv: profile("DIRECTV", "streaming", "Live television and on-demand entertainment in one place.", ["Live TV", "On-demand library", "Supported-device access"], standardStreamingDevices(), "D", "#00a6d6"),
  disneyplus: profile("Disney+", "streaming", "Disney, Pixar, Marvel, Star Wars, and National Geographic entertainment.", ["Premium franchises", "Family entertainment", "Multi-device streaming"], ["Smart TV", "Console", "Mobile", "Browser"], "D+", "#113ccf"),
  dstv: profile("DStv", "streaming", "Live channels, sports, news, and entertainment from DStv.", ["Live channels", "Sports and entertainment", "Mobile viewing"], ["Decoder", "Smart TV", "Mobile", "Browser"], "D", "#1474c4"),
  dstvcompact: profile("DStv Compact", "streaming", "Live entertainment, sports, news, and family channels from DStv.", ["Live channels", "Sports and entertainment", "Family viewing"], ["Decoder", "Smart TV", "Mobile", "Browser"], "D", "#1474c4"),
  dstvpremium: profile("DStv Premium", "streaming", "DStv's broadest selection of premium sport, films, series, and live channels.", ["Premium sport", "Live channels", "Movies and series"], ["Decoder", "Smart TV", "Mobile", "Browser"], "D", "#0f5fa8"),
  f1tv: profile("F1 TV", "streaming", "Live Formula 1 coverage, timing, replays, and race archives.", ["Live race coverage", "Onboard cameras", "Race archive"], standardStreamingDevices(), "F1", "#e10600"),
  foxnation: profile("Fox Nation", "streaming", "Original shows, documentaries, and entertainment from Fox Nation.", ["Original shows", "Documentaries", "On-demand viewing"], standardStreamingDevices(), "FN", "#003366"),
  filmora: profile("Filmora", "creative", "Accessible video editing with effects, templates, and export tools.", ["Video editing", "Creative templates", "Export tools"], ["Windows", "Mac", "Mobile"], "F", "#1ec7b6"),
  fubo: profile("Fubo", "streaming", "Live sports, television channels, and on-demand programming.", ["Live sports", "Live channels", "Cloud viewing"], standardStreamingDevices(), "F", "#fa4616"),
  hbomax: profile("HBO Max", "streaming", "HBO series, blockbuster films, and exclusive entertainment.", ["HBO Originals", "Blockbuster films", "Premium series"], ["Smart TV", "Console", "Mobile", "Browser"], "H", "#6f2cff"),
  hmavpn: profile("HMA VPN", "security", "Private browsing and location flexibility across supported devices.", ["Encrypted browsing", "Global locations", "Multi-device support"], ["Windows", "Mac", "Mobile", "Router"], "HMA", "#ff4b4b"),
  hulu: profile("Hulu", "streaming", "Current television, original series, films, and on-demand entertainment.", ["Original series", "Current TV", "On-demand library"], ["Smart TV", "Console", "Mobile", "Browser"], "H", "#1ce783"),
  nbaleaguepass: profile("NBA League Pass", "streaming", "Live NBA games, replays, highlights, and league coverage.", ["Live NBA games", "Game replays", "League coverage"], standardStreamingDevices(), "NBA", "#1d428a"),
  netflix: profile("Netflix Premium", "streaming", "Premium entertainment managed through one simple member dashboard.", ["Premium viewing experience", "Renewal tracking", "Member support"], standardStreamingDevices(), "N", "#e50914"),
  nordvpn: profile("NordVPN", "security", "Private, encrypted internet access across your everyday devices.", ["Encrypted connection", "Global servers", "Threat protection"], ["Windows", "Mac", "Mobile", "Router"], "N", "#4687ff"),
  office365: profile("Microsoft 365", "productivity", "Office applications and cloud storage for work, school, and home.", ["Office applications", "Cloud storage", "Multi-device use"], ["Windows", "Mac", "Mobile", "Browser"], "M", "#f25022"),
  osnplus: profile("OSN+", "streaming", "Arabic and international series, films, and premium entertainment.", ["Premium series", "Arabic entertainment", "Movie library"], standardStreamingDevices(), "O+", "#6d36ff"),
  paramountplus: profile("Paramount+", "streaming", "Paramount films, originals, live content, and family entertainment.", ["Paramount Originals", "Movie library", "Family content"], ["Smart TV", "Console", "Mobile", "Browser"], "P+", "#0064ff"),
  peacock: profile("Peacock", "streaming", "NBCUniversal series, films, sports, news, and originals.", ["Original series", "Live sports", "Movie library"], ["Smart TV", "Console", "Mobile", "Browser"], "P", "#111111"),
  primevideo: profile("Prime Video", "streaming", "Amazon Originals, films, series, and on-demand entertainment.", ["Amazon Originals", "Movies and series", "Multi-device streaming"], ["Smart TV", "Console", "Mobile", "Browser"], "PV", "#00a8e1"),
  quillbot: profile("QuillBot", "ai", "AI writing, rewriting, grammar, and summarisation tools.", ["Paraphrasing", "Grammar support", "Summarisation"], ["Desktop", "Mobile", "Browser"], "Q", "#499557"),
  scribd: profile("Scribd", "learning", "Digital books, documents, audiobooks, and reading resources.", ["Digital library", "Audiobooks", "Offline reading"], ["Mobile", "Tablet", "Desktop", "Browser"], "S", "#1e7b85"),
  skillshare: profile("Skillshare", "learning", "Creative and practical online classes taught by working professionals.", ["Online classes", "Creative learning", "Project-based lessons"], ["Mobile", "Tablet", "Desktop", "Browser"], "S", "#00a66a"),
  showmax: profile("Showmax", "streaming", "African and international series, films, entertainment, and sport.", ["African entertainment", "Movies and series", "Supported live sport"], standardStreamingDevices(), "S", "#7b2cff"),
  showtime: profile("Showtime", "streaming", "Showtime original series, films, documentaries, and premium entertainment.", ["Original series", "Movie library", "Documentaries"], standardStreamingDevices(), "SH", "#e31837"),
  starz: profile("Starz", "streaming", "Starz original series, films, and premium on-demand entertainment.", ["Original series", "Movie library", "On-demand streaming"], standardStreamingDevices(), "S", "#111111"),
  youtube: profile("YouTube Premium", "streaming", "Ad-free YouTube, background play, downloads, and YouTube Music.", ["Ad-free viewing", "Background play", "Offline downloads"], ["Smart TV", "Console", "Mobile", "Browser"], "YT", "#ff0000")
};

function standardStreamingDevices() {
  return ["Smart TV", "Mobile", "Tablet", "Browser"];
}

function profile(name: string, category: ServiceCategory, shortDescription: string, features: string[], devices: string[], logoText: string, accentColor: string): ServiceProfile {
  return { name, category, shortDescription, features, devices, logoText, accentColor };
}

export function normalizeLokimaxServiceName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function canonicalLokimaxCatalogKey(value: string) {
  const key = normalizeLokimaxServiceName(value);
  const aliases: Record<string, string> = {
    f1: "f1tv",
    fubotv: "fubo",
    nba: "nbaleaguepass",
    prime: "primevideo"
  };
  return aliases[key] ?? key;
}

export function lokimaxServiceDisplayName(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "Digital service";
  const key = canonicalLokimaxCatalogKey(trimmed);
  if (key === "dstv" || key === "dstvcompact" || key === "dstvpremium") return "Live Stream";
  return profiles[key]?.name ?? trimmed;
}

function slugify(value: string) {
  return value.toLowerCase().replace(/\+/g, "-plus").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function buildLokimaxCatalog(sources: LokimaxCatalogSource[], curatedServices: CatalogService[]) {
  const curatedBySlug = new Map(curatedServices.map((service) => [service.slug, service]));
  const seen = new Set<string>();

  // Lokimax is ordered newest-first. The first canonical name wins so older
  // duplicate rows (for example PRIME/PRIME VIDEO) do not create duplicate cards.
  return sources.flatMap((source) => {
    const key = canonicalLokimaxCatalogKey(source.name);
    const serviceProfile = profiles[key];
    const name = serviceProfile?.name ?? source.name.trim();
    const serviceSlug = slugify(name);
    const monthlyPriceKes = Number(source.selling_price_1_month);
    if (!key || seen.has(serviceSlug) || !Number.isFinite(monthlyPriceKes) || monthlyPriceKes <= 0) return [];
    seen.add(serviceSlug);

    const startingPriceUsd = Math.round(kesToUsd(monthlyPriceKes) * 100) / 100;
    const availabilityStatus = Number(source.stock_quantity) <= 0
      ? "coming_soon" as const
      : Number(source.stock_quantity) <= 5
        ? "limited" as const
        : "available" as const;
    const curated = curatedBySlug.get(serviceSlug);
    if (curated) return [{ ...curated, startingPriceUsd, availabilityStatus }];

    const shortDescription = serviceProfile?.shortDescription ?? `${name} access with activation tracking and local member support.`;
    return [{
      id: source.id,
      slug: serviceSlug,
      category: serviceProfile?.category ?? "productivity",
      name,
      shortDescription,
      description: `${shortDescription} Review availability, activation progress, renewals, and support from one member dashboard.`,
      logoText: serviceProfile?.logoText ?? name.slice(0, 2).toUpperCase(),
      accentColor: serviceProfile?.accentColor ?? "#6957ff",
      features: serviceProfile?.features ?? ["Managed access", "Renewal tracking", "Member support"],
      supportedDevices: serviceProfile?.devices ?? ["Mobile", "Desktop", "Browser"],
      setupRequirements: ["An active UniPlug membership", "A supported device", "Any account details requested during activation"],
      fulfillmentLabel: "Managed access",
      activationWindow: "Confirmed by support after account verification",
      replacementSummary: "Eligible access issues can be reported and tracked from your member dashboard.",
      faqs: [{ question: "How do I receive access?", answer: "The current activation method and any required details are confirmed after your request is reviewed." }],
      availabilityStatus,
      featured: false,
      startingPriceUsd
    }];
  });
}
