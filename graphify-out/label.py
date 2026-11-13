import json
from pathlib import Path
from graphify.build import build_from_json
from graphify.analyze import suggest_questions
from graphify.report import generate
from graphify.export import to_json

if __name__ == '__main__':
    ext = json.loads(Path('graphify-out/.graphify_extract.json').read_text(encoding='utf-8'))
    det = json.loads(Path('graphify-out/.graphify_detect.json').read_text(encoding='utf-8'))
    an = json.loads(Path('graphify-out/.graphify_analysis.json').read_text(encoding='utf-8'))
    G = build_from_json(ext, root='.', directed=False)
    comms = {int(k): v for k, v in an['communities'].items()}
    coh = {int(k): v for k, v in an['cohesion'].items()}
    names = {0:'Modales y componentes web',1:'Documentacion y alcance de Boxy',2:'Shell de la app y Auth web',3:'Tickets y utilidades de impresion',4:'Dashboard y excepciones de negocio',5:'Calculo de venta (PHP=TS)',6:'Pruebas de operacion API',7:'Monitor en vivo',8:'Dependencias Composer',9:'Cuenta y precios masivos',10:'Empresa y promociones',11:'Auth y fiscal API',12:'Instalador y categorias',13:'Clientes y fiado',14:'Inventario y productos',15:'Facturacion SaaS web',16:'Middleware de seguridad',17:'Capturas UI y tema oscuro',18:'Compras y comprobantes',19:'Analisis y monitor web',20:'Modelos Cliente y Empresa',21:'Comandos de respaldo y tasas',22:'Dependencias web',23:'Dependencias api js',24:'Usuario y turno de caja',25:'Cliente HTTP y tokens',26:'Service worker PWA',27:'Modelos de devolucion y pago',28:'Config TypeScript',29:'Dev tooling eslint'}
    labels = {c: names.get(c, f'Grupo {c}') for c in comms}
    q = suggest_questions(G, comms, labels)
    Path('graphify-out/GRAPH_REPORT.md').write_text(generate(G, comms, coh, labels, an['gods'], an['surprises'], det, {'input':0,'output':0}, '.', suggested_questions=q), encoding='utf-8')
    Path('graphify-out/.graphify_labels.json').write_text(json.dumps({str(k): v for k, v in labels.items()}, ensure_ascii=False), encoding='utf-8')
    print('wrote', to_json(G, comms, 'graphify-out/graph.json', community_labels=labels))
