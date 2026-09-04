"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Zap, ArrowRight, Check, Star, Play, Shield, Clock,
  Bot, Workflow, Database, Globe, ChevronDown, Menu, X,
  BarChart3, Users, Cpu, Lock,
} from "lucide-react";

const features = [
  {
    icon: Bot,
    title: "AI-Powered Intelligence",
    description: "Leverage GPT-4 and custom ML models to automate complex decision-making within your workflows.",
  },
  {
    icon: Workflow,
    title: "Visual Workflow Builder",
    description: "Drag-and-drop interface to create sophisticated multi-step workflows without writing code.",
  },
  {
    icon: Globe,
    title: "500+ Integrations",
    description: "Connect with every tool your team uses — Slack, GitHub, Jira, Salesforce, and more.",
  },
  {
    icon: Database,
    title: "Data Transformation",
    description: "Built-in data mapping, filtering, and transformation pipeline with real-time preview.",
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    description: "SOC2 compliant, end-to-end encryption, SSO, and granular role-based access control.",
  },
  {
    icon: BarChart3,
    title: "Advanced Analytics",
    description: "Real-time monitoring, custom dashboards, and AI-driven optimization suggestions.",
  },
];

const pricingPlans = [
  {
    name: "Starter",
    price: "$29",
    period: "/month",
    description: "For small teams getting started",
    features: ["5 active workflows", "1,000 executions/mo", "10 integrations", "Email support", "Basic analytics"],
    cta: "Start Free Trial",
    popular: false,
  },
  {
    name: "Professional",
    price: "$99",
    period: "/month",
    description: "For growing businesses",
    features: ["Unlimited workflows", "50,000 executions/mo", "100+ integrations", "AI workspace access", "Priority support", "Advanced analytics", "Custom webhooks"],
    cta: "Start Free Trial",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For large organizations",
    features: ["Everything in Pro", "Unlimited executions", "SSO & SAML", "Dedicated support", "Custom AI models", "On-premise option", "SLA guarantee", "Audit logs"],
    cta: "Contact Sales",
    popular: false,
  },
];

const stats = [
  { value: "10M+", label: "Workflows Executed" },
  { value: "500+", label: "Integrations" },
  { value: "99.9%", label: "Uptime SLA" },
  { value: "10K+", label: "Active Teams" },
];

const testimonials = [
  { name: "Sarah Chen", role: "VP Engineering, TechCorp", quote: "AutoFlow cut our deployment pipeline time by 70%. The AI suggestions are genuinely useful.", avatar: "SC" },
  { name: "Marcus Rodriguez", role: "CTO, DataFlow Inc", quote: "We replaced 5 different tools with AutoFlow. The ROI was visible within the first month.", avatar: "MR" },
  { name: "Emily Watson", role: "Ops Director, ScaleUp", quote: "The visual builder makes it easy for non-technical team members to create workflows.", avatar: "EW" },
];

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  return (
    <div className={darkMode ? "dark" : ""}>
      <div className="min-h-screen bg-background">
        {/* Navigation */}
        <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              <div className="flex items-center gap-8">
                <Link href="/" className="flex items-center gap-2" aria-label="AutoFlow Home">
                  <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                    <Zap className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <span className="text-xl font-bold">AutoFlow</span>
                </Link>
                <div className="hidden md:flex items-center gap-6">
                  <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a>
                  <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
                  <a href="#testimonials" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Testimonials</a>
                  <a href="#docs" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Docs</a>
                </div>
              </div>
              <div className="hidden md:flex items-center gap-4">
                <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Sign in</Link>
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Get Started Free
                </Link>
              </div>
              <button
                className="md:hidden p-2"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
          {mobileMenuOpen && (
            <div className="md:hidden border-t bg-background px-4 pb-4">
              <div className="flex flex-col gap-3 pt-4">
                <a href="#features" className="text-sm font-medium">Features</a>
                <a href="#pricing" className="text-sm font-medium">Pricing</a>
                <a href="#testimonials" className="text-sm font-medium">Testimonials</a>
                <hr />
                <Link href="/login" className="text-sm font-medium">Sign in</Link>
                <Link href="/register" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
                  Get Started Free
                </Link>
              </div>
            </div>
          )}
        </nav>

        {/* Hero Section */}
        <section className="relative overflow-hidden">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24 md:py-32">
            <div className="text-center max-w-4xl mx-auto">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-8">
                <Star className="h-4 w-4" />
                <span>Now with GPT-4o integration</span>
              </div>
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
                Automate Anything
                <span className="text-primary block mt-2">with AI Intelligence</span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
                Build intelligent workflows that adapt, learn, and optimize. Connect your tools,
                automate repetitive tasks, and let AI handle the complexity.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-base font-medium text-primary-foreground hover:bg-primary/90 transition-colors gap-2"
                >
                  Start Building Free
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="#demo"
                  className="inline-flex items-center justify-center rounded-lg border border-input bg-background px-6 py-3 text-base font-medium hover:bg-accent transition-colors gap-2"
                >
                  <Play className="h-4 w-4" />
                  Watch Demo
                </Link>
              </div>
            </div>
          </div>
          {/* Background decoration */}
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute -top-40 right-0 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
            <div className="absolute -bottom-40 left-0 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
          </div>
        </section>

        {/* Stats */}
        <section className="border-y bg-muted/30">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-3xl md:text-4xl font-bold">{stat.value}</div>
                  <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything you need to automate</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                From simple task automation to complex AI-driven pipelines, AutoFlow provides all the tools your team needs.
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.map((feature) => (
                <div key={feature.title} className="group rounded-xl border bg-card p-6 hover:shadow-lg transition-all duration-300">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section id="testimonials" className="py-24 bg-muted/30">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Trusted by industry leaders</h2>
              <p className="text-lg text-muted-foreground">See what our customers have to say</p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {testimonials.map((t) => (
                <div key={t.name} className="rounded-xl border bg-card p-6">
                  <div className="flex mb-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground mb-6 leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">{t.avatar}</div>
                    <div>
                      <div className="text-sm font-medium">{t.name}</div>
                      <div className="text-xs text-muted-foreground">{t.role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Simple, transparent pricing</h2>
              <p className="text-lg text-muted-foreground">Start free, scale as you grow</p>
            </div>
            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {pricingPlans.map((plan) => (
                <div
                  key={plan.name}
                  className={`rounded-xl border p-8 relative ${plan.popular ? "border-primary shadow-lg scale-105" : ""}`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                      Most Popular
                    </div>
                  )}
                  <h3 className="text-xl font-bold">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                  <div className="mt-6 mb-8">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={plan.name === "Enterprise" ? "/contact" : "/register"}
                    className={`block w-full text-center rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                      plan.popular
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "border border-input hover:bg-accent"
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-24 bg-primary text-primary-foreground">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to automate your workflows?</h2>
            <p className="text-lg opacity-90 mb-8 max-w-2xl mx-auto">
              Join 10,000+ teams already using AutoFlow to save thousands of hours every month.
              Start your free trial today — no credit card required.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-lg bg-white text-primary px-6 py-3 text-base font-medium hover:bg-white/90 transition-colors gap-2"
              >
                Start Free Trial
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="#demo"
                className="inline-flex items-center justify-center rounded-lg border border-white/30 px-6 py-3 text-base font-medium hover:bg-white/10 transition-colors"
              >
                Schedule Demo
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                    <Zap className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <span className="font-bold">AutoFlow</span>
                </div>
                <p className="text-sm text-muted-foreground">AI-powered workflow automation for modern teams.</p>
              </div>
              <div>
                <h4 className="font-semibold mb-3 text-sm">Product</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><a href="#features" className="hover:text-foreground transition-colors">Features</a></li>
                  <li><a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a></li>
                  <li><a href="#" className="hover:text-foreground transition-colors">Changelog</a></li>
                  <li><a href="#" className="hover:text-foreground transition-colors">Roadmap</a></li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-3 text-sm">Resources</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><a href="#" className="hover:text-foreground transition-colors">Documentation</a></li>
                  <li><a href="#" className="hover:text-foreground transition-colors">API Reference</a></li>
                  <li><a href="#" className="hover:text-foreground transition-colors">Blog</a></li>
                  <li><a href="#" className="hover:text-foreground transition-colors">Community</a></li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-3 text-sm">Company</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><a href="#" className="hover:text-foreground transition-colors">About</a></li>
                  <li><a href="#" className="hover:text-foreground transition-colors">Careers</a></li>
                  <li><a href="#" className="hover:text-foreground transition-colors">Privacy</a></li>
                  <li><a href="#" className="hover:text-foreground transition-colors">Terms</a></li>
                </ul>
              </div>
            </div>
            <div className="border-t pt-8 text-center text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} AutoFlow. All rights reserved.
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
