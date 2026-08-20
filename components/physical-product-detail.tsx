"use client";

import Link from "next/link";
import { CheckCircle2, PackageCheck, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { useState } from "react";
import { StoreProductPurchase } from "@/components/store-cart";
import { StoreProductImage } from "@/components/store-product-image";
import type { PhysicalCatalogProduct } from "@/lib/storefront-products";

const money = new Intl.NumberFormat("en-KE");

export function PhysicalProductDetail({
  product,
  related
}: {
  product: PhysicalCatalogProduct;
  related: PhysicalCatalogProduct[];
}) {
  const gallery = Array.from(new Set([product.image, ...product.images]));
  const [selectedImage, setSelectedImage] = useState(gallery[0]);

  return (
    <div className="store-product-page commerce-shell">
      <nav className="store-breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Store</Link><span>/</span>
        <Link href={`/?category=${product.category}#popular`}>{product.categoryLabel}</Link><span>/</span>
        <span>{product.name}</span>
      </nav>

      <section className="store-product-layout">
        <div className="store-product-gallery">
          <div className="store-product-main-image"><StoreProductImage alt={product.imageAlt} key={selectedImage} src={selectedImage} /></div>
          {gallery.length > 1 ? (
            <div className="store-product-thumbnails">
              {gallery.slice(0, 5).map((image) => (
                <button aria-label={`View ${product.name} image`} aria-pressed={selectedImage === image} key={image} onClick={() => setSelectedImage(image)} type="button">
                  <StoreProductImage alt="" loading="lazy" src={image} />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="store-product-copy">
          <div className="store-product-badges"><span>Physical</span><span>{product.stockLabel}</span></div>
          <p className="commerce-eyebrow">{product.brand}</p>
          <h1>{product.name}</h1>
          <p className="store-product-category">{product.categoryLabel}{product.platform ? ` / ${product.platform}` : ""}</p>
          <strong className="store-product-price">KSh {money.format(product.priceKes)}</strong>
          <p className="store-product-price-note">Live catalog price. Delivery is calculated at checkout.</p>
          <div className="store-product-description">
            {product.description.split(/\n+/).filter(Boolean).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </div>
          <StoreProductPurchase product={product} />
          <div className="store-product-promises">
            <span><CheckCircle2 aria-hidden="true" /><b>Stock checked</b><small>Validated again at checkout</small></span>
            <span><ShieldCheck aria-hidden="true" /><b>Secure payment</b><small>M-Pesa or card via Paystack</small></span>
            <span><Truck aria-hidden="true" /><b>Kenya delivery</b><small>Address collected securely</small></span>
            <span><RotateCcw aria-hidden="true" /><b>Local support</b><small>Order help from UniPlug</small></span>
          </div>
        </div>
      </section>

      {related.length ? (
        <section className="store-related" aria-labelledby="store-related-title">
          <div className="store-related-heading"><div><p className="commerce-eyebrow">Complete your setup</p><h2 id="store-related-title">Related products</h2></div><Link href={`/?category=${product.category}#popular`}>View category</Link></div>
          <div className="store-related-grid">
            {related.map((item) => (
              <article key={item.id}>
                <Link href={item.href}><StoreProductImage alt={item.name} loading="lazy" src={item.image} /></Link>
                <span>{item.brand}</span>
                <h3><Link href={item.href}>{item.name}</Link></h3>
                <strong>KSh {money.format(item.priceKes)}</strong>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="store-detail-assurance">
        <PackageCheck aria-hidden="true" />
        <div><strong>One catalog, one UniPlug checkout.</strong><p>Price and stock are confirmed again before payment, with local delivery and order support from UniPlug.</p></div>
      </section>
    </div>
  );
}
