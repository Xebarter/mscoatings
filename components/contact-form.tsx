'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle2, Loader2, Send } from 'lucide-react';
import { CONTACT_SUBJECTS } from '@/lib/contact';

export default function ContactForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: CONTACT_SUBJECTS[0],
    message: '',
    company: '', // honeypot
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
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
    if (formData.message.trim().length < 10) {
      toast.error('Please enter a message (at least 10 characters)');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.status === 204) {
        setSent(true);
        return;
      }

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };

      if (!res.ok) {
        toast.error(data.error || 'Unable to send your message');
        return;
      }

      toast.success(data.message || 'Message sent successfully');
      setSent(true);
      setFormData({
        name: '',
        email: '',
        phone: '',
        subject: CONTACT_SUBJECTS[0],
        message: '',
        company: '',
      });
    } catch {
      toast.error('Network error — please try again or call us');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    'w-full rounded-xl border border-slate-200/80 bg-white/90 px-4 py-3 text-sm text-navy shadow-sm transition focus:border-premium-blue focus:outline-none focus:ring-2 focus:ring-premium-blue/20 sm:text-base';

  if (sent) {
    return (
      <div className="flex flex-col items-center px-2 py-10 text-center sm:py-14">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
          <CheckCircle2 size={28} />
        </div>
        <h3 className="text-xl font-bold text-navy">Message received</h3>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-body">
          Thank you for contacting MS Coatings. Our team will respond within one business
          day — usually sooner during office hours.
        </p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="mt-6 text-sm font-semibold text-premium-blue hover:text-cyan"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Honeypot — hidden from users */}
      <input
        type="text"
        name="company"
        value={formData.company}
        onChange={handleChange}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
      />

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
            required
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
            required
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
            {CONTACT_SUBJECTS.map((subject) => (
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
          className={`${inputClass} min-h-[140px] resize-y`}
          required
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="btn-primary inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-8"
      >
        {isSubmitting ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Sending…
          </>
        ) : (
          <>
            <Send size={16} />
            Send Message
          </>
        )}
      </button>

      <p className="text-xs leading-relaxed text-body sm:text-sm">
        Your message is delivered securely to our team dashboard. We typically respond
        within one business day.
      </p>
    </form>
  );
}
