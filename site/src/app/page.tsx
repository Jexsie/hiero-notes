import { Edition } from "@/components/Edition";
import { Masthead } from "@/components/Masthead";
import { getEdition } from "@/lib/briefings";

export default function Home() {
  const edition = getEdition();
  if (!edition) {
    return (
      <div className="mx-auto max-w-[88rem] px-4 sm:px-8">
        <Masthead />
        <p className="py-24 text-center font-display text-3xl">
          No editions yet. Briefings in <code className="font-mono text-xl">briefings/</code> appear here.
        </p>
      </div>
    );
  }
  return <Edition {...edition} />;
}
