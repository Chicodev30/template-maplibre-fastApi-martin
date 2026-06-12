# GeoFrame Next Template

Template inicial para uma aplicação WebGIS com:

- React + Vite + TypeScript
- MapLibre + deck.gl
- Zustand
- TanStack Query
- TanStack Table
- FastAPI
- PostgreSQL/PostGIS externo via variáveis de ambiente
- Martin MVT em container separado
- Keycloak/SSO-PMPA
- Catálogo, Group Layers, Resources, edição de atributos e auditoria

Este template está propositalmente leve, com pastas e arquivos base para iniciar a implementação.

## Decisão de infra

A estrutura **não inclui**:

- `docker-compose.yml`
- manifests `k8s`
- container local de PostgreSQL
- scripts de init de PostgreSQL

A infra da empresa pode subir **web**, **api** e **martin** separadamente. O banco é informado via `.env`.

## Estrutura

```txt
geoframe-next-template/
  apps/
    web/              # React + Vite + TS
      Dockerfile
      .env.example
    api/              # FastAPI
      Dockerfile
      .env.example
  infra/
    martin/           # Martin separado
      Dockerfile
      martin.yaml
      entrypoint.sh
      .env.example
  docs/               # documentação técnica
  .env.example        # exemplo geral
```

## Constantes institucionais

As constantes abaixo ficam em arquivo versionado, não no `.env`:

```txt
KEYCLOAK_URL=https://sso-pmpa-hom.procempa.com.br/auth
KEYCLOAK_REALM=pmpa
KEYCLOAK_CLIENT_ID=gfr
```

Arquivos:

```txt
apps/api/app/core/constants.py
apps/web/src/config/constants.ts
```

## Próximos passos sugeridos

1. Implementar autenticação Keycloak no frontend e validação JWT na API.
2. Criar modelos SQLAlchemy para catálogo, recursos, layer binding e auditoria.
3. Criar endpoint `/api/auth/me`.
4. Criar endpoint de publicação Martin.
5. Montar o layout do mapa com MapLibre + deck.gl.
6. Criar árvore de camadas e tabela de atributos.
7. Implementar edição tabular via API, nunca diretamente pelo MVT.
