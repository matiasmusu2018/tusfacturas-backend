// server.js - CON GESTIÓN DE EMAILS (Opción A - Solución definitiva)
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

const JSONBIN_API_KEY = process.env.JSONBIN_API_KEY;
const JSONBIN_CLIENTES_BIN_ID = process.env.JSONBIN_CLIENTES_BIN_ID;
const JSONBIN_TEMPLATES_BIN_ID = process.env.JSONBIN_TEMPLATES_BIN_ID;
const JSONBIN_BASE_URL = 'https://api.jsonbin.io/v3';

console.log('🚀 Servidor TusFacturas - PRODUCCIÓN');
console.log('📄 API v2: developers.tusfacturas.app');
console.log('☁️  Persistencia: JSONBin.io');
console.log('📧 Emails: Gestionados en JSONBin + enviados a TusFacturas');

let templatesGuardados = [];
let clientesGuardados = [];

// ═══════════════════════════════════════════════════════════════
// FUNCIONES JSONBIN.IO
// ═══════════════════════════════════════════════════════════════

const getJSONBinHeaders = () => ({
  'Content-Type': 'application/json',
  'X-Master-Key': JSONBIN_API_KEY
});

const leerDesdeJSONBin = async (binId, tipo) => {
  try {
    if (!JSONBIN_API_KEY || !binId) {
      console.warn(`⚠️  JSONBin no configurado para ${tipo}, usando memoria local`);
      return null;
    }

    console.log(`📥 Cargando ${tipo} desde JSONBin...`);
    const response = await axios.get(
      `${JSONBIN_BASE_URL}/b/${binId}/latest`,
      { 
        headers: getJSONBinHeaders(),
        timeout: 8000 
      }
    );
    
    const datos = response.data.record;
    
    if (!Array.isArray(datos)) {
      console.warn(`⚠️  Datos de ${tipo} no son array, inicializando vacío`);
      return [];
    }
    
    if (tipo === 'templates' && datos.length > 0) {
      datos.forEach((t, idx) => {
        if (typeof t.monto === 'undefined') {
          console.warn(`⚠️  Template ${idx} sin 'monto', corrigiendo...`);
          t.monto = 0;
        }
        if (typeof t.selected === 'undefined') {
          t.selected = false;
        }
      });
    }
    
    console.log(`✅ ${tipo} cargados: ${datos.length} registros`);
    return datos;
    
  } catch (error) {
    console.error(`❌ Error leyendo ${tipo} de JSONBin:`, error.message);
    return null;
  }
};

const guardarEnJSONBin = async (binId, datos, tipo) => {
  try {
    if (!JSONBIN_API_KEY || !binId) {
      console.warn(`⚠️  JSONBin no configurado para ${tipo}, guardando solo en memoria`);
      return false;
    }

    console.log(`💾 Guardando ${tipo} en JSONBin (${datos.length} registros)...`);
    
    await axios.put(
      `${JSONBIN_BASE_URL}/b/${binId}`,
      datos,
      { 
        headers: getJSONBinHeaders(),
        timeout: 8000 
      }
    );
    
    console.log(`✅ ${tipo} guardados en JSONBin`);
    return true;
    
  } catch (error) {
    console.error(`❌ Error guardando ${tipo} en JSONBin:`, error.message);
    return false;
  }
};

const cargarDatosIniciales = async () => {
  console.log('\n🔄 Cargando datos desde JSONBin...\n');
  
  try {
    const clientesCargados = await leerDesdeJSONBin(JSONBIN_CLIENTES_BIN_ID, 'clientes');
    if (clientesCargados) {
      clientesGuardados = clientesCargados;
    }
    
    const templatesCargados = await leerDesdeJSONBin(JSONBIN_TEMPLATES_BIN_ID, 'templates');
    if (templatesCargados) {
      templatesGuardados = templatesCargados;
    }
    
    console.log(`\n📊 Datos cargados: ${clientesGuardados.length} clientes, ${templatesGuardados.length} templates\n`);
    
  } catch (error) {
    console.error('❌ Error en carga inicial:', error.message);
    console.log('⚠️  El servidor arrancará con datos en memoria\n');
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

app.get('/', (req, res) => {
  res.json({
    message: 'TusFacturas API - SILVIA MONICA NAHABETIAN',
    status: 'OK',
    timestamp: new Date().toISOString(),
    cuit: '27233141246',
    pdv: '00006',
    modo: 'PRODUCCIÓN',
    clientes_locales: clientesGuardados.length,
    templates_guardados: templatesGuardados.length,
    persistencia: JSONBIN_API_KEY ? 'JSONBin.io activo' : 'Memoria local',
    gestion_emails: 'JSONBin (app gestiona emails)'
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    jsonbin: JSONBIN_API_KEY ? 'configurado' : 'no configurado'
  });
});

// ═══════════════════════════════════════════════════════════════
// GESTIÓN CLIENTES - CON CAMPO EMAIL
// ═══════════════════════════════════════════════════════════════

app.get('/api/clientes', async (req, res) => {
  try {
    const datosActualizados = await leerDesdeJSONBin(JSONBIN_CLIENTES_BIN_ID, 'clientes');
    if (datosActualizados && Array.isArray(datosActualizados)) {
      clientesGuardados = datosActualizados;
    }
    
    console.log(`📋 Devolviendo ${clientesGuardados.length} clientes`);
    res.json(Array.isArray(clientesGuardados) ? clientesGuardados : []);
  } catch (error) {
    console.error('Error obteniendo clientes:', error);
    res.json([]);
  }
});

app.post('/api/clientes/agregar', async (req, res) => {
  try {
    const { cliente } = req.body;
    const nuevoId = clientesGuardados.length > 0 
      ? Math.max(...clientesGuardados.map(c => c.id)) + 1 
      : 1;
    
    // ✅ AHORA GUARDAMOS EL EMAIL
    const clienteNuevo = {
      id: nuevoId,
      nombre: cliente.nombre,
      documento: (cliente.documento || '').replace(/-/g, ''),
      email: cliente.email || '',  // ✅ Email incluido
      tipo_documento: 'CUIT',
      origen: 'manual'
    };
    
    const existe = clientesGuardados.find(c => c.documento === clienteNuevo.documento);
    if (existe) {
      return res.json({ success: true, message: 'Cliente ya existe', cliente: existe });
    }
    
    clientesGuardados.push(clienteNuevo);
    console.log(`➕ Cliente agregado: ${clienteNuevo.nombre} (${clienteNuevo.documento})`);
    console.log(`   📧 Email: ${clienteNuevo.email || '(sin email)'}`);
    
    guardarEnJSONBin(JSONBIN_CLIENTES_BIN_ID, clientesGuardados, 'clientes');
    
    res.json({ success: true, cliente: clienteNuevo });
  } catch (err) {
    console.error('Error agregando cliente:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/clientes/guardar', async (req, res) => {
  try {
    const { clientes } = req.body;
    clientesGuardados = clientes || [];
    console.log(`💾 ${clientesGuardados.length} clientes guardados en memoria`);
    
    await guardarEnJSONBin(JSONBIN_CLIENTES_BIN_ID, clientesGuardados, 'clientes');
    
    res.json({ success: true, total: clientesGuardados.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// GESTIÓN TEMPLATES
// ═══════════════════════════════════════════════════════════════

app.get('/api/templates', async (req, res) => {
  try {
    const datosActualizados = await leerDesdeJSONBin(JSONBIN_TEMPLATES_BIN_ID, 'templates');
    if (datosActualizados && Array.isArray(datosActualizados)) {
      templatesGuardados = datosActualizados;
    }
    
    console.log(`📊 Devolviendo ${templatesGuardados.length} templates`);
    res.json(Array.isArray(templatesGuardados) ? templatesGuardados : []);
  } catch (error) {
    console.error('Error obteniendo templates:', error);
    res.json([]);
  }
});

app.post('/api/templates/guardar', async (req, res) => {
  try {
    const { templates } = req.body;
    templatesGuardados = templates || [];
    console.log(`💾 ${templatesGuardados.length} templates guardados en memoria`);
    
    await guardarEnJSONBin(JSONBIN_TEMPLATES_BIN_ID, templatesGuardados, 'templates');
    
    res.json({ success: true, total: templatesGuardados.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// ENVÍO DE FACTURAS - ENVIANDO EMAIL GUARDADO
// ═══════════════════════════════════════════════════════════════

app.post('/api/enviar-facturas', async (req, res) => {
  const { templates } = req.body;
  const templatesSeleccionados = (templates || []).filter(t => t.selected);
  const resultados = [];

  console.log(`\n🚀 Enviando ${templatesSeleccionados.length} facturas (Factura A)`);
  console.log(`📧 Emails: Se envían desde JSONBin → TusFacturas los mantiene`);

  try {
    for (const template of templatesSeleccionados) {
      try {
        const cliente = clientesGuardados.find(c => c.id === template.clienteId);
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

        // ✅ ENVIAR TODOS LOS DATOS DEL CLIENTE INCLUYENDO EMAIL
        const facturaData = {
          ...createBaseRequest(),
          cliente: {
            documento_tipo: 'CUIT',
            documento_nro: cliente.documento,
            razon_social: cliente.nombre,
            email: cliente.email || '',  // ✅ Email desde JSONBin
            domicilio: cliente.domicilio || 'Ciudad Autónoma de Buenos Aires',
            provincia: cliente.provincia || '1',
            envia_por_mail: cliente.email ? 'S' : 'N',  // ✅ S si tiene email
            condicion_iva: cliente.condicion_iva || 'RI',
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

        console.log('   📤 REQUEST A TUSFACTURAS:');
        console.log(`      Cliente: ${facturaData.cliente.razon_social}`);
        console.log(`      CUIT: ${facturaData.cliente.documento_nro}`);
        console.log(`      Email: ${facturaData.cliente.email || '(sin email)'}`);
        console.log(`      Envía mail: ${facturaData.cliente.envia_por_mail}`);
        console.log(`      Total: $${facturaData.comprobante.total}`);

        const response = await axios.post(
          `${TUSFACTURAS_BASE_URL}/facturacion/nuevo`,
          facturaData,
          {
            timeout: 30000,
            headers: { 'Content-Type': 'application/json' }
          }
        );

        console.log('   📥 Respuesta API:', JSON.stringify(response.data, null, 2));

        if (response.data?.error === 'S') {
          const apiErr = Array.isArray(response.data.errores) 
            ? response.data.errores.join(' | ') 
            : (response.data.errores || 'Error API');
          throw new Error(apiErr);
        }

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
        console.error('   ❌ ERROR AL ENVIAR FACTURA:', err.message);
        console.error('   Detalle API:', err.response?.data || 'sin response.data');
        resultados.push({
          templateId: template.id,
          success: false,
          error: err.response?.data?.errores?.[0] || err.message
        });
      }
    }

    const exitosas = resultados.filter(r => r.success).length;
    const fallidas = resultados.filter(r => !r.success).length;

    console.log(`\n✅ Resultado: ${exitosas} exitosas | ${fallidas} fallidas`);

    if (exitosas > 0) {
      templatesGuardados = templatesGuardados.map(t => {
        const ok = resultados.find(r => r.templateId === t.id && r.success);
        return ok ? { ...t, selected: false } : t;
      });
      
      guardarEnJSONBin(JSONBIN_TEMPLATES_BIN_ID, templatesGuardados, 'templates');
    }

    res.json({ 
      success: true, 
      total: templatesSeleccionados.length, 
      exitosas, 
      fallidas, 
      detalles: resultados 
    });

  } catch (err) {
    console.error('💥 ERROR CRÍTICO EN ENVIOS:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// TEST CONEXIÓN
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
    console.log('🔍 Test API OK');
    res.json({ 
      success: true, 
      mensaje: 'Conexión exitosa con TusFacturas', 
      modo: 'PRODUCCIÓN', 
      api: response.data 
    });
  } catch (err) {
    console.error('❌ Error de conexión test:', err.message);
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
  console.log('║  MODO: PRODUCCIÓN                                 ║');
  console.log('║  📧 Emails: Gestionados en app                    ║');
  console.log('╚════════════════════════════════════════════════════╝\n');
  
  await cargarDatosIniciales();
  
  console.log('✅ Sistema listo para operar\n');
});

process.on('SIGTERM', () => {
  console.log('🛑 Cerrando servidor...');
  server.close(() => console.log('✅ Servidor cerrado correctamente'));
});

module.exports = app;