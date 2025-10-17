"use client";
import Script from "next/script";
import { SITE } from "@/lib/site";

export default function SeoJsonLd() {
  const org = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE.name,
    url: SITE.domain,
    description: SITE.description,
    logo: `${SITE.domain}/favicon-512.png`, // ある場合
    image: `${SITE.domain}${SITE.ogImage}`,
    address: {
      "@type": "PostalAddress",
      streetAddress: SITE.address.streetAddress,
      addressLocality: SITE.address.addressLocality,
      addressRegion: SITE.address.addressRegion,
      postalCode: SITE.address.postalCode,
      addressCountry: SITE.address.addressCountry,
    },
  };

  const person = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: SITE.owner,
    url: SITE.domain,
    worksFor: { "@type": "Organization", name: SITE.name },
    jobTitle: "Designer / Web Engineer",
  };

  return (
    <>
      <Script id="ld-org" type="application/ld+json" strategy="afterInteractive">
        {JSON.stringify(org)}
      </Script>
      <Script id="ld-person" type="application/ld+json" strategy="afterInteractive">
        {JSON.stringify(person)}
      </Script>
    </>
  );
}