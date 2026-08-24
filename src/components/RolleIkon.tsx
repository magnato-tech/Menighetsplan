import React from "react";
import {
  Banknote,
  BookOpen,
  CakeSlice,
  Camera,
  Coffee,
  Flower2,
  Handshake,
  Heart,
  Lightbulb,
  Mic,
  Music2,
  Smile,
  Sparkles,
  UserRound,
  Users,
  Volume2,
  Wrench,
  type LucideIcon,
} from "lucide-react";

type RolleUtseende = {
  Icon: LucideIcon;
  wrap: string;
  icon: string;
};

const FALLBACK: RolleUtseende[] = [
  { Icon: Sparkles, wrap: "bg-sky-100", icon: "text-sky-500" },
  { Icon: Sparkles, wrap: "bg-violet-100", icon: "text-violet-500" },
  { Icon: Sparkles, wrap: "bg-rose-100", icon: "text-rose-500" },
  { Icon: Sparkles, wrap: "bg-amber-100", icon: "text-amber-500" },
  { Icon: Sparkles, wrap: "bg-emerald-100", icon: "text-emerald-500" },
  { Icon: Sparkles, wrap: "bg-cyan-100", icon: "text-cyan-500" },
];

const KJENTE: { treff: string[]; utseende: RolleUtseende }[] = [
  { treff: ["husgruppe"], utseende: { Icon: Heart, wrap: "bg-rose-100", icon: "text-rose-500" } },
  { treff: ["lederskap", "ledergruppe"], utseende: { Icon: UserRound, wrap: "bg-violet-100", icon: "text-violet-500" } },
  { treff: ["gruppelederteam", "gruppeledergruppe"], utseende: { Icon: Users, wrap: "bg-amber-100", icon: "text-amber-600" } },
  { treff: ["gudstjenesteleder", "møteleder"], utseende: { Icon: UserRound, wrap: "bg-sky-100", icon: "text-sky-500" } },
  { treff: ["taler", "preken"], utseende: { Icon: Mic, wrap: "bg-violet-100", icon: "text-violet-500" } },
  { treff: ["forbønn", "bønn"], utseende: { Icon: Heart, wrap: "bg-rose-100", icon: "text-rose-500" } },
  { treff: ["barnekirke", "søndagsskole"], utseende: { Icon: Smile, wrap: "bg-amber-100", icon: "text-amber-500" } },
  { treff: ["lovsang", "musikk"], utseende: { Icon: Music2, wrap: "bg-teal-100", icon: "text-teal-500" } },
  { treff: ["teknikk", "lyd"], utseende: { Icon: Volume2, wrap: "bg-indigo-100", icon: "text-indigo-500" } },
  { treff: ["bilde", "video"], utseende: { Icon: Camera, wrap: "bg-cyan-100", icon: "text-cyan-500" } },
  { treff: ["lys"], utseende: { Icon: Lightbulb, wrap: "bg-yellow-100", icon: "text-yellow-500" } },
  { treff: ["møtevert"], utseende: { Icon: Handshake, wrap: "bg-lime-100", icon: "text-lime-600" } },
  { treff: ["rigg"], utseende: { Icon: Wrench, wrap: "bg-orange-100", icon: "text-orange-500" } },
  { treff: ["kjøkken"], utseende: { Icon: Coffee, wrap: "bg-orange-100", icon: "text-orange-500" } },
  { treff: ["bak"], utseende: { Icon: CakeSlice, wrap: "bg-pink-100", icon: "text-pink-500" } },
  { treff: ["kollekt"], utseende: { Icon: Banknote, wrap: "bg-emerald-100", icon: "text-emerald-500" } },
  { treff: ["pynt"], utseende: { Icon: Flower2, wrap: "bg-fuchsia-100", icon: "text-fuchsia-500" } },
  { treff: ["bibel", "tekst"], utseende: { Icon: BookOpen, wrap: "bg-blue-100", icon: "text-blue-500" } },
];

function velgUtseende(rollenavn: string): RolleUtseende {
  const nøkkel = rollenavn.trim().toLowerCase();
  const treff = KJENTE.find((k) => k.treff.some((t) => nøkkel.includes(t)));
  if (treff) return treff.utseende;
  const hash = [...nøkkel].reduce((sum, tegn) => sum + tegn.charCodeAt(0), 0);
  return FALLBACK[hash % FALLBACK.length];
}

export const RolleIkon: React.FC<{ rollenavn: string; className?: string }> = ({
  rollenavn,
  className = "w-7 h-7",
}) => {
  const { Icon, wrap, icon } = velgUtseende(rollenavn);
  const stor = className.includes("w-10") || className.includes("w-11");
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full shrink-0 ${wrap} ${className}`}
      aria-hidden
    >
      <Icon className={`${stor ? "w-5 h-5" : "w-4 h-4"} ${icon}`} strokeWidth={2.25} />
    </span>
  );
};
