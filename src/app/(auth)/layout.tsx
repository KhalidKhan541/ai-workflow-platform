import Link from "next/link";
import { Zap } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary relative overflow-hidden flex-col justify-between p-12">
        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-2 text-primary-foreground" aria-label="AutoFlow Home">
            <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Zap className="h-6 w-6" />
            </div>
            <span className="text-2xl font-bold">AutoFlow</span>
          </Link>
        </div>
        <div className="relative z-10">
          <h1 className="text-4xl font-bold text-primary-foreground mb-4">
            Automate Anything with AI Intelligence
          </h1>
          <p className="text-lg text-primary-foreground/80 max-w-md">
            Build intelligent workflows that adapt, learn, and optimize.
            Join 10,000+ teams already transforming their operations.
          </p>
        </div>
        <div className="relative z-10">
          <div className="grid grid-cols-2 gap-6 text-primary-foreground/80 text-sm">
            <div>
              <p className="font-semibold text-primary-foreground text-lg">10M+</p>
              <p>Workflows Executed</p>
            </div>
            <div>
              <p className="font-semibold text-primary-foreground text-lg">500+</p>
              <p>Integrations</p>
            </div>
            <div>
              <p className="font-semibold text-primary-foreground text-lg">99.9%</p>
              <p>Uptime SLA</p>
            </div>
            <div>
              <p className="font-semibold text-primary-foreground text-lg">10K+</p>
              <p>Active Teams</p>
            </div>
          </div>
        </div>
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-primary/80" />
        <div className="absolute top-20 right-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-20 left-20 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">AutoFlow</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
