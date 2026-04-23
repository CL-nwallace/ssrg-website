"use client";

import { useState } from "react";
import Image from "next/image";
import Hero from "@/components/Hero";
import SectionHeading from "@/components/SectionHeading";
import FadeIn from "@/components/FadeIn";
import CarCard from "@/components/CarCard";
import SponsorCard from "@/components/SponsorCard";
import ContactForm from "@/components/ContactForm";
import SponsorForm from "@/components/SponsorForm";

const members = [
  { image: "/images/car-1.jpg", name: "Lamborghini Huracan", owner: "@boytulisan" },
  { image: "/images/car-2.jpg", name: "McLaren 570S", owner: "@tsuper570" },
  { image: "/images/car-3.jpg", name: "McLaren Artura", owner: "@art_ovwar" },
  { image: "/images/car-4.jpg", name: "McLaren 720S Spider", owner: "@carbajal_369" },
  { image: "/images/car-5.jpg", name: "Porsche 991.1 GT3RS", owner: "@sonic_gt3rs" },
  { image: "/images/car-6.jpg", name: "Corvette C8 Z06", owner: "@johnnyl_777" },
  { image: "/images/car-7.jpg", name: "Lotus Emira", owner: "@zoom_lotus" },
  { image: "/images/car-8.jpg", name: "Audi R8 GT", owner: "@ls1z01" },
  { image: "/images/car-9.jpg", name: "Ferrari 488 GTB", owner: "@jon_488_gt3" },
  { image: "/images/car-10.jpg", name: "Lamborghini Huracan", owner: "@rubenz_amg63" },
  { image: "/images/car-11.jpg", name: "McLaren 570S", owner: "@orange570s" },
  { image: "/images/car-12.jpg", name: "Aston Martin Vantage V12", owner: "@jorgiehigareda" },
  { image: "/images/car-13.jpg", name: "Ferrari 296 Spider", owner: "@afamousworld" },
  { image: "/images/car-14.jpg", name: "Ferrari F8 Spider", owner: "Micky" },
  { image: "/images/car-15.jpg", name: "Lamborghini Huracan", owner: "@hramv10" },
  { image: "/images/car-16.jpg", name: "Porsche 911 GT3", owner: "@nihowdy.james" },
  { image: "/images/car-17.jpg", name: "Corvette C8 Z06", owner: "@dar_win_all" },
  { image: "/images/car-18.jpg", name: "McLaren 720S", owner: "Steve" },
];

const sponsors = [
  {
    logo: "/images/sponsor-ultra.png",
    name: "Ultra Autoworks",
    href: "https://ultraautoworks.net/",
    invertLogo: true,
    services: [
      "Paint Protection Film (Full & Partial PPF)",
      "Vinyl Wraps & Color Changes",
      "Window Tint (Heat & UV Rejection)",
      "Ceramic Coating",
      "Professional Detailing",
      "Climate-controlled Vehicle Storage",
    ],
    perks: [
      "Monthly detail wash on SSRG cars with banners",
      "Special member discounted pricing on all services",
      "Prioritized scheduling for member cars",
    ],
  },
  {
    logo: "/images/sponsor-carbontastic.png",
    name: "Carbontastic",
    href: "http://www.carbontastic.com/",
    invertLogo: true,
    services: [
      "Fully customized steering wheels",
      "OEM+ refresh designs",
      "Full carbon fiber builds",
      "Custom designs for any vehicle",
    ],
    perks: ["Special member discounted pricing on all products"],
  },
  {
    logo: "/images/sponsor-ether.jpg",
    name: "Ether Supercars",
    href: "http://www.ether-supercars.com/",
    services: [
      "Automotive repair & maintenance",
      "Motorsports expertise",
      "Full-service facility",
      "Family-owned, Orange County based",
    ],
    perks: ["Prioritized scheduling for member cars"],
  },
];

const visionSections = [
  {
    image: "/images/passion.jpg",
    title: "Our Passion",
    text: "At SSRG, our passion for cars drives everything we do. We believe in the power of community and the joy of sharing our love for automobiles. Our members' diverse tastes in exotic cars create a vibrant and dynamic atmosphere.",
    align: "left" as const,
  },
  {
    image: "/images/vision.jpg",
    title: "Our Vision",
    text: "Our vision is to become the leading community for car enthusiasts, renowned for exceptional events and an inclusive atmosphere. We aim to create a space where every car lover feels welcome and inspired.",
    align: "right" as const,
  },
  {
    image: "/images/goal.jpg",
    title: "Our Goal",
    text: "Our goal is simple: to provide unforgettable experiences for car enthusiasts. We are committed to organizing top-notch events that cater to both drivers and spectators, setting new standards in the world of car events.",
    align: "left" as const,
  },
];

export default function HomePage() {
  const [showAll, setShowAll] = useState(false);
  const displayedMembers = showAll ? members : members.slice(0, 6);

  return (
    <>
      {/* Hero */}
      <Hero backgroundVideo="/videos/hero.mp4" />

      {/* Who is SSRG? */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <FadeIn direction="left">
            <div className="gold-line mb-6" />
            <h2 className="font-serif font-semibold text-heading text-text-primary">
              Who is SSRG?
            </h2>
            <p className="mt-6 text-body text-text-secondary leading-relaxed">
              SSRG is a premier car event and lifestyle group dedicated to
              bringing together car enthusiasts for unforgettable driving
              experiences and social gatherings. Whether you are a seasoned
              driver or just beginning your journey, SSRG offers events that
              cater to all. From scenic drives to casual meetups, we create
              opportunities for our members to connect, share their passion for
              cars, and enjoy the open road.
            </p>
          </FadeIn>
          <FadeIn direction="right" delay={0.2}>
            <div className="relative aspect-[4/3] rounded-lg overflow-hidden">
              <Image
                src="/images/track-cover.jpg"
                alt="SSRG Track Day"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Passion / Vision / Goal */}
      <section data-testid="vision-section">
        {visionSections.map((section) => (
          <div key={section.title} className="relative min-h-[70vh] flex items-center">
            <div
              className="absolute inset-0 bg-cover bg-center bg-fixed"
              style={{ backgroundImage: `url(${section.image})` }}
            />
            <div className="absolute inset-0 bg-bg-deep/70" />

            <div className="relative z-10 max-w-7xl mx-auto px-6 py-24 w-full">
              <FadeIn
                direction="up"
                delay={0.1}
                className={`max-w-xl ${section.align === "right" ? "ml-auto text-right" : ""}`}
              >
                <div
                  className={`gold-line mb-6 ${section.align === "right" ? "ml-auto" : ""}`}
                />
                <h2 className="font-serif font-semibold text-heading text-text-primary">
                  {section.title}
                </h2>
                <p className="mt-6 text-body text-text-secondary leading-relaxed">
                  {section.text}
                </p>
              </FadeIn>
            </div>
          </div>
        ))}
      </section>

      {/* Loyal Participants */}
      <section className="py-24 px-6" data-testid="members-section">
        <SectionHeading
          title="Loyal Participants"
          subtitle="Our members are our pride. Here are some of the incredible cars and their proud owners who regularly join our events."
        />
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedMembers.map((member, index) => (
            <FadeIn key={member.owner + index} delay={index * 0.05}>
              <CarCard {...member} />
            </FadeIn>
          ))}
        </div>
        {!showAll && (
          <div className="text-center mt-12">
            <button
              onClick={() => setShowAll(true)}
              className="px-8 py-3 border border-gold text-gold font-semibold text-small rounded hover:bg-gold hover:text-bg-deep transition-colors cursor-pointer"
            >
              View All Members
            </button>
          </div>
        )}
      </section>

      {/* About Sally */}
      <section className="py-24 px-6 bg-bg-elevated" data-testid="about-section">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <FadeIn direction="left">
            <div className="relative aspect-[3/2] rounded-lg overflow-hidden">
              <Image
                src="/images/sally.jpg"
                alt="Sally Corpin"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
          </FadeIn>
          <FadeIn direction="right" delay={0.2}>
            <div className="gold-line mb-6" />
            <h2 className="font-serif font-semibold text-heading text-text-primary">
              About Us
            </h2>
            <p className="mt-6 text-body text-text-secondary leading-relaxed">
              Introducing Sally Corpin, the heart and soul of SSRG events. With
              her passion for cars and her exceptional organizational skills,
              Sally ensures that every event is meticulously planned and
              executed. Her dedication to creating memorable experiences for our
              members is unmatched.
            </p>
            <div className="mt-8">
              <p className="font-serif text-large text-gold">Sally Corpin</p>
              <p className="text-small text-text-muted uppercase tracking-widest mt-1">
                Event Host | Organizer | Exotic Car Buyer/Seller
              </p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Sponsors */}
      <section className="py-24 px-6" data-testid="sponsors-section">
        <SectionHeading
          title="Our Valued Partners"
          subtitle="Premium brands that support the SSRG community and offer exclusive perks to our members."
        />
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {sponsors.map((sponsor) => (
            <FadeIn key={sponsor.name}>
              <SponsorCard {...sponsor} />
            </FadeIn>
          ))}
        </div>
      </section>

      {/* Become a Sponsor */}
      <section className="py-24 px-6 bg-bg-elevated" data-testid="sponsor-form-section">
        <div className="max-w-2xl mx-auto">
          <SectionHeading
            title="Become Our Sponsor"
            subtitle="Interested in partnering with SSRG? Fill out the form below and we'll be in touch."
          />
          <div className="bg-bg-deep border border-subtle rounded-lg p-8">
            <SponsorForm />
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="py-24 px-6" data-testid="contact-section">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
          <div>
            <SectionHeading title="Contact Us" align="left" />
            <div className="bg-bg-elevated border border-subtle rounded-lg p-8">
              <ContactForm />
            </div>
          </div>
          <FadeIn direction="right" delay={0.2}>
            <div className="relative aspect-[4/3] rounded-lg overflow-hidden mt-16 lg:mt-0">
              <Image
                src="/images/mclaren-footer.jpg"
                alt="McLaren 720s"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
          </FadeIn>
        </div>
      </section>
    </>
  );
}
