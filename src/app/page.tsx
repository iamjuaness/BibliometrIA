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
  Plus,
  Trash2,
  History,
  Clock,
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
import WordCloud from "react-d3-cloud";

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [researchers, setResearchers] = useState<string[]>([""]);
  const [articleCount, setArticleCount] = useState<number | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(
    "Iniciando Extracción...",
  );

  const loadingMessages = [
    "Leyendo archivos bibliográficos...",
    "Identificando bases de datos...",
    "Curando metadatos de artículos...",
    "Modelando temas con LDA...",
    "Construyendo red de coautoría...",
    "Generando informe con IA avanzada...",
    "Finalizando síntesis ejecutiva...",
  ];

  // Cycling loading messages
  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      let i = 0;
      interval = setInterval(() => {
        setLoadingMessage(loadingMessages[i % loadingMessages.length]);
        i++;
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const chartsRefDaily = useRef<HTMLDivElement>(null);
  const chartsRefAuthors = useRef<HTMLDivElement>(null);
  const chartsRefKeywords = useRef<HTMLDivElement>(null);
  const chartsRefJournals = useRef<HTMLDivElement>(null);
  const chartsRefCoauth = useRef<HTMLDivElement>(null);
  const chartsRefCloud = useRef<HTMLDivElement>(null);

  // Load history on mount
  React.useEffect(() => {
    const savedHistory = localStorage.getItem("bibliometria_history");
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Error loading history", e);
      }
    }
  }, []);

  // Save history helper
  const addToHistory = (newItem: any) => {
    const updatedHistory = [
      newItem,
      ...history.filter((h) => h.id !== newItem.id),
    ].slice(0, 3);
    setHistory(updatedHistory);
    localStorage.setItem(
      "bibliometria_history",
      JSON.stringify(updatedHistory),
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      const allowedExtensions = [".ris", ".bib", ".bibtex", ".bibtext", ".csv"];
      const invalidFiles = selectedFiles.filter(
        (f) =>
          !allowedExtensions.some((ext) => f.name.toLowerCase().endsWith(ext)),
      );

      if (invalidFiles.length > 0) {
        setError(
          `Archivos no permitidos: ${invalidFiles.map((f) => f.name).join(", ")}. Use .ris, .bib, o .csv`,
        );
        return;
      }

      setFiles((prev) => [...prev, ...selectedFiles]);
      setError(null);
      setResult(null);
      setStats(null);

      // We'll update the article count during analysis for accuracy since it's now multi-format
    }
  };

  const removeFile = (index: number) => {
    const newFiles = [...files];
    newFiles.splice(index, 1);
    setFiles(newFiles);
    if (newFiles.length === 0) {
      setResult(null);
      setStats(null);
      setArticleCount(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAllFiles = () => {
    setFiles([]);
    setResult(null);
    setStats(null);
    setArticleCount(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const addResearcher = () => {
    setResearchers([...researchers, ""]);
  };

  const updateResearcher = (index: number, value: string) => {
    const newResearchers = [...researchers];
    newResearchers[index] = value;
    setResearchers(newResearchers);
  };

  const removeResearcher = (index: number) => {
    if (researchers.length > 1) {
      const newResearchers = researchers.filter((_, i) => i !== index);
      setResearchers(newResearchers);
    } else {
      setResearchers([""]);
    }
  };

  const readFilesAsText = async (filesToRead: File[]) => {
    return Promise.all(
      filesToRead.map((file) => {
        return new Promise<{ name: string; content: string }>(
          (resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) =>
              resolve({ name: file.name, content: e.target?.result as string });
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
          },
        );
      }),
    );
  };

  const analyzeFile = async () => {
    if (files.length === 0) {
      setError("Por favor, sube al menos un archivo.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);
    setStats(null);

    try {
      const filesWithContent = await readFilesAsText(files);

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: filesWithContent }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error en la respuesta del servidor");
      }

      setResult(data.text);
      setStats(data.stats);
      setArticleCount(data.stats.total_articulos);

      // Add to history
      addToHistory({
        id: Date.now().toString(),
        fileName: files.length > 1 ? `${files.length} archivos` : files[0].name,
        text: data.text,
        stats: data.stats,
        date: new Date().toLocaleString(),
      });
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Ocurrió un error al procesar los archivos.");
    } finally {
      setIsLoading(false);
    }
  };

  const formatChartData = (obj: any, sortByName = false) => {
    if (!obj) return [];
    const data = Object.entries(obj).map(([name, value]) => ({ name, value }));
    if (sortByName) {
      return data.sort((a, b) =>
        isNaN(Number(a.name)) ? 0 : Number(a.name) - Number(b.name),
      );
    }
    return data.sort((a: any, b: any) => b.value - a.value);
  };

  const generateProfessionalPDF = async () => {
    if (!result || !stats) return;
    setIsGeneratingPDF(true);

    try {
      const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 18;
      const contentWidth = pageWidth - margin * 2;

      let cursorY = margin;
      let tocPageNumber = 2;

      type InlineToken = {
        text: string;
        bold?: boolean;
        italic?: boolean;
      };

      type Block =
        | { type: "heading"; level: number; text: string }
        | { type: "paragraph"; text: string }
        | { type: "list"; items: string[]; ordered: boolean }
        | { type: "table"; rows: string[][] }
        | { type: "chart"; key: string }
        | { type: "blockquote"; text: string }
        | { type: "hr" };

      const tocEntries: { text: string; page: number; level: number }[] = [];

      const addPage = () => {
        doc.addPage();
        cursorY = margin;
        drawHeader();
        drawFooter();
      };

      const ensureSpace = (needed = 10) => {
        if (cursorY + needed > pageHeight - 16) {
          addPage();
        }
      };

      const drawHeader = () => {
        doc.setFillColor(248, 250, 252);
        doc.rect(0, 0, pageWidth, 12, "F");

        doc.setDrawColor(226, 232, 240);
        doc.line(margin, 12, pageWidth - margin, 12);

        doc.setFont("times", "bold");
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text("BibliometrIA Enterprise", margin, 8);

        doc.setFont("times", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text(
          "Sistema de Inteligencia de Investigación",
          pageWidth - margin,
          8,
          {
            align: "right",
          },
        );
      };

      const drawFooter = () => {
        const currentPage = doc.getCurrentPageInfo().pageNumber;

        doc.setDrawColor(226, 232, 240);
        doc.line(margin, pageHeight - 11, pageWidth - margin, pageHeight - 11);

        doc.setFont("times", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(148, 163, 184);
        doc.text(`Página ${currentPage}`, pageWidth - margin, pageHeight - 6, {
          align: "right",
        });
      };

      const cleanInlineMarkdown = (text: string) => {
        return text
          .replace(/<br\s*\/?>/gi, " ")
          .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
          .replace(/`([^`]+)`/g, "$1")
          .trim();
      };

      const parseInlineTokens = (text: string): InlineToken[] => {
        const normalized = cleanInlineMarkdown(text);
        const regex = /(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*)/g;
        const parts = normalized.split(regex).filter(Boolean);

        return parts.map((part) => {
          if (/^\*\*\*.*\*\*\*$/.test(part)) {
            return {
              text: part.slice(3, -3),
              bold: true,
              italic: true,
            };
          }

          if (/^\*\*.*\*\*$/.test(part)) {
            return {
              text: part.slice(2, -2),
              bold: true,
            };
          }

          if (/^\*.*\*$/.test(part)) {
            return {
              text: part.slice(1, -1),
              italic: true,
            };
          }

          return { text: part };
        });
      };

      const getFontStyle = (token: InlineToken) => {
        if (token.bold && token.italic) return "bolditalic";
        if (token.bold) return "bold";
        if (token.italic) return "italic";
        return "normal";
      };

      const isTableSeparatorLine = (line: string) => {
        return /^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim());
      };

      const isHorizontalRule = (line: string) => {
        return /^(-{3,}|\*{3,}|_{3,})$/.test(line.trim());
      };

      const parseMarkdownBlocks = (markdown: string): Block[] => {
        const normalized = markdown.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
        const lines = normalized.split("\n");
        const blocks: Block[] = [];
        let i = 0;

        while (i < lines.length) {
          const line = lines[i].trim();

          if (!line) {
            i++;
            continue;
          }

          if (isHorizontalRule(line)) {
            blocks.push({ type: "hr" });
            i++;
            continue;
          }

          const chartMatch = line.match(/^\{chart:([a-zA-Z]+)\}$/);
          if (chartMatch) {
            blocks.push({ type: "chart", key: chartMatch[1] });
            i++;
            continue;
          }

          const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
          if (headingMatch) {
            blocks.push({
              type: "heading",
              level: headingMatch[1].length,
              text: cleanInlineMarkdown(headingMatch[2]),
            });
            i++;
            continue;
          }

          if (/^\s*>\s+/.test(line)) {
            const quoteLines: string[] = [];
            while (i < lines.length && /^\s*>\s+/.test(lines[i].trim())) {
              quoteLines.push(lines[i].trim().replace(/^\s*>\s+/, ""));
              i++;
            }

            blocks.push({
              type: "blockquote",
              text: quoteLines.join(" "),
            });
            continue;
          }

          if (/^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
            const ordered = /^\s*\d+\.\s+/.test(line);
            const items: string[] = [];

            while (i < lines.length) {
              const current = lines[i].trim();
              if (
                ordered
                  ? /^\s*\d+\.\s+/.test(current)
                  : /^\s*[-*]\s+/.test(current)
              ) {
                items.push(
                  cleanInlineMarkdown(
                    current
                      .replace(/^\s*[-*]\s+/, "")
                      .replace(/^\s*\d+\.\s+/, ""),
                  ),
                );
                i++;
              } else if (!current) {
                i++;
                break;
              } else {
                break;
              }
            }

            if (items.length) {
              blocks.push({ type: "list", items, ordered });
            }
            continue;
          }

          if (line.startsWith("|")) {
            const tableLines: string[] = [];
            while (i < lines.length && lines[i].trim().startsWith("|")) {
              tableLines.push(lines[i].trim());
              i++;
            }

            const rows = tableLines
              .filter((row, idx) => !(idx === 1 && isTableSeparatorLine(row)))
              .filter((row) => !isTableSeparatorLine(row))
              .map((row) =>
                row
                  .split("|")
                  .slice(1, -1)
                  .map((cell) => cleanInlineMarkdown(cell.trim())),
              )
              .filter((row) => row.length > 0);

            if (rows.length) {
              blocks.push({ type: "table", rows });
            }
            continue;
          }

          const paragraphLines: string[] = [];
          while (i < lines.length) {
            const current = lines[i].trim();

            if (!current) break;
            if (isHorizontalRule(current)) break;
            if (/^\{chart:([a-zA-Z]+)\}$/.test(current)) break;
            if (/^(#{1,6})\s+/.test(current)) break;
            if (/^\s*>\s+/.test(current)) break;
            if (/^\s*[-*]\s+/.test(current)) break;
            if (/^\s*\d+\.\s+/.test(current)) break;
            if (current.startsWith("|")) break;

            paragraphLines.push(current);
            i++;
          }

          const paragraphText = paragraphLines.join(" ").trim();
          if (paragraphText) {
            blocks.push({
              type: "paragraph",
              text: paragraphText,
            });
          }

          if (i < lines.length && !lines[i].trim()) i++;
        }

        return blocks;
      };

      const getChartImage = async (chartKey: string) => {
        let ref: React.RefObject<HTMLDivElement | null> | null = null;

        if (chartKey === "trends") ref = chartsRefDaily;
        else if (chartKey === "authors") ref = chartsRefAuthors;
        else if (chartKey === "keywords") ref = chartsRefKeywords;
        else if (chartKey === "journals") ref = chartsRefJournals;
        else if (chartKey === "coauthorship") ref = chartsRefCoauth;
        else if (chartKey === "wordcloud") ref = chartsRefCloud;

        if (ref?.current) {
          try {
            return await toPng(ref.current, {
              backgroundColor: "#ffffff",
              pixelRatio: 2,
              cacheBust: true,
            });
          } catch {
            return null;
          }
        }

        return null;
      };

      const wrapInlineTokens = (
        tokens: InlineToken[],
        maxWidth: number,
        fontSize = 11,
      ): InlineToken[][] => {
        const lines: InlineToken[][] = [];
        let currentLine: InlineToken[] = [];
        let currentWidth = 0;

        tokens.forEach((token) => {
          const fragments = token.text
            .split(/(\s+)/)
            .filter((p) => p.length > 0);

          fragments.forEach((fragment) => {
            const fragmentToken: InlineToken = {
              text: fragment,
              bold: token.bold,
              italic: token.italic,
            };

            doc.setFont("times", getFontStyle(fragmentToken) as any);
            doc.setFontSize(fontSize);
            const fragmentWidth = doc.getTextWidth(fragment);

            if (
              currentWidth + fragmentWidth > maxWidth &&
              currentLine.length > 0
            ) {
              lines.push(currentLine);
              currentLine = [];
              currentWidth = 0;
            }

            currentLine.push(fragmentToken);
            currentWidth += fragmentWidth;
          });
        });

        if (currentLine.length > 0) {
          lines.push(currentLine);
        }

        return lines;
      };

      const renderInlineLine = (
        tokens: InlineToken[],
        x: number,
        y: number,
        fontSize = 11,
        color: [number, number, number] = [51, 65, 85],
      ) => {
        let currentX = x;

        tokens.forEach((token) => {
          const style = getFontStyle(token);
          doc.setFont("times", style as any);
          doc.setFontSize(fontSize);
          doc.setTextColor(color[0], color[1], color[2]);

          if (token.text) {
            doc.text(token.text, currentX, y);
            currentX += doc.getTextWidth(token.text);
          }
        });
      };

      const renderParagraph = (text: string) => {
        const tokens = parseInlineTokens(text);
        const wrappedLines = wrapInlineTokens(tokens, contentWidth, 11);

        wrappedLines.forEach((lineTokens) => {
          ensureSpace(7);
          renderInlineLine(lineTokens, margin, cursorY, 11);
          cursorY += 6;
        });

        cursorY += 2.5;
      };

      const renderList = (items: string[], ordered: boolean) => {
        items.forEach((item, idx) => {
          const bullet = ordered ? `${idx + 1}. ` : "• ";
          doc.setFont("times", "normal");
          doc.setFontSize(10.8);
          const bulletWidth = doc.getTextWidth(bullet) + 2;
          const availableWidth = contentWidth - bulletWidth;

          const tokens = parseInlineTokens(item);
          const wrappedLines = wrapInlineTokens(tokens, availableWidth, 10.8);

          wrappedLines.forEach((lineTokens, lineIndex) => {
            ensureSpace(7);

            if (lineIndex === 0) {
              doc.setFont("times", "normal");
              doc.setFontSize(10.8);
              doc.setTextColor(51, 65, 85);
              doc.text(bullet, margin, cursorY);
              renderInlineLine(
                lineTokens,
                margin + bulletWidth,
                cursorY,
                10.8,
                [51, 65, 85],
              );
            } else {
              renderInlineLine(
                lineTokens,
                margin + bulletWidth,
                cursorY,
                10.8,
                [51, 65, 85],
              );
            }

            cursorY += 5.8;
          });

          cursorY += 1;
        });

        cursorY += 1.5;
      };

      const renderBlockquote = (text: string) => {
        const quoteX = margin + 6;
        const quoteWidth = contentWidth - 6;

        const tokens = parseInlineTokens(text);
        const wrappedLines = wrapInlineTokens(tokens, quoteWidth - 6, 10.5);
        const blockHeight = wrappedLines.length * 5.6 + 8;

        ensureSpace(blockHeight + 4);

        doc.setFillColor(248, 250, 252);
        doc.roundedRect(
          margin,
          cursorY - 4,
          contentWidth,
          blockHeight,
          1.5,
          1.5,
          "F",
        );

        doc.setDrawColor(6, 182, 212);
        doc.setLineWidth(1);
        doc.line(
          margin + 2,
          cursorY - 3,
          margin + 2,
          cursorY - 3 + blockHeight - 2,
        );

        wrappedLines.forEach((lineTokens) => {
          renderInlineLine(
            lineTokens,
            quoteX,
            cursorY + 1,
            10.5,
            [71, 85, 105],
          );
          cursorY += 5.6;
        });

        cursorY += 4;
      };

      const renderHorizontalRule = () => {
        ensureSpace(8);
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.4);
        doc.line(margin, cursorY, pageWidth - margin, cursorY);
        cursorY += 5;
      };

      const renderHeading = (text: string, level: number) => {
        if (level <= 2 && cursorY > pageHeight * 0.72) {
          addPage();
        } else {
          ensureSpace(level === 1 ? 18 : 14);
        }

        doc.setTextColor(15, 23, 42);
        doc.setFont("times", "bold");

        let fontSize = 12;
        let lineGap = 6.5;

        if (level === 1) {
          fontSize = 20;
          lineGap = 8.5;
        } else if (level === 2) {
          fontSize = 15.5;
          lineGap = 7.2;
        } else if (level === 3) {
          fontSize = 13;
          lineGap = 6.5;
        }

        doc.setFontSize(fontSize);
        const lines = doc.splitTextToSize(text, contentWidth);
        doc.text(lines, margin, cursorY);
        cursorY += lines.length * lineGap;

        if (level <= 2) {
          doc.setDrawColor(226, 232, 240);
          doc.line(margin, cursorY, pageWidth - margin, cursorY);
          cursorY += 5;
        } else {
          cursorY += 2;
        }

        const page = doc.getCurrentPageInfo().pageNumber;
        tocEntries.push({ text, page, level });
      };

      const renderTable = (rows: string[][]) => {
        if (!rows.length) return;

        ensureSpace(18);

        autoTable(doc, {
          head: [rows[0]],
          body: rows.slice(1),
          startY: cursorY,
          theme: "grid",
          margin: { left: margin, right: margin },
          styles: {
            font: "times",
            fontSize: 9,
            textColor: [51, 65, 85],
            cellPadding: 2.3,
            overflow: "linebreak",
            valign: "middle",
            lineColor: [226, 232, 240],
            lineWidth: 0.1,
          },
          headStyles: {
            fillColor: [15, 23, 42],
            textColor: [255, 255, 255],
            fontStyle: "bold",
          },
          alternateRowStyles: {
            fillColor: [248, 250, 252],
          },
        });

        cursorY = (doc as any).lastAutoTable.finalY + 6;
      };

      const renderChart = async (key: string) => {
        const img = await getChartImage(key);
        if (!img) return;

        const chartHeight = key === "wordcloud" ? 88 : 72;
        ensureSpace(chartHeight + 12);

        doc.addImage(img, "PNG", margin, cursorY, contentWidth, chartHeight);
        cursorY += chartHeight + 6;
      };

      const drawCover = () => {
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, pageWidth, 58, "F");

        doc.setTextColor(255, 255, 255);
        doc.setFont("times", "bold");
        doc.setFontSize(24);
        doc.text("BibliometrIA", margin, 28);

        doc.setFontSize(10);
        doc.text("SISTEMA DE INTELIGENCIA DE INVESTIGACIÓN", margin, 36);

        doc.setTextColor(15, 23, 42);
        doc.setFont("times", "bold");
        doc.setFontSize(18);

        const title = `Análisis Bibliométrico de ${
          articleCount ?? stats.total_articulos ?? 0
        } Artículos`;

        const titleLines = doc.splitTextToSize(title, contentWidth);
        doc.text(titleLines, margin, 78);

        doc.setDrawColor(203, 213, 225);
        doc.line(margin, 90, pageWidth - margin, 90);

        let coverY = 104;

        doc.setFont("times", "bold");
        doc.setFontSize(12);
        doc.text("Investigadores:", margin, coverY);
        coverY += 9;

        doc.setFont("times", "normal");
        const validResearchers = researchers.filter(
          (name) => name.trim() !== "",
        );
        if (validResearchers.length) {
          validResearchers.forEach((name) => {
            const lines = doc.splitTextToSize(`• ${name}`, contentWidth - 5);
            doc.text(lines, margin + 3, coverY);
            coverY += lines.length * 6 + 1;
          });
        } else {
          doc.text("• No especificados", margin + 3, coverY);
          coverY += 7;
        }

        coverY += 5;
        doc.setFont("times", "bold");
        doc.text("Bases de datos analizadas:", margin, coverY);
        coverY += 9;

        doc.setFont("times", "normal");
        (stats.analisis_por_bd || []).forEach((db: any) => {
          const dbText = `- ${db.database} (${db.article_count} documentos)`;
          const dbLines = doc.splitTextToSize(dbText, contentWidth - 5);
          doc.text(dbLines, margin + 3, coverY);
          coverY += dbLines.length * 6 + 1;
        });

        doc.setFont("times", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(100, 116, 139);
        doc.text(
          `Generado el ${new Date().toLocaleDateString()}`,
          pageWidth / 2,
          282,
          { align: "center" },
        );
      };

      const drawTOCPlaceholderPage = () => {
        doc.addPage();
        drawHeader();
        drawFooter();
        cursorY = 24;

        doc.setFont("times", "bold");
        doc.setFontSize(18);
        doc.setTextColor(15, 23, 42);
        doc.text("Tabla de contenido", margin, cursorY);
      };

      const renderTOC = () => {
        doc.setPage(tocPageNumber);
        drawHeader();
        drawFooter();

        doc.setFillColor(255, 255, 255);
        doc.rect(0, 12, pageWidth, pageHeight - 24, "F");

        let tocY = 24;

        doc.setFont("times", "bold");
        doc.setFontSize(18);
        doc.setTextColor(15, 23, 42);
        doc.text("Tabla de contenido", margin, tocY);
        tocY += 10;

        tocEntries.forEach((entry) => {
          if (tocY > pageHeight - 20) return;

          const indent = entry.level === 1 ? 0 : entry.level === 2 ? 6 : 12;
          const titleWidth = contentWidth - 22 - indent;
          const title = entry.text;
          const visibleTitle =
            doc.splitTextToSize(title, titleWidth)[0] || title;

          doc.setFont("times", entry.level <= 2 ? "bold" : "normal");
          doc.setFontSize(entry.level === 1 ? 11 : 10);
          doc.setTextColor(51, 65, 85);
          doc.text(visibleTitle, margin + indent, tocY);

          doc.setDrawColor(203, 213, 225);
          doc.setLineWidth(0.1);
          doc.line(
            margin + indent + 60,
            tocY - 1,
            pageWidth - margin - 10,
            tocY - 1,
          );

          doc.setFont("times", "normal");
          doc.text(String(entry.page), pageWidth - margin, tocY, {
            align: "right",
          });

          tocY += entry.level === 1 ? 7 : 6;
        });
      };

      drawCover();
      drawFooter();

      drawTOCPlaceholderPage();

      doc.addPage();
      cursorY = margin;
      drawHeader();
      drawFooter();

      const blocks = parseMarkdownBlocks(result);

      for (const block of blocks) {
        if (block.type === "heading") {
          renderHeading(block.text, block.level);
        } else if (block.type === "paragraph") {
          renderParagraph(block.text);
        } else if (block.type === "list") {
          renderList(block.items, block.ordered);
        } else if (block.type === "table") {
          renderTable(block.rows);
        } else if (block.type === "chart") {
          await renderChart(block.key);
        } else if (block.type === "blockquote") {
          renderBlockquote(block.text);
        } else if (block.type === "hr") {
          renderHorizontalRule();
        }
      }

      renderTOC();

      const totalPages = doc.getNumberOfPages();
      for (let page = 1; page <= totalPages; page++) {
        doc.setPage(page);

        doc.setDrawColor(226, 232, 240);
        doc.line(margin, pageHeight - 11, pageWidth - margin, pageHeight - 11);

        doc.setFont("times", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Página ${page} de ${totalPages}`,
          pageWidth - margin,
          pageHeight - 6,
          { align: "right" },
        );
      }

      doc.save(`BibliometrIA_Analisis_Pro_${Date.now()}.pdf`);
    } catch (err) {
      console.error(err);
      setError("Error al generar el reporte Premium.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-cyan-500/30">
      <header className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 h-18 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              whileHover={{ rotate: 180 }}
              transition={{ duration: 0.5 }}
              className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white p-2 rounded-xl shadow-lg shadow-cyan-500/20"
            >
              <BarChart2 className="w-6 h-6" />
            </motion.div>
            <div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                BibliometrIA
              </h1>
              <p className="text-[10px] text-cyan-500 font-bold tracking-[0.2em] uppercase">
                Enterprise Research Intelligence
              </p>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <button
              onClick={() => setIsAboutOpen(true)}
              className="text-sm font-medium text-slate-400 hover:text-white transition-colors flex items-center gap-2"
            >
              <Info className="w-4 h-4" />
              About Us
            </button>
            <div className="relative">
              <button
                onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                className="text-sm font-medium text-slate-400 hover:text-white transition-colors flex items-center gap-2"
              >
                <History className="w-4 h-4" /> Historial
              </button>
              <AnimatePresence>
                {isHistoryOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-4 w-80 bg-slate-900 border border-white/10 shadow-2xl z-50 rounded-2xl p-4"
                  >
                    <h3 className="text-xs font-bold text-cyan-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Clock size={14} /> Recientes
                    </h3>
                    <div className="space-y-2">
                      {history.length > 0 ? (
                        history.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => {
                              setResult(item.text);
                              setStats(item.stats);
                              setIsHistoryOpen(false);
                              window.scrollTo({ top: 800, behavior: "smooth" });
                            }}
                            className="w-full text-left p-3 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10 transition-all group"
                          >
                            <p className="text-sm font-bold text-white truncate mb-1 group-hover:text-cyan-400">
                              {item.fileName}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              {item.date}
                            </p>
                          </button>
                        ))
                      ) : (
                        <p className="text-center py-4 text-sm text-slate-500">
                          No hay archivos previos
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </nav>
        </div>
      </header>

      <div className="relative pt-32 pb-20 px-6 overflow-hidden">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-7xl font-extrabold mb-6 tracking-tight"
          >
            Análisis{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
              Multidimensional
            </span>
          </motion.h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Sube archivos de bases de datos científicas para análisis técnico,
            temático y de redes.
          </p>
        </div>

        {/* How it Works Section */}
        <div className="max-w-5xl mx-auto mb-20 grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            {
              icon: <UploadCloud className="text-cyan-400" />,
              title: "Extracción",
              desc: "Limpieza y lectura de archivos .ris, .bib y .csv.",
            },
            {
              icon: <Info className="text-blue-400" />,
              title: "Normalización",
              desc: "Identificación de bases de datos y curaduría de metadatos.",
            },
            {
              icon: <BarChart2 className="text-purple-400" />,
              title: "Análisis",
              desc: "Modelado de temas vía LDA y grafos de coautoría.",
            },
            {
              icon: <Send className="text-emerald-400" />,
              title: "Síntesis",
              desc: "Generación de informe ejecutivo mediante IA.",
            },
          ].map((step, i) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              key={i}
              className="bg-slate-900/40 border border-white/5 p-6 rounded-2xl hover:border-cyan-500/30 transition-all"
            >
              <div className="mb-4">{step.icon}</div>
              <h4 className="font-bold mb-2">{step.title}</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                {step.desc}
              </p>
            </motion.div>
          ))}
        </div>

        <div className="max-w-3xl mx-auto">
          {error && (
            <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl flex items-center gap-3">
              <X /> {error}
            </div>
          )}

          <div className="glass-card rounded-[2.5rem] p-8 md:p-12 mb-8">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700/50 rounded-[2rem] p-8 md:p-12 hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all cursor-pointer mb-6 text-center"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".ris,.bib,.csv"
                multiple
                className="hidden"
              />
              <UploadCloud className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-xl font-bold text-white mb-2">
                Subir Fuentes de Datos
              </p>
              <p className="text-slate-500 text-sm">
                ScienceDirect, Scopus, WoS, PubMed (.ris, .bib, .csv)
              </p>
            </div>

            {files.length > 0 && (
              <div className="space-y-3 mb-8">
                {files.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-4 bg-slate-900/50 rounded-2xl border border-slate-800"
                  >
                    <div className="flex items-center gap-3">
                      <div className="px-2 py-1 bg-cyan-500/10 text-cyan-400 text-[10px] font-bold rounded uppercase">
                        {f.name.split(/[_-]/)[0]}
                      </div>
                      <span className="text-sm font-medium truncate max-w-[200px]">
                        {f.name}
                      </span>
                    </div>
                    <button
                      onClick={() => removeFile(i)}
                      className="p-1.5 hover:bg-red-500/20 rounded-lg"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-10">
              <label className="block text-xs font-bold text-cyan-500 uppercase tracking-widest mb-4">
                Investigadores del Proyecto
              </label>
              <div className="space-y-3">
                {researchers.map((name, index) => (
                  <input
                    key={index}
                    value={name}
                    onChange={(e) => updateResearcher(index, e.target.value)}
                    placeholder="Nombre completo"
                    className="w-full bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3 focus:border-cyan-500/50 outline-none"
                  />
                ))}
              </div>
            </div>

            <button
              onClick={analyzeFile}
              disabled={files.length === 0 || isLoading}
              className="mt-10 w-full py-5 rounded-2xl font-bold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              {isLoading
                ? "Extrayendo Metadatos..."
                : "Generar Informe Científico"}
            </button>
          </div>
        </div>

        {stats && (
          <div className="max-w-6xl mx-auto mt-12 space-y-12">
            <div className="grid md:grid-cols-3 gap-6">
              {stats.analisis_por_bd.map((db: any, i: number) => (
                <div
                  key={i}
                  className="glass-card p-6 rounded-2xl border border-white/5"
                >
                  <h4 className="text-cyan-400 font-bold uppercase text-[10px] tracking-widest mb-2">
                    {db.database}
                  </h4>
                  <p className="text-2xl font-bold mb-4">
                    {db.article_count}{" "}
                    <span className="text-xs text-slate-500 font-normal">
                      Docs
                    </span>
                  </p>
                  <div className="space-y-2">
                    {db.top_topics.map((t: any, j: number) => (
                      <div
                        key={j}
                        className="text-[10px] bg-white/5 p-2 rounded-lg"
                      >
                        <span className="font-bold text-white">#{t.topic}</span>
                        : {t.keywords.slice(1, 3).join(", ")}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="glass-card p-8 rounded-[2rem] border border-white/5">
                <h3 className="font-bold mb-6 flex items-center gap-2">
                  <TrendingUp size={20} className="text-cyan-400" /> Cronología
                  Literaria
                </h3>
                <div ref={chartsRefDaily} className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={formatChartData(stats.publicaciones_por_anio, true)}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#1e293b"
                        vertical={false}
                      />
                      <XAxis dataKey="name" fontSize={10} stroke="#475569" />
                      <YAxis fontSize={10} stroke="#475569" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0f172a",
                          border: "none",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        fill="#06b6d4"
                        fillOpacity={0.2}
                        stroke="#06b6d4"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="glass-card p-8 rounded-[2rem] border border-white/5">
                <h3 className="font-bold mb-6 flex items-center gap-2">
                  <Users size={20} className="text-blue-400" /> Top Autores
                </h3>
                <div ref={chartsRefAuthors} className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={formatChartData(stats.top_10_autores)}
                    >
                      <XAxis type="number" hide />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={180}
                        fontSize={9}
                        stroke="#475569"
                      />

                      <Tooltip />
                      <Bar
                        dataKey="value"
                        fill="#3b82f6"
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Journals */}
              <div className="glass-card p-8 rounded-[2rem] border border-white/5">
                <h3 className="font-bold mb-6 flex items-center gap-2">
                  <BarChart2 size={20} className="text-orange-400" /> Top
                  Revistas
                </h3>
                <div ref={chartsRefJournals} className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={formatChartData(stats.top_10_revistas)}
                    >
                      <XAxis type="number" hide />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={180}
                        fontSize={9}
                        stroke="#475569"
                      />

                      <Tooltip />
                      <Bar
                        dataKey="value"
                        fill="#f97316"
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Co-authorship Network Concept */}
              <div className="glass-card p-8 rounded-[2rem] border border-white/5">
                <h3 className="font-bold mb-6 flex items-center gap-2">
                  <Plus size={20} className="text-emerald-400" /> Red de
                  Coautoría
                </h3>
                <div
                  ref={chartsRefCoauth}
                  className="h-64 relative bg-slate-950/50 rounded-xl overflow-hidden flex items-center justify-center"
                >
                  <svg width="100%" height="100%" viewBox="0 0 200 200">
                    {stats.coauthorship_links
                      .slice(0, 20)
                      .map((l: any, i: number) => (
                        <motion.line
                          key={i}
                          x1={100 + Math.cos(i) * 60}
                          y1={100 + Math.sin(i) * 60}
                          x2={100}
                          y2={100}
                          stroke="#334155"
                          strokeWidth="0.5"
                        />
                      ))}
                    {Object.keys(stats.top_10_autores).map((name, i) => (
                      <circle
                        key={i}
                        cx={100 + Math.cos(i) * 60}
                        cy={100 + Math.sin(i) * 60}
                        r="4"
                        fill="#10b981"
                      />
                    ))}
                    <circle cx="100" cy="100" r="8" fill="#3b82f6" />
                  </svg>
                  <div className="absolute bottom-4 right-4 text-[8px] text-slate-500 uppercase">
                    Interactive Network Matrix
                  </div>
                </div>
              </div>

              {/* WordCloud Concept */}
              <div className="glass-card p-8 rounded-[2rem] border border-white/5">
                <h3 className="font-bold mb-6 flex items-center gap-2">
                  <BookOpen size={20} className="text-purple-400" /> Nube de
                  Conceptos
                </h3>
                <div
                  ref={chartsRefCloud}
                  className="h-80 bg-slate-950/50 rounded-xl overflow-hidden"
                >
                  <WordCloud
                    data={Object.entries(stats.top_20_keywords).map(
                      ([text, value]) => ({
                        text,
                        value: (value as number) * 5,
                      }),
                    )}
                    width={500}
                    height={300}
                    font="Inter"
                    fontWeight="bold"
                    fontSize={(word) => Math.log2(word.value) * 8}
                    spiral="rectangular"
                    rotate={(word) => (word.value % 2 === 0 ? 0 : 90)}
                    padding={2}
                    fill={(d: any, i: number) =>
                      ["#06b6d4", "#3b82f6", "#8b5cf6", "#f97316"][i % 4]
                    }
                  />
                </div>
              </div>
            </div>

            {result && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-slate-900 border border-slate-800 rounded-[3rem] overflow-hidden shadow-2xl"
              >
                <div className="bg-white/5 px-10 h-24 flex items-center justify-between border-b border-white/5">
                  <div>
                    <h3 className="font-bold text-white text-lg tracking-tight">
                      Intelligence Report
                    </h3>
                    <p className="text-[10px] text-cyan-500 font-bold uppercase tracking-[0.2em]">
                      Validated by AI Architecture
                    </p>
                  </div>
                  <button
                    onClick={generateProfessionalPDF}
                    disabled={isGeneratingPDF}
                    className="px-8 py-3 bg-cyan-500 text-slate-950 rounded-2xl font-bold flex items-center gap-2 hover:bg-cyan-400 transition-all hover:shadow-[0_0_20px_rgba(6,182,212,0.4)]"
                  >
                    {isGeneratingPDF ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <>
                        <Download size={18} /> Exportar Reporte Premium
                      </>
                    )}
                  </button>
                </div>
                <div
                  className="p-12 md:p-20 prose prose-invert prose-slate max-w-none 
                  prose-h1:text-4xl prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-6
                  prose-p:text-slate-400 prose-p:leading-relaxed prose-table:rounded-xl prose-table:overflow-hidden"
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {result}
                  </ReactMarkdown>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>

      <footer className="mt-20 py-12 text-center text-slate-500 text-sm border-t border-slate-900">
        <p>
          © {new Date().getFullYear()} BibliometrIA Team. Excelencia Científica.
        </p>
      </footer>

      {/* Loading Overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-lg"
          >
            <div className="relative mb-12">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                className="w-40 h-40 border-t-4 border-cyan-500 border-r-4 border-r-transparent rounded-full"
              />
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 w-40 h-40 border-b-4 border-blue-600 border-l-4 border-l-transparent rounded-full opacity-50"
              />
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <div className="bg-cyan-500/20 p-6 rounded-full blur-xl absolute" />
                <BarChart2 size={48} className="text-cyan-400 relative z-10" />
              </motion.div>
            </div>

            <div className="text-center">
              <motion.h3
                key={loadingMessage}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-2xl font-bold text-white mb-3"
              >
                {loadingMessage}
              </motion.h3>
              <div className="flex items-center justify-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      delay: i * 0.2,
                    }}
                    className="w-1.5 h-1.5 bg-cyan-500 rounded-full"
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* About Us Modal */}

      <AnimatePresence>
        {isAboutOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-slate-900 border border-white/10 p-8 md:p-12 rounded-[2.5rem] max-w-2xl w-full shadow-2xl relative"
            >
              <button
                onClick={() => setIsAboutOpen(false)}
                className="absolute top-6 right-6 p-2 hover:bg-white/5 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-slate-400" />
              </button>

              <div className="flex items-center gap-4 mb-8">
                <div className="bg-gradient-to-br from-cyan-500 to-blue-600 p-3 rounded-2xl">
                  <Award className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-white tracking-tight">
                    Desarrolladores
                  </h2>
                  <p className="text-cyan-500 text-xs font-bold uppercase tracking-widest">
                    BibliometrIA Core Team
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                  <p className="text-slate-400 text-xs mb-1 uppercase tracking-tighter">
                    Senior Developer
                  </p>
                  <p className="text-xl font-bold text-white">
                    Juan Esteban Cardona
                  </p>
                </div>
                <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                  <p className="text-slate-400 text-xs mb-1 uppercase tracking-tighter">
                    Research Engineer
                  </p>
                  <p className="text-xl font-bold text-white">
                    Juan Esteban Ramirez
                  </p>
                </div>
              </div>

              <div className="space-y-4 text-slate-400 text-sm leading-relaxed">
                <p>
                  BibliometrIA es una plataforma de vanguardia diseñada para
                  automatizar la extracción de valor de grandes volúmenes de
                  datos científicos. Nuestra misión es democratizar el acceso a
                  análisis bibliométricos complejos mediante Inteligencia
                  Artificial.
                </p>
                <div className="flex items-center gap-6 pt-4 border-t border-white/5">
                  <div className="flex items-center gap-2 text-cyan-400 font-medium">
                    <Github size={18} /> @BibliometrIA-Project
                  </div>
                  <div className="text-slate-600 text-xs text-right flex-1">
                    Versión Enterprise 2.0.4 <br /> Build 2026.04.26
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
