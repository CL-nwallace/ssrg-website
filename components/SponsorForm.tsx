"use client";

import { useState } from "react";

export default function SponsorForm() {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    company: "",
    firstName: "",
    lastName: "",
    position: "",
    email: "",
    phone: "",
    goals: "",
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
        <p className="font-serif text-subheading text-gold">
          Application Received
        </p>
        <p className="mt-2 text-text-secondary">
          We&apos;ll review your application and get back to you.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" data-testid="sponsor-form" noValidate>
      <div>
        <label htmlFor="sponsor-company" className="block text-small text-text-secondary mb-2">
          Company name <span className="text-gold">*</span>
        </label>
        <input
          id="sponsor-company"
          name="company"
          type="text"
          required
          value={formData.company}
          onChange={handleChange}
          className="w-full px-4 py-3 bg-bg-surface border border-subtle rounded text-text-primary focus:outline-none focus:border-gold transition-colors"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label htmlFor="sponsor-firstName" className="block text-small text-text-secondary mb-2">
            First name <span className="text-gold">*</span>
          </label>
          <input
            id="sponsor-firstName"
            name="firstName"
            type="text"
            required
            value={formData.firstName}
            onChange={handleChange}
            className="w-full px-4 py-3 bg-bg-surface border border-subtle rounded text-text-primary focus:outline-none focus:border-gold transition-colors"
          />
        </div>
        <div>
          <label htmlFor="sponsor-lastName" className="block text-small text-text-secondary mb-2">
            Last name <span className="text-gold">*</span>
          </label>
          <input
            id="sponsor-lastName"
            name="lastName"
            type="text"
            required
            value={formData.lastName}
            onChange={handleChange}
            className="w-full px-4 py-3 bg-bg-surface border border-subtle rounded text-text-primary focus:outline-none focus:border-gold transition-colors"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label htmlFor="sponsor-position" className="block text-small text-text-secondary mb-2">
            Position <span className="text-gold">*</span>
          </label>
          <input
            id="sponsor-position"
            name="position"
            type="text"
            required
            value={formData.position}
            onChange={handleChange}
            className="w-full px-4 py-3 bg-bg-surface border border-subtle rounded text-text-primary focus:outline-none focus:border-gold transition-colors"
          />
        </div>
        <div>
          <label htmlFor="sponsor-phone" className="block text-small text-text-secondary mb-2">
            Phone <span className="text-gold">*</span>
          </label>
          <input
            id="sponsor-phone"
            name="phone"
            type="tel"
            required
            value={formData.phone}
            onChange={handleChange}
            className="w-full px-4 py-3 bg-bg-surface border border-subtle rounded text-text-primary focus:outline-none focus:border-gold transition-colors"
          />
        </div>
      </div>
      <div>
        <label htmlFor="sponsor-email" className="block text-small text-text-secondary mb-2">
          Email <span className="text-gold">*</span>
        </label>
        <input
          id="sponsor-email"
          name="email"
          type="email"
          required
          value={formData.email}
          onChange={handleChange}
          className="w-full px-4 py-3 bg-bg-surface border border-subtle rounded text-text-primary focus:outline-none focus:border-gold transition-colors"
        />
      </div>
      <div>
        <label htmlFor="sponsor-goals" className="block text-small text-text-secondary mb-2">
          What are you hoping to achieve sponsoring SSRG? <span className="text-gold">*</span>
        </label>
        <textarea
          id="sponsor-goals"
          name="goals"
          required
          rows={4}
          value={formData.goals}
          onChange={handleChange}
          className="w-full px-4 py-3 bg-bg-surface border border-subtle rounded text-text-primary focus:outline-none focus:border-gold transition-colors resize-none"
        />
      </div>
      <button
        type="submit"
        className="px-8 py-3 bg-gold text-bg-deep font-semibold rounded hover:bg-gold-light transition-colors cursor-pointer"
      >
        Submit Application
      </button>
    </form>
  );
}
