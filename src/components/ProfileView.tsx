import React, { useState } from "react";
import { User, Mail, Shield, Key, History, Save, HeartCrack } from "lucide-react";
import { UserProfile } from "../types";
import { localStore } from "../lib/firebase";

interface ProfileViewProps {
  user: UserProfile | null;
  onRefreshStates: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ user, onRefreshStates }) => {
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto p-12 text-center bg-white dark:bg-[#0f131a] rounded-2xl border border-gray-100 dark:border-[#1e2530]">
        <div className="text-gray-400 font-mono text-xs">NO_ACTIVE_PROFILE_NODE</div>
      </div>
    );
  }

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    setTimeout(() => {
      localStore.saveUserProfile({
        displayName,
        email,
      });
      onRefreshStates();
      setMessage("Profile parameters stabilized successfully.");
      setSaving(false);
    }, 400);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="bg-white dark:bg-[#0f131a] p-6 rounded-2xl border border-gray-100 dark:border-[#1e2530] shadow-sm space-y-4">
        <div>
          <h3 className="text-md font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <User className="w-5 h-5 text-indigo-500" /> Account Settings Profile
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">Manage details and active session states</p>
        </div>

        {message && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 text-xs rounded-xl border border-emerald-100 dark:border-emerald-950/20 font-semibold">
            {message}
          </div>
        )}

        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1.5 tracking-wider">Display Name</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                  <User className="w-4 h-4" />
                </span>
                <input
                  id="profile_name_input"
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full text-xs pl-9 pr-3.5 py-2 bg-gray-50 dark:bg-[#141b25] text-gray-900 dark:text-white border border-transparent rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold placeholder-gray-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1.5 tracking-wider">Email Address</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  id="profile_email_input"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-xs pl-9 pr-3.5 py-2 bg-gray-50 dark:bg-[#141b25] text-gray-900 dark:text-white border border-transparent rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold placeholder-gray-400"
                />
              </div>
            </div>
          </div>

          <button
            id="profile_submit_btn"
            type="submit"
            disabled={saving}
            className="w-full py-2.5 mt-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-98"
          >
            <Save className="w-4 h-4" /> {saving ? "Updating..." : "Commit Profile Changes"}
          </button>
        </form>
      </div>

      {/* Account diagnostic indices stats */}
      <div className="bg-white dark:bg-[#0f131a] p-6 rounded-2xl border border-gray-100 dark:border-[#1e2530] shadow-sm space-y-4">
        <div>
          <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block font-sans">Security Logs & Nodes Metadata</h4>
          <p className="text-xs text-gray-400">Identity and auth telemetry diagnostics</p>
        </div>

        <div className="space-y-2 pt-1 font-mono text-[10px] font-medium text-gray-500 dark:text-gray-400 select-text">
          <div className="flex justify-between py-1 border-b border-gray-50 dark:border-gray-900">
            <span>Identity Node ID:</span>
            <span className="font-semibold text-gray-800 dark:text-gray-200">{user?.userId ?? "N/A"}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-gray-50 dark:border-gray-900">
            <span>Authentication Sync Tier:</span>
            <span className="font-semibold text-gray-800 dark:text-gray-200 uppercase">LOCAL_FIRST / CACHED</span>
          </div>
          <div className="flex justify-between py-1 border-b border-gray-50 dark:border-gray-900">
            <span>Client Registration Timestamp:</span>
            <span className="font-semibold text-gray-800 dark:text-gray-200">
              {user?.createdAt ? new Date(user.createdAt).toLocaleString() : "Never"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
