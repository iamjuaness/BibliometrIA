"use client";

import React, { useState, useRef } from "react";
import { UploadCloud, FileText, X, Send, Loader2, BarChart2, Download } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface FlowiseArtifact {
  fileName: string;
  type: string;
  data: string; // usually base64
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [question, setQuestion] = useState<string>("Realiza un análisis bibliométrico detallado con el contenido de este archivo RIS. Genera estadísticas sobre autores, años de publicación y temas principales.");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [artifacts, setArtifacts] = useState<FlowiseArtifact[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.ris')) {
        setError("Por favor, selecciona un archivo con extensión .ris");
        return;
      }
      setFile(selectedFile);
      setError(null);
      
      const reader = new FileReader();
      reader.onload = (event) => {
        setFileContent(event.target?.result as string);
      };
      reader.readAsText(selectedFile);
    }
  };

  const clearFile = () => {
    setFile(null);
    setFileContent("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const downloadArtifact = (artifact: FlowiseArtifact) => {
    try {
      // Flowise might return data as base64 or a URL
      const link = document.createElement("a");
      if (artifact.data.startsWith("http")) {
        link.href = artifact.data;
      } else {
        // Assume base64
        const byteString = atob(artifact.data.split(",")[1] || artifact.data);
        const mimeString = artifact.data.split(",")[0].split(":")[1]?.split(";")[0] || "application/pdf";
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([ab], { type: mimeString });
        link.href = URL.createObjectURL(blob);
      }
      link.download = artifact.fileName || "analisis.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Error downloading file:", err);
      setError("No se pudo descargar el archivo.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileContent && !question) return;

    setIsLoading(true);
    setError(null);
    setResult(null);
    setArtifacts([]);

    // Structured prompt to avoid echoing the RIS file
    const fullQuestion = `
A continuación presento la información de un archivo bibliográfico en formato RIS. 
Por favor, NO devuelvas el contenido del archivo. En su lugar, analiza los datos y responde a lo siguiente:
${question}

CONTENIDO DEL ARCHIVO RIS:
---
${fileContent.substring(0, 30000)}
---
    `.trim();

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: fullQuestion }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Ocurrió un error al procesar la solicitud.");
      }

      // Handle text response
      const textResponse = data.text || data.answer || data.response;
      setResult(textResponse || (typeof data === 'string' ? data : null));

      // Handle artifacts (Flowise sometimes returns fileAnnotations or artifacts)
      const foundArtifacts: FlowiseArtifact[] = [];
      
      if (data.artifacts && Array.isArray(data.artifacts)) {
        foundArtifacts.push(...data.artifacts);
      }
      
      if (data.fileAnnotations && Array.isArray(data.fileAnnotations)) {
        foundArtifacts.push(...data.fileAnnotations.map((ann: any) => ({
          fileName: ann.fileName || "descarga.pdf",
          type: ann.contentType || "file",
          data: ann.data
        })));
      }

      setArtifacts(foundArtifacts);

      if (!textResponse && foundArtifacts.length === 0) {
        setResult("El análisis se ha completado, pero no se recibió texto. Por favor revisa si hay archivos descargables.");
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-4xl space-y-8">
        <div className="text-center">
          <div className="flex justify-center items-center mb-4">
            <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
              <BarChart2 className="w-10 h-10 text-indigo-400" />
            </div>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2">
            Bibliometr<span className="text-indigo-400">IA</span>
          </h1>
          <p className="text-neutral-400 text-lg max-w-2xl mx-auto">
            Adjunta tu archivo .ris y genera un análisis bibliométrico detallado.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl">
          <div className="space-y-6">
            
            {/* File Upload Area */}
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Archivo RIS
              </label>
              {!file ? (
                <div 
                  className="border-2 border-dashed border-neutral-700/50 rounded-2xl p-8 flex flex-col items-center justify-center text-center hover:bg-neutral-800/50 hover:border-indigo-500/50 transition-all cursor-pointer group"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="p-4 bg-neutral-800 rounded-full group-hover:bg-indigo-500/20 group-hover:text-indigo-400 transition-colors mb-4">
                    <UploadCloud className="w-8 h-8 text-neutral-400 group-hover:text-indigo-400" />
                  </div>
                  <p className="text-sm text-neutral-300 font-medium mb-1">Haz clic para subir un archivo</p>
                  <p className="text-xs text-neutral-500">Solo archivos .ris permitidos</p>
                  <input 
                    type="file" 
                    accept=".ris" 
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={handleFileChange}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl">
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-indigo-500/20 rounded-lg">
                      <FileText className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-neutral-200">{file.name}</p>
                      <p className="text-xs text-neutral-500">{(file.size / 1024).toFixed(2)} KB</p>
                    </div>
                  </div>
                  <button 
                    type="button" 
                    onClick={clearFile}
                    className="p-2 text-neutral-400 hover:text-red-400 hover:bg-red-400/10 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>

            {/* Prompt Input */}
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Instrucciones del Análisis
              </label>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={3}
                className="w-full bg-neutral-950 border border-neutral-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl p-4 text-neutral-100 placeholder-neutral-600 transition-all resize-none"
                placeholder="¿Qué te gustaría analizar de este archivo?"
              />
            </div>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 flex rounded-xl text-sm justify-between items-center px-4">
                {error}
                <button type="button" onClick={() => setError(null)}>
                   <X className="w-4 h-4"/>
                </button>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isLoading || (!fileContent && !question)}
                className="flex items-center justify-center py-3 px-6 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:ring-offset-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Procesando datos...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Iniciar Análisis
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Results Area */}
        {(result || artifacts.length > 0) && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b border-neutral-800 pb-6">
              <h2 className="text-2xl font-bold text-white flex items-center">
                <BarChart2 className="w-6 h-6 mr-3 text-indigo-400" />
                Resultados del Análisis
              </h2>
              
              {/* Artifacts / Downloads */}
              <div className="flex flex-wrap gap-2">
                {artifacts.map((art, i) => (
                  <button
                    key={i}
                    onClick={() => downloadArtifact(art)}
                    className="flex items-center px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-xl text-indigo-400 text-sm font-medium transition-all group"
                  >
                    <Download className="w-4 h-4 mr-2 group-hover:translate-y-0.5 transition-transform" />
                    Descargar {art.fileName || (art.type.includes('pdf') ? 'Análisis PDF' : 'Archivo')}
                  </button>
                ))}
              </div>
            </div>

            {result && (
              <div className="prose prose-invert prose-indigo max-w-none">
                <ReactMarkdown>{result}</ReactMarkdown>
              </div>
            )}
            
            {artifacts.length > 0 && !result && (
              <div className="text-center py-12">
                <div className="inline-flex p-4 bg-indigo-500/10 rounded-2xl mb-4">
                  <FileText className="w-12 h-12 text-indigo-400" />
                </div>
                <p className="text-neutral-300 font-medium">Análisis generado correctamente</p>
                <p className="text-neutral-500 text-sm">El reporte está listo para descargar en la parte superior.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
