"use client";

import { useState } from "react";

export default function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setEmail("");
  };

  if (submitted) {
    return (
      <p className="text-small text-gold">
        Thank you for subscribing!
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="email"
        required
        placeholder="Your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="flex-1 px-4 py-2 bg-bg-surface border border-subtle rounded text-small text-text-primary placeholder:text-text-muted focus:outline-none focus:border-gold transition-colors"
        aria-label="Email for newsletter"
      />
      <button
        type="submit"
        className="px-4 py-2 bg-gold text-bg-deep font-semibold text-small rounded hover:bg-gold-light transition-colors cursor-pointer"
      >
        Subscribe
      </button>
    </form>
  );
}
