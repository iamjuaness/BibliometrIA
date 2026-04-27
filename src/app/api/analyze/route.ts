import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const filesData = data.files; // Array of { name: string, content: string }

    let allEntries: any[] = [];
    const dbStats: any = {};

    const KNOWN_DATABASES = [
      "Scopus",
      "ScienceDirect",
      "Web of Science",
      "WOS",
      "PubMed",
      "IEEE Xplore",
      "Google Scholar",
      "Springer",
      "Emerald",
      "Taylor & Francis",
    ];

    for (const file of filesData) {
      const content = file.content;
      const fileName = file.name;

      // Better identification
      let dbName = "Otros";
      const searchTarget = (
        fileName +
        " " +
        content.substring(0, 2000)
      ).toLowerCase();

      for (const db of KNOWN_DATABASES) {
        if (searchTarget.includes(db.toLowerCase())) {
          dbName = db === "WOS" ? "Web of Science" : db;
          break;
        }
      }

      if (dbName === "Otros") {
        const prefix = fileName.split(/[_-]/)[0];
        if (prefix && prefix.length > 3) dbName = prefix;
      }

      if (!dbStats[dbName]) {
        dbStats[dbName] = { count: 0, entries: [] };
      }

      let entries: any[] = [];
      if (fileName.toLowerCase().endsWith(".ris")) {
        entries = parseRIS(content);
      } else if (
        fileName.toLowerCase().endsWith(".bib") ||
        fileName.toLowerCase().endsWith(".bibtext") ||
        fileName.toLowerCase().endsWith(".bibtex")
      ) {
        entries = parseBibTeX(content);
      } else if (fileName.toLowerCase().endsWith(".csv")) {
        entries = parseCSV(content);
      } else {
        entries = parseRIS(content);
      }

      dbStats[dbName].count += entries.length;
      dbStats[dbName].entries = dbStats[dbName].entries.concat(entries);
      allEntries = allEntries.concat(entries);
    }

    // Global Stats
    const years: any = {};
    const keywordsCount: any = {};
    const authorsCount: any = {};
    const journalsCount: any = {};
    const coauthorship: any[] = [];

    allEntries.forEach((e) => {
      if (e.year) years[e.year] = (years[e.year] || 0) + 1;
      if (e.journal)
        journalsCount[e.journal] = (journalsCount[e.journal] || 0) + 1;

      if (e.authors) {
        e.authors.forEach(
          (a: string) => (authorsCount[a] = (authorsCount[a] || 0) + 1),
        );

        // Co-authorship relationships
        if (e.authors.length > 1) {
          for (let i = 0; i < e.authors.length; i++) {
            for (let j = i + 1; j < e.authors.length; j++) {
              coauthorship.push({ source: e.authors[i], target: e.authors[j] });
            }
          }
        }
      }

      if (e.keywords) {
        e.keywords.forEach(
          (k: string) => (keywordsCount[k] = (keywordsCount[k] || 0) + 1),
        );
      }
    });

    // Topic Analysis (Simple LDA-like approach: Clustering keywords that appear together)
    const getTopicsPerDB = (entries: any[]) => {
      const cooccur: any = {};
      entries.forEach((e) => {
        if (e.keywords && e.keywords.length > 1) {
          e.keywords.forEach((k1: string) => {
            if (!cooccur[k1]) cooccur[k1] = {};
            e.keywords.forEach((k2: string) => {
              if (k1 !== k2) cooccur[k1][k2] = (cooccur[k1][k2] || 0) + 1;
            });
          });
        }
      });

      // Find top 3 keyword clusters as "topics"
      const seeds = Object.entries(cooccur)
        .sort(
          (a: any, b: any) =>
            Object.values(b[1]).length - Object.values(a[1]).length,
        )
        .slice(0, 3);

      return seeds.map(([main, others]: any) => {
        const related = Object.entries(others)
          .sort((a: any, b: any) => b[1] - a[1])
          .slice(0, 4)
          .map((i) => i[0]);
        return { topic: main, keywords: [main, ...related] };
      });
    };

    const finalDbAnalysis = Object.entries(dbStats).map(([name, data]: any) => {
      return {
        database: name,
        article_count: data.count,
        top_topics: getTopicsPerDB(data.entries),
      };
    });

    const getTop = (obj: any, limit: number) =>
      Object.entries(obj)
        .sort((a: any, b: any) => b[1] - a[1])
        .slice(0, limit);

    const statsJSON = {
      total_articulos: allEntries.length,
      rango_anios:
        allEntries.length > 0
          ? `${Math.min(
              ...Object.keys(years)
                .filter((y) => !isNaN(Number(y)))
                .map(Number),
            )} - ${Math.max(
              ...Object.keys(years)
                .filter((y) => !isNaN(Number(y)))
                .map(Number),
            )}`
          : "N/A",
      publicaciones_por_anio: years,
      top_10_autores: Object.fromEntries(getTop(authorsCount, 10)),
      top_20_keywords: Object.fromEntries(getTop(keywordsCount, 20)),
      top_10_revistas: Object.fromEntries(getTop(journalsCount, 10)),
      coauthorship_links: coauthorship.slice(0, 100), // Limitar para no saturar
      analisis_por_bd: finalDbAnalysis,
    };

    const openRouterApiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.OPENROUTER_MODEL || "openai/gpt-4o";

    const prompt = `
Actúa como un investigador senior especializado en bibliometría, cienciometría y análisis de literatura científica. Tu tarea es redactar un informe académico en español, con estilo extremadamente profesional, formal, analítico y riguroso, similar al de una publicación científica en editoriales como Springer o Elsevier.

A continuación se proporcionan los datos estadísticos del análisis bibliométrico en formato JSON:

${JSON.stringify(statsJSON, null, 2)}

OBJETIVO:
Elabora un informe interpretativo completo, no una simple descripción de cifras. Debes explicar los patrones observados, comparar resultados entre bases de datos, identificar tendencias relevantes y extraer conclusiones académicamente sólidas a partir de la información disponible.

INSTRUCCIONES DE REDACCIÓN:
1. El informe debe estar escrito íntegramente en español académico formal.
2. Usa una redacción cohesionada, técnica y precisa.
3. Evita repetir literalmente los nombres de campos del JSON salvo cuando sea necesario para claridad analítica.
4. No inventes datos. Si algún dato no está disponible o no puede inferirse con certeza, indícalo explícitamente de forma académica.
5. Interpreta los resultados, no te limites a enumerarlos.
6. Prioriza el análisis comparativo, especialmente entre bases de datos.
7. Si existe información temporal, comenta evolución, crecimiento, concentración o estabilidad de la producción.
8. Si existe información de autores, revistas, palabras clave o colaboración, analiza concentración, liderazgo, dispersión, recurrencia y posibles implicaciones científicas.
9. Si existe modelado temático mediante LDA, describe los temas predominantes, su posible significado conceptual y cómo difieren entre bases de datos.
10. Si existe wordcloud o frecuencia léxica, interpreta los conceptos dominantes y su relación con la estructura temática del corpus.
11. Mantén un tono objetivo, impersonal y propio de un artículo científico.
12. No incluyas introducciones vacías ni explicaciones genéricas sobre qué es la bibliometría; enfócate en los resultados suministrados.
13. Cuando cites cifras, contextualízalas interpretativamente en lugar de presentarlas de forma aislada.
14. Evita adjetivos enfáticos no científicos como "muy importante", "impresionante" o "sorprendente", salvo que estén justificados por los datos.

ESTRUCTURA OBLIGATORIA DEL INFORME:
Redacta el informe con las siguientes secciones y subtítulos exactos:

# Informe bibliométrico

## 1. Metodología
Explica de forma académica el enfoque de análisis utilizado a partir de los datos disponibles. Menciona, según corresponda:
- análisis de producción científica,
- análisis por base de datos,
- análisis de coautoría,
- análisis temático mediante LDA,
- análisis léxico mediante frecuencia de términos y wordcloud.

Aclara que las interpretaciones se derivan exclusivamente de los datos suministrados en el JSON.

## 2. Análisis de Producción Científica
Describe el comportamiento general de la producción:
- volumen total de documentos,
- evolución temporal,
- autores más productivos,
- revistas o fuentes más representativas,
- palabras clave más frecuentes.

Integra en esta sección, en los lugares apropiados, las siguientes etiquetas EXACTAS:
{chart:trends}
{chart:authors}
{chart:journals}

No pongas las etiquetas todas juntas al final; ubícalas donde realmente respalden el texto.

## 3. Análisis Comparativo por Base de Datos
Analiza específicamente los resultados contenidos en "analisis_por_bd".
Para cada base de datos identificada:
- resume su volumen de contribución,
- comenta sus autores, revistas o términos destacados si están disponibles,
- identifica sus temas predominantes descubiertos por LDA,
- compara su perfil temático con el de las demás bases de datos,
- señala convergencias, divergencias, sesgos de cobertura o especialización temática si los datos lo sugieren.

Si resulta útil, incluye una o más tablas Markdown comparativas entre bases de datos.

## 4. Redes de Colaboración (Coautoría)
Examina la estructura de colaboración científica con base en los datos disponibles:
- densidad o amplitud de la red,
- presencia de autores centrales,
- clústeres o comunidades de colaboración,
- posibles patrones de fragmentación o articulación de la red.

Integra la etiqueta EXACTA:
{chart:coauthorship}

Si no hay suficientes datos para un análisis estructural profundo, indícalo sin inventar resultados.

## 5. Análisis Temático
Desarrolla un análisis temático robusto articulando:
- los resultados del modelado LDA,
- la frecuencia de palabras clave,
- la nube de palabras o conceptos dominantes.

Explica qué líneas temáticas emergen del corpus, qué conceptos organizan la conversación científica y cómo se relacionan entre sí. Cuando existan diferencias por base de datos, destácalas explícitamente.

Integra la etiqueta EXACTA:
{chart:wordcloud}

## 6. Conclusiones
Presenta conclusiones analíticas de alto nivel derivadas del conjunto de resultados. Debes:
- sintetizar los principales hallazgos de producción, colaboración y estructura temática,
- destacar diferencias relevantes entre bases de datos,
- señalar qué áreas parecen consolidadas, emergentes o periféricas,
- cerrar con una valoración académica del estado del campo representado por los datos.

REQUISITOS DE CALIDAD:
- El texto debe sonar como la sección de resultados y discusión de un informe científico real.
- Usa conectores académicos como: "En términos generales", "De forma específica", "Asimismo", "Por otra parte", "Este hallazgo sugiere", "En contraste", "Desde una perspectiva comparativa", etc.
- No uses viñetas en la redacción principal salvo dentro de tablas; privilegia párrafos bien construidos.
- Si una comparación entre bases de datos es relevante, preséntala en tabla Markdown además de explicarla en texto.
- Si el JSON incluye métricas numéricas, cítalas explícitamente dentro del análisis.
- Si alguna sección carece de insumos suficientes, conserva la sección y explica la limitación metodológica de manera formal.

REGLAS ESTRICTAS DE FORMATO MARKDOWN:
- Cada encabezado debe ir en su propia línea.
- Cada párrafo debe estar separado por una línea en blanco.
- Cada etiqueta {chart:...} debe ir sola en una línea.
- Las tablas deben estar en formato Markdown GFM estricto.
- Las listas deben usar únicamente "-" o numeración "1.".
- No uses HTML embebido.
- No mezcles texto narrativo y {chart:...} en la misma línea.
- Usa negrita solo de forma moderada, en fragmentos cortos.

FORMATO DE SALIDA:
Devuelve únicamente el informe final en Markdown, listo para renderizarse, sin comentarios previos, sin bloque de código y sin explicar cómo lo hiciste.
`;

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openRouterApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: "system",
              content:
                "Generas informes bibliométricos profesionales con placeholders para gráficos.",
            },
            { role: "user", content: prompt },
          ],
        }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error?.message || "Error al consultar OpenRouter",
      );
    }

    const result = await response.json();

    if (!result.choices || result.choices.length === 0) {
      console.error("Respuesta inesperada de OpenRouter:", result);
      throw new Error(
        result.error?.message ||
          "La IA no devolvió ninguna respuesta (choices está vacío).",
      );
    }

    const extractedText = result.choices[0].message.content;

    return NextResponse.json({ text: extractedText, stats: statsJSON });
  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function parseRIS(content: string) {
  const lines = content.split("\n");
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
      const separatorIdx = trimmed.indexOf("-");
      const tag = trimmed.substring(0, separatorIdx).trim();
      const value = trimmed.substring(separatorIdx + 1).trim();

      if (tag === "AU") {
        currentEntry.authors = currentEntry.authors || [];
        currentEntry.authors.push(value);
      } else if (tag === "KW") {
        currentEntry.keywords = currentEntry.keywords || [];
        currentEntry.keywords.push(value);
      } else if (tag === "PY" || tag === "Y1") {
        currentEntry.year =
          value.split("/")[0].match(/\d{4}/)?.[0] || value.split("/")[0];
      } else if (tag === "TI" || tag === "T1") {
        currentEntry.title = value;
      } else if (tag === "JO" || tag === "JF" || tag === "T2") {
        currentEntry.journal = value;
      }
    }
  }
  return entries;
}

function parseBibTeX(content: string) {
  const entries: any[] = [];
  // Basic BibTeX regex parser
  const entryRegex = /@\w+\s*\{[^@]+/g;
  const matches = content.match(entryRegex);

  if (matches) {
    for (const match of matches) {
      const entry: any = {};

      // Extract title
      const titleMatch = match.match(/title\s*=\s*[\{"]([^"\}]+)["\}]/i);
      if (titleMatch) entry.title = titleMatch[1];

      // Extract author
      const authorMatch = match.match(/author\s*=\s*[\{"]([^"\}]+)["\}]/i);
      if (authorMatch) {
        entry.authors = authorMatch[1].split(/\s+and\s+/i).map((a) => a.trim());
      }

      // Extract year
      const yearMatch = match.match(/year\s*=\s*[\{"]?(\d{4})[\"\}]?/i);
      if (yearMatch) entry.year = yearMatch[1];

      // Extract journal
      const journalMatch = match.match(/journal\s*=\s*[\{"]([^"\}]+)["\}]/i);
      if (journalMatch) entry.journal = journalMatch[1];

      // Extract keywords (often in 'keywords' field)
      const keywordsMatch = match.match(/keywords\s*=\s*[\{"]([^"\}]+)["\}]/i);
      if (keywordsMatch) {
        entry.keywords = keywordsMatch[1].split(/[,;]/).map((k) => k.trim());
      }

      if (Object.keys(entry).length > 0) entries.push(entry);
    }
  }
  return entries;
}

function parseCSV(content: string) {
  const lines = content.split("\n");
  if (lines.length < 2) return [];

  const header = lines[0].toLowerCase().split(/[,;]/);
  const entries: any[] = [];

  // Scopus/WoS Headers mapping
  const titleIdx = header.findIndex(
    (h) => h.includes("title") && !h.includes("source"),
  );
  const authorIdx = header.findIndex((h) => h.includes("author"));
  const yearIdx = header.findIndex((h) => h.includes("year"));
  const journalIdx = header.findIndex(
    (h) => h.includes("source title") || h.includes("journal"),
  );
  const keywordsIdx = header.findIndex((h) => h.includes("keyword"));

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    // Very basic CSV split (doesn't handle quotes perfectly, but for simple export might work)
    const values = line.split(/[,;]/);
    const entry: any = {};

    if (titleIdx !== -1 && values[titleIdx])
      entry.title = values[titleIdx].replace(/"/g, "").trim();
    if (authorIdx !== -1 && values[authorIdx]) {
      entry.authors = values[authorIdx]
        .replace(/"/g, "")
        .split(/[,;]/)
        .map((a) => a.trim())
        .filter((a) => a);
    }
    if (yearIdx !== -1 && values[yearIdx])
      entry.year = values[yearIdx].replace(/"/g, "").trim();
    if (journalIdx !== -1 && values[journalIdx])
      entry.journal = values[journalIdx].replace(/"/g, "").trim();
    if (keywordsIdx !== -1 && values[keywordsIdx]) {
      entry.keywords = values[keywordsIdx]
        .replace(/"/g, "")
        .split(/[,;]/)
        .map((k) => k.trim())
        .filter((k) => k);
    }

    if (Object.keys(entry).length > 0) entries.push(entry);
  }
  return entries;
}
