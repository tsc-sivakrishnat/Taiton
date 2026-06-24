import { ContentModulePage } from '../components/ContentModulePage.jsx';
import { PERMISSIONS } from '../constants/permissions.js';
import { PermissionRoute } from '../routes/PermissionRoute.jsx';

export function SeoPage() {
  return (
    <PermissionRoute permission={PERMISSIONS.SEO_WRITE}>
      <ContentModulePage
        contentType="seo"
        title="SEO Management"
        subtitle="Website pages — keywords, descriptions, meta tags, and related SEO fields."
      />
    </PermissionRoute>
  );
}
