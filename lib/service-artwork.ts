import { serviceArtworkSlugs } from "@/lib/service-artwork.generated";

const serviceArtwork = [
  { match: "netflix", src: "/brands/netflix.svg" },
  { match: "spotify", src: "/brands/spotify.svg" },
  { match: "canva", src: "/brands/canva.svg" },
  { match: "icloud", src: "/brands/icloud.svg" },
  { match: "game-pass", src: "/brands/xbox.svg" },
  { match: "xbox", src: "/brands/xbox.svg" },
  { match: "microsoft-365", src: "/brands/microsoft.svg" },
  { match: "office-365", src: "/brands/microsoft.svg" }
] as const;

export function getServiceArtwork(slug: string | null | undefined) {
  if (!slug) return null;
  const normalizedSlug = slug.trim().toLowerCase();
  if (serviceArtworkSlugs.has(normalizedSlug)) return `/brands/catalog/${normalizedSlug}.svg`;
  return serviceArtwork.find((artwork) => normalizedSlug.includes(artwork.match))?.src ?? null;
}
