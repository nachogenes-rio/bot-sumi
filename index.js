const express = require('express');
const twilio = require('twilio');
const XLSX = require('xlsx');
const path = require('path');

const app = express();
app.use(express.urlencoded({ extended: false }));

// ─── CONFIGURACIÓN ───────────────────────────────────────────
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN  = process.env.TWILIO_AUTH_TOKEN;

// Usuarios y contraseñas de los vendedores
const USUARIOS = {
  'aquino':       { pass: '1234', vendedor: 'AQUINO, JONATAN, 30',      nombre: 'Jonatan Aquino' },
  'cristaldo':    { pass: '5678', vendedor: 'CRISTALDO, CLAUDIA, 31',   nombre: 'Claudia Cristaldo' },
  'lopez':        { pass: '1234', vendedor: 'LOPEZ, DANIELA, 32',       nombre: 'Daniela Lopez' },
  'molina':       { pass: '1234', vendedor: 'MOLINA, TOMAS, 34',        nombre: 'Tomas Molina' },
  'adaro':        { pass: '1234', vendedor: 'ADARO, ALBERTO, 41',       nombre: 'Alberto Adaro' },
  'carabajal':    { pass: '1234', vendedor: 'CARABAJAL, SANDRA, 42',    nombre: 'Sandra Carabajal' },
  'chaparro':     { pass: '1234', vendedor: 'CHAPARRO, BETIANA, 43',    nombre: 'Betiana Chaparro' },
  'dotta':        { pass: '1234', vendedor: 'DOTTA, MAXIMILIANO, 44',   nombre: 'Maximiliano Dotta' },
  'valiente':     { pass: '1234', vendedor: 'VALIENTE, ALEJANDRO, 46',  nombre: 'Alejandro Valiente' },
  'velazquez':    { pass: '1234', vendedor: 'VELAZQUEZ, ALEJANDRA, 36', nombre: 'Alejandra Velazquez' },
  'olivera':      { pass: '1234', vendedor: 'OLIVERA, DANA, 38',        nombre: 'Dana Olivera' },
  'reynoso':      { pass: '1234', vendedor: 'REYNOSO, MARCELA 39',      nombre: 'Marcela Reynoso' },
  'rios':         { pass: '1234', vendedor: 'RIOS, ANA, 40',            nombre: 'Ana Rios' },
};

// ─── CARGA DE DATOS DESDE EXCEL ─────────────────────────────
let DB = { clientes: [], sin_vender: [], avance: [], flia: [] };

function cargarExcel() {
  try {
    const filePath = path.join(__dirname, 'Sumi_.xlsx');
    const wb = XLSX.readFile(filePath);

    // Hoja principal: Sumi UF
    const ws = wb.Sheets['Sumi UF'];
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const headers = raw[6];
    DB.clientes = raw.slice(7)
      .filter(r => r[0])
      .map(r => ({
        cod:       String(r[headers.indexOf('COD.CL')] || '').replace('.0',''),
        razon:     String(r[headers.indexOf('RAZON SOCIAL')] || '').trim(),
        dir:       String(r[headers.indexOf('DIRECCION')] || '').trim(),
        loc:       String(r[headers.indexOf('LOCALIDAD')] || '').trim(),
        vendedor:  String(r[headers.indexOf('VENDEDOR')] || '').trim(),
        cluster:   String(r[headers.indexOf('CLUSTER')] || '').trim(),
        dia:       String(r[headers.indexOf('DIA DE VISITA')] || '').trim(),
        kg:        parseFloat(r[headers.indexOf('KG ACUM.')] || 0) || 0,
        sku:       parseFloat(r[headers.indexOf('CANT. SKU')] || 0) || 0,
        finita:    parseFloat(r[headers.indexOf('FINITA')] || 0) || 0,
        mediana:   parseFloat(r[headers.indexOf('MEDIANA')] || 0) || 0,
        clasica:   parseFloat(r[headers.indexOf('CLASICA')] || 0) || 0,
        parrillera:parseFloat(r[headers.indexOf('PARRILLERA')] || 0) || 0,
        s230:      parseFloat(r[headers.indexOf('230GR')] || 0) || 0,
        s190:      parseFloat(r[headers.indexOf('190GR')] || 0) || 0,
        sx12:      parseFloat(r[headers.indexOf('X12')] || 0) || 0,
        mila:      parseFloat(r[headers.indexOf('MILA/NUGG')] || 0) || 0,
        faltante:  String(r[headers.indexOf('FALTANTE')] || '').trim(),
      }));

    // Hoja: CL sin Vender
    const ws2 = wb.Sheets['CL sin Vender'];
    const raw2 = XLSX.utils.sheet_to_json(ws2, { header: 1 });
    DB.sin_vender = raw2.slice(1).filter(r => r[0]).map(r => ({
      cod: String(r[0]).replace('.0',''), razon: String(r[1]||'').trim(),
      dir: String(r[2]||'').trim(), loc: String(r[3]||'').trim(),
      vendedor: String(r[4]||'').trim(), dia: String(r[5]||'').trim(),
    }));

    // Hoja: Avance xVend.
    const ws3 = wb.Sheets['Avance xVend.'];
    const raw3 = XLSX.utils.sheet_to_json(ws3, { header: 1 });
    const validVendors = ['ADARO','AQUINO','CARABAJAL','CHAPARRO','CRISTALDO','DOTTA','FORMENTE','LOPEZ','MOLINA','OLIVERA','MUNOZ','REYNOSO','RIOS','VALIENTE','VELAZQUEZ','PEREZ'];
    DB.avance = raw3.slice(4)
      .filter(r => r[1] && validVendors.some(v => String(r[1]).toUpperCase().includes(v)))
      .map(r => ({
        vendedor:    String(r[1]).trim(),
        obj_total:   parseFloat(r[2]) || 0,
        av_total:    parseFloat(r[3]) || 0,
        proyeccion:  parseFloat(r[4]) || 0,
        pct_total:   parseFloat(r[5]) || 0,
        obj_hamb:    parseFloat(r[6]) || 0,
        av_hamb:     parseFloat(r[7]) || 0,
        pct_hamb:    parseFloat(r[8]) || 0,
        obj_salch:   parseFloat(r[9]) || 0,
        av_salch:    parseFloat(r[10]) || 0,
        pct_salch:   parseFloat(r[11]) || 0,
        obj_rebo:    parseFloat(r[12]) || 0,
        av_rebo:     parseFloat(r[13]) || 0,
        pct_rebo:    parseFloat(r[14]) || 0,
      }));

    // Hoja: Flia SuMi xVend.
    const ws4 = wb.Sheets['Flia SuMi xVend.'];
    const raw4 = XLSX.utils.sheet_to_json(ws4, { header: 1 });
    DB.flia = raw4.slice(3).filter(r => r[0] && String(r[0]).trim() !== 'nan').map(r => ({
      vendedor:  String(r[0]).trim(),
      finita:    parseFloat(r[1]) || 0,
      mediana:   parseFloat(r[2]) || 0,
      clasica:   parseFloat(r[3]) || 0,
      parrillera:parseFloat(r[4]) || 0,
      s230:      parseFloat(r[5]) || 0,
      s190:      parseFloat(r[6]) || 0,
      sx12:      parseFloat(r[7]) || 0,
      nuggets:   parseFloat(r[8]) || 0,
      milanesas: parseFloat(r[9]) || 0,
    }));

    console.log(`✅ Excel cargado: ${DB.clientes.length} clientes, ${DB.sin_vender.length} sin vender`);
  } catch (e) {
    console.error('❌ Error cargando Excel:', e.message);
  }
}

// ─── HELPERS ────────────────────────────────────────────────
function getClientesPorVendedor(vendedor) {
  return DB.clientes.filter(c => c.vendedor === vendedor);
}
function getSinVenderPorVendedor(vendedor) {
  const apellido = vendedor.split(',')[0].trim().toUpperCase();
  return DB.sin_vender.filter(c => c.vendedor.toUpperCase().includes(apellido));
}
function getAvance(vendedor) {
  const apellido = vendedor.split(',')[0].trim().toUpperCase();
  return DB.avance.find(a => a.vendedor.toUpperCase().includes(apellido)) || null;
}
function getFlia(vendedor) {
  const apellido = vendedor.split(',')[0].trim().toUpperCase();
  return DB.flia.find(f => f.vendedor.toUpperCase().includes(apellido)) || null;
}
function pct(v) { return Math.round((v||0)*100) + '%'; }
function kg(v)  { return Math.round((v||0)*10)/10 + ' kg'; }

// ─── SESIONES EN MEMORIA ─────────────────────────────────────
// { telefono: { estado, usuario, vendedor, nombre, busqueda } }
const sesiones = {};

function getSesion(tel) {
  if (!sesiones[tel]) sesiones[tel] = { estado: 'inicio' };
  return sesiones[tel];
}

// ─── MENU PRINCIPAL ──────────────────────────────────────────
function menuPrincipal(nombre) {
  return `✅ *Bienvenido, ${nombre}!*\n\n¿Qué querés consultar?\n\n1️⃣ Mi avance vs objetivo\n2️⃣ Clientes sin vender\n3️⃣ Buscar cliente\n4️⃣ Filtrar por cluster\n5️⃣ Faltantes de un cliente\n0️⃣ Cerrar sesión`;
}

// ─── LÓGICA DEL BOT ──────────────────────────────────────────
function procesarMensaje(tel, texto) {
  const s = getSesion(tel);
  const msg = texto.trim().toLowerCase();

  // ── Estado: inicio ──
  if (s.estado === 'inicio') {
    s.estado = 'esperando_usuario';
    return '👋 Bienvenido al sistema de consultas *SuMi Distribuidora*.\n\nIngresá tu *usuario*:';
  }

  // ── Estado: esperando usuario ──
  if (s.estado === 'esperando_usuario') {
    const user = msg.replace(/\s/g,'');
    if (USUARIOS[user]) {
      s.usuario = user;
      s.estado = 'esperando_pass';
      return '🔑 Ingresá tu *contraseña*:';
    }
    return '❌ Usuario no encontrado. Intentá de nuevo:';
  }

  // ── Estado: esperando contraseña ──
  if (s.estado === 'esperando_pass') {
    const u = USUARIOS[s.usuario];
    if (msg === u.pass) {
      s.vendedor = u.vendedor;
      s.nombre = u.nombre;
      s.estado = 'menu';
      return menuPrincipal(u.nombre);
    }
    s.estado = 'inicio';
    s.usuario = null;
    return '❌ Contraseña incorrecta. Escribí *hola* para intentar de nuevo.';
  }

  // ── Si no está logueado ──
  if (s.estado !== 'menu' && s.estado !== 'buscando_cliente' && s.estado !== 'buscando_cluster') {
    s.estado = 'inicio';
    return procesarMensaje(tel, texto);
  }

  // ── Opción 0: cerrar sesión ──
  if (msg === '0' || msg === 'salir' || msg === 'logout') {
    const nombre = s.nombre;
    sesiones[tel] = { estado: 'inicio' };
    return `👋 Hasta luego, *${nombre}*! Sesión cerrada.`;
  }

  // ── Opción 1: avance ──
  if (msg === '1' || msg.includes('avance') || msg.includes('objetivo')) {
    const av = getAvance(s.vendedor);
    if (!av) return '⚠️ No encontré datos de avance para tu usuario.';
    const falta = av.obj_total - av.av_total;
    return `📊 *${s.nombre} — Avance Marzo 2026*\n\n` +
      `📦 KG vendidos: *${kg(av.av_total)}*\n` +
      `🎯 Objetivo: *${kg(av.obj_total)}*\n` +
      `📈 Proyección: *${kg(av.proyeccion)}*\n` +
      `✅ Avance: *${pct(av.pct_total)}*\n\n` +
      `*Por categoría:*\n` +
      `🍔 Hamburguesas: ${pct(av.pct_hamb)} (${kg(av.av_hamb)} / ${kg(av.obj_hamb)})\n` +
      `🌭 Salchichas: ${pct(av.pct_salch)} (${kg(av.av_salch)} / ${kg(av.obj_salch)})\n` +
      `🍗 Rebozados: ${pct(av.pct_rebo)} (${kg(av.av_rebo)} / ${kg(av.obj_rebo)})\n\n` +
      `💡 Te faltan *${kg(falta)}* para cumplir el objetivo.\n\nEscribí *menu* para volver.`;
  }

  // ── Opción 2: sin vender ──
  if (msg === '2' || msg.includes('sin vender') || msg.includes('no compraron')) {
    const sv = getSinVenderPorVendedor(s.vendedor);
    if (!sv.length) return '✅ ¡No tenés clientes sin vender esta semana!';
    const dias = ['LUNES','MARTES','MIERCOLES','JUEVES','VIERNES'];
    let resp = `🚫 *Clientes sin vender — ${s.nombre}*\nTotal: *${sv.length} clientes*\n\n`;
    for (const dia of dias) {
      const grupo = sv.filter(c => c.dia && c.dia.toUpperCase() === dia);
      if (grupo.length) {
        resp += `*${dia}* (${grupo.length}):\n`;
        grupo.slice(0,5).forEach(c => { resp += `• ${c.razon} — ${c.loc}\n`; });
        if (grupo.length > 5) resp += `  ...y ${grupo.length-5} más\n`;
        resp += '\n';
      }
    }
    resp += 'Escribí *menu* para volver.';
    return resp;
  }

  // ── Helper: mostrar ficha completa de un cliente ──
  function fichaCliente(c, mostrarFaltantes) {
    const faltantes = [];
    if (!c.finita) faltantes.push('Finita (hamb.)');
    if (!c.mediana) faltantes.push('Mediana (hamb.)');
    if (!c.clasica) faltantes.push('Clásica (hamb.)');
    if (!c.parrillera) faltantes.push('Parrillera (hamb.)');
    if (!c.s230) faltantes.push('Salch. 230g');
    if (!c.s190) faltantes.push('Salch. 190g');
    if (!c.sx12) faltantes.push('Salch. x12');
    if (!c.mila) faltantes.push('Mila/Nuggets');
    let resp = `📋 *${c.razon}*\n\n` +
      `📍 ${c.dir}, ${c.loc}\n` +
      `🏷️ Cluster: ${c.cluster}\n` +
      `📅 Día de visita: ${c.dia}\n` +
      `📦 KG acumulados: *${kg(c.kg)}*\n` +
      `🛒 SKUs activos: ${c.sku}/7\n\n`;
    if (faltantes.length) {
      resp += `❌ *Productos faltantes (${faltantes.length}):*\n`;
      faltantes.forEach(f => { resp += `  • ${f}\n`; });
    } else {
      resp += `✅ Cartera completa`;
    }
    resp += '\n\nEscribí *menu* para volver.';
    return resp;
  }

  // ── Búsqueda directa: "faltantes de X" o "buscar X" o "cliente X" ──
  const patronBusqueda = /(?:faltantes?\s+de|buscar?|cliente|ver|info(?:rmacion)?(?:\s+de)?)\s+(.+)/i;
  const matchBusqueda = texto.trim().match(patronBusqueda);
  if (matchBusqueda) {
    const q = matchBusqueda[1].trim().toUpperCase();
    const clientes = getClientesPorVendedor(s.vendedor);
    const res = clientes.filter(c =>
      c.razon.toUpperCase().includes(q) ||
      c.cod === q ||
      c.dir.toUpperCase().includes(q)
    );
    if (res.length === 1) return fichaCliente(res[0]);
    if (res.length > 1) {
      let resp = `🔍 Encontré *${res.length} clientes* con "${matchBusqueda[1]}":\n\n`;
      res.slice(0,8).forEach(c => { resp += `• *${c.cod}* — ${c.razon} (${c.loc})\n`; });
      if (res.length > 8) resp += `...y ${res.length-8} más.\n`;
      resp += '\nEscribí el nombre más exacto o el código para ver el detalle.';
      return resp;
    }
    // Si no encontró nada, seguir con el flujo normal
  }

  // ── Opción 3: buscar cliente ──
  if (msg === '3' || msg === 'buscar') {
    s.estado = 'buscando_cliente';
    return '🔍 ¿Qué cliente buscás? Podés ingresar:\n• Nombre o razón social\n• Código de cliente\n• Dirección';
  }

  if (s.estado === 'buscando_cliente') {
    const clientes = getClientesPorVendedor(s.vendedor);
    const q = msg.toUpperCase();
    const res = clientes.filter(c =>
      c.razon.toUpperCase().includes(q) ||
      c.cod.includes(q) ||
      c.dir.toUpperCase().includes(q)
    );
    s.estado = 'menu';
    if (!res.length) return '❌ No encontré clientes con ese criterio.\n\nEscribí *menu* para volver.';
    if (res.length === 1) return fichaCliente(res[0]);
    let resp = `🔍 Encontré *${res.length} clientes*:\n\n`;
    res.slice(0,8).forEach(c => { resp += `• *${c.cod}* — ${c.razon} (${c.loc})\n`; });
    if (res.length > 8) resp += `...y ${res.length-8} más.\n`;
    resp += '\nEscribí el nombre más exacto o el código para ver el detalle.';
    return resp;
  }

  // ── Opción 4: cluster ──
  if (msg === '4' || msg === 'cluster') {
    s.estado = 'buscando_cluster';
    const clientes = getClientesPorVendedor(s.vendedor);
    const clusters = [...new Set(clientes.map(c=>c.cluster).filter(Boolean))].sort();
    return `🏷️ *Filtrar por cluster*\n\nTus clusters disponibles:\n${clusters.map((c,i)=>`${i+1}. ${c}`).join('\n')}\n\nEscribí el nombre del cluster (ej: *autoservicio*):`;
  }

  if (s.estado === 'buscando_cluster') {
    const clientes = getClientesPorVendedor(s.vendedor);
    const q = msg.toUpperCase();
    const res = clientes.filter(c => c.cluster.toUpperCase().includes(q));
    s.estado = 'menu';
    if (!res.length) return '❌ No encontré clientes en ese cluster.\n\nEscribí *menu* para volver.';
    const totalKg = res.reduce((a,c) => a+c.kg, 0);
    let resp = `🏷️ *${res[0].cluster}* — ${s.nombre}\n\n`;
    resp += `Total: *${res.length} clientes* | *${kg(totalKg)}*\n\n`;
    res.slice(0,10).forEach(c => { resp += `• ${c.razon} — ${kg(c.kg)}\n`; });
    if (res.length > 10) resp += `...y ${res.length-10} más.\n`;
    resp += '\nEscribí *menu* para volver.';
    return resp;
  }

  // ── Opción 5: faltantes generales ──
  if (msg === '5' || msg === 'faltantes' || msg === 'faltante') {
    const clientes = getClientesPorVendedor(s.vendedor);
    const conFaltantes = clientes.filter(c => c.faltante && c.faltante !== 'nan' && c.sku < 7);
    if (!conFaltantes.length) return '✅ Todos tus clientes tienen la cartera completa.';
    let resp = `📦 *Clientes con productos faltantes*\nTotal: *${conFaltantes.length}*\n\n`;
    conFaltantes.slice(0,10).forEach(c => {
      resp += `• *${c.razon}*\n  ❌ ${c.faltante.replace(/\+/g,', ')}\n`;
    });
    if (conFaltantes.length > 10) resp += `\n...y ${conFaltantes.length-10} más.`;
    resp += '\n\n💡 Para ver el detalle de un cliente escribí:\n*faltantes de [nombre]*\n\nEscribí *menu* para volver.';
    return resp;
  }

  // ── Menu / ayuda ──
  if (msg === 'menu' || msg === 'inicio' || msg === 'hola' || msg === 'help') {
    s.estado = 'menu';
    return menuPrincipal(s.nombre);
  }

  return `No entendí ese comando 🤔\n\n${menuPrincipal(s.nombre)}`;
}

// ─── WEBHOOK DE TWILIO ────────────────────────────────────────
app.post('/webhook', (req, res) => {
  const from = req.body.From || '';
  const body = req.body.Body || '';
  const tel  = from.replace('whatsapp:', '');

  console.log(`📩 [${tel}]: ${body}`);

  const respuesta = procesarMensaje(tel, body);

  console.log(`📤 Respondiendo: ${respuesta.slice(0,80)}...`);

  const twiml = new twilio.twiml.MessagingResponse();
  twiml.message(respuesta);
  res.type('text/xml').send(twiml.toString());
});

// ─── INICIO ──────────────────────────────────────────────────
cargarExcel();
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Bot SuMi corriendo en puerto ${PORT}`));
