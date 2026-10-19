// Placeholder landing page. Replaced by the `customer-web` agent in Phase 2
// with the real "No Pets Allowed" landing (hero, upcoming shows, how-to-buy, FAQ).
export default function HomePage() {
  return (
    <main className="container flex min-h-screen flex-col items-center justify-center gap-4 py-16">
      <h1 className="text-5xl font-extrabold tracking-tight sm:text-[5rem]">
        No Pets <span className="text-primary">Allowed</span>
      </h1>
      <p className="text-muted-foreground">Ticketing — coming soon.</p>
    </main>
  );
}
