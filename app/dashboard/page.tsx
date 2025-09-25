import { redirect } from "next/navigation"

export default function DashboardPage() {
  // Redirect to availability page as the default
  redirect("/dashboard/availability")
}
