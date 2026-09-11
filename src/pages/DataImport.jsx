import React, { useState, useRef } from 'react'
import { useStore } from '../store/useStore.js'
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, X, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'

const IMPORT_TYPES = [
  { key: 'stations', label: 'Stations', fields: ['name', 'region', 'manager', 'status', 'monthlySales', 'riskScore'] },
  { key: 'fleet', label: 'Fleet Vehicles', fields: ['plate', 'type', 'driver', 'status', 'mileage'] },
  { key: 'tankReadings', label: 'Tank Readings', fields: ['stationName', 'tankNo', 'product', 'currentLevel', 'variancePct'] },
]

export default function DataImport() {
  const { importData } = useStore()
  const [type, setType] = useState('stations')
  const [preview, setPreview] = useState(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState(null)
  const fileRef = useRef(null)

  const activeType = IMPORT_TYPES.find(t => t.key === type)

  const handleFile = (file) => {
    if (!file) return
    setFileName(file.name)
    setError(null)
    const ext = file.name.split('.').pop().toLowerCase()

    if (ext === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => {
          if (res.errors.length) { setError(res.errors[0].message); return }
          setPreview(res.data)
        },
        error: (err) => setError(err.message),
      })
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target.result, { type: 'binary' })
          const sheet = wb.Sheets[wb.SheetNames[0]]
          const rows = XLSX.utils.sheet_to_json(sheet)
          setPreview(rows)
        } catch (err) {
          setError('Could not read Excel file: ' + err.message)
        }
      }
      reader.readAsBinaryString(file)
    } else {
      setError('Unsupported file type. Please upload .csv or .xlsx')
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    handleFile(e.dataTransfer.files[0])
  }

  const handleImport = () => {
    if (!preview?.length) return
    importData(type, preview)
    toast.success(`Imported ${preview.length} ${activeType.label.toLowerCase()} records`)
    setPreview(null)
    setFileName('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const downloadTemplate = () => {
    const csv = Papa.unparse([Object.fromEntries(activeType.fields.map(f => [f, '']))])
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${type}_template.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div>
          <div className="page-title">Data Import</div>
          <div className="page-subtitle">Bulk import station, fleet, or tank data from CSV / Excel</div>
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-header"><div className="card-title">1. Select Data Type</div></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {IMPORT_TYPES.map(t => (
              <button
                key={t.key}
                onClick={() => { setType(t.key); setPreview(null); setFileName('') }}
                className={`btn ${type === t.key ? 'btn-primary' : 'btn-secondary'}`}
                style={{ justifyContent: 'flex-start' }}
              >
                <FileSpreadsheet size={15} /> {t.label}
              </button>
            ))}
          </div>

          <button className="btn btn-ghost btn-sm" onClick={downloadTemplate}>
            <Download size={13} /> Download CSV template
          </button>

          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
            Expected columns: {activeType.fields.join(', ')}
          </div>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            style={{
              marginTop: 20, border: '2px dashed var(--border-bright)', borderRadius: 12,
              padding: '32px 20px', textAlign: 'center', cursor: 'pointer',
            }}
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={28} color="var(--text-muted)" style={{ marginBottom: 10 }} />
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
              {fileName || 'Drag & drop a CSV/Excel file, or click to browse'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>.csv, .xlsx, .xls supported</div>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files[0])} />
          </div>

          {error && (
            <div className="alert-bar critical" style={{ marginTop: 14 }}>
              <AlertTriangle size={16} color="var(--danger)" />
              <div style={{ fontSize: 12 }}>{error}</div>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">2. Preview & Confirm</div></div>
          {!preview ? (
            <div className="empty-state">
              <FileSpreadsheet size={32} />
              <div>Upload a file to preview data before importing</div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{preview.length} rows detected</span>
                <button className="btn btn-ghost btn-sm" onClick={() => { setPreview(null); setFileName('') }}>
                  <X size={13} /> Clear
                </button>
              </div>
              <div className="table-wrap" style={{ maxHeight: 280, overflowY: 'auto', marginBottom: 16 }}>
                <table>
                  <thead>
                    <tr>{Object.keys(preview[0] || {}).map(k => <th key={k}>{k}</th>)}</tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 8).map((row, i) => (
                      <tr key={i}>
                        {Object.keys(preview[0]).map(k => <td key={k}>{String(row[k] ?? '')}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.length > 8 && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>+ {preview.length - 8} more rows</div>}
              <button className="btn btn-primary" onClick={handleImport} style={{ width: '100%', justifyContent: 'center' }}>
                <CheckCircle size={15} /> Import {preview.length} Records
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
