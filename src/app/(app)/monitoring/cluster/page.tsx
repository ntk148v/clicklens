import { redirect } from "next/navigation";

// Redirect the old cluster route to the new overview page
export default function ClusterMonitoringPage() {
  redirect("/monitoring/overview");
}
