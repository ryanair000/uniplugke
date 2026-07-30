type InfoItem = {
  description: string;
  icon: string;
  title: string;
};

const processItems: InfoItem[] = [
  {
    icon: "1",
    title: "Compare services",
    description: "Review devices, starting prices, and setup requirements."
  },
  {
    icon: "2",
    title: "Choose a member plan",
    description: "Invited clients see KSh prices, approximate USD equivalents, and billing cycles."
  },
  {
    icon: "3",
    title: "Track it in one place",
    description: "Follow payment, activation, renewal, and support progress."
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
        <div className="home-process-heading">
          <p className="upgrade-eyebrow">How it works</p>
          <h2 id="process-title">From discovery to renewal, without the guesswork.</h2>
        </div>
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
