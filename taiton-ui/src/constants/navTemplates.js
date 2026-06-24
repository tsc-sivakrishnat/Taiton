/** Quick-add templates for Onboarding Nav Items (assign to super_employee or other roles). */
export const ORG_NAV_TEMPLATES = [
  { label: 'Catalogs', icon: 'Layout', route: '/app/catalogs', sortOrder: 18, rolesCsv: 'super_employee' },
  { label: 'Events & achievements', icon: 'Briefcase', route: '/app/events', sortOrder: 19, rolesCsv: 'super_employee' },
  { label: 'Onboarding Products', icon: 'Package', route: '/app/products', sortOrder: 10, rolesCsv: 'employee,employee_2' },
  { label: 'Web Responses', icon: 'Inbox', route: '/app/web-responses', sortOrder: 20, rolesCsv: 'employee,employee_2' },
];
