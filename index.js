const express = require('express');
const twilio = require('twilio');
const XLSX = require('xlsx');
const path = require('path');

const app = express();
app.use(express.urlencoded({ extended: false }));

const USUARIOS = {
  'aquino':    { pass: '1234', vendedor: 'AQUINO, JONATAN, 30',      nombre: 'Jonatan Aquino' },
  'cristaldo': { pass: '5678', vendedor: 'CRISTALDO, CLAUDIA, 31',   nombre: 'Claudia Cristaldo' },
  'lopez':     { pass: '1234', vendedor: 'LOPEZ, DANIELA, 32',       nombre: 'Daniela Lopez' },
  'molina':    { pass: '1234', vendedor: 'MOLINA, TOMAS, 34',        nombre: 'Tomas Molina' },
  'adaro':     { pass: '1234', vendedor: 'ADARO, ALBERTO, 41',       nombre: 'Alberto Adaro' },
  'carabajal': { pass: '1234', vendedor: 'CARABAJAL, SANDRA, 42',    nombre: 'Sandra Carabajal' },
  'chaparro':  { pass: '1234', vendedor: 'CHAPARRO, BETIANA, 43',    nombre: 'Betiana Chaparro' },
  'dotta':     { pass: '1234', vendedor: 'DOTTA, MAXIMILIANO, 44',   nombre: 'Maximiliano Dotta' },
  'valiente':  { pass: '1234', vendedor: 'VALIENTE, ALEJANDRO, 46',  nombre: 'Alejandro Valiente' },
  'velazquez': { pass: '1234', vendedor: 'VELAZQUEZ, ALEJANDRA, 36', nombre: 'Alejandra Velazquez' },
  'olivera':   { pass: '1234', vendedor: 'OLIVERA, DANA, 38',        nombre: 'Dana Olivera' },
  'reynoso':   { pass: '1234', vendedor: 'REYNOSO, MARCELA 39',      nombre: 'Marcela Reynoso' },
  'rios':      { pass: '1234', vendedor: 'RIOS, ANA, 40',            nombre: 'Ana Rios' },
};

let DB = { clientes: [], sin_vender: [], avance: [] };

function cargarExcel() {
  try {
    const wb = XLSX.readFile(path.join(__dirname, 'Sumi_.xlsx'));
    const ws = wb.Sheets['Sumi UF'];
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const h = raw[6];
    const safeNum = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
    DB.clientes = raw.slice(7).filter(r => r[0]).map(r => ({
      cod:       String(r[h.indexOf('COD.CL')]||'').replace('.0',''),
      razon:     String(r[h.indexOf('RAZON SOCIAL')]||'').trim(),
      dir:       String(r[h.indexOf('DIRECCION')]||'').trim(),
      loc:       String(r[h.indexOf('LOCALIDAD')]||'').trim(),
      vendedor:  String(r[h.indexOf('VENDEDOR')]||'').trim(),
      cluster:   String(r[h.indexOf('CLUSTER')]||'').trim(),
      dia:       String(r[h.indexOf('DIA DE VISITA')]||'').trim(),
      kg:        safeNum(r[h.indexOf('KG ACUM.')]),
      sku:       safeNum(r[h.indexOf('CANT. SKU')]),
      finita:    safeNum(r[h.indexOf('FINITA')]),
      mediana:   safeNum(r[h.indexOf('MEDIANA')]),
      clasica:   safeNum(r[h.indexOf('CLASICA')]),
      parrillera:safeNum(r[h.indexOf('PARRILLERA')]),
      s230:      safeNum(r[h.indexOf('230GR')]),
      s190:      safeNum(r[h.indexOf('190GR')]),
      sx12:      safeNum(r[h.indexOf('X12')]),
      mila:      safeNum(r[h.indexOf('MILA/NUGG')]),
      faltante:  String(r[h.indexOf('FALTANTE')]||'').trim(),
    }));
    const ws2 = wb.Sheets['CL sin Vender'];
    const raw2 = XLSX.utils.sheet_to_json(ws2, { header: 1 });
    DB.sin_vender = raw2.slice(1).filter(r=>r[0]).map(r=>({
      cod: String(r[0]).replace('.0',''), razon: String(r[1]||'').trim(),
      dir: String(r[2]||'').trim(), loc: String(r[3]||'').trim(),
      vendedor: String(r[4]||'').trim(), dia: String(r[5]||'').trim(),
    }));
    const ws3 = wb.Sheets['Avance xVend.'];
    const raw3 = XLSX.utils.sheet_to_json(ws3, { header: 1 });
    const validV = ['ADARO','AQUINO','CARABAJAL','CHAPARRO','CRISTALDO','DOTTA','LOPEZ','MOLINA','OLIVERA','REYNOSO','RIOS','VALIENTE','VELAZQUEZ'];
    DB.avance = raw3.slice(4).filter(r=>r[1]&&validV.some(v=>String(r[1]).toUpperCase().includes(v))).map(r=>({
      vendedor: String(r[1]).trim(),
      obj_total: safeNum(r[2]), av_total: safeNum(r[3]),
      proyeccion: safeNum(r[4]), pct_total: safeNum(r[5]),
      obj_hamb: safeNum(r[6]), av_hamb: safeNum(r[7]), pct_hamb: safeNum(r[8]),
      obj_salch: safeNum(r[9]), av_salch: safeNum(r[10]), pct_salch: safeNum(r[11]),
      obj_rebo: safeNum(r[12]), av_rebo: safeNum(r[13]), pct_rebo: safeNum(r[14]),
    }));
    console.log(`✅ Excel cargado: ${DB.clientes.length} clientes`);
  } catch(e) { console.error('❌ Error Excel:', e.message); }
}

function getClientesPorVendedor(v) { return DB.clientes.filter(c=>c.vendedor===v); }
function getSinVender(v) { const ap=v.split(',')[0].trim().toUpperCase(); return DB.sin_vender.filter(c=>c.vendedor.toUpperCase().includes(ap)); }
function getAvance(v) { const ap=v.split(',')[0].trim().toUpperCase(); return DB.avance.find(a=>a.vendedor.toUpperCase().includes(ap))||null; }
function pct(v) { return Math.round((v||0)*100)+'%'; }
function kg(v)  { return (Math.round((v||0)*10)/10)+' kg'; }

// ─── CONTEXTO PRE-CALCULADO PARA CLAUDE ──────────────────────
// En vez de mandar la lista cruda y dejar que Claude cuente,
// calculamos los totales en código y los incluimos en el contexto.
function buildContexto(vendedor) {
  const clientes = getClientesPorVendedor(vendedor);
  const sinVender = getSinVender(vendedor);
  const avance = getAvance(vendedor);

  // Pre-calcular filtros para que Claude no tenga que contar
  const stats = {
    total: clientes.length,
    sin_finita:     clientes.filter(c => !c.finita).length,
    sin_mediana:    clientes.filter(c => !c.mediana).length,
    sin_clasica:    clientes.filter(c => !c.clasica).length,
    sin_parrillera: clientes.filter(c => !c.parrillera).length,
    sin_s230:       clientes.filter(c => !c.s230).length,
    sin_s190:       clientes.filter(c => !c.s190).length,
    sin_sx12:       clientes.filter(c => !c.sx12).length,
    sin_mila:       clientes.filter(c => !c.mila).length,
    sin_vender_total: sinVender.length,
  };

  // Lista de clientes con estructura compacta
  const listaClientes = clientes.map(c => ({
    cod: c.cod,
    nombre: c.razon,
    barrio: c.loc,
    cluster: c.cluster,
    dia: c.dia,
    kg: Math.round(c.kg*10)/10,
    sku_activos: c.sku,
    // true = tiene el producto, false = le falta
    tiene: {
      finita: c.finita > 0,
      mediana: c.mediana > 0,
      clasica: c.clasica > 0,
      parrillera: c.parrillera > 0,
      salch_230g: c.s230 > 0,
      salch_190g: c.s190 > 0,
      salch_x12: c.sx12 > 0,
      mila_o_nugg: c.mila > 0,
    },
  }));

  return JSON.stringify({
    vendedor,
    TOTALES_PRECALCULADOS: stats,
    clientes: listaClientes,
    sin_vender: sinVender.map(c=>({ cod:c.cod, nombre:c.razon, barrio:c.loc, dia:c.dia })),
    avance: avance ? {
      kg_vendidos: Math.round(avance.av_total*10)/10,
      objetivo_kg: Math.round(avance.obj_total*10)/10,
      proyeccion_kg: Math.round(avance.proyeccion*10)/10,
      pct_avance: pct(avance.pct_total),
      hamburguesas: { avance: kg(avance.av_hamb), objetivo: kg(avance.obj_hamb), pct: pct(avance.pct_hamb) },
      salchichas:   { avance: kg(avance.av_salch), objetivo: kg(avance.obj_salch), pct: pct(avance.pct_salch) },
      rebozados:    { avance: kg(avance.av_rebo),  objetivo: kg(avance.obj_rebo),  pct: pct(avance.pct_rebo) },
    } : null,
  });
}

// ─── LLAMADA A CLAUDE ─────────────────────────────────────────
async function preguntarClaude(pregunta, contexto, historial) {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) return '⚠️ No está configurada la clave ANTHROPIC_API_KEY en Railway.';

  const systemPrompt = `Sos el asistente de ventas de SuMi Distribuidora. Respondés preguntas de vendedores sobre sus clientes.

IMPORTANTE: El JSON contiene un campo "TOTALES_PRECALCULADOS" con conteos exactos ya calculados por el sistema. 
Cuando te pregunten "cuántos clientes les falta X", SIEMPRE usá esos valores precalculados, no cuentes vos mismo.

Categorías de productos:
- Hamburguesas: Finita, Mediana, Clásica, Parrillera
- Salchichas: 230g, 190g, x12
- Rebozados: Milanesas/Nuggets (campo mila_o_nugg)

En el campo "tiene", true = el cliente YA tiene ese producto, false = le FALTA.

Reglas de respuesta:
- Respondé en español, conciso y útil para WhatsApp
- Usá emojis para hacer la respuesta más legible
- Para listas de clientes, mostrá máximo 10. Si hay más, indicá el total
- Nunca inventes datos que no estén en el JSON
- Para preguntas de conteo, usá SIEMPRE TOTALES_PRECALCULADOS

Datos del vendedor:
${contexto}`;

  const messages = [...historial, { role: 'user', content: pregunta }];

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      }),
    });
    const data = await res.json();
    if (data.error) { console.error('Claude error:', data.error); return '⚠️ Error al consultar la IA. Intentá de nuevo.'; }
    return data.content[0].text;
  } catch(e) {
    console.error('Fetch error:', e.message);
    return '⚠️ No pude conectarme con la IA. Intentá de nuevo.';
  }
}

// ─── SESIONES ─────────────────────────────────────────────────
const sesiones = {};
function getSesion(tel) {
  if (!sesiones[tel]) sesiones[tel] = { estado: 'inicio', historial: [] };
  return sesiones[tel];
}

// ─── WEBHOOK ──────────────────────────────────────────────────
app.post('/webhook', async (req, res) => {
  const from = (req.body.From||'').replace('whatsapp:','');
  const texto = (req.body.Body||'').trim();
  const s = getSesion(from);
  const msg = texto.toLowerCase();
  let respuesta = '';

  if (s.estado === 'inicio' || msg === 'hola' || msg === 'start') {
    s.estado = 'esperando_usuario'; s.historial = [];
    respuesta = '👋 Bienvenido al sistema de consultas *SuMi Distribuidora*.\n\nIngresá tu *usuario*:';
  }
  else if (s.estado === 'esperando_usuario') {
    const user = msg.replace(/\s/g,'');
    if (USUARIOS[user]) { s.usuario = user; s.estado = 'esperando_pass'; respuesta = '🔑 Ingresá tu *contraseña*:'; }
    else respuesta = '❌ Usuario no encontrado. Intentá de nuevo:';
  }
  else if (s.estado === 'esperando_pass') {
    const u = USUARIOS[s.usuario];
    if (msg === u.pass) {
      s.vendedor = u.vendedor; s.nombre = u.nombre;
      s.estado = 'chat'; s.historial = [];
      s.contexto = buildContexto(u.vendedor);
      respuesta = `✅ *Bienvenido, ${u.nombre}!*\n\n🤖 Podés preguntarme lo que quieras. Por ejemplo:\n\n• _¿A qué clientes les falta hamburguesa finita?_\n• _¿Cómo voy contra el objetivo?_\n• _¿Cuántos clientes no compraron esta semana?_\n• _Dame info de Chen Liyun_\n• _¿Qué clientes tengo los jueves en Palermo?_\n\nEscribí *salir* para cerrar sesión.`;
    } else {
      s.estado = 'inicio'; s.usuario = null;
      respuesta = '❌ Contraseña incorrecta. Escribí *hola* para intentar de nuevo.';
    }
  }
  else if (msg === 'salir' || msg === '0' || msg === 'logout') {
    const nombre = s.nombre;
    sesiones[from] = { estado: 'inicio', historial: [] };
    respuesta = `👋 Hasta luego, *${nombre}*! Sesión cerrada.`;
  }
  else if (s.estado === 'chat' && s.vendedor) {
    s.historial.push({ role: 'user', content: texto });
    if (s.historial.length > 6) s.historial = s.historial.slice(-6);
    respuesta = await preguntarClaude(texto, s.contexto, s.historial.slice(0,-1));
    s.historial.push({ role: 'assistant', content: respuesta });
    if (s.historial.length > 6) s.historial = s.historial.slice(-6);
  }
  else {
    s.estado = 'inicio';
    respuesta = '👋 Escribí *hola* para empezar.';
  }

  console.log(`📩 [${from}]: ${texto}`);
  console.log(`📤 → ${respuesta.slice(0,100)}`);
  const twiml = new twilio.twiml.MessagingResponse();
  twiml.message(respuesta);
  res.type('text/xml').send(twiml.toString());
});

cargarExcel();
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Bot SuMi con IA en puerto ${PORT}`));
