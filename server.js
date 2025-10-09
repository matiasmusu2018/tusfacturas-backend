// server.js - VERSIÓN CON PERSISTENCIA EN JSONBIN.IO
const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: ['https://tusfacturasapp.netlify.app', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

const TUSFACTURAS_BASE_URL = 'https://www.tusfacturas.app/app/api/v2';
const API_KEY = process.env.API_KEY || '68567';
const API_TOKEN = process.env.TUSFACTURAS_API_TOKEN || '6aa4e9bbe67eb7d8a05b28ea378ef55f';
const USER_TOKEN = process.env.USER_TOKEN || 'd527102f84b9a161f7f6ccbee824834610035e0a4a56c07c94f7afa4d0545244';

// JSONBin.io Configuration
const JSONBIN_API_KEY = process.env.JSONBIN_API_KEY;
const JSONBIN_CLIENTES_BIN_ID = process.env.JSONBIN_CLIENTES_BIN_ID;
const JSONBIN_TEMPLATES_BIN_ID = process.env.JSONBIN_TEMPLATES_BIN_ID;
const JSONBIN_BASE_URL = 'https://api.jsonbin.io/v3';

console.log('🚀 Servidor TusFacturas - PRODUCCIÓN CON JSONBin.io');
console.log('📄 API v2: developers.tusfacturas.app');
console.log('☁️  Persistencia: JSONBin.io');

// ═══════════════════════════════════════════════════════════════
// SISTEMA DE PERSISTENCIA CON JSONBIN.IO
// ═══════════════════════════════════════════════════════════════

// Cache en memoria (evita llamadas excesivas a JSONBin)
let clientesCache = [];
let templatesCache = [];
let lastClientesFetch = 0;
let lastTemplatesFetch = 0;
const CACHE_TTL = 5000; // 5 segundos

// Headers para JSONBin
const getJSONBinHeaders = () => ({
  'Content-Type': 'application/json',
  'X-Master-Key': JSONBIN_API_KEY
});

// Leer datos de un bin
const leerBin = async (binId, tipo) => {
  try {
    console.log(`📥 Leyendo ${tipo} desde JSONBin...`);
    const response = await axios.get(
      `${JSONBIN_BASE_URL}/b/${binId}/latest`,
      { 
        headers: getJSONBinHeaders(),
        timeout: 10000 
      }
    );
    
    const datos = response.data.record;
    console.log(`✅ ${tipo} cargados: ${datos.length} registros`);
    return Array.isArray(datos) ? datos : [];
    
  } catch (error) {
    console.error(`❌ Error leyendo ${tipo}:`, error.message);
    if (error.response?.status === 404) {
      console.log(`📝 Bin no encontrado, inicializando ${tipo}...`);
      return [];
    }
    throw error;
  }
};

// Guardar datos en un bin
const guardarBin = async (binId, datos, tipo) => {
  try {
    console.log(`💾 Guardando ${tipo} en JSONBin (${datos.length} registros)...`);
    
    const response = await axios.put(
      `${JSONBIN_BASE_URL}/b/${binId}`,
      datos,
      { 
        headers: getJSONBinHeaders(),
        timeout: 10000 
      }
    );
    
    console.log(`✅ ${tipo} guardados exitosamente`);
    return true;
    
  } catch (error) {
    console.error(`❌ Error guardando ${tipo}:`, error.message);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data:`, error.response.data);
    }
    return false;
  }
};

// Funciones con cache
const obtenerClientes = async (forzarRecarga = false) => {
  const ahora = Date.now();
  
  if (!forzarRecarga && clientesCache.length > 0 && (ahora - lastClientesFetch) < CACHE_TTL) {
    console.log('📦 Usando cache de clientes');
    return clientesCache;
  }
  
  clientesCache = await leerBin(JSONBIN_CLIENTES_BIN_ID, 'clientes');
  lastClientesFetch = ahora;
  return clientesCache;
};

const obtenerTemplates = async (forzarRecarga = false) => {
  const ahora = Date.now();
  
  if (!forzarRecarga && templatesCache.length > 0 && (ahora - lastTemplatesFetch) < CACHE_TTL) {
    console.log('📦 Usando cache de templates');
    return templatesCache;
  }
  
  templatesCache = await leerBin(JSONBIN_TEMPLATES_BIN_ID, 'templates');
  lastTemplatesFetch = ahora;
  return templatesCache;
};

// Inicialización: cargar datos al arrancar
const inicializarDatos = async () => {
  try {
    console.log('\n🔄 Cargando datos iniciales desde JSONBin...');
    
    if (!JSONBIN_API_KEY || !JSONBIN_CLIENTES_BIN_ID || !JSONBIN_TEMPLATES_BIN_ID) {
      throw new Error('Faltan variables de entorno de JSONBin (API_KEY o BIN_IDs)');
    }
    
    await Promise.all([
      obtenerClientes(true),
      obtenerTemplates(true)
    ]);
    
    console.log('✅ Datos iniciales cargados correctamente\n');
    
  } catch (error) {
    console.error('❌ Error en inicialización:', error.message);
    console.log('⚠️  El servidor arrancará con datos vacíos\n');
  }
};

// ═══════════════════════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════════════════════

const createBaseRequest = () => ({
  apikey: API_KEY,
  apitoken: API_TOKEN,
  usertoken: USER_TOKEN
});

const formatDate = (date) => {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const round2 = (n) => Number(Number(n || 0).toFixed(2));

const calcularVencimiento = (fechaBase, condicionPago) => {
  const v = new Date(fechaBase);
  const dias = parseInt(condicionPago, 10);
  if (!isNaN(dias) && dias > 0) v.setDate(v.getDate() + dias);
  return v;
};

// ═══════════════════════════════════════════════════════════════
// ENDPOINTS BÁSICOS
// ═══════════════════════════════════════════════════════════════

app.get('/', async (req, res) => {
  const clientes = await obtenerClientes();
  const templates = await obtenerTemplates();
  
  res.json({
    message: 'TusFacturas API - SILVIA MONICA NAHABETIAN',
    status: 'OK',
    timestamp: new Date().toISOString(),
    cuit: '27233141246',
    pdv: '00006',
    modo: 'PRODUCCIÓN CON JSONBin.io',
    clientes_locales: clientes.length,
    templates_guardados: templates.length,
    persistencia: 'JSONBin.io'
  });
});

app.get('/health', async (req, res) => {
  try {
    // Test de conectividad con JSONBin
    await axios.get(
      `${JSONBIN_BASE_URL}/b/${JSONBIN_CLIENTES_BIN_ID}/latest`,
      { 
        headers: getJSONBinHeaders(),
        timeout: 5000 
      }
    );
    
    res.json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      persistencia: 'OK',
      jsonbin: 'conectado'
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      persistencia: 'ERROR',
      jsonbin: 'desconectado',
      error: error.message
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// GESTIÓN DE CLIENTES
// ═══════════════════════════════════════════════════════════════

app.get('/api/clientes', async (req, res) => {
  try {
    const clientes = await obtenerClientes(true); // Forzar recarga
    console.log(`📋 Devolviendo ${clientes.length} clientes`);
    res.json(clientes);
  } catch (error) {
    console.error('❌ Error obteniendo clientes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/clientes/agregar', async (req, res) => {
  try {
    const { cliente } = req.body;
    
    const clientes = await obtenerClientes(true);
    
    const nuevoId = clientes.length > 0 
      ? Math.max(...clientes.map(c => c.id)) + 1 
      : 1;
    
    const clienteNuevo = {
      id: nuevoId,
      nombre: cliente.nombre,
      documento: (cliente.documento || '').replace(/-/g, ''),
      email: cliente.email || '',
      tipo_documento: 'CUIT',
      origen: 'manual',
      fecha_creacion: new Date().toISOString()
    };
    
    const existe = clientes.find(c => c.documento === clienteNuevo.documento);
    if (existe) {
      return res.json({ 
        success: true, 
        message: 'Cliente ya existe', 
        cliente: existe 
      });
    }
    
    clientes.push(clienteNuevo);
    
    const guardado = await guardarBin(JSONBIN_CLIENTES_BIN_ID, clientes, 'clientes');
    
    if (guardado) {
      clientesCache = clientes; // Actualizar cache
      lastClientesFetch = Date.now();
      console.log(`✅ Cliente agregado: ${clienteNuevo.nombre}`);
      res.json({ success: true, cliente: clienteNuevo });
    } else {
      throw new Error('No se pudo guardar el cliente en JSONBin');
    }
    
  } catch (err) {
    console.error('❌ Error agregando cliente:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/clientes/guardar', async (req, res) => {
  try {
    const { clientes } = req.body;
    
    const guardado = await guardarBin(JSONBIN_CLIENTES_BIN_ID, clientes, 'clientes');
    
    if (guardado) {
      clientesCache = clientes;
      lastClientesFetch = Date.now();
      console.log(`💾 ${clientes.length} clientes guardados en JSONBin`);
      res.json({ success: true, total: clientes.length });
    } else {
      throw new Error('No se pudieron guardar los clientes');
    }
  } catch (err) {
    console.error('❌ Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// GESTIÓN DE TEMPLATES
// ═══════════════════════════════════════════════════════════════

app.get('/api/templates', async (req, res) => {
  try {
    const templates = await obtenerTemplates(true);
    console.log(`📊 Devolviendo ${templates.length} templates`);
    res.json(templates);
  } catch (error) {
    console.error('❌ Error obteniendo templates:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/templates/guardar', async (req, res) => {
  try {
    const { templates } = req.body;
    
    const guardado = await guardarBin(JSONBIN_TEMPLATES_BIN_ID, templates, 'templates');
    
    if (guardado) {
      templatesCache = templates;
      lastTemplatesFetch = Date.now();
      console.log(`💾 ${templates.length} templates guardados en JSONBin`);
      res.json({ success: true, total: templates.length });
    } else {
      throw new Error('No se pudieron guardar los templates');
    }
  } catch (err) {
    console.error('❌ Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// ENVÍO DE FACTURAS
// ═══════════════════════════════════════════════════════════════

app.post('/api/enviar-facturas', async (req, res) => {
  const { templates } = req.body;
  
  // Recargar datos actuales
  const clientes = await obtenerClientes(true);
  let templatesActuales = await obtenerTemplates(true);
  
  const templatesSeleccionados = (templates || []).filter(t => t.selected);
  const resultados = [];

  console.log(`\n🚀 Enviando ${templatesSeleccionados.length} facturas (Factura A)`);

  try {
    for (const template of templatesSeleccionados) {
      try {
        const cliente = clientes.find(c => c.id === template.clienteId);
        if (!cliente) throw new Error(`Cliente ID ${template.clienteId} no encontrado`);

        console.log(`\n🧾 Preparando factura para: ${cliente.nombre} - CUIT: ${cliente.documento}`);

        const cantidadItem = Number(template.cantidad || 1);
        const precioUnitarioSinIva = Number(template.monto || template.precio || 0);
        const alicuota = Number(template.alicuota ?? 21);
        const bonificacionPorcentaje = Number(template.bonificacion_porcentaje ?? 0);
        const condicionPago = String(template.condicion_pago ?? cliente.condicion_pago ?? '0');
        const percepciones = Array.isArray(template.percepciones) ? template.percepciones : [];

        const fechaHoy = new Date();
        const fechaVto = calcularVencimiento(fechaHoy, condicionPago);

        const items = Array.isArray(template.items) && template.items.length > 0
          ? template.items.map(it => ({
              cantidad: Number(it.cantidad || 1),
              precio_unitario_sin_iva: Number(it.precio || it.precio_unitario_sin_iva || 0),
              alicuota: Number(it.alicuota ?? alicuota),
              descripcion: it.descripcion || template.concepto || 'Servicio'
            }))
          : [{
              cantidad: cantidadItem,
              precio_unitario_sin_iva: precioUnitarioSinIva,
              alicuota,
              descripcion: template.concepto || 'Servicio'
            }];

        let importe_neto_gravado = 0;
        let importe_exento = 0;
        let importe_no_gravado = 0;
        let importe_iva = 0;
        let impuestos_internos = 0;
        const detalleParaAPI = [];

        for (const it of items) {
          const lineaSubtotal = round2(it.precio_unitario_sin_iva * Number(it.cantidad));
          if (it.alicuota === 0) {
            importe_exento += lineaSubtotal;
          } else {
            importe_neto_gravado += lineaSubtotal;
            const ivaLinea = round2(lineaSubtotal * (it.alicuota / 100));
            importe_iva += ivaLinea;
          }

          detalleParaAPI.push({
            cantidad: String(it.cantidad),
            afecta_stock: 'N',
            bonificacion_porcentaje: '0',
            producto: {
              descripcion: it.descripcion,
              unidad_bulto: '1',
              lista_precios: 'SERVICIOS',
              codigo: '',
              precio_unitario_sin_iva: it.precio_unitario_sin_iva.toFixed(2),
              alicuota: String(it.alicuota),
              unidad_medida: '7',
              actualiza_precio: 'N',
              rg5329: 'N'
            },
            leyenda: ''
          });
        }

        const bonificacionVal = round2(importe_neto_gravado * (bonificacionPorcentaje / 100));
        importe_neto_gravado = round2(importe_neto_gravado - bonificacionVal);

        let percepcionesTotal = 0;
        const percepcionesParaAPI = [];
        for (const p of percepciones) {
          const imp = round2(Number(p.importe || 0));
          if (imp > 0) {
            percepcionesTotal += imp;
            percepcionesParaAPI.push({
              tipo: p.tipo || 'PER',
              descripcion: p.descripcion || p.tipo || 'Percepción',
              importe: imp.toFixed(2)
            });
          }
        }

        importe_neto_gravado = round2(importe_neto_gravado);
        importe_exento = round2(importe_exento);
        importe_no_gravado = round2(importe_no_gravado);
        importe_iva = round2(importe_iva);
        impuestos_internos = round2(impuestos_internos);
        percepcionesTotal = round2(percepcionesTotal);

        const total = round2(importe_neto_gravado + importe_exento + importe_no_gravado + importe_iva + impuestos_internos + percepcionesTotal);

        if (total <= 0) {
          throw new Error('El total calculado es 0. Revise precios/cantidades del template.');
        }

        const facturaData = {
          ...createBaseRequest(),
          cliente: {
            documento_tipo: 'CUIT',
            documento_nro: cliente.documento,
            razon_social: cliente.nombre,
            email: cliente.email || '',
            domicilio: cliente.domicilio || 'Ciudad Autónoma de Buenos Aires',
            provincia: cliente.provincia || '1',
            envia_por_mail: cliente.email ? 'S' : 'N',
            condicion_iva: 'RI',
            condicion_pago: condicionPago
          },
          comprobante: {
            fecha: formatDate(fechaHoy),
            vencimiento: formatDate(fechaVto),
            tipo: 'FACTURA A',
            operacion: 'V',
            punto_venta: String(process.env.PUNTO_VENTA || '6'),
            moneda: 'PES',
            cotizacion: '1',
            idioma: '1',
            periodo_facturado_desde: formatDate(fechaHoy),
            periodo_facturado_hasta: formatDate(fechaHoy),
            rubro: template.rubro || 'Servicios Profesionales',
            rubro_grupo_contable: template.rubro_grupo_contable || 'servicios',
            detalle: detalleParaAPI,
            bonificacion: bonificacionVal.toFixed(2),
            importe_neto_gravado: importe_neto_gravado.toFixed(2),
            importe_exento: importe_exento.toFixed(2),
            importe_no_gravado: importe_no_gravado.toFixed(2),
            importe_iva: importe_iva.toFixed(2),
            impuestos_internos: impuestos_internos.toFixed(2),
            percepciones: percepcionesParaAPI.length > 0 ? percepcionesParaAPI : undefined,
            total: total.toFixed(2),
            leyenda_gral: template.leyenda_gral || ''
          }
        };

        console.log(`   💰 Total: ${total.toFixed(2)} (Neto: ${importe_neto_gravado.toFixed(2)} + IVA: ${importe_iva.toFixed(2)})`);
        console.log(`   🌐 Enviando a TusFacturas API...`);

        const response = await axios.post(
          `${TUSFACTURAS_BASE_URL}/facturacion/nuevo`,
          facturaData,
          {
            timeout: 30000,
            headers: { 'Content-Type': 'application/json' }
          }
        );

        console.log(`   📡 Respuesta recibida (status: ${response.status})`);

        if (response.data?.error === 'S') {
          const apiErr = Array.isArray(response.data.errores) 
            ? response.data.errores.join(' | ') 
            : (response.data.errores || 'Error API');
          throw new Error(apiErr);
        }

        console.log(`   ✅ Factura autorizada - CAE: ${response.data.cae}`);

        resultados.push({
          templateId: template.id,
          success: true,
          facturaNumero: response.data.numero,
          cliente: cliente.nombre,
          cae: response.data.cae,
          vencimiento_cae: response.data.vencimiento_cae,
          pdf_url: response.data.pdf_url
        });

        await new Promise(r => setTimeout(r, 1200));

      } catch (err) {
        console.error(`   ❌ ERROR: ${err.message}`);
        
        if (err.response) {
          console.error(`   📡 Status HTTP: ${err.response.status}`);
          console.error(`   📄 Respuesta API:`, JSON.stringify(err.response.data, null, 2));
        } else if (err.request) {
          console.error(`   🔌 Sin respuesta del servidor (timeout o red caída)`);
        } else {
          console.error(`   ⚙️  Error al configurar request:`, err.message);
        }
        
        resultados.push({
          templateId: template.id,
          success: false,
          error: err.response?.data?.errores?.[0] || err.message
        });
      }
    }

    const exitosas = resultados.filter(r => r.success).length;
    const fallidas = resultados.filter(r => !r.success).length;

    console.log(`\n📊 Resultado: ${exitosas} exitosas | ${fallidas} fallidas`);

    // Actualizar y guardar templates (desmarcar exitosas)
    if (exitosas > 0) {
      templatesActuales = templatesActuales.map(t => {
        const ok = resultados.find(r => r.templateId === t.id && r.success);
        return ok ? { ...t, selected: false } : t;
      });
      await guardarBin(JSONBIN_TEMPLATES_BIN_ID, templatesActuales, 'templates');
      templatesCache = templatesActuales;
      lastTemplatesFetch = Date.now();
    }

    res.json({ 
      success: true, 
      total: templatesSeleccionados.length, 
      exitosas, 
      fallidas, 
      detalles: resultados 
    });

  } catch (err) {
    console.error('💥 ERROR CRÍTICO:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// TEST DE CONEXIÓN
// ═══════════════════════════════════════════════════════════════

app.get('/api/test', async (req, res) => {
  try {
    const response = await axios.post(
      `${TUSFACTURAS_BASE_URL}/facturacion/buscar`,
      {
        ...createBaseRequest(),
        fecha_desde: formatDate(new Date()),
        fecha_hasta: formatDate(new Date())
      },
      { timeout: 10000 }
    );
    console.log('✅ Test de conexión exitoso');
    res.json({ 
      success: true, 
      mensaje: 'Conexión exitosa con TusFacturas', 
      modo: 'PRODUCCIÓN',
      persistencia: 'JSONBin.io OK'
    });
  } catch (err) {
    console.error('❌ Error en test:', err.message);
    res.status(500).json({ 
      success: false, 
      error: err.message, 
      detail: err.response?.data 
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// ERROR HANDLERS
// ═══════════════════════════════════════════════════════════════

app.use((error, req, res, next) => {
  console.error('🚨 Error no manejado:', error);
  res.status(500).json({
    error: 'Error interno del servidor',
    message: error.message
  });
});

app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint no encontrado',
    path: req.originalUrl
  });
});

// ═══════════════════════════════════════════════════════════════
// INICIAR SERVIDOR
// ═══════════════════════════════════════════════════════════════

const server = app.listen(PORT, async () => {
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log(`║  SERVIDOR ACTIVO EN PUERTO ${PORT}                  ║`);
  console.log('║  SILVIA MONICA NAHABETIAN                         ║');
  console.log('║  CUIT: 27233141246 • PDV: 00006                   ║');
  console.log('║  MODO: PRODUCCIÓN CON JSONBin.io                  ║');
  console.log('╚════════════════════════════════════════════════════╝\n');
  
  // Cargar datos iniciales
  await inicializarDatos();
  
  console.log(`📊 Clientes: ${clientesCache.length} | Templates: ${templatesCache.length}`);
  console.log('✅ Sistema listo para operar\n');
});

process.on('SIGTERM', () => {
  console.log('🛑 Cerrando servidor...');
  server.close(() => console.log('✅ Servidor cerrado correctamente'));
});

module.exports = app;