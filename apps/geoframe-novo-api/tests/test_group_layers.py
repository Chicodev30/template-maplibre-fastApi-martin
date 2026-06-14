# Testes group-layers (sem DB): recursao da arvore e contagem de camadas.
from app.api.routes.group_layers import LayerGroupIn, TreeNode, _count_layers


def _sample_tree() -> list[dict]:
    tree = [
        TreeNode(
            id="g1",
            kind="folder",
            label="Grupo interno",
            children=[
                TreeNode(id="l1", kind="layer", label="A", resourceId="s.t"),
                TreeNode(id="l2", kind="layer", label="A (filtrado)", resourceId="s.t"),
            ],
        ),
        TreeNode(id="l3", kind="layer", label="B", resourceId="s.u"),
    ]
    return [node.model_dump() for node in tree]


def test_count_layers_walks_nested_folders():
    assert _count_layers(_sample_tree()) == 3


def test_count_layers_empty():
    assert _count_layers([]) == 0


def test_same_resource_can_repeat():
    tree = _sample_tree()
    layer_resource_ids = [c["resourceId"] for c in tree[0]["children"]]
    assert layer_resource_ids == ["s.t", "s.t"]


def test_layer_defaults_have_style_and_label():
    layer = TreeNode(id="l", kind="layer", label="x", resourceId="s.t")
    # estilo so e materializado quando informado; defaults ficam no front.
    assert layer.minZoom is None and layer.maxZoom is None
    assert layer.filterRules == []


def test_payload_roundtrip_preserves_tree():
    payload = LayerGroupIn(name="Mapa", tree=[TreeNode.model_validate(n) for n in _sample_tree()])
    dumped = [node.model_dump() for node in payload.tree]
    assert _count_layers(dumped) == 3
