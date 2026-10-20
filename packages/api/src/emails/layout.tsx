import type { ReactNode } from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

/** Format integer centavos as `₱1,234.00` for email bodies. */
export function formatPeso(centavos: number): string {
  return `₱${(centavos / 100).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function EmailLayout(props: {
  preview: string;
  heading: string;
  children: ReactNode;
}) {
  return (
    <Html>
      <Head />
      <Preview>{props.preview}</Preview>
      <Body style={{ backgroundColor: "#0a0a0a", fontFamily: "sans-serif" }}>
        <Container style={{ padding: "24px", maxWidth: "480px" }}>
          <Text
            style={{ color: "#a3a3a3", fontSize: "12px", letterSpacing: 2 }}
          >
            NO PETS ALLOWED
          </Text>
          <Heading style={{ color: "#fafafa", fontSize: "22px" }}>
            {props.heading}
          </Heading>
          <Section style={{ color: "#d4d4d4", fontSize: "14px" }}>
            {props.children}
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
