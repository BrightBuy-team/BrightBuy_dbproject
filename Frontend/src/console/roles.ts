// Which console sections each employee role may open, and where each kind of
// account lands after sign-in. The backend enforces the same rules on every
// request; this only decides what the pages show.

export type SectionId = 'overview' | 'inventory' | 'products' | 'categories' | 'reports' | 'staff' | 'deliveries'
export type Portal = 'customer' | 'employee' | 'admin'
type Account = { accountType: string; role: string }

export const sectionLabels: Record<SectionId, string> = {
  overview: 'Dashboard', inventory: 'Inventory', products: 'Products',
  categories: 'Categories', reports: 'Reports', staff: 'Staff accounts',
  deliveries: 'Deliveries',
}

const sectionsByRole: Record<string, SectionId[]> = {
  WarehouseStaff: ['overview', 'inventory', 'products', 'categories', 'deliveries'],
  Management: ['overview', 'reports'],
  Admin: ['overview', 'staff', 'inventory', 'products', 'categories', 'deliveries'],
  DeliveryDriver: ['deliveries'],
}

export const roleTitles: Record<string, string> = {
  WarehouseStaff: 'Warehouse staff', Management: 'Management', DeliveryDriver: 'Delivery driver',
  Admin: 'Administrator',
}

export function sectionsFor(role: string): SectionId[] {
  return sectionsByRole[role] ?? []
}

/** The requested section if this role may open it, otherwise the role's first section. */
export function resolveSection(role: string, requested: string | null): SectionId | undefined {
  const allowed = sectionsFor(role)
  return allowed.find(section => section === requested) ?? allowed[0]
}

/** Where an account goes after signing in. */
export function landingPage(user: Account): string {
  return user.accountType === 'CUSTOMER' ? '/catalogue.html' : '/console.html'
}

/** The sign-in door an account belongs to: customers, employees, or administrators. */
export function portalOf(user: Account): Portal {
  if (user.accountType === 'CUSTOMER') return 'customer'
  return user.role === 'Admin' ? 'admin' : 'employee'
}
