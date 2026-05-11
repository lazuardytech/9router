import ConsoleLogClient from "./ConsoleLogClient";

// Force dynamic so Next.js standalone build includes the server-side JS file
export const dynamic = "force-dynamic";

export const metadata = { title: "Console Log" };

export default function ConsoleLogPage() {
  return <ConsoleLogClient />;
}
