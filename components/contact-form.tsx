'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { BUSINESS_INFO, getMailtoHref } from '@/lib/seo/business';

const SUBJECTS = [
  'General inquiry',
  'Product information',
  'Order support',
  'Technical support',
  'Bulk / wholesale order',
  'Shipping & delivery',
  'Returns & refunds',
  'Partnership inquiry',
];

export default function ContactForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: SUBJECTS[0],
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Please enter your name');
      return;
    }
    if (!formData.email.trim()) {
      toast.error('Please enter your email');
      return;
    }
    if (!formData.message.trim()) {
      toast.error('Please enter a message');
      return;
    }

    setIsSubmitting(true);

    const body = [
      `Name: ${formData.name.trim()}`,
      `Email: ${formData.email.trim()}`,
      formData.phone.trim() ? `Phone: ${formData.phone.trim()}` : null,
      `Subject: ${formData.subject}`,
      '',
      formData.message.trim(),
    ]
      .filter(Boolean)
      .join('\n');

    const mailtoUrl = getMailtoHref(BUSINESS_INFO.email, {
      subject: `[MS Coatings] ${formData.subject}`,
      body,
    });

    window.location.href = mailtoUrl;
    toast.success('Opening your email app to send the message...');
    setIsSubmitting(false);
  };

  const inputClass =
    'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-navy transition-shadow focus:border-premium-blue focus:outline-none focus:ring-2 focus:ring-premium-blue/20 sm:text-base';

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-navy">
            Full name <span className="text-performance-red">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Your name"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-navy">
            Email address <span className="text-performance-red">*</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="you@example.com"
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-navy">
            Phone number
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            value={formData.phone}
            onChange={handleChange}
            placeholder="+256 ..."
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="subject" className="mb-1.5 block text-sm font-medium text-navy">
            Subject
          </label>
          <select
            id="subject"
            name="subject"
            value={formData.subject}
            onChange={handleChange}
            className={inputClass}
          >
            {SUBJECTS.map((subject) => (
              <option key={subject} value={subject}>
                {subject}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="message" className="mb-1.5 block text-sm font-medium text-navy">
          Message <span className="text-performance-red">*</span>
        </label>
        <textarea
          id="message"
          name="message"
          rows={6}
          value={formData.message}
          onChange={handleChange}
          placeholder="Tell us how we can help — product questions, order details, technical advice, etc."
          className={`${inputClass} resize-y min-h-[140px]`}
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="btn-primary w-full rounded-xl px-6 py-3.5 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-8"
      >
        {isSubmitting ? 'Preparing...' : 'Send Message'}
      </button>

      <p className="text-xs leading-relaxed text-body sm:text-sm">
        Submitting opens your email app with your message pre-filled. For faster
        responses, you can also call or WhatsApp us directly.
      </p>
    </form>
  );
}
