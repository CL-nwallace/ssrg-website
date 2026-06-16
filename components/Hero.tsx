"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { ChevronDownIcon } from "@heroicons/react/24/outline";

interface HeroProps {
  title?: string;
  subtitle?: string;
  backgroundImage?: string;
  backgroundVideo?: string;
  fullHeight?: boolean;
  showLogo?: boolean;
}

export default function Hero({
  title = "SSRG",
  subtitle = "Exotic Car Lifestyle",
  backgroundImage = "/images/hero.jpg",
  backgroundVideo,
  fullHeight = true,
  showLogo = true,
}: HeroProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    // React doesn't reliably reflect the `muted` attribute to the DOM property,
    // and mobile browsers only autoplay muted inline video — force it, then
    // kick playback. If autoplay is blocked (iOS Low Power Mode, data saver),
    // the poster image stays put as the fallback.
    v.muted = true;
    v.play().catch(() => {});
  }, []);

  return (
    <section
      className={`relative ${fullHeight ? "min-h-dvh" : "min-h-[50vh]"} flex items-center justify-center overflow-hidden`}
    >
      {/* Video background (all viewports) with the image as poster + fallback */}
      {backgroundVideo ? (
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          poster={backgroundImage}
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src={backgroundVideo} type="video/mp4" />
        </video>
      ) : (
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${backgroundImage})` }}
        />
      )}

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-bg-deep/40 via-bg-deep/60 to-bg-deep" />

      {/* Content */}
      <div className="relative z-10 text-center px-6">
        {showLogo ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <Image
              src="/images/ssrg-logo.png"
              alt="SSRG"
              width={264}
              height={93}
              className="mx-auto h-24 md:h-32 w-auto invert"
              priority
            />
          </motion.div>
        ) : (
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="font-serif font-bold text-hero md:text-display text-gold"
          >
            {title}
          </motion.h1>
        )}
        {/* The logo artwork already includes the "Exotic Car Lifestyle" tagline,
            so only render the subtitle text when the logo isn't shown. */}
        {!showLogo && subtitle ? (
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="mt-4 text-sm uppercase tracking-[0.4em] text-text-secondary"
          >
            {subtitle}
          </motion.p>
        ) : null}
      </div>

      {/* Scroll indicator */}
      {fullHeight && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <ChevronDownIcon className="w-6 h-6 text-text-muted" />
          </motion.div>
        </motion.div>
      )}
    </section>
  );
}
