const LandingFooter = () => (
  <footer className="border-t border-white/6 px-6 py-16 lg:px-12">
    <div className="mx-auto max-w-7xl">
      <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
        {/* Brand */}
        <div className="sm:col-span-2 lg:col-span-1">
          <span className="font-display text-2xl font-bold text-white">Rekindled</span>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/30">
            Making showing up feel easier. Small groups, real activities, real friendships.
          </p>
        </div>

        {/* Product */}
        <div>
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">Product</p>
          <ul className="space-y-3">
            {["How it works", "Pricing", "Safety", "Community"].map((item) => (
              <li key={item}>
                <a href="#" className="text-sm text-white/40 transition-colors hover:text-white/70">{item}</a>
              </li>
            ))}
          </ul>
        </div>

        {/* Company */}
        <div>
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">Company</p>
          <ul className="space-y-3">
            {["About", "Blog", "Careers", "Press"].map((item) => (
              <li key={item}>
                <a href="#" className="text-sm text-white/40 transition-colors hover:text-white/70">{item}</a>
              </li>
            ))}
          </ul>
        </div>

        {/* Legal */}
        <div>
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">Legal</p>
          <ul className="space-y-3">
            {["Privacy Policy", "Terms of Service", "Cookie Policy", "Contact"].map((item) => (
              <li key={item}>
                <a href="#" className="text-sm text-white/40 transition-colors hover:text-white/70">{item}</a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-white/6 pt-8 sm:flex-row">
        <p className="text-xs text-white/20">
          © 2026 Rekindled, Inc. All rights reserved.
        </p>
        <div className="flex gap-6">
          {["Twitter", "Instagram", "TikTok"].map((s) => (
            <a key={s} href="#" className="text-xs text-white/20 transition-colors hover:text-white/50">{s}</a>
          ))}
        </div>
      </div>
    </div>
  </footer>
);

export default LandingFooter;
