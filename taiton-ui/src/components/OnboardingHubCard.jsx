import { Link } from 'react-router-dom';
import { SidebarNavIcon } from './SidebarNavIcon.jsx';

/** Dashboard tile linking to an onboarding or operations route. */
export function OnboardingHubCard({ to, icon, title, description }) {
  return (
    <Link to={to} className="cp-onboard-card">
      <span className="cp-onboard-card-icon" aria-hidden>
        <SidebarNavIcon name={icon} />
      </span>
      <span className="cp-onboard-card-body">
        <span className="cp-onboard-card-title">{title}</span>
        {description ? <span className="cp-onboard-card-desc">{description}</span> : null}
      </span>
      <span className="cp-onboard-card-arrow" aria-hidden>
        →
      </span>
    </Link>
  );
}
