// Menu admin.
import { NavLink } from '@mantine/core';
import { Link, useLocation } from 'react-router-dom';

interface NavItem {
  label: string;
  to: string;
}

interface NavGroup {
  label: string;
  basePath: string;
  items: NavItem[];
}

const groups: NavGroup[] = [
  {
    label: 'Catálogo',
    basePath: '/admin/catalog',
    items: [
      { label: 'Grupo de camadas', to: '/admin/catalog/group-layers' },
      { label: 'Recursos', to: '/admin/catalog/resources' },
      { label: 'Estilização', to: '/admin/catalog/styles' },
    ],
  },
  {
    label: 'Social',
    basePath: '/admin/social',
    items: [
      { label: 'Usuários', to: '/admin/social/users' },
      { label: 'Grupos', to: '/admin/social/groups' },
      { label: 'Papéis', to: '/admin/social/roles' },
    ],
  },
];

export function AdminSidebar() {
  const { pathname } = useLocation();

  return (
    <>
      {groups.map((group) => (
        <NavLink
          key={group.basePath}
          label={group.label}
          defaultOpened={pathname.startsWith(group.basePath)}
          childrenOffset={28}
        >
          {group.items.map((item) => (
            <NavLink
              key={item.to}
              component={Link}
              to={item.to}
              label={item.label}
              active={pathname === item.to || pathname.startsWith(`${item.to}/`)}
            />
          ))}
        </NavLink>
      ))}
    </>
  );
}
