import { Archivo, Martian_Mono } from "next/font/google";
import "./signal.css";

const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], axes: ["wdth"] });
const martian = Martian_Mono({ variable: "--font-martian", subsets: ["latin"], axes: ["wdth"] });

export default function SignalLayout({ children }: LayoutProps<"/v2">) {
  return <div className={`${archivo.variable} ${martian.variable}`}>{children}</div>;
}
