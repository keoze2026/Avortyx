"use client"

import { useEffect, useRef, useState } from "react"
import { CaretDown } from "@phosphor-icons/react/dist/ssr"

const FAQS = [
  {
    question: "How does pricing work?",
    answer:
      "You pay per routed call. Starter is $49/month with 500 routed calls included; Growth is $199/month with 5,000. Additional calls are billed per call at the rate shown in your workspace. We only charge for calls that actually reach a buyer — screened-out and unanswered calls are never billed.",
  },
  {
    question: "Which numbers can I use?",
    answer:
      "Buy local or toll-free numbers across all 50 states directly from Avortyx, or port the numbers you already own. Numbers can be pooled per campaign for dynamic insertion, and every number carries its own concurrency and daily caps.",
  },
  {
    question: "How do you handle TCPA and DNC compliance?",
    answer:
      "Every attempt is screened before it rings a buyer: federal, state and your internal DNC lists, TCPA consent proof, VoIP and velocity fraud signals, and per-state two-party recording rules. The decision log is stored on the call record and exportable for audit.",
  },
  {
    question: "Can I bring my own buyers?",
    answer:
      "Yes. Add your buyers with their destinations, bids and caps and route to them directly. You can also publish inventory to the Avortyx marketplace and let vetted buyers bid on your traffic in real time — or run both side by side.",
  },
  {
    question: "How fast is a routing decision?",
    answer:
      "Scoring and buyer selection happen while the call is still ringing — typically well under a second — so the caller is connected on the first ring instead of sitting in a queue. Live calls, in-flight counts and connect rates update in the dashboard as they happen.",
  },
  {
    question: "Do you offer SLAs?",
    answer:
      "Growth plans include a 99.9% routing uptime SLA. Enterprise plans include 99.99% with guaranteed response times, a dedicated support channel and private routing infrastructure. Real-time status is published on our status page.",
  },
]

function FAQItem({
  question,
  answer,
  isOpen,
  onClick,
  delay,
  isVisible,
}: {
  question: string
  answer: string
  isOpen: boolean
  onClick: () => void
  delay: number
  isVisible: boolean
}) {
  return (
    <div
      className={`border-b border-[var(--color-baltic-sea-800)] transition-all duration-500 ${
        isVisible ? "opacity-100 translate-x-0" : `opacity-0 ${delay % 2 === 0 ? "-translate-x-8" : "translate-x-8"}`
      }`}
      style={{ transitionDelay: `${delay * 75 + 200}ms` }}
    >
      <button onClick={onClick} className="w-full flex items-center justify-between py-5 text-left group">
        <span className="font-medium text-[var(--color-baltic-sea-200)] group-hover:text-[var(--color-keppel-400)] transition-colors">
          {question}
        </span>
        <CaretDown
          weight="bold"
          className={`h-5 w-5 text-[var(--color-baltic-sea-500)] group-hover:text-[var(--color-keppel-400)] transition-all duration-300 ${isOpen ? "rotate-180 text-[var(--color-keppel-400)]" : ""}`}
        />
      </button>
      <div
        className={`grid transition-all duration-300 ease-out ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      >
        <div className="overflow-hidden">
          <p className="pb-5 text-[var(--color-baltic-sea-400)] leading-relaxed">{answer}</p>
        </div>
      </div>
    </div>
  )
}

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1 },
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section id="faq" ref={ref} className="py-24 border-t border-[var(--color-baltic-sea-900)] overflow-hidden">
      <div className="mx-auto max-w-[800px] px-2.5 sm:px-6 lg:px-12">
        <div
          className={`text-center max-w-2xl mx-auto mb-16 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0 blur-0" : "opacity-0 translate-y-12 blur-sm"}`}
        >
          <span className="text-sm font-medium text-[var(--color-keppel-400)] uppercase tracking-wider">FAQ</span>
          <h2 className="mt-3 text-3xl font-bold text-[var(--color-baltic-sea-100)] md:text-4xl">
            Frequently asked questions
          </h2>
        </div>

        <div>
          {FAQS.map((faq, i) => (
            <FAQItem
              key={faq.question}
              question={faq.question}
              answer={faq.answer}
              isOpen={openIndex === i}
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              delay={i}
              isVisible={isVisible}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
