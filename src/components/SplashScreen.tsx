import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

const SplashScreen = ({ onComplete }: { onComplete: () => void }) => {
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const t = setTimeout(() => onCompleteRef.current(), 1800);
    return () => clearTimeout(t);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground"
    >
      <h1 className="font-display text-5xl font-bold text-primary-foreground tracking-tight sm:text-6xl">
        Rekindled
      </h1>
    </motion.div>
  );
};

export default SplashScreen;
