// server.js - VERSIÓN CON PERSISTENCIA EN ARCHIVOS JSON
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
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

console.log('🚀 Servidor TusFacturas - PRODUCCIÓN CON PERSISTENCIA');
console.log('📄 API v2: developers.tusfacturas.app');
console.log('💾 Persistencia: Archivos JSON');

// ═══════════════════════════════════════════════════════════════
// SISTEMA DE PERSISTENCIA EN ARCHIVOS
// ═══════════════════════════════════════════════════════════════

const DATA_DIR = path.join(__dirname, 'data');
const TEMPLATES_FILE = path.join(DATA_DIR, 'templates.json');
const CLIENTES_FILE = path.join(DATA_DIR, 'clientes.json');

// Crear directorio de datos si no existe
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log('📁 Directorio de datos creado');
}

// Funciones de persistencia
const guardarArchivo = (archivo, datos) => {
  try {
    // Validar que datos sea serializable
    const jsonString = JSON.stringify(datos, null, 2);
    
    // Escribir de forma atómica (tmp + rename para evitar corrupción)
    const tmpFile = `${archivo}.tmp`;
    fs.writeFileSync(tmpFile, jsonString, 'utf8');
    fs.renameSync(tmpFile, archivo);
    
    return true;
  } catch (error) {
    console.error(`❌ Error guardando ${path.basename(archivo)}:`, error.message);
    return false;
  }
};

const leerArchivo = (archivo, valorDefault = []) => {
  try {
    if (!fs.existsSync(archivo)) {
      console.log(`📝 Creando archivo ${path.basename(archivo)} con datos iniciales`);
      guardarArchivo(archivo, valorDefault);
      return valorDefault;
    }
    
    const contenido = fs.readFileSync(archivo, 'utf8');
    
    // Validar que no esté vacío
    if (!contenido || contenido.trim() === '') {
      console.warn(`⚠️  Archivo ${path.basename(archivo)} vacío, usando defaults`);
      guardarArchivo(archivo, valorDefault);
      return valorDefault;
    }
    
    // Intentar parsear JSON
    const datos = JSON.parse(contenido);
    
    // Validar que sea un array (formato esperado)
    if (!Array.isArray(datos)) {
      console.warn(`⚠️  Archivo ${path.basename(archivo)} no contiene un array, usando defaults`);
      guardarArchivo(archivo, valorDefault);
      return valorDefault;
    }
    
    return datos;
    
  } catch (error) {
    // Diferenciar tipos de error
    if (error instanceof SyntaxError) {
      console.error(`❌ JSON corrupto en ${path.basename(archivo)}: ${error.message}`);
      console.log(`🔧 Creando backup y restaurando defaults...`);
      
      // Crear backup del archivo corrupto
      try {
        const backupFile = `${archivo}.corrupto.${Date.now()}.bak`;
        fs.copyFileSync(archivo, backupFile);
        console.log(`💾 Backup creado: ${path.basename(backupFile)}`);
      } catch (backupErr) {
        console.error('⚠️  No se pudo crear backup:', backupErr.message);
      }
      
      // Restaurar defaults
      guardarArchivo(archivo, valorDefault);
      return valorDefault;
      
    } else {
      console.error(`❌ Error leyendo ${path.basename(archivo)}:`, error.message);
      return valorDefault;
    }
  }
};

// Cargar datos al iniciar
let templatesGuardados = leerArchivo(TEMPLATES_FILE, []);
let clientesGuardados = leerArchivo(CLIENTES_FILE, []);

console.log(`✅ Datos cargados: ${clientesGuardados.length} clientes, ${templatesGuardados.length} templates`);

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
    modo: 'PRODUCCIÓN CON PERSISTENCIA',
    clientes_locales: clientesGuardados.length,
    templates_guardados: templatesGuardados.length,
    persistencia: 'Archivos JSON'
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    persistencia: fs.existsSync(CLIENTES_FILE) && fs.existsSync(TEMPLATES_FILE) ? 'OK' : 'ERROR'
  });
});

// ═══════════════════════════════════════════════════════════════
// GESTIÓN DE CLIENTES (CON PERSISTENCIA)
// ═══════════════════════════════════════════════════════════════

app.get('/api/clientes', (req, res) => {
  // Recargar desde archivo por si hubo cambios externos
  clientesGuardados = leerArchivo(CLIENTES_FILE, []);
  console.log(`📋 Devolviendo ${clientesGuardados.length} clientes`);
  res.json(clientesGuardados);
});

app.post('/api/clientes/agregar', (req, res) => {
  try {
    const { cliente } = req.body;
    
    // Recargar datos actuales
    clientesGuardados = leerArchivo(CLIENTES_FILE, []);
    
    const nuevoId = clientesGuardados.length > 0 
      ? Math.max(...clientesGuardados.map(c => c.id)) + 1 
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
    
    const existe = clientesGuardados.find(c => c.documento === clienteNuevo.documento);
    if (existe) {
      return res.json({ 
        success: true, 
        message: 'Cliente ya existe', 
        cliente: existe 
      });
    }
    
    clientesGuardados.push(clienteNuevo);
    
    // Guardar en archivo
    if (guardarArchivo(CLIENTES_FILE, clientesGuardados)) {
      console.log(`✅ Cliente agregado y guardado: ${clienteNuevo.nombre}`);
      res.json({ success: true, cliente: clienteNuevo });
    } else {
      throw new Error('No se pudo guardar el cliente');
    }
    
  } catch (err) {
    console.error('❌ Error agregando cliente:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/clientes/guardar', (req, res) => {
  try {
    const { clientes } = req.body;
    clientesGuardados = clientes || [];
    
    if (guardarArchivo(CLIENTES_FILE, clientesGuardados)) {
      console.log(`💾 ${clientesGuardados.length} clientes guardados en archivo`);
      res.json({ success: true, total: clientesGuardados.length });
    } else {
      throw new Error('No se pudieron guardar los clientes');
    }
  } catch (err) {
    console.error('❌ Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// GESTIÓN DE TEMPLATES (CON PERSISTENCIA)
// ═══════════════════════════════════════════════════════════════

app.get('/api/templates', (req, res) => {
  // Recargar desde archivo
  templatesGuardados = leerArchivo(TEMPLATES_FILE, []);
  console.log(`📊 Devolviendo ${templatesGuardados.length} templates`);
  res.json(templatesGuardados);
});

app.post('/api/templates/guardar', (req, res) => {
  try {
    const { templates } = req.body;
    templatesGuardados = templates || [];
    
    if (guardarArchivo(TEMPLATES_FILE, templatesGuardados)) {
      console.log(`💾 ${templatesGuardados.length} templates guardados en archivo`);
      res.json({ success: true, total: templatesGuardados.length });
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
  clientesGuardados = leerArchivo(CLIENTES_FILE, []);
  templatesGuardados = leerArchivo(TEMPLATES_FILE, []);
  
  const templatesSeleccionados = (templates || []).filter(t => t.selected);
  const resultados = [];

  console.log(`\n🚀 Enviando ${templatesSeleccionados.length} facturas (Factura A)`);

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
        
        // Log detallado del error para debugging
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
      templatesGuardados = templatesGuardados.map(t => {
        const ok = resultados.find(r => r.templateId === t.id && r.success);
        return ok ? { ...t, selected: false } : t;
      });
      guardarArchivo(TEMPLATES_FILE, templatesGuardados);
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
      persistencia: 'OK'
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

const server = app.listen(PORT, () => {
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log(`║  SERVIDOR ACTIVO EN PUERTO ${PORT}                  ║`);
  console.log('║  SILVIA MONICA NAHABETIAN                         ║');
  console.log('║  CUIT: 27233141246 • PDV: 00006                   ║');
  console.log('║  MODO: PRODUCCIÓN CON PERSISTENCIA                ║');
  console.log(`║  Clientes: ${clientesGuardados.length} | Templates: ${templatesGuardados.length}                        ║`);
  console.log('╚════════════════════════════════════════════════════╝\n');
});

process.on('SIGTERM', () => {
  console.log('🛑 Cerrando servidor...');
  // Guardar datos antes de cerrar
  guardarArchivo(CLIENTES_FILE, clientesGuardados);
  guardarArchivo(TEMPLATES_FILE, templatesGuardados);
  server.close(() => console.log('✅ Servidor cerrado correctamente'));
});

module.exports = app;