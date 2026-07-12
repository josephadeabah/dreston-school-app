"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { StaffProfile } from "@/lib/useAuth";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "◆" },
  { href: "/students", label: "Students", icon: "🎓" },
  { href: "/guardians", label: "Guardians", icon: "👪" },
  { href: "/attendance", label: "Attendance", icon: "✓" },
  { href: "/feeding", label: "Feeding Money", icon: "🍽" },
  { href: "/fees", label: "School Fees", icon: "💳" },
  { href: "/messaging", label: "Messages", icon: "✉" },
];

const ADMIN_NAV_ITEMS = [{ href: "/staff", label: "Staff", icon: "🛡" }];

export default function Sidebar({
  profile,
  onSignOut,
}: {
  profile: StaffProfile | null;
  onSignOut: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 min-h-screen bg-violet-600 text-white flex flex-col">
      <div className="px-6 pt-8 pb-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold-400 text-plum-900 font-display font-bold text-sm">
            DE
          </div>
          <div>
            <p className="font-display font-semibold leading-tight text-sm">
              Dreston Elite
            </p>
            <p className="text-[11px] text-blush-100/80 leading-tight">Montessori School</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-6 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-white text-violet-600 shadow-soft"
                  : "text-blush-100 hover:bg-white/10"
              }`}
            >
              <span aria-hidden>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}

        {profile?.role === "admin" && (
          <>
            <p className="px-4 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wide text-blush-100/50">
              Admin
            </p>
            {ADMIN_NAV_ITEMS.map((item) => {
              const active = pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                    active
                      ? "bg-white text-violet-600 shadow-soft"
                      : "text-blush-100 hover:bg-white/10"
                  }`}
                >
                  <span aria-hidden>{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      <div className="px-6 py-5 border-t border-white/10">
        <p className="text-xs text-blush-100/70 mb-2">
          Signed in as
          <br />
          <span className="font-semibold text-white">{profile?.full_name ?? "…"}</span>
          {profile?.role && (
            <span className="pill bg-white/15 text-white ml-2 capitalize">
              {profile.role.replace("_", " ")}
            </span>
          )}
        </p>
        <button
          onClick={onSignOut}
          className="text-xs font-semibold text-blush-100 hover:text-white transition"
        >
          Sign out →
        </button>
      </div>
    </aside>
  );
}
