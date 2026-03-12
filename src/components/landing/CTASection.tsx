import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const fade = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 1, ease: [0.22, 1, 0.36, 1] as const } },
};

const CTASection = ({ onAction }: { onAction: () => void }) => (
  <section className="relative overflow-hidden px-6 py-40 lg:px-12 lg:py-52">
    {/* Subtle radial glow */}
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="h-[600px] w-[600px] rounded-full bg-accent/5 blur-[120px]" />
    </div>

    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={fade}
      className="relative mx-auto max-w-2xl text-center"
    >
      <h2 className="mb-8 font-display text-4xl font-bold leading-[1.1] text-white sm:text-5xl lg:text-6xl text-balance">
        Stop waiting for someone to invite&nbsp;you.
      </h2>
      <p className="mb-12 text-lg text-white/40">
        Your first hang is free. No card required.
      </p>
      <Button
        onClick={onAction}
        className="group rounded-full bg-white px-12 py-7 text-base font-semibold text-[hsl(220,20%,8%)] shadow-dramatic transition-all hover:bg-white/95"
        size="lg"
      >
        Try your first hang free
        <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
      </Button>
    </motion.div>
  </section>
);

export default CTASection;
