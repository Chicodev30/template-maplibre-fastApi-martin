// Rotas: login, mapa, admin.
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { MapView } from '../map/MapView';
import { RequireAuth } from '../auth/RequireAuth';
import { AdminLayout } from '../layouts/AdminLayout/AdminLayout';
import { ResourcesPage } from '../pages/Admin/ResourcesPage';
import { ResourceDetailPage } from '../pages/Admin/ResourceDetailPage';
import { GroupLayersPage } from '../pages/Admin/GroupLayersPage';
import { UsersPage } from '../pages/Admin/UsersPage';
import { UserDetailPage } from '../pages/Admin/UserDetailPage';
import { GroupsPage } from '../pages/Admin/GroupsPage';
import { RolesPage } from '../pages/Admin/RolesPage';
import { LoginPage } from '../pages/LoginPage/LoginPage';

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/login" replace /> },
  { path: '/login', element: <LoginPage /> },
  {
    path: '/map',
    element: (
      <RequireAuth>
        <MapView />
      </RequireAuth>
    ),
  },
  {
    path: '/admin',
    element: (
      <RequireAuth>
        <AdminLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="catalog/resources" replace /> },
      { path: 'catalog', element: <Navigate to="resources" replace /> },
      { path: 'catalog/resources', element: <ResourcesPage /> },
      { path: 'catalog/resources/:id', element: <ResourceDetailPage /> },
      { path: 'catalog/group-layers', element: <GroupLayersPage /> },
      { path: 'social', element: <Navigate to="users" replace /> },
      { path: 'social/users', element: <UsersPage /> },
      { path: 'social/users/:id', element: <UserDetailPage /> },
      { path: 'social/groups', element: <GroupsPage /> },
      { path: 'social/roles', element: <RolesPage /> },
    ],
  },
]);
