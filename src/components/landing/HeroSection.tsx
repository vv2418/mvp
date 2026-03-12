import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const heroImg = "/images/hero-friends.jpg";

const fade = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.3 + i * 0.15, duration: 1, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

const HeroSection = ({ onAction }: { onAction: () => void }) => (
  <section className="relative flex min-h-[100svh] items-center overflow-hidden">
    <motion.div
      initial={{ scale: 1.1 }}
      animate={{ scale: 1 }}
      transition={{ duration: 2, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0"
    >
      <img
        src={heroImg}
        alt="Friends laughing together"
        className="h-full w-full object-cover"
      />
    </motion.div>

    <div className="absolute inset-0 bg-gradient-to-t from-[hsl(220,20%,8%)] via-[hsl(220,20%,8%,0.4)] to-[hsl(220,20%,8%,0.3)]" />

    <div className="relative z-10 w-full px-6 lg:px-12">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl pt-20">
          <motion.p
            custom={0}
            initial="hidden"
            animate="visible"
            variants={fade}
            className="mb-6 text-sm font-semibold uppercase tracking-[0.2em] text-white/50"
          >
            Where real friendships begin
          </motion.p>
          <motion.h1
            custom={1}
            initial="hidden"
            animate="visible"
            variants={fade}
            className="mb-8 font-display text-5xl font-bold leading-[1.05] text-white sm:text-6xl lg:text-7xl xl:text-8xl"
          >
            Your next
            <br />
            friend group
            <br />
            <span className="italic text-white/60">starts here.</span>
          </motion.h1>
          <motion.p
            custom={2}
            initial="hidden"
            animate="visible"
            variants={fade}
            className="mb-10 max-w-md text-lg leading-relaxed text-white/50"
          >
            Small groups. Real activities. A host who makes sure nobody stands alone.
          </motion.p>
          <motion.div custom={3} initial="hidden" animate="visible" variants={fade}>
            <Button
              onClick={onAction}
              className="group rounded-full bg-white px-10 py-7 text-base font-semibold text-[hsl(220,20%,8%)] shadow-dramatic transition-all hover:bg-white/95 hover:shadow-elevated"
              size="lg"
            >
              Try your first hang free
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </motion.div>
        </div>
      </div>
    </div>

    <motion.div
      animate={{ y: [0, 8, 0] }}
      transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
      className="absolute bottom-10 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2"
    >
      <div className="h-10 w-[1px] bg-gradient-to-b from-transparent to-white/30" />
    </motion.div>
  </section>
);

export default HeroSection;
