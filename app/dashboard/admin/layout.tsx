import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth/server"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()

  // Redirect non-admin users
  if (!user || user.role !== "ADMIN") {
    redirect("/dashboard/availability")
  }

  return <>{children}</>
}