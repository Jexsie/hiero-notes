import type { Metadata } from "next";
import { PulseApp } from "@/components/pulse/PulseApp";
import "./pulse.css";

export const metadata: Metadata = {
  title: "Pulse",
  description: "Interactive activity dashboard for the hiero-ledger and LFDT-CLPR GitHub orgs.",
};

export default function PulsePage() {
  return <PulseApp />;
}
