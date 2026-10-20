import type { ReactElement } from "react";
import { render } from "@react-email/components";
import { Resend } from "resend";

/**
 * Resend send helper. The `RESEND_API_KEY` in dev is a placeholder, so this
 * MUST no-op gracefully (log, never throw) when the key is missing or looks
 * like a dev placeholder. A failed email must NEVER roll back a committed
 * mutation — callers should also wrap `sendEmail` in try/catch to be safe.
 */
function isUsableKey(key: string | undefined): key is string {
  return !!key && !key.startsWith("dev") && key.length > 8;
}

const FROM =
  process.env.RESEND_FROM_EMAIL ?? "No Pets Allowed <no-reply@nopets.test>";

export interface SendEmailArgs {
  to: string;
  subject: string;
  react: ReactElement;
}

export async function sendEmail({
  to,
  subject,
  react,
}: SendEmailArgs): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!isUsableKey(key)) {
    const html = await render(react);
    console.log(
      `[email:noop] would send "${subject}" to ${to} (RESEND_API_KEY not configured)`,
      html.slice(0, 120),
    );
    return;
  }

  try {
    const resend = new Resend(key);
    await resend.emails.send({ from: FROM, to, subject, react });
  } catch (err) {
    // Never let a notification failure propagate into business logic.
    console.error(`[email:error] failed to send "${subject}" to ${to}`, err);
  }
}
