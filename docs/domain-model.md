# Modelo de Domínio

## GroupLayer

Publicação lógica no catálogo. Gera um `gl_id` e contém 1..N recursos.

## Resource

Camada real: Martin/MVT, PostGIS, WMS, WFS, GeoJSON ou outra origem.

## LayerBinding

Associação entre a visualização MVT e a tabela editável no PostGIS.

## AuditLog

Registro das ações feitas por usuários.
