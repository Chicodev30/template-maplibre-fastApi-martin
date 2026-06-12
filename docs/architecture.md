# Arquitetura

## Componentes

- `apps/web`: frontend React com MapLibre/deck.gl.
- `apps/api`: API FastAPI responsável por autenticação, catálogo, publicação, edição e auditoria.
- `martin`: servidor MVT.
- `postgres`: banco PostgreSQL/PostGIS.

## Regra principal

O MVT é usado para visualização. A edição de atributos deve passar pela API e atualizar a tabela PostGIS associada ao `resource` por meio de `layer_binding`.
