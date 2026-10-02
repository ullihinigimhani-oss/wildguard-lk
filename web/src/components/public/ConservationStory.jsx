import { Link } from "react-router-dom";
export default function ConservationStory({ story, index }) {
  return (
    <article
      id={story.id}
      tabIndex={-1}
      className={`public-story ${index % 2 ? "public-story-reverse" : ""}`}
    >
      <figure className={story.imageFit === "contain" ? "public-image-contain" : undefined}>
        <img
          src={story.image}
          alt={story.alt}
          width="1000"
          height="700"
          loading="lazy"
        />
        <figcaption>WILDGUARD LK / {story.label}</figcaption>
      </figure>
      <div>
        <span className="public-kicker">
          0{index + 1} / {story.label}
        </span>
        <h3>{story.heading}</h3>
        <p>{story.text}</p>
        <Link className="public-story-action" to={story.route}>
          {story.action} <span aria-hidden="true">↗</span>
        </Link>
        <small>
          Account access required. Operational tools are in development.
        </small>
      </div>
    </article>
  );
}
