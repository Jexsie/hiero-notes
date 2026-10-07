import type { Metadata } from "next";
import { Board } from "@/components/v2/Board";
import { TopBar } from "@/components/v2/TopBar";
import { getEdition } from "@/lib/briefings";

export const metadata: Metadata = { title: "Signal" };

export default function SignalHome() {
  const edition = getEdition();
  if (!edition) {
    return (
      <div className="sig">
        <TopBar />
        <p className="mono p-10 text-center text-[var(--dim)]">&gt; no editions in briefings/ yet_</p>
      </div>
    );
  }
  return <Board {...edition} />;
}
