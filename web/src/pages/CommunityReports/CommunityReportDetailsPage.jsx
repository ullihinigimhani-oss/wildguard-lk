import { Link, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import CommunityReportDetails from "../../components/community/CommunityReportDetails";
import "./CommunityReports.css";
export default function CommunityReportDetailsPage() {
  const { reportId } = useParams();
  const [params] = useSearchParams();
  const { user } = useAuth() || {};
  const authorized =
    user?.role === "PARK_MANAGER" && user?.approvalStatus === "APPROVED";
  const context = params.size ? `?${params}` : "";
  return (
    <div className="community-page">
      <Link to={`/community-reports${context}`}>
        ← Back to Community Reports
      </Link>
      {authorized ? (
        <CommunityReportDetails key={reportId} id={reportId} />
      ) : (
        <p role="alert">
          Only approved Park Managers can view community report management.
        </p>
      )}
    </div>
  );
}