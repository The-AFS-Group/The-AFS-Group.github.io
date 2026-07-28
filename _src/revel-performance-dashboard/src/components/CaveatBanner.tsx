// src/components/CaveatBanner.tsx
interface CaveatBannerProps {
  text: string;
}

export function CaveatBanner({ text }: CaveatBannerProps) {
  return (
    <p
      className="text-xs rounded-lg px-3 py-2"
      style={{
        color: "var(--gaf-text-muted)",
        background: "#f9fafb",
        border: "1px solid var(--gaf-row-border)",
        fontFamily: "var(--font-body)",
      }}
    >
      {text}
    </p>
  );
}
