import json, glob
from pathlib import Path
from graphify.build import build_from_json
from graphify.cluster import cluster, score_all
from graphify.analyze import god_nodes, surprising_connections, suggest_questions
from graphify.report import generate
from graphify.export import to_json
from graphify.diagnostics import diagnose_extraction, format_diagnostic_report

if __name__ == '__main__':
    nodes, edges, hyper = [], [], []
    for c in sorted(glob.glob('graphify-out/.graphify_chunk_*.json')):
        d = json.loads(Path(c).read_text(encoding='utf-8'))
        nodes += d.get('nodes', []); edges += d.get('edges', []); hyper += d.get('hyperedges', [])
        print(c, len(d.get('nodes', [])), len(d.get('edges', [])))
    seen=set(); sn=[]
    for n in nodes:
        if n['id'] not in seen: seen.add(n['id']); sn.append(n)
    sem = {'nodes': sn, 'edges': edges, 'hyperedges': hyper, 'input_tokens': 0, 'output_tokens': 0}
    Path('graphify-out/.graphify_semantic.json').write_text(json.dumps(sem, ensure_ascii=False), encoding='utf-8')
    ast = json.loads(Path('graphify-out/.graphify_ast.json').read_text(encoding='utf-8'))
    ids = {n['id'] for n in ast['nodes']}
    mn = list(ast['nodes'])
    for n in sn:
        if n['id'] not in ids: mn.append(n); ids.add(n['id'])
    ext = {'nodes': mn, 'edges': ast['edges'] + edges, 'hyperedges': hyper, 'input_tokens': 0, 'output_tokens': 0}
    Path('graphify-out/.graphify_extract.json').write_text(json.dumps(ext, ensure_ascii=False), encoding='utf-8')
    print('merged', len(mn), len(ext['edges']))
    print(format_diagnostic_report(diagnose_extraction(ext, directed=False, root='.')))
    detection = json.loads(Path('graphify-out/.graphify_detect.json').read_text(encoding='utf-8'))
    G = build_from_json(ext, root='.', directed=False)
    if G.number_of_nodes() == 0: raise SystemExit('empty graph')
    comms = cluster(G); coh = score_all(G, comms)
    gods = god_nodes(G); sur = surprising_connections(G, comms)
    labels = {c: 'Community ' + str(c) for c in comms}
    q = suggest_questions(G, comms, labels)
    wrote = to_json(G, comms, 'graphify-out/graph.json')
    if not wrote: raise SystemExit('shrink guard refused')
    Path('graphify-out/GRAPH_REPORT.md').write_text(generate(G, comms, coh, labels, gods, sur, detection, {'input':0,'output':0}, '.', suggested_questions=q), encoding='utf-8')
    Path('graphify-out/.graphify_analysis.json').write_text(json.dumps({'communities': {str(k): v for k, v in comms.items()}, 'cohesion': {str(k): v for k, v in coh.items()}, 'gods': gods, 'surprises': sur, 'questions': q}, ensure_ascii=False), encoding='utf-8')
    print(f'Graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges, {len(comms)} communities')
