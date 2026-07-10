"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import {
  createContext,
  type ReactNode,
  useContext,
} from "react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const convexClient = convexUrl ? new ConvexReactClient(convexUrl) : null;

type BackendStatus =
  | { isConfigured: true; mode: "authenticated" }
  | { isConfigured: false; mode: "demo" };

const configuredStatus = {
  isConfigured: true,
  mode: "authenticated",
} as const satisfies BackendStatus;
const demoStatus = {
  isConfigured: false,
  mode: "demo",
} as const satisfies BackendStatus;

const BackendStatusContext = createContext<BackendStatus>(demoStatus);

export function useBackendStatus() {
  return useContext(BackendStatusContext);
}

export function Providers({ children }: { children: ReactNode }) {
  if (!convexClient || !clerkPublishableKey) {
    return (
      <BackendStatusContext.Provider value={demoStatus}>
        {children}
      </BackendStatusContext.Provider>
    );
  }

  return (
    <BackendStatusContext.Provider value={configuredStatus}>
      <ClerkProvider publishableKey={clerkPublishableKey}>
        <ConvexProviderWithClerk client={convexClient} useAuth={useAuth}>
          {children}
        </ConvexProviderWithClerk>
      </ClerkProvider>
    </BackendStatusContext.Provider>
  );
}

export default Providers;
