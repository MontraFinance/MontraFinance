import { useState, useEffect } from "react";
import { Zap } from "lucide-react";

// Staggered launch times — 2/25 3pm CST, then every hour after
// CST = UTC-6, so 3pm CST = 21:00 UTC
const LAUNCH_TIMES: Record<string, Date> = {
  "Agent Fleet":   new Date("2026-02-25T21:00:00Z"), // 3pm CST
  "Portfolio":     new Date("2026-02-25T22:00:00Z"), // 4pm CST
  "Transactions":  new Date("2026-02-25T23:00:00Z"), // 5pm CST
  "Analytics":     new Date("2026-02-26T00:00:00Z"), // 6pm CST
  "Messages":      new Date("2026-02-26T01:00:00Z"), // 7pm CST
  "Agent Orders":  new Date("2026-02-26T02:00:00Z"), // 8pm CST
};

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function getTimeLeft(target: Date): TimeLeft {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

export default function LaunchCountdown({ title }: { title: string }) {
  const target = LAUNCH_TIMES[title] || new Date("2026-02-25T21:00:00Z");
  const [time, setTime] = useState(() => getTimeLeft(target));
  const [launched, setLaunched] = useState(() => target.getTime() <= Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      const t = getTimeLeft(target);
      setTime(t);
      if (t.days === 0 && t.hours === 0 && t.minutes === 0 && t.seconds === 0) {
        setLaunched(true);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [target]);

  // Don't show overlay if launched
  if (launched) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Glass overlay */}
      <div className="absolute inset-0 bg-white/30 backdrop-blur-sm" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center px-8 py-10 rounded-3xl bg-white/60 backdrop-blur-md shadow-lg border border-white/40">
        {/* Icon */}
        <div className="w-20 h-20 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-8" style={{ boxShadow: "0 0 40px rgba(37,99,235,0.15)" }}>
          <Zap size={36} className="text-primary" />
        </div>

        {/* Title */}
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-primary mb-2 font-mono">
          {title}
        </h1>
        <p className="text-sm font-mono text-primary/50 uppercase tracking-[0.3em] mb-12">
          Coming Soon
        </p>

        {/* Countdown blocks */}
        <div className="flex items-center gap-3 md:gap-5">
          {[
            { label: "DAYS", value: time.days },
            { label: "HRS", value: time.hours },
            { label: "MIN", value: time.minutes },
            { label: "SEC", value: time.seconds },
          ].map(({ label, value }, i) => (
            <div key={label} className="flex items-center gap-3 md:gap-5">
              <div className="flex flex-col items-center">
                <div
                  className="w-[72px] h-[88px] md:w-[96px] md:h-[112px] rounded-2xl bg-white border border-primary/15 flex items-center justify-center"
                  style={{ boxShadow: "0 4px 24px rgba(37,99,235,0.08), 0 0 0 1px rgba(37,99,235,0.05)" }}
                >
                  <span className="text-3xl md:text-5xl font-mono font-bold text-primary tabular-nums">
                    {pad(value)}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-primary/40 mt-2 tracking-[0.2em]">
                  {label}
                </span>
              </div>
              {i < 3 && (
                <span className="text-2xl md:text-4xl font-mono text-primary/20 -mt-6">:</span>
              )}
            </div>
          ))}
        </div>

        {/* Subtitle */}
        <p className="text-sm font-mono text-primary/40 mt-12 max-w-md leading-relaxed">
          We're building something powerful. This module will be live at launch.
        </p>

        {/* Montra branding */}
        <div className="flex items-center gap-2 mt-8">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-[10px] font-mono text-primary/30 uppercase tracking-[0.3em]">
            Montra Finance
          </span>
        </div>
      </div>
    </div>
  );
}
