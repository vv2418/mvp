import { useNavigate } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import HeroSection from "@/components/landing/HeroSection";
import StorySection from "@/components/landing/StorySection";
import TestimonialsSection from "@/components/landing/TestimonialsSection";
import PricingSection from "@/components/landing/PricingSection";
import CTASection from "@/components/landing/CTASection";
import LandingNav from "@/components/landing/LandingNav";
import LandingFooter from "@/components/landing/LandingFooter";

const Landing = () => {
  const navigate = useNavigate();
  const go = () => navigate("/signup");

  return (
    <div className="min-h-screen bg-[hsl(220,20%,8%)] text-white overflow-x-hidden">
      <LandingNav onAction={go} />
      <HeroSection onAction={go} />
      <StorySection />
      <TestimonialsSection />
      <PricingSection onAction={go} />
      <CTASection onAction={go} />
      <LandingFooter />
    </div>
  );
};

export default Landing;
