// server.js - VERSIÓN CORREGIDA
// Backend para TusFacturas API v2
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

console.log('🚀 Servidor TusFacturas - PRODUCCIÓN');
console.log('📄 API v2: developers.tusfacturas.app');

// Storage en memoria
let templatesGuardados = [];
let clientesGuardados = [];

const createBaseRequest = () => ({
  apikey: API_KEY,
  apitoken: API_TOKEN,
  usertoken: USER_TOKEN
});

// ✅ FORMATO CORRECTO: DD/MM/YYYY
const formatDate = (date) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
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
    templates_guardados: templatesGuardados.length
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ═══════════════════════════════════════════════════════════════
// GESTIÓN LOCAL DE CLIENTES
// ═══════════════════════════════════════════════════════════════

app.get('/api/clientes', (req, res) => {
  console.log(`📋 Devolviendo ${clientesGuardados.length} clientes locales`);
  res.json(clientesGuardados);
});

app.post('/api/clientes/agregar', (req, res) => {
  try {
    const { cliente } = req.body;
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('➕ AGREGANDO CLIENTE A LISTA LOCAL');
    console.log(`   Nombre: ${cliente.nombre}`);
    console.log(`   CUIT: ${cliente.documento}`);
    console.log(`   Email: ${cliente.email || '(sin email)'}`);
    
    const nuevoId = clientesGuardados.length > 0 
      ? Math.max(...clientesGuardados.map(c => c.id)) + 1 
      : 1;
    
    const clienteNuevo = {
      id: nuevoId,
      nombre: cliente.nombre,
      documento: cliente.documento.replace(/-/g, ''), // Limpiar guiones
      email: cliente.email || '',
      tipo_documento: 'CUIT',
      origen: 'manual'
    };
    
    const yaExiste = clientesGuardados.find(c => c.documento === clienteNuevo.documento);
    
    if (yaExiste) {
      console.log('⚠️  Cliente ya existe en lista local');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      return res.json({
        success: true,
        message: 'Cliente ya existe',
        cliente: yaExiste
      });
    }
    
    clientesGuardados.push(clienteNuevo);
    
    console.log(`✅ Cliente agregado - Total: ${clientesGuardados.length}`);
    console.log('ℹ️  TusFacturas lo creará automáticamente al enviar la primera factura');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    res.json({
      success: true,
      message: 'Cliente agregado correctamente',
      cliente: clienteNuevo,
      info: 'Se creará automáticamente en TusFacturas al enviar la primera factura'
    });
    
  } catch (error) {
    console.error('❌ Error agregando cliente:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.post('/api/clientes/guardar', (req, res) => {
  try {
    const { clientes } = req.body;
    clientesGuardados = clientes;
    console.log(`💾 ${clientes.length} clientes guardados en memoria`);
    res.json({ success: true, total: clientes.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// GESTIÓN DE TEMPLATES
// ═══════════════════════════════════════════════════════════════

app.get('/api/templates', (req, res) => {
  console.log(`📊 Devolviendo ${templatesGuardados.length} templates`);
  res.json(templatesGuardados);
});

app.post('/api/templates/guardar', (req, res) => {
  try {
    const { templates } = req.body;
    templatesGuardados = templates;
    console.log(`💾 ${templates.length} templates guardados`);
    res.json({ success: true, total: templates.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// ENVÍO DE FACTURAS A ARCA
// ═══════════════════════════════════════════════════════════════

app.post('/api/enviar-facturas', async (req, res) => {
  const { templates } = req.body;
  const templatesSeleccionados = templates.filter(t => t.selected);
  const resultados = [];
  
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log(`║  ENVIANDO ${templatesSeleccionados.length} FACTURAS A ARCA                     ║`);
  console.log('╚════════════════════════════════════════════════════╝\n');
  
  try {
    for (const template of templatesSeleccionados) {
      try {
        const cliente = clientesGuardados.find(c => c.id === template.clienteId);
        
        if (!cliente) {
          throw new Error(`Cliente ID ${template.clienteId} no encontrado`);
        }
        
        console.log(`📝 Factura para: ${cliente.nombre}`);
        console.log(`   CUIT: ${cliente.documento}`);
        console.log(`   Email: ${cliente.email || '(sin email)'}`);
        console.log(`   Concepto: ${template.concepto}`);
        console.log(`   Monto: $${template.monto}`);
        
        // ✅ Estructura CORRECTA según API v2 - FACTURA A
        const fechaHoy = new Date();
        const facturaData = {
          ...createBaseRequest(),
          cliente: {
            documento_tipo: 'CUIT',
            documento_nro: cliente.documento,
            razon_social: cliente.nombre,
            email: cliente.email || '',
            domicilio: 'Ciudad Autónoma de Buenos Aires',
            provincia: '1', // CABA
            envia_por_mail: cliente.email ? 'S' : 'N',
            condicion_iva: 'RI', // ✅ RESPONSABLE INSCRIPTO para Factura A
            condicion_pago: '0' // Contado - calcula vencimiento automático
          },
          comprobante: {
            fecha: formatDate(fechaHoy), // ✅ DD/MM/YYYY
            tipo: 'FACTURA A', // ✅ FACTURA A
            operacion: 'V',
            punto_venta: '6',
            moneda: 'PES',
            cotizacion: '1',
            idioma: '1',
            // ✅ vencimiento se calcula automáticamente según condicion_pago
            periodo_facturado_desde: formatDate(fechaHoy),
            periodo_facturado_hasta: formatDate(fechaHoy),
            rubro: 'Servicios Profesionales',
            rubro_grupo_contable: 'servicios',
            detalle: [{ 
              cantidad: '1',
              afecta_stock: 'N',
              bonificacion_porcentaje: '0',
              producto: {
                descripcion: template.concepto,
                unidad_bulto: '1',
                lista_precios: 'SERVICIOS',
                codigo: '',
                precio_unitario_sin_iva: template.monto.toFixed(2),
                alicuota: '21',
                unidad_medida: '7',
                actualiza_precio: 'N',
                rg5329: 'N'
              },
              leyenda: ''
            }],
            bonificacion: '0',
            leyenda_gral: ''
          }
        };
        
        console.log('   📤 REQUEST COMPLETO A TUSFACTURAS:');
        console.log(JSON.stringify(facturaData, null, 2));
        
        console.log('   🚀 Enviando a TusFacturas API...');
        
        const response = await axios.post(
          `${TUSFACTURAS_BASE_URL}/facturacion/nuevo`,
          facturaData,
          { 
            timeout: 30000,
            headers: { 'Content-Type': 'application/json' }
          }
        );
        
        console.log('   📥 Respuesta de TusFacturas:', JSON.stringify(response.data, null, 2));
        
        // Verificar errores
        if (response.data?.error === 'S') {
          const errorMsg = response.data.errores?.[0] || 'Error desconocido';
          throw new Error(errorMsg);
        }
        
        console.log('   ✅ FACTURA AUTORIZADA POR ARCA');
        console.log(`   CAE: ${response.data.cae || 'N/A'}`);
        console.log(`   Número: ${response.data.numero || 'N/A'}`);
        console.log('');
        
        resultados.push({
          templateId: template.id,
          success: true,
          facturaNumero: response.data.numero,
          cliente: cliente.nombre,
          cae: response.data.cae,
          vencimiento_cae: response.data.vencimiento_cae,
          pdf_url: response.data.pdf_url
        });
        
        // Pausa entre facturas
        await new Promise(resolve => setTimeout(resolve, 1500));
        
      } catch (error) {
        console.error(`   ❌ ERROR: ${error.message}`);
        console.error('   Detalles:', error.response?.data || error);
        console.log('');
        
        resultados.push({
          templateId: template.id,
          success: false,
          error: error.response?.data?.errores?.[0] || error.message
        });
      }
    }
    
    const exitosas = resultados.filter(r => r.success).length;
    const fallidas = resultados.filter(r => !r.success).length;
    
    console.log('╔════════════════════════════════════════════════════╗');
    console.log(`║  RESULTADO: ${exitosas} exitosas | ${fallidas} fallidas           ║`);
    console.log('╚════════════════════════════════════════════════════╝\n');
    
    // Desmarcar las exitosas
    if (exitosas > 0) {
      templatesGuardados = templatesGuardados.map(t => {
        const resultado = resultados.find(r => r.templateId === t.id && r.success);
        return resultado ? { ...t, selected: false } : t;
      });
    }
    
    res.json({
      success: true,
      total: templatesSeleccionados.length,
      exitosas,
      fallidas,
      detalles: resultados
    });
    
  } catch (error) {
    console.error('💥 ERROR CRÍTICO:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// TEST DE CONEXIÓN
// ═══════════════════════════════════════════════════════════════

app.get('/api/test', async (req, res) => {
  try {
    console.log('🔍 Test de conexión con TusFacturas...');
    
    const response = await axios.post(
      `${TUSFACTURAS_BASE_URL}/facturacion/buscar`,
      {
        ...createBaseRequest(),
        fecha_desde: formatDate(new Date()),
        fecha_hasta: formatDate(new Date())
      },
      { timeout: 10000 }
    );
    
    console.log('✅ Conexión exitosa con TusFacturas API v2');
    
    res.json({
      success: true,
      mensaje: 'Conexión exitosa con TusFacturas',
      modo: 'PRODUCCIÓN'
    });
    
  } catch (error) {
    console.error('❌ Error de conexión:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
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
  console.log('║  MODO: PRODUCCIÓN                                 ║');
  console.log('╚════════════════════════════════════════════════════╝\n');
});

process.on('SIGTERM', () => {
  console.log('🛑 Cerrando servidor...');
  server.close(() => console.log('✅ Servidor cerrado correctamente'));
});

module.exports = app;