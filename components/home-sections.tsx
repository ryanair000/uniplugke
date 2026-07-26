type InfoItem = {
  description: string;
  icon: string;
  title: string;
};

const processItems: InfoItem[] = [
  {
    icon: "1",
    title: "Choose a service",
    description: "Pick the service that fits your needs."
  },
  {
    icon: "2",
    title: "Sign in for local pricing",
    description: "See exact member plans in KSh and complete setup securely."
  },
  {
    icon: "3",
    title: "Manage everything",
    description: "Payments, renewals and settings in one place."
  }
];

const trustItems: InfoItem[] = [
  {
    icon: "✓",
    title: "Secure checkout",
    description: "Payments are encrypted and protected."
  },
  {
    icon: "↻",
    title: "Renewal reminders",
    description: "Get notified before your subscription renews."
  },
  {
    icon: "W",
    title: "Kenyan WhatsApp support",
    description: "Real people. Local support. We’re here to help."
  }
];

function InfoRow({
  item,
  kind,
  isLast
}: {
  item: InfoItem;
  kind: "process" | "trust";
  isLast: boolean;
}) {
  return (
    <article className={`home-info-item ${kind}`}>
      <span className="home-info-icon" aria-hidden="true">{item.icon}</span>
      <div>
        <h3>{item.title}</h3>
        <p>{item.description}</p>
      </div>
      {!isLast && <span className="home-info-divider" aria-hidden="true" />}
    </article>
  );
}

export function ProcessStrip() {
  return (
    <section id="how-it-works" className="home-process" aria-labelledby="process-title">
      <div className="home-section-shell">
        <h2 id="process-title">How UniPlug works</h2>
        <div className="home-info-grid">
          {processItems.map((item, index) => (
            <InfoRow
              key={item.title}
              item={item}
              kind="process"
              isLast={index === processItems.length - 1}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export function TrustStrip() {
  return (
    <section className="home-trust" aria-label="Why members trust UniPlug">
      <div className="home-section-shell home-info-grid">
        {trustItems.map((item, index) => (
          <InfoRow
            key={item.title}
            item={item}
            kind="trust"
            isLast={index === trustItems.length - 1}
          />
        ))}
      </div>
    </section>
  );
}
