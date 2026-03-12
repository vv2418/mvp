import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check } from "lucide-react";

const fade = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] as const } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

const PLANS = [
  {
    name: "First hang",
    price: "Free",
    detail: "No card required",
    features: ["Join one hang", "Group chat access", "See who's going"],
  },
  {
    name: "Per hang",
    price: "$10",
    detail: "Pay as you go",
    featured: true,
    features: ["Unlimited browsing", "Priority matching", "Group chat access"],
  },
  {
    name: "Unlimited",
    price: "$25",
    detail: "per month",
    features: ["Unlimited hangs", "Priority matching", "Early access to new events"],
  },
];

const PricingSection = ({ onAction }: { onAction: () => void }) => (
  <section className="px-6 py-32 lg:px-12 lg:py-44">
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={stagger}
      className="mx-auto max-w-5xl"
    >
      <motion.p
        variants={fade}
        className="mb-4 text-center text-[11px] font-semibold uppercase tracking-[0.25em] text-white/30"
      >
        Pricing
      </motion.p>
      <motion.h2
        variants={fade}
        className="mb-16 text-center font-display text-4xl font-bold text-white sm:text-5xl"
      >
        Simple, honest pricing.
      </motion.h2>

      <motion.div variants={fade} className="mb-14 grid gap-4 sm:grid-cols-3">
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            className={`flex flex-col rounded-3xl border p-8 transition-all ${
              plan.featured
                ? "border-white/20 bg-white/[0.06] shadow-elevated"
                : "border-white/8 bg-white/[0.02]"
            }`}
          >
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
              {plan.name}
            </p>
            <div className="mb-1 flex items-baseline gap-1">
              <span className="font-display text-4xl font-bold text-white">{plan.price}</span>
              {plan.detail && (
                <span className="text-sm text-white/30">/ {plan.detail}</span>
              )}
            </div>
            <div className="my-6 h-px bg-white/8" />
            <ul className="mb-8 flex-1 space-y-3">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-3 text-sm text-white/50">
                  <Check className="h-4 w-4 flex-shrink-0 text-accent" />
                  {f}
                </li>
              ))}
            </ul>
            <Button
              onClick={onAction}
              className={`w-full rounded-full py-6 font-semibold transition-all ${
                plan.featured
                  ? "bg-white text-[hsl(220,20%,8%)] hover:bg-white/90"
                  : "border border-white/15 bg-white/5 text-white hover:bg-white/10"
              }`}
            >
              Get started
            </Button>
          </div>
        ))}
      </motion.div>
    </motion.div>
  </section>
);

export default PricingSection;
