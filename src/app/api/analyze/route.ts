import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const risContent = data.fileContent;

    // 1. PROCESAR EL RIS EN EL SERVIDOR (Cero tokens gastados)
    const lines = risContent.split("\n");
    const entries: any[] = [];
    let currentEntry: any = {};

    for (let line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("ER  -") || trimmed.startsWith("ER-")) {
        if (Object.keys(currentEntry).length > 0) {
          entries.push(currentEntry);
          currentEntry = {};
        }
      } else if (trimmed.includes("-")) {
        const parts = trimmed.split("-");
        const tag = parts[0].trim();
        const value = parts.slice(1).join("-").trim();

        if (tag === "AU") {
          currentEntry.authors = currentEntry.authors || [];
          currentEntry.authors.push(value);
        } else if (tag === "KW") {
          currentEntry.keywords = currentEntry.keywords || [];
          currentEntry.keywords.push(value);
        } else if (tag === "PY" || tag === "Y1") {
          currentEntry.year = value.split("/")[0];
        } else if (tag === "TI" || tag === "T1") {
          currentEntry.title = value;
        } else if (tag === "JO" || tag === "JF" || tag === "T2") {
          currentEntry.journal = value;
        }
      }
    }

    const years: any = {};
    const keywords: any = {};
    const authors: any = {};
    const journals: any = {};
    entries.forEach((e) => {
      if (e.year) years[e.year] = (years[e.year] || 0) + 1;
      if (e.journal) journals[e.journal] = (journals[e.journal] || 0) + 1;
      if (e.authors)
        e.authors.forEach((a: string) => (authors[a] = (authors[a] || 0) + 1));
      if (e.keywords)
        e.keywords.forEach(
          (k: string) => (keywords[k] = (keywords[k] || 0) + 1),
        );
    });

    const getTop = (obj: any, limit: number) =>
      Object.entries(obj)
        .sort((a: any, b: any) => b[1] - a[1])
        .slice(0, limit);

    const statsJSON = {
      total_articulos: entries.length,
      rango_anios: `${Math.min(...Object.keys(years).map(Number))} - ${Math.max(...Object.keys(years).map(Number))}`,
      publicaciones_por_anio: years,
      top_10_autores: Object.fromEntries(getTop(authors, 10)),
      top_20_keywords: Object.fromEntries(getTop(keywords, 20)),
      top_10_revistas: Object.fromEntries(getTop(journals, 10)),
    };

    // 2. ENVIAR SOLO EL JSON RESUMIDO AL LLM
    const payload = {
      question: `Redacta el informe bibliométrico usando EXACTAMENTE estos datos estadísticos procesados:\n${JSON.stringify(statsJSON)}`,
      // Esto evita que la memoria se acumule entre diferentes análisis:
      overrideConfig: { sessionId: "session_" + Date.now() },
    };

    const flowiseUrl =
      process.env.FLOWISE_API_URL ||
      "http://localhost:3000/api/v1/prediction/8e8ea8f5-42dc-4e78-8e6f-e83315dde5d8";

    const response = await fetch(flowiseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    let extractedText =
      typeof result === "string"
        ? result
        : result.text || result.response || JSON.stringify(result);

    return NextResponse.json({ text: extractedText, stats: statsJSON });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
