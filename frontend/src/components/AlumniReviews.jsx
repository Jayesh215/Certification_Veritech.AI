import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Building2, Star } from "lucide-react";
import {
  ALUMNI_REVIEW_COUNT,
  alumniAverageRating,
  alumniCompanies,
  alumniReviews,
} from "../data/alumniReviews";

function Stars({ rating }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${
            i < rating ? "fill-[#F59E0B] text-[#F59E0B]" : "fill-transparent text-slate-300"
          }`}
        />
      ))}
    </span>
  );
}

function ReviewTile({ review }) {
  return (
    <article className="w-[300px] shrink-0 rounded-[20px] border border-slate-100 bg-white p-5 shadow-[0_10px_30px_-22px_rgba(15,23,42,0.28)] sm:w-[340px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#0F172A]">{review.name}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {review.role} · {review.company}
          </p>
        </div>
        <Stars rating={review.rating} />
      </div>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">{review.text}</p>
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-[#2563EB]">
        Veritech.AI certified alumnus
      </p>
    </article>
  );
}

function MarqueeRow({ items, duration = 80, reverse = false }) {
  const reduce = useReducedMotion();
  const loop = useMemo(() => [...items, ...items], [items]);

  if (reduce) {
    return (
      <div className="flex gap-4 overflow-x-auto px-5 pb-2">
        {items.map((review) => (
          <ReviewTile key={review.id} review={review} />
        ))}
      </div>
    );
  }

  return (
    <div className="alumni-marquee overflow-hidden">
      <div
        className={`alumni-marquee-track flex w-max gap-4 ${reverse ? "alumni-marquee-reverse" : ""}`}
        style={{ "--alumni-marquee-duration": `${duration}s` }}
      >
        {loop.map((review, index) => (
          <ReviewTile key={`${review.id}-${index}`} review={review} />
        ))}
      </div>
    </div>
  );
}

function CompanyStrip() {
  const reduce = useReducedMotion();
  const loop = useMemo(() => [...alumniCompanies, ...alumniCompanies], []);

  return (
    <div className="mt-10 overflow-hidden border-y border-slate-100 bg-white py-5">
      <p className="mb-4 text-center text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        Alumni placed across leading companies
      </p>
      <div className={reduce ? "flex flex-wrap justify-center gap-x-8 gap-y-3 px-5" : "alumni-marquee"}>
        <div
          className={
            reduce
              ? "contents"
              : "alumni-marquee-track alumni-marquee-slow flex w-max items-center gap-10 px-5"
          }
          style={reduce ? undefined : { "--alumni-marquee-duration": "55s" }}
        >
          {(reduce ? alumniCompanies : loop).map((company, index) => (
            <span
              key={`${company}-${index}`}
              className="inline-flex items-center gap-2 text-sm font-semibold tracking-wide text-slate-500"
            >
              <Building2 className="h-3.5 w-3.5 text-[#2563EB]" />
              {company}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AlumniReviews() {
  const rowOne = alumniReviews.slice(0, 18);
  const rowTwo = alumniReviews.slice(18, 36);

  return (
    <section className="bg-white px-0 py-20" data-testid="alumni-reviews-section">
      <div className="mx-auto max-w-6xl px-5">
        <motion.div
          className="mx-auto max-w-3xl text-center"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ type: "spring", stiffness: 500, damping: 60 }}
        >
          <p className="inline-flex rounded-xl bg-[#EFF6FF] px-3 py-1 text-sm font-semibold text-[#2563EB]">
            Alumni placements
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[#0F172A] sm:text-4xl">
            {ALUMNI_REVIEW_COUNT}+ Veritech.AI alumni rated their certificate journey
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-500">
            Interns who completed a Veritech.AI internship and received a verified certificate have gone on to roles at major technology and consulting companies. Their reviews and ratings are collected below.
          </p>
        </motion.div>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            { label: "Alumni reviews", value: `${ALUMNI_REVIEW_COUNT}+` },
            { label: "Average rating", value: `${alumniAverageRating}/5` },
            { label: "Companies mentioned", value: `${alumniCompanies.length}+` },
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              className="rounded-[20px] border border-slate-100 bg-[#F8FAFC] px-5 py-6 text-center"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ type: "spring", stiffness: 500, damping: 60, delay: 0.08 * index }}
            >
              <p className="text-3xl font-semibold tracking-tight text-[#2563EB]">{stat.value}</p>
              <p className="mt-1 text-sm font-medium text-slate-500">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>

      <CompanyStrip />

      <div className="mt-10 space-y-4">
        <MarqueeRow items={rowOne} duration={95} />
        <MarqueeRow items={rowTwo} duration={110} reverse />
      </div>

      <p className="mx-auto mt-8 max-w-3xl px-5 text-center text-xs leading-relaxed text-slate-400">
        Reviews reflect alumni who completed a Veritech.AI internship and downloaded their certificate. Company names refer to where alumni reported receiving offers or joining after the program.
      </p>
    </section>
  );
}
