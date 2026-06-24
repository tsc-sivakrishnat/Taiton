import { CustomerRequestsPage } from './CustomerRequestsPage.jsx';
import { PageBreadcrumb } from '../components/PageBreadcrumb.jsx';

/** Web Responses — org-facing customer inquiries (alias of customer requests). */
export function WebResponsesPage() {
  return (
    <div className="cp-stack">
      <PageBreadcrumb current="Web Responses" />
      <div className="cp-page-head">
        <div>
          <h1 className="cp-page-title">Web Responses</h1>
          <p className="cp-muted">Inquiries, contacts, and quotations from the website.</p>
        </div>
      </div>
      <CustomerRequestsPage embedded hidePageHead hideNewRequestForm title="Web Responses" />
    </div>
  );
}
