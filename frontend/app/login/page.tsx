"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    // Update time every minute
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      }));
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      toast.error("We couldn't sign you in. Check your email and password.");
      return;
    }
    router.replace("/dashboard");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-700 via-violet-600 to-indigo-500 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        
        {/* Left Side - School Branding */}
        <div className="hidden lg:flex flex-col items-start text-white space-y-6">
          {/* School Crest */}
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 rounded-full bg-gold-400/30 backdrop-blur-sm border-2 border-gold-400/50 flex items-center justify-center text-3xl font-bold text-gold-300 shadow-xl">
              DE
            </div>
            <div>
              <div className="text-sm font-medium text-gold-300/80 uppercase tracking-wider">
                Established 2010
              </div>
              <div className="text-xs text-white/60">
                Excellence in Montessori Education
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="font-display text-4xl lg:text-5xl font-bold leading-tight">
              Dreston Elite
              <br />
              <span className="text-gold-300">Montessori School</span>
            </h1>
            <p className="text-lg text-white/80 max-w-md leading-relaxed">
              &ldquo;The fear of the Lord is the beginning of wisdom.&rdquo;
              <br />
              <span className="text-sm text-white/60">— Proverbs 9:10</span>
            </p>
          </div>

          <div className="flex flex-wrap gap-4 pt-4">
            <div className="flex items-center gap-2 text-sm text-white/70">
              <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse"></span>
              <span>School is open</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-white/70">
              <span className="text-gold-300">🕐</span>
              <span>{currentTime}</span>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4 w-full max-w-sm pt-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center border border-white/10">
              <div className="text-2xl font-bold text-gold-300">50+</div>
              <div className="text-xs text-white/60">Students</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center border border-white/10">
              <div className="text-2xl font-bold text-gold-300">12</div>
              <div className="text-xs text-white/60">Staff</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center border border-white/10">
              <div className="text-2xl font-bold text-gold-300">6</div>
              <div className="text-xs text-white/60">Classes</div>
            </div>
          </div>

          <div className="flex gap-4 text-sm text-white/50 pt-4">
            <a href="#" className="hover:text-white/80 transition">About</a>
            <a href="#" className="hover:text-white/80 transition">Contact</a>
            <a href="#" className="hover:text-white/80 transition">Calendar</a>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="w-full max-w-md mx-auto lg:mx-0 lg:ml-auto">
          {/* Mobile Header (shown only on small screens) */}
          <div className="lg:hidden text-center mb-6">
            <div className="h-16 w-16 mx-auto rounded-full bg-gold-400/30 backdrop-blur-sm border-2 border-gold-400/50 flex items-center justify-center text-2xl font-bold text-gold-300 shadow-xl">
              DE
            </div>
            <h1 className="font-display text-2xl font-bold text-white mt-3">
              Dreston Elite Montessori
            </h1>
          </div>

          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-8">
            <div className="text-center mb-6">
              <h2 className="font-display text-2xl font-semibold text-plum-800">
                Welcome Back
              </h2>
              <p className="text-sm text-plum-800/60 mt-1">
                Sign in to access the school management dashboard
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email Field */}
              <div>
                <label className="block text-sm font-medium text-plum-700 mb-1.5" htmlFor="email">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-plum-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                    </svg>
                  </div>
                  <input
                    id="email"
                    type="email"
                    required
                    className="w-full pl-10 pr-4 py-3 bg-plum-50/80 border border-plum-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition text-plum-800 placeholder-plum-400"
                    placeholder="you@drestonelite.edu.gh"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-plum-700" htmlFor="password">
                    Password
                  </label>
                  <a href="#" className="text-xs text-violet-600 hover:text-violet-700 font-medium transition">
                    Forgot password?
                  </a>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-plum-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    className="w-full pl-10 pr-12 py-3 bg-plum-50/80 border border-plum-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition text-plum-800 placeholder-plum-400"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-plum-400 hover:text-plum-600 transition"
                  >
                    {showPassword ? (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Remember me checkbox */}
              <div className="flex items-center">
                <input
                  id="remember"
                  type="checkbox"
                  className="h-4 w-4 text-violet-600 rounded border-plum-300 focus:ring-violet-500"
                />
                <label htmlFor="remember" className="ml-2 text-sm text-plum-600">
                  Keep me signed in
                </label>
              </div>

              {/* Submit Button */}
              <button 
                type="submit" 
                disabled={loading} 
                className="w-full py-3 px-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-medium rounded-xl shadow-lg shadow-violet-600/25 hover:shadow-xl hover:shadow-violet-600/30 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  "Sign In"
                )}
              </button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-plum-200"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-white text-plum-400">Secure login</span>
                </div>
              </div>

              {/* Staff Info */}
              <p className="text-xs text-center text-plum-500/70">
                Don&apos;t have an account? Ask your school admin to add you.
              </p>
            </form>
          </div>

          {/* Footer */}
          <div className="text-center mt-6 text-sm text-white/50">
            © {new Date().getFullYear()} Dreston Elite Montessori School
          </div>
        </div>
      </div>
    </div>
  );
}