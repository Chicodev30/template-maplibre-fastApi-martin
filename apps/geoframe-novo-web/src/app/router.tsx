// Rotas: mapa (home), login, admin.
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { MapLayout } from '../layouts/MapLayout/MapLayout';
import { RequireAuth } from '../auth/RequireAuth';
import { AdminLayout } from '../layouts/AdminLayout/AdminLayout';
import { ResourcesPage } from '../pages/Admin/ResourcesPage';
import { ResourceUploadPage } from '../pages/Admin/ResourceUploadPage';
import { ResourceDetailPage } from '../pages/Admin/ResourceDetailPage';
import { GroupLayersPage } from '../pages/Admin/GroupLayersPage';
import { GroupLayerBuilderPage } from '../pages/Admin/GroupLayerBuilderPage';
import { StylesPage } from '../pages/Admin/StylesPage';
import { StyleBuilderPage } from '../pages/Admin/StyleBuilderPage';
import { UsersPage } from '../pages/Admin/UsersPage';
import { UserDetailPage } from '../pages/Admin/UserDetailPage';
import { GroupsPage } from '../pages/Admin/GroupsPage';
import { RolesPage } from '../pages/Admin/RolesPage';
import { StoragePage } from '../pages/Admin/StoragePage';
import { LoginPage } from '../pages/LoginPage/LoginPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <RequireAuth>
        <MapLayout />
      </RequireAuth>
    ),
  },
  { path: '/login', element: <LoginPage /> },
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
      { path: 'catalog/resources/new', element: <ResourceUploadPage /> },
      { path: 'catalog/resources/:id', element: <ResourceDetailPage /> },
      { path: 'catalog/group-layers', element: <GroupLayersPage /> },
      { path: 'catalog/group-layers/new', element: <GroupLayerBuilderPage /> },
      { path: 'catalog/group-layers/:id', element: <GroupLayerBuilderPage /> },
      { path: 'catalog/styles', element: <StylesPage /> },
      { path: 'catalog/styles/new', element: <StyleBuilderPage /> },
      { path: 'catalog/styles/:id', element: <StyleBuilderPage /> },
      { path: 'social', element: <Navigate to="users" replace /> },
      { path: 'social/users', element: <UsersPage /> },
      { path: 'social/users/:id', element: <UserDetailPage /> },
      { path: 'social/groups', element: <GroupsPage /> },
      { path: 'social/roles', element: <RolesPage /> },
      { path: 'storage', element: <StoragePage /> },
    ],
  },
]);
