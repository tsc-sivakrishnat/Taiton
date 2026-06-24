import { ContentModulePage } from '../components/ContentModulePage.jsx';
import { PERMISSIONS } from '../constants/permissions.js';
import { PermissionRoute } from '../routes/PermissionRoute.jsx';

export function UiElementsPage() {
  return (
    <PermissionRoute permission={PERMISSIONS.UI_WRITE}>
      <ContentModulePage
        contentType="ui_element"
        title="UI Elements"
        subtitle="Layouts (theme, font, root colors) and components (pages → components). Changes may require organization administrator approval."
      />
    </PermissionRoute>
  );
}
