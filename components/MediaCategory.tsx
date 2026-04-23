"use client";

import Link from "next/link";
import { motion } from "framer-motion";

interface MediaCategoryProps {
  image: string;
  title: string;
  description: string;
  href: string;
}

export default function MediaCategory({
  image,
  title,
  description,
  href,
}: MediaCategoryProps) {
  return (
    <Link href={href}>
      <motion.div
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.3 }}
        className="group relative aspect-[4/3] rounded-lg overflow-hidden cursor-pointer"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt={title}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        {/* Overlay */}
        <div className="absolute inset-0 bg-bg-deep/50 group-hover:bg-bg-deep/70 transition-colors duration-300" />

        {/* Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
          <h3 className="font-serif text-subheading text-text-primary">
            {title}
          </h3>
          <p className="mt-2 text-small text-text-secondary max-w-xs opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            {description}
          </p>
        </div>
      </motion.div>
    </Link>
  );
}
