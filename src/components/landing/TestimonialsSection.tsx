import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const TESTIMONIALS = [
  {
    text: "I showed up alone and left with three people's numbers. Best decision I made all month.",
    author: "Sarah",
    age: "26",
  },
  {
    text: "Knowing it was only 6 people made me actually go. Big events paralyze me — this didn't.",
    author: "Marcus",
    age: "28",
  },
  {
    text: "The group chat after was the best part. We're hanging out again this weekend.",
    author: "Priya",
    age: "24",
  },
  {
    text: "I've tried meetup apps before. This is the first one where I actually made friends.",
    author: "Jake",
    age: "31",
  },
];

const DURATION = 4000;

const TestimonialsSection = () => {
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);

  const goTo = useCallback((idx: number) => {
    setActive(idx);
    setProgress(0);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          setActive((a) => (a + 1) % TESTIMONIALS.length);
          return 0;
        }
        return p + (100 / (DURATION / 50));
      });
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const t = TESTIMONIALS[active];

  return (
    <section className="px-6 py-32 lg:px-12 lg:py-44">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] as const }}
        className="mx-auto max-w-4xl"
      >
        <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-white/30">
          After one hang
        </p>
        <h2 className="mb-16 font-display text-4xl font-bold text-white sm:text-5xl">
          Real people, real&nbsp;stories.
        </h2>

        {/* Progress bars */}
        <div className="mb-12 flex gap-2">
          {TESTIMONIALS.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className="relative h-[3px] flex-1 cursor-pointer overflow-hidden rounded-full bg-white/10"
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-white/60 transition-none"
                style={{
                  width: i === active ? `${Math.min(progress, 100)}%` : i < active ? "100%" : "0%",
                  transition: i === active ? "none" : "width 0.3s ease",
                }}
              />
            </button>
          ))}
        </div>

        {/* Quote */}
        <div className="min-h-[200px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] as const }}
            >
              <p className="mb-8 font-display text-2xl leading-relaxed text-white/80 sm:text-3xl lg:text-4xl">
                "{t.text}"
              </p>
              <div>
                <p className="text-sm font-semibold text-white/60">{t.author}</p>
                <p className="text-xs text-white/25">{t.age}</p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </section>
  );
};

export default TestimonialsSection;
