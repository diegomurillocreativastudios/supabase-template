"use client"

import React, { useState } from 'react';
import { Upload, FileSpreadsheet, Table, AlertCircle, CheckCircle } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const FileDataViewer = () => {
  const [file, setFile] = useState(null);
  const [data, setData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fileName, setFileName] = useState('');
  const [processing, setProcessing] = useState(false);
  const [processResult, setProcessResult] = useState(null);

  // Initialize Supabase client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const handleFileUpload = async (event) => {
    const selectedFile = event.target.files[0];
    if (!selectedFile) return;

    setLoading(true);
    setError(null);
    setFile(selectedFile);
    setFileName(selectedFile.name);

    try {
      const fileExtension = selectedFile.name.split('.').pop().toLowerCase();

      if (fileExtension === 'csv') {
        await handleCSVFile(selectedFile);
      } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        await handleExcelFile(selectedFile);
      } else {
        throw new Error('Formato de archivo no soportado. Use CSV, XLS o XLSX.');
      }
    } catch (err) {
      setError(err.message);
      setData([]);
      setHeaders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCSVFile = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          // Usar Papaparse para parsear CSV con punto y coma
          const Papa = window.Papa || require('papaparse');
          const result = Papa.parse(e.target.result, {
            header: true,
            delimiter: ';', // Tu archivo usa punto y coma
            dynamicTyping: true,
            skipEmptyLines: true
          });

          if (result.errors.length > 0) {
            console.warn('Errores en el archivo CSV:', result.errors);
          }

          const cleanHeaders = result.meta.fields.map(header =>
            header ? header.trim() : 'Columna sin nombre'
          );

          setHeaders(cleanHeaders);
          setData(result.data);
          resolve();
        } catch (error) {
          reject(new Error('Error al procesar archivo CSV: ' + error.message));
        }
      };
      reader.onerror = () => reject(new Error('Error al leer el archivo'));
      reader.readAsText(file);
    });
  };

  const handleExcelFile = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          // Usar SheetJS para leer Excel
          const XLSX = window.XLSX || require('xlsx');
          const workbook = XLSX.read(e.target.result, {
            type: 'binary',
            cellDates: true,
            cellStyles: true
          });

          // Tomar la primera hoja
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];

          // Convertir a JSON
          const jsonData = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            defval: '',
            blankrows: false
          });

          if (jsonData.length === 0) {
            throw new Error('El archivo Excel está vacío');
          }

          // La primera fila son los headers
          const rawHeaders = jsonData[0];
          const cleanHeaders = rawHeaders.map((header, index) =>
            header ? String(header).trim() : `Columna ${index + 1}`
          );

          // El resto son los datos
          const rows = jsonData.slice(1).map(row => {
            const rowObject = {};
            cleanHeaders.forEach((header, index) => {
              rowObject[header] = row[index] !== undefined ? row[index] : '';
            });
            return rowObject;
          });

          setHeaders(cleanHeaders);
          setData(rows);
          resolve();
        } catch (error) {
          reject(new Error('Error al procesar archivo Excel: ' + error.message));
        }
      };
      reader.onerror = () => reject(new Error('Error al leer el archivo'));
      reader.readAsBinaryString(file);
    });
  };

  const handleProcessData = async () => {
    if (data.length === 0) {
      alert('No hay datos para procesar');
      return;
    }

    setProcessing(true);
    setError(null);
    setProcessResult(null);

    try {
      const results = {
        partners: 0,
        locations: 0,
        customers: 0,
        providers: 0,
        services: 0,
        orders: 0,
        commissions: 0,
        errors: []
      };

      for (let i = 0; i < data.length; i++) {
        const row = data[i];

        try {
          // 1. Partner - buscar o crear
          let partnerId;
          const { data: existingPartner } = await supabase
            .from('Partner')
            .select('idPartner')
            .eq('name', row.partner)
            .single();

          if (existingPartner) {
            partnerId = existingPartner.idPartner;
          } else {
            const { data: newPartner, error: partnerError } = await supabase
              .from('Partner')
              .insert({ name: row.partner })
              .select('idPartner')
              .single();

            if (partnerError) throw new Error(`Partner: ${partnerError.message}`);
            partnerId = newPartner.idPartner;
            results.partners++;
          }

          // 2. Location - buscar o crear
          let locationId;
          const { data: existingLocation } = await supabase
            .from('Location')
            .select('idLocation')
            .eq('address', row.location)
            .single();

          if (existingLocation) {
            locationId = existingLocation.idLocation;
          } else {
            const { data: newLocation, error: locationError } = await supabase
              .from('Location')
              .insert({ address: row.location })
              .select('idLocation')
              .single();

            if (locationError) throw new Error(`Location: ${locationError.message}`);
            locationId = newLocation.idLocation;
            results.locations++;
          }

          // 3. Customer - buscar o crear
          let customerId;
          const { data: existingCustomer } = await supabase
            .from('Customer')
            .select('idCustomer')
            .eq('name', row.customer)
            .single();

          if (existingCustomer) {
            customerId = existingCustomer.idCustomer;
          } else {
            const { data: newCustomer, error: customerError } = await supabase
              .from('Customer')
              .insert({ name: row.customer })
              .select('idCustomer')
              .single();

            if (customerError) throw new Error(`Customer: ${customerError.message}`);
            customerId = newCustomer.idCustomer;
            results.customers++;
          }

          // 4. Provider - buscar o crear
          let providerId;
          const { data: existingProvider } = await supabase
            .from('Provider')
            .select('idProvider')
            .eq('name', row.provider)
            .single();

          if (existingProvider) {
            providerId = existingProvider.idProvider;
          } else {
            const { data: newProvider, error: providerError } = await supabase
              .from('Provider')
              .insert({ name: row.provider })
              .select('idProvider')
              .single();

            if (providerError) throw new Error(`Provider: ${providerError.message}`);
            providerId = newProvider.idProvider;
            results.providers++;
          }

          // 5. Service - buscar o crear
          let serviceId;
          const { data: existingService } = await supabase
            .from('Service')
            .select('idService')
            .eq('name', row.service)
            .single();

          if (existingService) {
            serviceId = existingService.idService;
          } else {
            const { data: newService, error: serviceError } = await supabase
              .from('Service')
              .insert({ name: row.service })
              .select('idService')
              .single();

            if (serviceError) throw new Error(`Service: ${serviceError.message}`);
            serviceId = newService.idService;
            results.services++;
          }

          // 6. Insertar Order (siempre crear nueva)
          const { data: orderData, error: orderError } = await supabase
            .from('order')
            .insert({
              idCustomer: customerId,
              idService: serviceId,
              idProvider: providerId,
              idLocation: locationId,
              mrc: parseFloat(row.mrc)
            })
            .select('idOrder')
            .single();

          if (orderError) throw new Error(`Order: ${orderError.message}`);
          results.orders++;

          // 7. Insertar Commission (siempre crear nueva)
          const { data: commissionData, error: commissionError } = await supabase
            .from('commission')
            .insert({
              idService: serviceId,
              idProvider: providerId,
              idPartner: partnerId,
              idLocation: locationId,
              idOrder: orderData.idOrder,
              pct: parseFloat(row.pct)
            })
            .select('idCommission')
            .single();

          if (commissionError) throw new Error(`Commission: ${commissionError.message}`);
          results.commissions++;

        } catch (rowError) {
          results.errors.push(`Fila ${i + 1}: ${rowError.message}`);
        }
      }

      setProcessResult(results);

    } catch (error) {
      setError('Error al procesar los datos: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const formatCellValue = (value) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object' && value instanceof Date) {
      return value.toLocaleDateString();
    }
    return String(value);
  };

  return (
    <div className="max-w-7xl mx-auto p-6 bg-white">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Visor de Datos Excel/CSV
        </h1>
        <p className="text-gray-600">
          Sube un archivo Excel (.xlsx, .xls) o CSV para visualizar su contenido
        </p>
      </div>

      {/* Upload Section */}
      <div className="mb-8">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <label htmlFor="file-upload" className="cursor-pointer">
            <span className="text-lg font-medium text-gray-900">
              Selecciona un archivo
            </span>
            <p className="text-gray-500 mt-1">CSV, XLS o XLSX</p>
            <input
              id="file-upload"
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        {fileName && (
          <div className="mt-4 flex items-center text-sm text-gray-600">
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Archivo seleccionado: {fileName}
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Procesando archivo...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
            <span className="text-red-700">{error}</span>
          </div>
        </div>
      )}

      {/* Process Results */}
      {processResult && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center mb-2">
            <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
            <span className="text-green-700 font-medium">Procesamiento completado</span>
          </div>
          <div className="text-green-700 text-sm space-y-1">
            <p>Partners creados: {processResult.partners}</p>
            <p>Locations creadas: {processResult.locations}</p>
            <p>Customers creados: {processResult.customers}</p>
            <p>Providers creados: {processResult.providers}</p>
            <p>Services creados: {processResult.services}</p>
            <p>Órdenes creadas: {processResult.orders}</p>
            <p>Comisiones creadas: {processResult.commissions}</p>
            {processResult.errors.length > 0 && (
              <div className="mt-2">
                <p className="font-medium">Errores encontrados:</p>
                <ul className="list-disc list-inside">
                  {processResult.errors.slice(0, 5).map((error, index) => (
                    <li key={index} className="text-red-600">{error}</li>
                  ))}
                  {processResult.errors.length > 5 && (
                    <li className="text-red-600">... y {processResult.errors.length - 5} errores más</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Data Display */}
      {data.length > 0 && !loading && (
        <div className="space-y-6">
          {/* Process Button */}
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <Table className="h-5 w-5 text-gray-500" />
              <span className="text-lg font-medium text-gray-900">
                Datos del archivo ({data.length} filas)
              </span>
            </div>
            <button
              onClick={handleProcessData}
              disabled={processing}
              className={`${processing
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
                } text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center`}
            >
              {processing && (
                <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              )}
              {processing ? 'Processing...' : 'Process Data'}
            </button>
          </div>

          {/* Data Table */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      #
                    </th>
                    {headers.map((header, index) => (
                      <th
                        key={index}
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.slice(0, 100).map((row, rowIndex) => (
                    <tr key={rowIndex} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {rowIndex + 1}
                      </td>
                      {headers.map((header, colIndex) => (
                        <td
                          key={colIndex}
                          className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate"
                          title={formatCellValue(row[header])}
                        >
                          {formatCellValue(row[header])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data.length > 100 && (
              <div className="bg-gray-50 px-4 py-3 text-sm text-gray-600 text-center">
                Mostrando las primeras 100 filas de {data.length} total
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FileDataViewer;