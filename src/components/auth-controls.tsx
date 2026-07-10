"use client";

import {
  SignInButton,
  UserButton,
  useUser,
} from "@clerk/nextjs";
import { Cloud, LockKeyhole } from "lucide-react";
import { useBackendStatus } from "./providers";

export function AuthControls() {
  const backend = useBackendStatus();

  if (!backend.isConfigured) {
    return (
      <span
        className="hidden items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-black/45 sm:flex"
        title="Add Clerk environment variables to enable cloud sync"
      >
        <Cloud className="h-3.5 w-3.5" />
        Local draft
      </span>
    );
  }

  return <ConfiguredAuthControls />;
}

function ConfiguredAuthControls() {
  const { isLoaded, isSignedIn } = useUser();

  if (!isLoaded) {
    return <span className="h-9 w-24 animate-pulse rounded-full bg-black/[0.06]" />;
  }

  return (
    isSignedIn ? (
      <div className="flex items-center gap-2 rounded-full border border-black/10 bg-white/70 p-1 pl-3">
        <span className="hidden text-[11px] font-bold text-black/50 sm:inline">
          Cloud sync
        </span>
        <UserButton />
      </div>
    ) : (
        <SignInButton mode="modal">
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-full bg-[#191816] px-4 text-xs font-bold text-white transition hover:bg-black/80"
          >
            <LockKeyhole className="h-3.5 w-3.5" />
            Sign in to save
          </button>
        </SignInButton>
    )
  );
}
