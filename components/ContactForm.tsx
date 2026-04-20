"use client";

import { useState } from "react";

export default function ContactForm() {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    message: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="text-center py-12">
        <p className="font-serif text-subheading text-gold">Message Sent</p>
        <p className="mt-2 text-text-secondary">
          We&apos;ll get back to you soon.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" data-testid="contact-form" noValidate>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label htmlFor="contact-firstName" className="block text-small text-text-secondary mb-2">
            First name
          </label>
          <input
            id="contact-firstName"
            name="firstName"
            type="text"
            required
            value={formData.firstName}
            onChange={handleChange}
            className="w-full px-4 py-3 bg-bg-surface border border-subtle rounded text-text-primary focus:outline-none focus:border-gold transition-colors"
          />
        </div>
        <div>
          <label htmlFor="contact-lastName" className="block text-small text-text-secondary mb-2">
            Last name
          </label>
          <input
            id="contact-lastName"
            name="lastName"
            type="text"
            value={formData.lastName}
            onChange={handleChange}
            className="w-full px-4 py-3 bg-bg-surface border border-subtle rounded text-text-primary focus:outline-none focus:border-gold transition-colors"
          />
        </div>
      </div>
      <div>
        <label htmlFor="contact-email" className="block text-small text-text-secondary mb-2">
          Email <span className="text-gold">*</span>
        </label>
        <input
          id="contact-email"
          name="email"
          type="email"
          required
          value={formData.email}
          onChange={handleChange}
          className="w-full px-4 py-3 bg-bg-surface border border-subtle rounded text-text-primary focus:outline-none focus:border-gold transition-colors"
        />
      </div>
      <div>
        <label htmlFor="contact-message" className="block text-small text-text-secondary mb-2">
          Message <span className="text-gold">*</span>
        </label>
        <textarea
          id="contact-message"
          name="message"
          required
          rows={5}
          value={formData.message}
          onChange={handleChange}
          className="w-full px-4 py-3 bg-bg-surface border border-subtle rounded text-text-primary focus:outline-none focus:border-gold transition-colors resize-none"
        />
      </div>
      <button
        type="submit"
        className="px-8 py-3 bg-gold text-bg-deep font-semibold rounded hover:bg-gold-light transition-colors cursor-pointer"
      >
        Send Message
      </button>
    </form>
  );
}
