import React, { useState } from "react";
import { Shield, Mail, Lock, User, Sparkles } from "lucide-react";
import { UserProfile } from "../types";
import { localStore, isFirebaseConfigured, auth } from "../lib/firebase";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider,
  updateProfile 
} from "firebase/auth";

interface AuthViewProps {
  onAuthComplete: (user: UserProfile) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onAuthComplete }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (!email.includes("@")) {
        setError("Please input a valid email address format.");
        setLoading(false);
        return;
      }

      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        setLoading(false);
        return;
      }

      if (isRegister && !displayName.trim()) {
        setError("Please enter your name.");
        setLoading(false);
        return;
      }

      if (isFirebaseConfigured && auth) {
        if (isRegister) {
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          if (userCredential.user) {
            await updateProfile(userCredential.user, { displayName });
            const userProfile: UserProfile = {
              userId: userCredential.user.uid,
              email: userCredential.user.email || email,
              displayName: displayName || "New User",
              theme: "dark",
              ttsVoice: "Zephyr",
              createdAt: new Date().toISOString(),
            };
            localStore.saveUserProfile(userProfile);
            onAuthComplete(userProfile);
          }
        } else {
          const userCredential = await signInWithEmailAndPassword(auth, email, password);
          if (userCredential.user) {
            const userProfile: UserProfile = {
              userId: userCredential.user.uid,
              email: userCredential.user.email || email,
              displayName: userCredential.user.displayName || displayName || "User",
              theme: "dark",
              ttsVoice: "Zephyr",
              createdAt: new Date().toISOString(),
            };
            localStore.saveUserProfile(userProfile);
            onAuthComplete(userProfile);
          }
        }
      } else {
        // Fallback for offline/unconfigured environment
        const fallbackId = "local-user-id";
        const userProfile: UserProfile = {
          userId: fallbackId,
          email: email,
          displayName: displayName || "Rahul Chinni",
          theme: "dark",
          ttsVoice: "Zephyr",
          createdAt: new Date().toISOString(),
        };
        localStore.saveUserProfile(userProfile);
        onAuthComplete(userProfile);
      }
    } catch (err: any) {
      console.error("Authentication action failed:", err);
      let errMsg = err?.message || "Authentication error.";
      if (err?.code === "auth/invalid-credential" || err?.code === "auth/wrong-password" || err?.code === "auth/user-not-found") {
        errMsg = "Invalid email or password credential.";
      } else if (err?.code === "auth/email-already-in-use") {
        errMsg = "This email address is already registered.";
      } else if (err?.code === "auth/weak-password") {
        errMsg = "Weak password. Please use at least 6 characters.";
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError("");
    try {
      if (isFirebaseConfigured && auth) {
        const provider = new GoogleAuthProvider();
        const userCredential = await signInWithPopup(auth, provider);
        if (userCredential.user) {
          const userProfile: UserProfile = {
            userId: userCredential.user.uid,
            email: userCredential.user.email || "user@example.com",
            displayName: userCredential.user.displayName || "Google User",
            theme: "dark",
            ttsVoice: "Zephyr",
            createdAt: new Date().toISOString(),
          };
          localStore.saveUserProfile(userProfile);
          onAuthComplete(userProfile);
        }
      } else {
        // Fallback
        const userProfile: UserProfile = {
          userId: "local-user-id",
          email: "google-user@example.com",
          displayName: "Google User Blocked",
          theme: "dark",
          ttsVoice: "Zephyr",
          createdAt: new Date().toISOString(),
        };
        localStore.saveUserProfile(userProfile);
        onAuthComplete(userProfile);
      }
    } catch (err: any) {
      console.error("Google authentication failed:", err);
      let errMsg = err?.message || "Google registration canceled or failed.";
      if (err?.code === "auth/popup-blocked") {
        errMsg = "Google login popup was blocked by your browser. Please allow popups or open the app in a new tab to sign in!";
      } else if (err?.code === "auth/popup-closed-by-user") {
        errMsg = "Google login popup was closed before completion.";
      } else if (err?.message?.includes("sandbox") || err?.message?.includes("iframe")) {
        errMsg = "Google Sign-in is restricted in iframe mode. Please open the application in a new tab to sign in with Google!";
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="auth_container" className="min-h-screen w-full flex items-center justify-center bg-gray-50 dark:bg-[#07090e] px-4 py-12 transition-colors duration-200">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.08),transparent_40%)] dark:bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.15),transparent_40%)]" />

      <div id="auth_card" className="w-full max-w-md bg-white dark:bg-[#0f131a] rounded-2xl border border-gray-100 dark:border-[#1e2530] shadow-xl overflow-hidden relative z-10 transition-colors duration-200">
        <div className="px-8 pt-8 pb-6 text-center border-b border-gray-100 dark:border-[#1e2530]">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 mb-4">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
            OmniMind AI
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {isRegister ? "Join the high-fidelity offline AI workspace" : "Sign in to access your secure AI ecosystem"}
          </p>
        </div>

        <div className="p-8">
          {error && (
            <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-xs rounded-lg border border-rose-100 dark:border-rose-950/50">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    id="auth_name_input"
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 text-sm bg-gray-50 dark:bg-[#151a24] text-gray-900 dark:text-white border border-gray-200 dark:border-[#222b3b] rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    placeholder="Enter displayName"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Email Address
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  id="auth_email_input"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm bg-gray-50 dark:bg-[#151a24] text-gray-900 dark:text-white border border-gray-200 dark:border-[#222b3b] rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  placeholder="Enter email address"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  id="auth_password_input"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm bg-gray-50 dark:bg-[#151a24] text-gray-900 dark:text-white border border-gray-200 dark:border-[#222b3b] rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              id="auth_submit_btn"
              type="submit"
              disabled={loading}
              className="w-full py-2.5 mt-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-600 text-white font-medium text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-md transform active:scale-98 transition-all disabled:opacity-50"
            >
              {loading ? "Authenticating..." : isRegister ? "Create Free Account" : "Access Platform"}
            </button>
          </form>

          <div className="relative my-6">
            <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-gray-100 dark:border-[#1e2530]" />
            <span className="relative bg-white dark:bg-[#0f131a] px-3 text-xs text-gray-400 block mx-auto w-max tracking-wide">
              OR
            </span>
          </div>

          <button
            id="auth_google_btn"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-2.5 bg-gray-50 dark:bg-[#151a24] hover:bg-gray-100 dark:hover:bg-[#1d2432] text-gray-700 dark:text-gray-200 text-sm font-medium border border-gray-100 dark:border-[#1e2530] rounded-xl transition-all"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.578-7.859-8s3.53-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l3.245-3.125C18.29 1.155 15.5 0 12.24 0 5.58 0 0 5.37 0 12s5.58 12 12.24 12c6.96 0 11.57-4.815 11.57-11.79 0-.795-.085-1.4-.19-1.925H12.24z"
              />
            </svg>
            Continue with Google
          </button>

          <div className="mt-6 text-center">
            <button
              id="auth_toggle_mode"
              onClick={() => setIsRegister(!isRegister)}
              className="text-xs text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 font-semibold"
            >
              {isRegister ? "Already have an account? Sign In" : "New to OmniMind? Create an Account"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
