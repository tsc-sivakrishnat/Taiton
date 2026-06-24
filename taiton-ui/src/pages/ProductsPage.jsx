import { ContentModulePage } from '../components/ContentModulePage.jsx';
import { PERMISSIONS } from '../constants/permissions.js';
import { PermissionRoute } from '../routes/PermissionRoute.jsx';

export function ProductsPage() {
  return (
    <PermissionRoute permission={PERMISSIONS.PRODUCTS_WRITE}>
      <ContentModulePage
        contentType="product"
        title="Onboarding Products"
        subtitle="Categories, sub-categories, products, and kits. Employee changes may require approval before publish."
      />
    </PermissionRoute>
  );
}
