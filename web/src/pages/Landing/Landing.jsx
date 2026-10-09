import { Link } from "react-router-dom";
import PublicNavbar from "../../components/public/PublicNavbar";
import PublicFooter from "../../components/public/PublicFooter";
import FeatureCard from "../../components/public/FeatureCard";
import ConservationStory from "../../components/public/ConservationStory";
import { conservationStories, heroImage } from "../../constants/publicContent";
import { useAuth } from "../../hooks/useAuth";
import "./landing.css";

export default function Landing() {
  const { user, isAuthenticated = false } = useAuth();
  const destination = isAuthenticated && user ? "/dashboard" : "/register";
  return (
    <div className="public-site" id="home">
      <a className="skip-link" href="#public-main">
        Skip to content
      </a>
      <PublicNavbar />
      <main id="public-main" tabIndex={-1}>
        <section className="public-hero" aria-labelledby="hero-title">
          <img
            className="public-hero-image"
            src={heroImage}
            alt=""
            fetchPriority="high"
            width="1600"
            height="900"
          />
          <div className="public-hero-shade" />
          <div className="public-container public-hero-content">
            <span className="public-kicker">
              FOR OUR WILDLIFE. FOR OUR FUTURE.
            </span>
            <h1 id="hero-title">
              Protecting Sri Lanka's Wildlife Through{" "}
              <em>Smarter Conservation</em>
            </h1>
            <p>
              A digital platform connecting park rangers, communities,
              researchers and conservation teams to protect wildlife and respond
              to threats faster.
            </p>
            <div className="public-actions">
              <Link
                className="public-button public-button-gold"
                to={destination}
              >
                Get Started <span aria-hidden="true">↗</span>
              </Link>
              <a
                className="public-button public-button-outline"
                href="#features"
              >
                Explore Features <span aria-hidden="true">↓</span>
              </a>
            </div>
            <div className="public-hero-note">
              <span className="public-line" /> Connected people. Informed
              action. A living wilderness.
            </div>
          </div>
          <div className="public-hero-caption">
            SRI LANKA / AN ORIGINAL WILDGUARD ILLUSTRATION
          </div>
        </section>
        <div className="public-purpose-strip">
          <div className="public-container">
            <span>ONE PLATFORM. A SHARED PURPOSE.</span>
            <p>
              Rangers <i /> Communities <i /> Researchers <i /> Conservation
              teams
            </p>
          </div>
        </div>
        <section
          id="about"
          tabIndex={-1}
          className="public-container public-about public-section"
        >
          <div>
            <span className="public-kicker">01 / ABOUT WILDGUARD LK</span>
            <h2>
              Our natural heritage.
              <br />
              <em>Our collective responsibility.</em>
            </h2>
          </div>
          <div>
            <p className="public-lead">
              Sri Lanka’s wildlife deserves a future where people, knowledge and
              action work together.
            </p>
            <p>
              WildGuard LK is a Smart Wildlife Conservation and Anti-Poaching
              Monitoring System designed to support the people caring for our
              wild spaces. It connects field monitoring, anti-poaching
              operations and community participation with informed conservation
              decision-making.
            </p>
            <a className="public-text-link" href="#conservation">
              Discover our approach <span aria-hidden="true">↗</span>
            </a>
          </div>
        </section>
        <section
          id="features"
          tabIndex={-1}
          className="public-features public-section"
        >
          <div className="public-container">
            <div className="public-section-heading">
              <div>
                <span className="public-kicker">
                  02 / CONNECTED CAPABILITIES
                </span>
                <h2>
                  Better connected.
                  <br />
                  <em>Better prepared.</em>
                </h2>
              </div>
              <p>
                Four areas of focus, brought together to support conservation
                from the field to the operations desk.
              </p>
            </div>
            <div className="public-features-grid">
              {conservationStories.map((feature, index) => (
                <FeatureCard key={feature.id} feature={feature} index={index} />
              ))}
            </div>
            <p className="public-prototype-note">
              A platform in development. These capabilities describe the project
              vision; operational workflows are not yet available.
            </p>
          </div>
        </section>
        <section
          id="conservation"
          tabIndex={-1}
          className="public-container public-section public-conservation"
        >
          <div className="public-section-heading">
            <div>
              <span className="public-kicker">
                03 / CONSERVATION IN PRACTICE
              </span>
              <h2>
                Technology with
                <br />
                <em>a purpose beyond the screen.</em>
              </h2>
            </div>
            <p>
              Built around the people and places at the heart of Sri Lanka’s
              conservation story.
            </p>
          </div>
          {[
            conservationStories[0],
            conservationStories[2],
            conservationStories[1],
            conservationStories[3],
          ].map((story, index) => (
            <ConservationStory key={story.id} story={story} index={index} />
          ))}
        </section>
        <section id="contact" tabIndex={-1} className="public-contact">
          <div className="public-container public-contact-inner">
            <div>
              <span className="public-kicker">04 / STAY CONNECTED</span>
              <h2>
                A wilder tomorrow
                <br />
                starts with <em>all of us.</em>
              </h2>
              <p>
                Join the conservation community, or sign in to your existing
                workspace.
              </p>
              <div className="public-actions">
                <Link
                  className="public-button public-button-gold"
                  to={destination}
                >
                  {isAuthenticated && user
                    ? "Open Dashboard"
                    : "Join the community"}{" "}
                  <span aria-hidden="true">↗</span>
                </Link>
                <Link className="public-contact-signin" to="/login">
                  Already a member? Sign In
                </Link>
              </div>
            </div>
            <aside>
              <h3>Contact & participation</h3>
              <p>
                WildGuard LK is a university conservation prototype. Public
                contact details will be shared when the service launches.
              </p>
              <p>
                For urgent wildlife concerns, use your local park
                administration’s established reporting channels. This prototype
                does not receive emergency reports.
              </p>
            </aside>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
