import { SiteFooter } from "./_components/site-footer";
import { SiteNav } from "./_components/site-nav";

/**
 * Public, unauthenticated surfaces: landing, events list/detail. Dark concert
 * ground with the shared nav + footer.
 */
export default function PublicLayout(props: { children: React.ReactNode }) {
  return (
    <div className="dark flex min-h-screen flex-col bg-[oklch(0.16_0.012_312)] text-[oklch(0.97_0.006_308)]">
      <SiteNav />
      <main className="flex-1">{props.children}</main>
      <SiteFooter />
    </div>
  );
}
