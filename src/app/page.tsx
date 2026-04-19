"use client";

import React, { useState, useRef } from "react";
import {
  UploadCloud,
  FileText,
  X,
  Send,
  Loader2,
  BarChart2,
  Download,
  Menu,
  Info,
  Github,
  Award,
  BookOpen,
  PieChart as PieChartIcon,
  TrendingUp,
  Users,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion, AnimatePresence } from "framer-motion";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { toPng } from "html-to-image";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chartsRefDaily = useRef<HTMLDivElement>(null);
  const chartsRefAuthors = useRef<HTMLDivElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith(".ris")) {
        setError("Por favor, selecciona un archivo con extensión .ris");
        return;
      }
      setFile(selectedFile);
      setError(null);
      setResult(null);
      setStats(null);

      const reader = new FileReader();
      reader.onload = (event) => {
        setFileContent(event.target?.result as string);
      };
      reader.readAsText(selectedFile);
    }
  };

  const removeFile = () => {
    setFile(null);
    setFileContent("");
    setResult(null);
    setStats(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const analyzeFile = async () => {
    if (!fileContent) {
      setError("Por favor, sube un archivo primero.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);
    setStats(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileContent }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error en la respuesta del servidor");
      }

      setResult(data.text);
      setStats(data.stats);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Ocurrió un error al procesar el archivo.");
    } finally {
      setIsLoading(false);
    }
  };

  const formatChartData = (obj: any) => {
    if (!obj) return [];
    return Object.entries(obj)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => (isNaN(Number(a.name)) ? 0 : Number(a.name) - Number(b.name)));
  };

  const generateProfessionalPDF = async () => {
    if (!result) return;
    setIsGeneratingPDF(true);

    try {
      const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 25;
      const contentWidth = pageWidth - margin * 2;

      // 1. --- COVER PAGE ---
      doc.setFillColor(15, 23, 42); 
      doc.rect(0, 0, pageWidth, 60, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("times", "bold");
      doc.setFontSize(24);
      doc.text("BibliometrIA", margin, 35);
      doc.setFontSize(12);
      doc.setFont("times", "normal");
      doc.text("Reporte de Análisis Bibliométrico Inteligente", margin, 45);
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(18);
      doc.setFont("times", "bold");
      const titleText = `Análisis: ${file?.name.replace(".ris", "") || "Documento RIS"}`;
      const splitTitle = doc.splitTextToSize(titleText, contentWidth);
      doc.text(splitTitle, margin, 85);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.5);
      doc.line(margin, 95, pageWidth - margin, 95);
      doc.setFontSize(14);
      doc.text("Creadores y Desarrolladores:", margin, 115);
      doc.setFont("times", "normal");
      doc.setFontSize(12);
      doc.text("• Juan Esteban Cardona", margin + 5, 125);
      doc.text("• Juan Esteban Ramirez", margin + 5, 132);
      doc.setFont("times", "bold");
      doc.text("Fecha:", margin, 150);
      doc.setFont("times", "normal");
      doc.text(new Date().toLocaleDateString(), margin + 20, 150);
      doc.setFont("times", "italic");
      doc.setFontSize(10);
      const abs = "Este documento presenta un análisis bibliometrico avanzado integrando datos estadísticos empíricos visualizados mediante gráficas de tendencia y productividad de autores.";
      doc.text(doc.splitTextToSize(abs, contentWidth), margin, 180);
      doc.setFont("times", "normal");
      doc.text("Generado por BibliometrIA Engine v1.2", pageWidth/2, 280, { align: "center" });

      // 2. --- CHARTS PAGE ---
      if (chartsRefDaily.current && chartsRefAuthors.current) {
        doc.addPage();
        doc.setFont("times", "bold");
        doc.setFontSize(16);
        doc.text("Visualizaciones de Datos", margin, 25);
        try {
          const trendImg = await toPng(chartsRefDaily.current, { backgroundColor: "#ffffff" });
          doc.setFontSize(12);
          doc.text("1. Tendencia de Producción Científica", margin, 35);
          doc.addImage(trendImg, "PNG", margin, 40, contentWidth, 80);
          
          const authorImg = await toPng(chartsRefAuthors.current, { backgroundColor: "#ffffff" });
          doc.text("2. Productividad por Autor (Top 10)", margin, 135);
          doc.addImage(authorImg, "PNG", margin, 140, contentWidth, 80);
        } catch (e) { console.error(e); }
      }

      // 3. --- CONTENT PAGES ---
      doc.addPage();
      let cursorY = 25;
      const lineHeight = 7;
      let globalBold = false;
      let globalItalic = false;

      const drawTextLineWrapped = (text: string, x: number, maxWidth: number, isHeading = false) => {
        // Replace !’ with ➜ globally and use special markers to track styles
        // \u0001 = toggle bold, \u0002 = toggle italic
        let processed = text.replace(/!’/g, "➜ ").replace(/\*\*/g, "\u0001").replace(/\*/g, "\u0002");
        const lines = doc.splitTextToSize(processed, maxWidth);
        
        lines.forEach((line: string) => {
          if (cursorY > pageHeight - margin) {
            doc.addPage();
            cursorY = margin;
          }

          let currentX = x;
          // Segments split by style markers
          const segments = line.split(/([\u0001\u0002])/g);
          
          segments.forEach(segment => {
            if (segment === "\u0001") {
              globalBold = !globalBold;
            } else if (segment === "\u0002") {
              globalItalic = !globalItalic;
            } else if (segment) {
              // Determine font style
              let style = "normal";
              if ((globalBold || isHeading) && globalItalic) style = "bolditalic";
              else if (globalBold || isHeading) style = "bold";
              else if (globalItalic) style = "italic";
              
              doc.setFont("times", style);
              doc.text(segment, currentX, cursorY);
              currentX += doc.getTextWidth(segment);
            }
          });
          cursorY += lineHeight;
        });
      };

      const markdownLines = result.split("\n");
      for (let i = 0; i < markdownLines.length; i++) {
        let line = markdownLines[i].trim();
        if (!line) { 
          cursorY += 4; 
          continue; 
        }

        if (cursorY > pageHeight - margin) {
          doc.addPage();
          cursorY = margin;
        }

        // Table Detection
        if (line.startsWith("|")) {
          const tableData = [];
          while (i < markdownLines.length && markdownLines[i].trim().startsWith("|")) {
            const rowContent = markdownLines[i].trim().split("|")
              .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)
              .map(c => c.trim().replace(/\*\*/g, "").replace(/\*/g, "")); 
            if (rowContent.length > 0 && !markdownLines[i].includes("---")) {
              tableData.push(rowContent);
            }
            i++;
          }
          i--; 
          if (tableData.length > 0) {
            autoTable(doc, {
              head: [tableData[0]],
              body: tableData.slice(1),
              startY: cursorY,
              margin: { left: margin, right: margin },
              theme: "striped",
              styles: { font: "times", fontSize: 9, cellPadding: 2 },
              headStyles: { fillColor: [15, 23, 42], textColor: 255 },
            });
            cursorY = (doc as any).lastAutoTable.finalY + 10;
          }
          continue;
        }

        // Heading Detection
        if (line.startsWith("# ")) {
          doc.setFontSize(16);
          drawTextLineWrapped(line.replace("# ", ""), margin, contentWidth, true);
          cursorY += 2;
          globalBold = false; // Reset style after heading
          globalItalic = false;
        } else if (line.startsWith("## ")) {
          doc.setFontSize(14);
          drawTextLineWrapped(line.replace("## ", ""), margin, contentWidth, true);
          cursorY += 1;
          globalBold = false;
          globalItalic = false;
        } else if (line.startsWith("- ") || line.startsWith("* ") || line.startsWith("• ") || line.match(/^[0-9]+\. /) || line.startsWith("!’")) {
          doc.setFontSize(11);
          let bullet = "• ";
          let content = line;
          
          if (line.startsWith("- ") || line.startsWith("* ")) {
            content = line.substring(2);
          } else if (line.startsWith("• ")) {
            content = line.substring(2);
          } else if (line.startsWith("!’")) {
            bullet = "➜ "; // Replaced !’ with a professional arrow
            content = line.substring(2);
          } else if (line.match(/^[0-9]+\. /)) {
            const match = line.match(/^[0-9]+\. /);
            bullet = match ? match[0] : "1. ";
            content = line.substring(bullet.length);
          }

          const bWidth = doc.getTextWidth(bullet);
          doc.setFont("times", "normal");
          doc.text(bullet, margin, cursorY);
          drawTextLineWrapped(content, margin + bWidth, contentWidth - bWidth);
          globalBold = false;
          globalItalic = false;
        } else {
          doc.setFontSize(11);
          drawTextLineWrapped(line, margin, contentWidth);
          globalBold = false;
          globalItalic = false;
        }
      }

      doc.save(`BibliometrIA_Analisis_${file?.name.replace(".ris", "")}.pdf`);
    } catch (err) {
      console.error(err);
      setError("Error al generar el reporte completo.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-cyan-500/30">
      {/* NAVBAR */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 h-18 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div whileHover={{ rotate: 180 }} transition={{ duration: 0.5 }} className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white p-2 rounded-xl shadow-lg shadow-cyan-500/20">
              <BarChart2 className="w-6 h-6" />
            </motion.div>
            <div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">BibliometrIA</h1>
              <p className="text-[10px] text-cyan-500 font-bold tracking-[0.2em] uppercase">AI Research Intelligence</p>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <button onClick={() => setIsAboutOpen(true)} className="text-sm font-medium text-slate-400 hover:text-white transition-colors flex items-center gap-2"><Info className="w-4 h-4" />About Us</button>
            <a href="https://github.com/iamjuaness/BibliometrIA" target="_blank" className="text-sm font-medium text-slate-400 hover:text-white transition-colors flex items-center gap-2"><Github className="w-4 h-4" />Github</a>
            <button className="px-5 py-2.5 rounded-full bg-slate-900 border border-slate-700 text-sm font-semibold hover:bg-slate-800 transition-all">Launch Agent</button>
          </nav>
          <button className="md:hidden p-2 text-slate-400 hover:text-white" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>{isMobileMenuOpen ? <X /> : <Menu />}</button>
        </div>
      </header>

      {/* MOBILE MENU */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="fixed inset-0 z-40 bg-slate-950 pt-24 px-6 md:hidden text-center">
            <div className="flex flex-col gap-8">
              <button onClick={() => { setIsAboutOpen(true); setIsMobileMenuOpen(false); }} className="text-2xl font-bold text-slate-200">About Us</button>
              <a href="https://github.com/iamjuaness/BibliometrIA" className="text-2xl font-bold text-slate-200">Github</a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ABOUT MODAL */}
      <AnimatePresence>
        {isAboutOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAboutOpen(false)} className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative w-full max-w-2xl glass-card rounded-3xl p-8 overflow-hidden">
              <button onClick={() => setIsAboutOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X /></button>
              <div className="flex items-start gap-6 mb-8">
                <div className="bg-cyan-500/20 p-4 rounded-2xl"><Award className="w-10 h-10 text-cyan-400" /></div>
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">Sobre Nosotros</h2>
                  <p className="text-slate-400 leading-relaxed">BibliometrIA es una plataforma que utiliza IA para simplificar la investigación bibliométrica.</p>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-6 mb-8">
                <div className="p-5 rounded-2xl bg-white/5 border border-white/10"><h3 className="text-cyan-400 font-bold mb-1 uppercase text-xs">Lead Dev</h3><p className="text-xl font-bold text-white">Juan Esteban Cardona</p></div>
                <div className="p-5 rounded-2xl bg-white/5 border border-white/10"><h3 className="text-cyan-400 font-bold mb-1 uppercase text-xs">AI Dev</h3><p className="text-xl font-bold text-white">Juan Esteban Ramirez</p></div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="relative pt-32 pb-20 px-6 overflow-hidden">
        <div className="max-w-4xl mx-auto text-center">
          <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-5xl md:text-7xl font-extrabold mb-6 tracking-tight">Análisis Bibliométrico <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Inteligente</span></motion.h2>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-xl text-slate-400 mb-10 leading-relaxed max-w-2xl mx-auto">Sube tu archivo .ris para generar gráficas y reportes académicos completos.</motion.p>
        </div>

        <div className="max-w-3xl mx-auto">
          {error && <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl flex items-center gap-3"><X /> {error}</div>}
          <div className="glass-card rounded-[2.5rem] p-8 md:p-12 mb-8 text-center">
            {!file ? (
              <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-slate-700/50 rounded-[2rem] p-12 hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all cursor-pointer">
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".ris" className="hidden" />
                <UploadCloud className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-xl font-bold text-white mb-2">Haz clic para subir .ris</p>
              </div>
            ) : (
              <div className="flex items-center justify-between p-6 bg-slate-900/50 rounded-3xl border border-slate-700">
                <div className="flex items-center gap-4"><FileText className="text-cyan-400" /> <span className="font-bold">{file.name}</span></div>
                <button onClick={removeFile} className="p-2 hover:bg-red-500/20 rounded-xl"><X className="text-slate-400" /></button>
              </div>
            )}
            <button onClick={analyzeFile} disabled={!file || isLoading} className="mt-10 px-10 py-5 rounded-2xl font-bold text-white bg-gradient-to-r from-cyan-600 to-blue-600 disabled:opacity-50">
              {isLoading ? "Analizando..." : "Comenzar Análisis"}
            </button>
          </div>
        </div>

        {stats && (
          <div className="max-w-6xl mx-auto mt-12 space-y-8">
            <div className="grid md:grid-cols-2 gap-8">
              <div className="glass-card rounded-[2rem] p-8 border border-white/5">
                <h3 className="font-bold text-white mb-6 flex items-center gap-2"><TrendingUp className="text-cyan-400"/> Producción por Año</h3>
                <div ref={chartsRefDaily} className="h-64 bg-white/5 rounded-2xl p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={formatChartData(stats.publicaciones_por_anio)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                      <YAxis stroke="#94a3b8" fontSize={12} />
                      <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderRadius: "12px" }} />
                      <Area type="monotone" dataKey="value" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="glass-card rounded-[2rem] p-8 border border-white/5">
                <h3 className="font-bold text-white mb-6 flex items-center gap-2"><Users className="text-blue-400"/> Top Autores</h3>
                <div ref={chartsRefAuthors} className="h-64 bg-white/5 rounded-2xl p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={formatChartData(stats.top_10_autores).reverse()}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={10} width={100} />
                      <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderRadius: "12px" }} />
                      <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {result && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
                <div className="bg-white/5 px-8 h-20 flex items-center justify-between border-b border-white/5">
                  <h3 className="font-bold text-white uppercase text-xs tracking-widest">Reporte Académico Interpretativo</h3>
                  <button onClick={generateProfessionalPDF} disabled={isGeneratingPDF} className="px-6 py-2.5 bg-cyan-500 text-slate-950 rounded-xl font-bold flex items-center gap-2 hover:bg-cyan-400 transition-colors">
                    {isGeneratingPDF ? <Loader2 className="animate-spin" /> : <><Download size={16}/> Exportar Reporte</>}
                  </button>
                </div>
                <div className="p-10 md:p-14 prose prose-invert prose-slate max-w-none 
                  prose-table:border prose-table:border-slate-800 prose-th:bg-slate-800 prose-th:p-3 prose-td:p-3 prose-td:border-t prose-td:border-slate-800">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>

      <footer className="mt-20 py-12 text-center text-slate-500 text-sm border-t border-slate-900">
        <p>© {new Date().getFullYear()} BibliometrIA Team. Excelencia Científica.</p>
      </footer>
    </main>
  );
}
