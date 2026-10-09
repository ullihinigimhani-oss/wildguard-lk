import elephants from "../assets/public/wildguard-hero-elephants.png";
import ranger from "../assets/public/ranger-field-operations.png";
import community from "../assets/public/community.svg";
import cameraTraps from "../assets/public/wildlife-monitoring-camera-traps.png";
import monitoring from "../assets/public/data-driven-conservation.png";

// Supplied photographs are stored as PNGs in the existing asset directory.
export const heroImage = elephants;
export const publicLinks = [
  ["home", "Home"],
  ["about", "About"],
  ["features", "Features"],
  ["conservation", "Conservation"],
  ["contact", "Contact"],
];
export const conservationStories = [
  {
    id: "ranger-operations",
    icon: "patrol",
    title: "Ranger Patrol & Field Incident Management",
    summary:
      "Bring patrol planning and field incident information into one connected workspace.",
    heading: "Supporting the people on the front line.",
    text: "Conservation begins in the field. WildGuard LK is designed to help ranger teams coordinate patrols, document incidents and share the information needed for a timely response.",
    image: ranger,
    alt: "Field team observing wildlife from tall grass",
    label: "RANGER FIELD OPERATIONS",
    action: "Explore patrol workspace",
    route: "/patrols",
  },
  {
    id: "community-participation",
    icon: "community",
    title: "Community Reporting & Safety Alert Management",
    summary:
      "Connect local knowledge with conservation teams and clearer safety communication.",
    heading: "Local voices. Shared responsibility.",
    text: "People living alongside wildlife are an essential part of its future. Community participation helps surface concerns, strengthen awareness and build a more informed approach to living together.",
    image: community,
    alt: "Original illustration of a community gathering beneath a tree",
    label: "COMMUNITY PARTICIPATION",
    action: "Explore community reporting",
    route: "/community-reports",
  },
  {
    id: "wildlife-monitoring",
    icon: "wildlife",
    title: "Wildlife Monitoring, Risk Detection & Field Data Synchronization",
    summary:
      "Build a clearer view of wildlife activity and prepare field information for connected use.",
    heading: "A clearer picture of life in the wild.",
    text: "Bringing monitoring information together can help teams understand changing conditions and identify where attention is needed. This prototype uses simulated sensor data; it does not track physical devices.",
    image: cameraTraps,
    imageFit: "contain",
    alt: "Collage of wildlife observations, camera-trap equipment and field monitoring",
    label: "WILDLIFE MONITORING",
    action: "Explore monitoring workspace",
    route: "/wildlife",
  },
  {
    id: "conservation-data",
    icon: "data",
    title: "Conservation Operations, Incident Response, Analytics & Reporting",
    summary:
      "Connect field observations with coordinated responses and conservation decisions.",
    heading: "Better information. More thoughtful action.",
    text: "From an individual observation to a park-wide perspective, organized information supports conservation decisions. WildGuard LK brings the foundation for incident response, analysis and reporting into a shared platform.",
    image: monitoring,
    alt: "People and field vehicles observing wildlife around a waterhole",
    label: "DATA-DRIVEN CONSERVATION",
    action: "Explore conservation analytics",
    route: "/analytics",
  },
];
