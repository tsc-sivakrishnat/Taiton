import { useState } from 'react';
import { useAuth } from '../../context/authContext.js';
import { notify } from '../../utils/notify.js';
import { PermissionRoute } from '../../routes/PermissionRoute.jsx';
import { OrgAdminsOnboardingPanel } from '../../components/OrgAdminsOnboardingPanel.jsx';
import { PageBreadcrumb } from '../../components/PageBreadcrumb.jsx';

export function MembersOnboardingPage() {
  return (
    <PermissionRoute platformOnly>
      <MembersOnboardingPageInner />
    </PermissionRoute>
  );
}

function MembersOnboardingPageInner() {
  const { token } = useAuth();
  const [refreshSignal, setRefreshSignal] = useState(0);

  return (
    <div className="cp-stack cp-stack--fill">
      <PageBreadcrumb current="Onboarding Members" />
      <div className="cp-page-head">
        <div>
          <h1 className="cp-page-title">Onboarding Members</h1>
          <p className="cp-page-lead">Add organization administrators for each tenant.</p>
        </div>
        <button
          type="button"
          className="cp-btn cp-btn-secondary"
          onClick={() => {
            setRefreshSignal((n) => n + 1);
            notify.info('Refreshed', 'List updated.');
          }}
        >
          Refresh
        </button>
      </div>
      <section className="cp-card cp-card-pad cp-card--overflow-visible cp-onboard-panel cp-onboard-panel--stretch">
        <OrgAdminsOnboardingPanel token={token} embedded refreshSignal={refreshSignal} />
      </section>
    </div>
  );
}
