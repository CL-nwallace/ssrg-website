"use client";

import Image from "next/image";
import { motion } from "framer-motion";

interface CarCardProps {
  image: string;
  name: string;
  owner: string;
}

export default function CarCard({ image, name, owner }: CarCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      transition={{ duration: 0.3 }}
      className="group relative overflow-hidden rounded-lg cursor-pointer"
    >
      <div className="aspect-[3/2] relative">
        <Image
          src={image}
          alt={`${name} owned by ${owner}`}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-bg-deep via-transparent to-transparent" />
      </div>
      {/* Info */}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <p className="font-serif text-lg text-text-primary">{name}</p>
        <p className="text-small text-gold">{owner}</p>
      </div>
    </motion.div>
  );
}
