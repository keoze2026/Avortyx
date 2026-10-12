"use client"

import { motion } from "framer-motion"
import { ChevronRight, Check, Activity, TrendingUp, Zap } from "lucide-react"

const integrations = [
  { name: "Twilio", isConnected: true, selected: true, icon: "◇" },
  { name: "HubSpot", isConnected: true, selected: false, icon: "◉" },
  { name: "Salesforce", isConnected: true, selected: false, icon: "◈" },
  { name: "Zapier", isConnected: false, selected: false, icon: "○" },
  { name: "Segment", isConnected: true, selected: false, icon: "◎" },
  { name: "GoHighLevel", isConnected: false, selected: false, icon: "○" },
]

export function AISection() {
  return (
    <div className="relative z-20 py-40" style={{ backgroundColor: "#09090B" }}>
      <div
        className="absolute top-0 left-0 right-0 pointer-events-none"
        style={{
          height: "20%",
          background: "linear-gradient(to bottom, rgba(255,255,255,0.05) 0%, transparent 100%)",
        }}
      />
      <div className="w-full flex justify-center px-6">
        <div className="w-full max-w-5xl">
          {/* Section label */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-2 mb-6"
          >
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-zinc-400 text-sm">AI-powered intelligence</span>
            <ChevronRight className="w-4 h-4 text-zinc-500" />
          </motion.div>

          {/* Heading */}
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-3xl sm:text-4xl md:text-5xl lg:text-[56px] text-white max-w-3xl mb-8"
            style={{
              letterSpacing: "-0.0325em",
              fontVariationSettings: '"opsz" 28',
              fontWeight: 538,
              lineHeight: 1.1,
            }}
          >
            AI optimization that learns your network
          </motion.h2>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-zinc-400 max-w-md mb-8"
          >
            <span className="text-white font-medium">AVO AI.</span> Suggests where to scale, pause, rebalance, or alert — automatically based on your network&apos;s performance patterns.
          </motion.p>

          {/* Learn more button */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="px-5 py-2.5 bg-zinc-800 text-zinc-300 rounded-lg border border-zinc-700 hover:bg-zinc-700 transition-colors text-sm flex items-center gap-2 mb-16"
          >
            Explore AI features
            <ChevronRight className="w-4 h-4" />
          </motion.button>

          {/* Integration dropdown mockup */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="flex justify-center mb-24"
          >
            <div
              style={{
                perspective: "900px",
                userSelect: "none",
                WebkitUserSelect: "none",
                width: "100%",
                maxWidth: "720px",
                position: "relative",
              }}
            >
              <div
                style={{
                  transformOrigin: "top",
                  willChange: "transform",
                  transform: "translateY(0%) rotateX(30deg) scale(1.15)",
                  position: "relative",
                }}
              >
                {/* Glass overlay effect */}
                <div
                  style={{
                    border: "1px solid rgba(66, 66, 66, 0.5)",
                    background: "linear-gradient(rgba(255, 255, 255, 0.1) 40%, rgba(8, 9, 10, 0.1) 100%)",
                    borderRadius: "8px",
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: 0,
                    right: 0,
                    boxShadow:
                      "inset 0 1.503px 5.261px rgba(255, 255, 255, 0.04), inset 0 -0.752px 0.752px rgba(255, 255, 255, 0.1)",
                    pointerEvents: "none",
                    zIndex: 10,
                  }}
                />

                <div
                  style={{
                    background: "linear-gradient(180deg, transparent 0%, #09090B 100%)",
                    height: "80%",
                    position: "absolute",
                    bottom: "-2px",
                    left: "-180px",
                    right: "-180px",
                    pointerEvents: "none",
                    zIndex: 11,
                  }}
                />

                {/* Input field */}
                <div className="bg-zinc-800/50 border border-zinc-700 rounded-t-xl px-5 py-4">
                  <span className="text-zinc-500 italic">Route to buyer...</span>
                </div>

                {/* Dropdown options */}
                <div className="bg-zinc-900/80 border border-t-0 border-zinc-700 rounded-b-xl py-1">
                  {integrations.map((integration, index) => (
                    <div
                      key={integration.name}
                      style={
                        integration.selected
                          ? {
                              transform: "scale(1.04) rotateX(17deg)",
                              background: "linear-gradient(#343434 0%, #2d2d2d 100%)",
                              borderRadius: "6px",
                              height: "48px",
                              position: "relative",
                              boxShadow:
                                "inset 0 -2.75px 4.75px rgba(255, 255, 255, 0.14), inset 0 -0.752px 0.752px rgba(255, 255, 255, 0.1), 0 54px 73px 3px rgba(0, 0, 0, 0.5)",
                              zIndex: 20,
                              marginLeft: "-12px",
                              marginRight: "-12px",
                            }
                          : {
                              opacity: 1 - index * 0.15,
                              height: "42px",
                            }
                      }
                    >
                      <div
                        className="flex items-center justify-between h-full"
                        style={{
                          paddingLeft: "24px",
                          paddingRight: "24px",
                          gap: "12px",
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-zinc-400 text-lg">{integration.icon}</span>
                          <span className={integration.selected ? "text-white font-medium" : "text-zinc-300"}>
                            {integration.name}
                          </span>
                          {integration.isConnected && (
                            <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">Connected</span>
                          )}
                        </div>
                        {integration.selected && <Check className="w-4 h-4 text-zinc-400" />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Bottom divider with two columns */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-16"
          >
            <div className="grid grid-cols-1 md:grid-cols-2">
              {/* Left column */}
              <div className="border-t border-r border-b border-zinc-800/60 pt-12 pr-12 pb-16">
                <h3 className="text-zinc-200 font-medium text-xl mb-3">Smart routing suggestions</h3>
                <p className="text-zinc-500 text-base mb-8">
                  Avortyx analyzes your network patterns and suggests optimizations to maximize revenue and buyer match rates.
                </p>

                {/* AI Suggestion Card */}
                <div className="bg-zinc-900/30 border border-zinc-800/60 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-5">
                    <Zap className="w-4 h-4 text-indigo-400" />
                    <span className="text-zinc-500 text-sm">
                      AI <span className="text-zinc-300">Recommendation</span>
                    </span>
                  </div>

                  {/* Suggestion Row */}
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-zinc-600 text-sm w-20">Action</span>
                    <div className="flex items-center gap-2">
                      <span
                        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm"
                        style={{ background: "#7170ff" }}
                      >
                        <TrendingUp className="w-3 h-3 text-white" />
                        <span className="text-white">Increase cap</span>
                      </span>
                    </div>
                  </div>

                  {/* Target Row */}
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-zinc-600 text-sm w-20">Buyer</span>
                    <span className="text-zinc-300 text-sm">Apex Insurance</span>
                  </div>

                  {/* Impact Row */}
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-zinc-600 text-sm w-20">Impact</span>
                    <span className="text-emerald-400 text-sm">+$2,400/day estimated</span>
                  </div>

                  {/* Expanded Suggestion Card */}
                  <div className="bg-zinc-800/40 rounded-lg p-4 ml-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Activity className="w-4 h-4 text-emerald-400" />
                      <span className="text-zinc-300 text-sm font-medium">Pattern detected</span>
                    </div>

                    <p className="text-zinc-500 text-xs mb-2">Why this was suggested</p>
                    <p className="text-zinc-500 text-sm mb-4">
                      Apex Insurance has maintained 98% acceptance rate over the past 48 hours with consistent conversion quality.
                    </p>

                    <button className="w-full flex items-center justify-center gap-2 bg-zinc-700/50 hover:bg-zinc-600/50 text-zinc-300 text-sm py-2.5 rounded-md transition-colors">
                      <Check className="w-4 h-4" />
                      Apply suggestion
                    </button>
                  </div>
                </div>
              </div>

              {/* Right column */}
              <div className="border-t border-b border-zinc-800/60 pt-12 pl-12 pb-16">
                <h3 className="text-zinc-200 font-medium text-xl mb-3">Avortyx SDK</h3>
                <p className="text-zinc-500 text-base mb-8">
                  Every Avortyx capability is reachable from a single typed SDK — and every event lands on your webhook within milliseconds.
                </p>

                {/* SDK Code Snippet */}
                <div className="bg-zinc-900/30 border border-zinc-800/60 rounded-xl p-5 font-mono text-sm">
                  <p className="text-zinc-700 mb-3">// @vortyx/sdk</p>
                  <div className="space-y-1 mb-6">
                    <p>
                      <span className="text-purple-400">import</span>
                      <span className="text-zinc-500"> {"{"} </span>
                      <span className="text-cyan-300">createClient</span>
                      <span className="text-zinc-500"> {"}"} </span>
                      <span className="text-purple-400">from</span>
                      <span className="text-green-400/70"> &apos;@vortyx/sdk&apos;</span>
                    </p>
                    <p className="mt-2">
                      <span className="text-purple-400">const</span>
                      <span className="text-zinc-300"> vortyx </span>
                      <span className="text-zinc-500">= </span>
                      <span className="text-cyan-300">createClient</span>
                      <span className="text-zinc-500">({"{"}</span>
                    </p>
                    <p className="pl-4">
                      <span className="text-orange-400/70">workspace</span>
                      <span className="text-zinc-500">: </span>
                      <span className="text-green-400/70">&apos;tier-one-health&apos;</span>
                      <span className="text-zinc-500">,</span>
                    </p>
                    <p className="pl-4">
                      <span className="text-orange-400/70">region</span>
                      <span className="text-zinc-500">: </span>
                      <span className="text-green-400/70">&apos;auto&apos;</span>
                    </p>
                    <p>
                      <span className="text-zinc-500">{"})"}</span>
                    </p>
                  </div>

                  {/* Route call example */}
                  <div className="bg-zinc-800/40 rounded-lg p-4">
                    <p className="text-zinc-600 text-xs mb-2">// Route incoming call</p>
                    <p>
                      <span className="text-purple-400">const</span>
                      <span className="text-zinc-300"> decision </span>
                      <span className="text-zinc-500">= </span>
                      <span className="text-purple-400">await</span>
                      <span className="text-zinc-300"> vortyx.</span>
                      <span className="text-cyan-300">route</span>
                      <span className="text-zinc-500">(call)</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
