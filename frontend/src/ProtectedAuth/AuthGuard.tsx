"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if token exists in localStorage
    const token = localStorage.getItem("token");
    
    if (!token && pathname !== "/login") {
      router.push("/login");
    } else {
      setIsAuthenticated(!!token);
    }
  }, [pathname, router]);

  // If we are on the login page, just render it
  if (pathname === "/login") {
    return <>{children}</>;
  }

  // If checking authentication, show nothing (or a loader)
  if (isAuthenticated === null || !isAuthenticated) {
    return null; // Optional: return a loading spinner here
  }

  // Authenticated
  return <>{children}</>;
}
