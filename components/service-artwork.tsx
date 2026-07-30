import Image from "next/image";
import { getServiceArtwork } from "@/lib/service-artwork";

type ServiceArtworkProps = {
  accentColor: string;
  className: string;
  logoText: string;
  name: string;
  slug: string | null | undefined;
  descriptive?: boolean;
};

export function ServiceArtwork({
  accentColor,
  className,
  logoText,
  name,
  slug,
  descriptive = false
}: ServiceArtworkProps) {
  const artwork = getServiceArtwork(slug);

  return (
    <span
      className={`${className} service-artwork${artwork ? " has-artwork" : ""}`}
      style={artwork ? undefined : { background: accentColor }}
    >
      {artwork ? (
        <Image
          alt={descriptive ? `${name} app icon` : ""}
          height={128}
          loading="eager"
          src={artwork}
          unoptimized
          width={128}
        />
      ) : logoText}
    </span>
  );
}
