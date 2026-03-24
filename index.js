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
    DB.clientes = raw.slice(7).filter(r => r[0]).map(r => ({
      cod:       String(r[h.indexOf('COD.CL')]||'').replace('.0',''),
      razon:     String(r[h.indexOf('RAZON SOCIAL')]||'').trim(),
      dir:       String(r[h.indexOf('DIRECCION')]||'').trim(),
      loc:       String(r[h.indexOf('LOCALIDAD')]||'').trim(),
      vendedor:  String(r[h.indexOf('VENDEDOR')]||'').trim(),
      cluster:   String(r[h.indexOf('CLUSTER')]||'').trim(),
      dia:       String(r[h.indexOf('DIA DE VISITA')]||'').trim(),
      kg:        parseFloat(r[h.indexOf('KG ACUM.')]||0)||0,
      sku:       parseFloat(r[h.indexOf('CANT. SKU')]||0)||0,
      finita:    parseFloat(r[h.indexOf('FINITA')]||0)||0,
      mediana:   parseFloat(r[h.indexOf('MEDIANA')]||0)||0,
      clasica:   parseFloat(r[h.indexOf('CLASICA')]||0)||0,
      parrillera:parseFloat(r[h.indexOf('PARRILLERA')]||0)||0,
      s230:      parseFloat(r[h.indexOf('230GR')]||0)||0,
      s190:      parseFloat(r[h.indexOf('190GR')]||0)||0,
      sx12:      parseFloat(r[h.indexOf('X12')]||0)||0,
      mila:      parseFloat(r[h.indexOf('MILA/NUGG')]||0)||0,
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
      obj_total: parseFloat(r[2])||0, av_total: parseFloat(r[3])||0,
      proyeccion: parseFloat(r[4])||0, pct_total: parseFloat(r[5])||0,
      obj_hamb: parseFloat(r[6])||0, av_hamb: parseFloat(r[7])||0, pct_hamb: parseFloat(r[8])||0,
      obj_salch: parseFloat(r[9])||0, av_salch: parseFloat(r[10])||0, pct_salch: parseFloat(r[11])||0,
      obj_rebo: parseFloat(r[12])||0, av_rebo: parseFloat(r[13])||0, pct_rebo: parseFloat(r[14])||0,
    }));
    console.log(`✅ Excel cargado: ${DB.clientes.length} clientes`);
  } catch(e) { console.error('❌ Error Excel:', e.message); }
}

function getClientesPorVendedor(v) { return DB.clientes.filter(c=>c.vendedor===v); }
function getSinVender(v) {
  // v = "MOLINA, TOMAS, 34" → extraer apellido y nombre para buscar en formato "MOLINA TOMAS"
  const partes = v.split(',').map(p=>p.trim().toUpperCase());
  const apellido = partes[0];
  const nombre = partes[1] || '';
  return DB.sin_vender.filter(c => {
    const vUpper = c.vendedor.toUpperCase();
    return vUpper.includes(apellido) && (!nombre || vUpper.includes(nombre));
  });
}
function getAvance(v) {
  const partes = v.split(',').map(p=>p.trim().toUpperCase());
  const apellido = partes[0];
  const nombre = partes[1] || '';
  return DB.avance.find(a => {
    const aUpper = a.vendedor.toUpperCase();
    return aUpper.includes(apellido) && (!nombre || aUpper.includes(nombre));
  }) || null;
}
function pct(v) { return Math.round((v||0)*100)+'%'; }
function kg(v)  { return (Math.round((v||0)*10)/10)+' kg'; }

// ─── CONTEXTO DE DATOS PARA CLAUDE ───────────────────────────
function buildContexto(vendedor) {
  const clientes = getClientesPorVendedor(vendedor);
  const sinVender = getSinVender(vendedor);
  const avance = getAvance(vendedor);

  // Resumen compacto para no exceder tokens
  const resumenClientes = clientes.map(c => ({
    cod: c.cod, nombre: c.razon, barrio: c.loc, cluster: c.cluster,
    dia: c.dia, kg: Math.round(c.kg*10)/10, sku: c.sku,
    hamburguesas: { finita: !!c.finita, mediana: !!c.mediana, clasica: !!c.clasica, parrillera: !!c.parrillera },
    salchichas: { s230: !!c.s230, s190: !!c.s190, x12: !!c.sx12 },
    rebozados: { milaOrNugg: !!c.mila },
    faltantes: c.faltante && c.faltante !== 'nan' ? c.faltante.replace(/\+/g,', ') : null,
  }));

  return JSON.stringify({
    vendedor,
    clientes: resumenClientes,
    sin_vender: sinVender.map(c=>({ cod:c.cod, nombre:c.razon, barrio:c.loc, dia:c.dia })),
    avance: avance ? {
      kg_vendidos: Math.round(avance.av_total*10)/10,
      objetivo: Math.round(avance.obj_total*10)/10,
      proyeccion: Math.round(avance.proyeccion*10)/10,
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
  if (!ANTHROPIC_API_KEY) return '⚠️ No está configurada la clave de Claude (ANTHROPIC_API_KEY).';

  const systemPrompt = `Sos el asistente de ventas de SuMi Distribuidora. Respondés preguntas de vendedores sobre sus clientes.

Tenés acceso a los datos reales del vendedor en formato JSON. Usá SOLO esa información para responder.

Categorías de productos:
- Hamburguesas: Finita, Mediana, Clásica, Parrillera
- Salchichas: 230g, 190g, x12
- Rebozados: Milanesas/Nuggets

Reglas:
- Respondé en español, de forma concisa y útil
- Usá emojis para hacer la respuesta más legible en WhatsApp
- Si te preguntan por clientes con/sin un producto, filtrá los datos y listá los resultados
- Máximo 10 clientes por lista para no saturar el mensaje
- Si hay más de 10, indicá cuántos hay en total
- Nunca inventes datos que no estén en el JSON
- Si no encontrás la info, decilo claramente

Datos del vendedor:
${contexto}`;

  const messages = [
    ...historial,
    { role: 'user', content: pregunta }
  ];

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'messages-2023-12-15',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      }),
    });
    const data = await res.json();
    if (data.error) { console.error('Claude error:', JSON.stringify(data.error)); return '⚠️ Error al consultar la IA. Intentá de nuevo.'; }
    if (!data.content || !data.content[0]) { console.error('Claude respuesta vacía:', JSON.stringify(data)); return '⚠️ Respuesta vacía de la IA.'; }
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

  console.log(`📩 [${from}]: ${texto}`);

  let respuesta = '';

  // ── Login ──
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
      respuesta = `✅ *Bienvenido, ${u.nombre}!*\n\n🤖 Podés preguntarme lo que quieras sobre tus clientes. Por ejemplo:\n\n• _¿A qué clientes les falta hamburguesa finita?_\n• _¿Cómo voy contra el objetivo?_\n• _¿Cuántos clientes no compraron esta semana?_\n• _Dame info de Chen Liyun_\n• _¿Qué clientes tengo los jueves?_\n\nEscribí *salir* para cerrar sesión.`;
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
    // Mantener historial de conversación (últimos 6 mensajes)
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

  console.log(`📤 → ${respuesta.slice(0,100)}`);
  const twiml = new twilio.twiml.MessagingResponse();
  twiml.message(respuesta);
  res.type('text/xml').send(twiml.toString());
});

cargarExcel();
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Bot SuMi con IA en puerto ${PORT}`));
