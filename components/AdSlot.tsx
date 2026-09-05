'use client';

type AdSize = 'banner' | 'rectangle' | 'native';

const DIMENSIONS: Record<AdSize, { maxWidth: number; minHeight: number; label: string }> = {
  banner: { maxWidth: 728, minHeight: 90, label: '728 × 90 (or 320 × 50 on mobile)' },
  rectangle: { maxWidth: 300, minHeight: 250, label: '300 × 250' },
  native: { maxWidth: 500, minHeight: 150, label: 'native / in-feed unit' }
};

export default function AdSlot({ size, id }: { size: AdSize; id: string }) {
  const dim = DIMENSIONS[size];

  return (
    <div
      className="ad-slot"
      data-ad-slot-id={id}
      role="complementary"
      aria-label="Advertisement"
      style={{ maxWidth: dim.maxWidth, minHeight: dim.minHeight }}
    >
      <span className="ad-slot__label">Advertisement</span>
      <span className="ad-slot__size">{dim.label}</span>

      {/*
        GOOGLE ADSENSE INTEGRATION
        1. Set NEXT_PUBLIC_ADSENSE_CLIENT_ID in your .env and load the
           AdSense loader script once (already wired in app/[locale]/layout.tsx).
        2. Replace the two <span> lines above with:

           <ins
             className="adsbygoogle"
             style={{ display: 'block' }}
             data-ad-client={process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID}
             data-ad-slot="YOUR_AD_UNIT_ID"
             data-ad-format="auto"
             data-full-width-responsive="true"
           />

        3. This component would need to become a 'use client' component with:

           useEffect(() => {
             try { (window as any).adsbygoogle = (window as any).adsbygoogle || []; (window as any).adsbygoogle.push({}); }
             catch (e) { /* ad blocked or not yet loaded * / }
           }, []);

        The `id` prop is there so you can tell slots apart in your ad
        network's dashboard (e.g. "home-rect", "merge-meadow-top-banner").
      */}
      <style jsx>{`
        .ad-slot {
          width: 100%;
          margin: 0 auto;
          border: 2px dashed rgba(0, 0, 0, 0.2);
          border-radius: 12px;
          background: rgba(0, 0, 0, 0.03);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          color: rgba(0, 0, 0, 0.45);
          font-size: 0.72rem;
          text-align: center;
          padding: 8px;
          display: none; // temporary disabled!!!
        }
        .ad-slot__label {
          font-weight: 700;
        }
        .ad-slot__size {
          opacity: 0.85;
        }
      `}</style>
    </div>
  );
}
