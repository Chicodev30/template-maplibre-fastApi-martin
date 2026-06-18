// Upload/add de recurso: a logica foi movida para o modal em ResourcesPage.
// Este componente so redireciona para manter compatibilidade de rota.
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function ResourceUploadPage() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/admin/catalog/resources', { replace: true });
  }, [navigate]);
  return null;
}
