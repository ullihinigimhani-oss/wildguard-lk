import FeatureIcon from "./FeatureIcon";
export default function FeatureCard({ feature, index }) {
  return (
    <article className="public-feature-card">
      <div className="public-feature-top">
        <FeatureIcon name={feature.icon} />
        <span>0{index + 1}</span>
      </div>
      <h3>{feature.title}</h3>
      <p>{feature.summary}</p>
      <a
        href={`#${feature.id}`}
        aria-label={`Learn more about ${feature.title}`}
      >
        Learn More <span aria-hidden="true">↗</span>
      </a>
    </article>
  );
}
