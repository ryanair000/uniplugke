"use client";

import type { ImgHTMLAttributes } from "react";

const PLACEHOLDER_IMAGE = "/storefront/product-placeholder.svg";

type StoreProductImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "alt" | "src"> & {
  alt: string;
  src: string;
};

export function StoreProductImage({ alt, onError, src, ...props }: StoreProductImageProps) {
  return (
    // Product media comes from the existing catalog and cannot use Next Image safely.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...props}
      alt={alt}
      onError={(event) => {
        if (!event.currentTarget.src.endsWith(PLACEHOLDER_IMAGE)) event.currentTarget.src = PLACEHOLDER_IMAGE;
        onError?.(event);
      }}
      ref={(image) => {
        if (image?.complete && image.naturalWidth === 0 && !image.src.endsWith(PLACEHOLDER_IMAGE)) {
          image.src = PLACEHOLDER_IMAGE;
        }
      }}
      referrerPolicy="no-referrer"
      src={src || PLACEHOLDER_IMAGE}
    />
  );
}
