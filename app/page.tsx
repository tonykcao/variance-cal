import { redirect } from 'next/navigation'

export default function Home() {
  // Redirect to the availability dashboard - this is the main entry point
  // Similar to how Airbnb lands you directly on the search/availability page
  redirect('/dashboard/availability')
}
