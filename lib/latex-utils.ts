// Default LaTeX resume template - Aditya Sugandhi's Resume
export const DEFAULT_RESUME_TEMPLATE = `\\documentclass[letterpaper,10pt]{article}

% FONT AND COLOR SETUP
\\usepackage{xcolor}
\\definecolor{metablue}{RGB}{24,119,242}
\\definecolor{darkgray}{HTML}{333333}
\\definecolor{azureblue}{RGB}{0,120,215}

% PACKAGES
\\usepackage{ragged2e,latexsym,enumitem,graphicx}
\\usepackage{titlesec,marvosym}
\\usepackage[hidelinks,colorlinks=true,linkcolor=azureblue,urlcolor=azureblue,citecolor=azureblue]{hyperref}
\\usepackage[english]{babel}
\\usepackage{tabularx,fontawesome5,multicol}
\\usepackage[margin=0.225in]{geometry}
\\usepackage{CormorantGaramond,charter}
\\urlstyle{same}

% LISTS
\\setlist[itemize]{topsep=2pt, parsep=2pt, itemsep=2pt, leftmargin=0.15in, label=\\textbullet}

% SECTION HEADING STYLE
\\titleformat{\\section}{\\vspace{-4pt}\\scshape\\raggedright\\large\\bfseries}{}{0em}{}[\\color{darkgray}\\titlerule\\vspace{4pt}]


% Resume macro definitions (correct and standard)

\\newcommand{\\resumeItem}[1]{\\item\\small #1}

\\newcommand{\\resumeSubheading}[4]{
  \\vspace{6pt}
  \\noindent
  \\textbf{#1} \\hfill {\\footnotesize #2} \\\\
  [-1pt]
  \\noindent
  \\small #3 \\hfill {\\small #4}
  \\vspace{3pt}
}


\\newcommand{\\resumeItemsStart}{\\vspace{-2pt}\\begin{itemize}}
\\newcommand{\\resumeItemsEnd}{\\end{itemize}\\vspace{6pt}}

\\begin{document}

%---------- HEADING ----------
\\begin{center}
{\\huge\\textbf{Aditya Sugandhi}} \\\\
+1 4485006857 \\textbar\\ \\textcolor{metablue}{Tallahassee, FL} \\textbar\\
\\href{mailto:adityasugandhi.work@outlook.com}{adityasugandhi.work@outlook.com} \\textbar\\
\\href{https://github.com/adityasugandhi}{GitHub}
\\textbar \\href{https://adityasugandhi.com}{adityasugandhi.com}
\\end{center}
\\vspace{-12pt}

%---------- SUMMARY ----------
\\section{\\textcolor{metablue}{SUMMARY}}
\\small
\\vspace{-6pt}
Software Engineer specializing in \\textbf{AI-powered developer tools} and large-scale network automation with \\textbf{Claude Code/MCP}, \\textbf{Python microservices}, and \\textbf{AWS infrastructure}. Architected developer productivity ecosystems using \\textbf{LLM integration}, \\textbf{custom CLI tools}, and \\textbf{CI/CD automation}; designed \\textbf{asynchronous network scanning systems} processing \\textbf{35k+ devices}. Built \\textbf{financial data extraction pipelines} with \\textbf{NER/NLP} and cross-functional tooling that improved engineering team efficiency by \\textbf{60\\%}.

\\vspace{-9pt}

%---------- TECHNICAL SKILLS ----------
\\section{\\textcolor{metablue}{TECHNICAL SKILLS}}
\\vspace{-5pt}
\\small
\\begin{itemize}
\\resumeItem{\\textbf{AI/Developer Tools:} Claude Code, MCP Servers, OpenAI API, LLM Integration, NER/NLP (spaCy, Transformers), Vector Databases (Qdrant, ChromaDB), AI Agents, Code Review Automation}
\\resumeItem{\\textbf{Developer Experience:} VS Code Extensions, CLI Development, SDK Design, CI/CD Integration, Developer APIs, Internal Tooling, IDE Plugins, Workflow Automation}
\\resumeItem{\\textbf{Languages:} Python, Go, JavaScript/TypeScript, Java, C++, Scala, Bash, SQL}
\\resumeItem{\\textbf{Cloud/Infrastructure:} AWS (MSK, S3, ECS Fargate, EMR, CloudWatch, IAM, VPC), Kafka (Connect, Streams, ksqlDB, Schema Registry), Docker, Kubernetes, Terraform, Jenkins}
\\resumeItem{\\textbf{Data \\& Analytics:} Spark, Hadoop, Glue, Athena, Parquet, Avro, Protobuf; ETL pipelines, stream processing, data lake architecture}
\\resumeItem{\\textbf{Databases \\& Storage:} PostgreSQL, MySQL, NoSQL, Redis; CDC/Debezium, vector databases, semantic search, data modeling}
\\resumeItem{\\textbf{Frameworks \\& APIs:} FastAPI, gRPC, React, Next.js, REST/GraphQL; microservices architecture, async programming (asyncio, telnetlib)}
\\resumeItem{\\textbf{Systems \\& Networking:} Linux (Ubuntu, RedHat), TCP/IP, BACnet/IP, Network Scanning, Shell Scripting, Performance Tuning, Large-scale System Design}
\\resumeItem{\\textbf{Observability:} Prometheus, Grafana, CloudWatch, Alertmanager; application metrics, distributed tracing, performance monitoring}
\\end{itemize}
\\vspace{-10pt}


%---------- WORK EXPERIENCE ----------
\\section{\\textcolor{metablue}{WORK EXPERIENCE}}
\\vspace{-12pt}

\\resumeSubheading
{BAS Software Developer}{Nov 2024 -- Present}
{Florida State University}{Tallahassee, FL}
\\resumeItemsStart
\\resumeItem{Architected \\textbf{AI-powered developer tools ecosystem} using \\textbf{Claude Code} with \\textbf{10+ MCP servers}; built \\textbf{3 custom MCP servers} for internal Oracle DBMS operations and \\textbf{BACnet device management}, improving developer workflow efficiency by \\textbf{60\\%} across \\textbf{15+ engineering teams}.}
\\resumeItem{Developed \\textbf{asynchronous network scanning microservices} using \\textbf{Python telnetlib} and \\textbf{asyncio} to scan \\textbf{172+ BLN networks simultaneously}; processed \\textbf{35k+ panels} and discovered \\textbf{3,500+ new devices}, reducing manual discovery time by \\textbf{85\\%} and improving commissioning accuracy to \\textbf{99.2\\%}.}
\\resumeItem{Designed and implemented \\textbf{claudecode.yml CI/CD integration} for GitHub workflows; streamlined \\textbf{AI-assisted code reviews}, \\textbf{automated testing pipelines}, and \\textbf{deployment automation} across \\textbf{dev/stage/prod} environments, reducing deployment time by \\textbf{70\\%}.}
\\resumeItemsEnd
\\vspace{-12pt}

\\resumeSubheading
{Machine Learning Researcher (Volunteer)}{Jan 2023 -- Aug 2024}
{Prof. Olmo Zavala Romero — FSU}{Tallahassee, FL}
\\resumeItemsStart
\\resumeItem{Architected \\textbf{ML pipelines} over \\textbf{1TB+ datasets} with \\textbf{LLMs/GenAI/NLP} components; implemented \\textbf{vector embeddings} and \\textbf{semantic search} capabilities using \\textbf{Transformers} and \\textbf{vector databases}, monitored via \\textbf{Grafana/MLflow} with automated drift detection and SLA alerting.}
\\resumeItem{Built \\textbf{optimized Spark (Scala/PySpark)} jobs for \\textbf{windowed aggregations}, deduplication, and watermarking on \\textbf{Kubernetes/EMR}; fine-tuned \\textbf{shuffle operations}, partitioning, and \\textbf{Parquet} file layout (128--512MB) to achieve \\textbf{+40\\%} throughput and \\textbf{99\\% job success} rate.}
\\resumeItem{Optimized \\textbf{data ingestion buffers} and \\textbf{memory management} strategies; implemented \\textbf{async processing} patterns and \\textbf{batch optimization} techniques, reducing overall \\textbf{ML pipeline runtime by 50\\%} while maintaining data quality and model accuracy.}
\\resumeItemsEnd
\\vspace{-12pt}

\\resumeSubheading
{Software Analyst}{Oct 2020 -- Jul 2022}
{Aspire Systems}{Chennai, India}
\\resumeItemsStart
\\resumeItem{Led \\textbf{monolith-to-microservices migration} on \\textbf{AWS EKS}, architecting \\textbf{event-driven services} with \\textbf{API gateways} and \\textbf{service mesh}; improved system availability to \\textbf{99.5\\%}, reduced infrastructure costs by \\textbf{20\\%}, and enhanced deployment frequency by \\textbf{5x} through \\textbf{CI/CD automation}.}
\\resumeItem{Developed \\textbf{optimized SQL stored procedures} and \\textbf{ETL pipelines} with \\textbf{parallel processing} and \\textbf{batch optimization}; implemented \\textbf{data validation} and \\textbf{error handling} mechanisms, boosting data processing throughput by \\textbf{35\\%} and reducing data quality issues by \\textbf{80\\%}.}
\\resumeItem{Instituted comprehensive \\textbf{testing strategy} with \\textbf{Jest/Cypress} achieving \\textbf{90\\% code coverage}; implemented \\textbf{automated test generation}, \\textbf{integration testing}, and \\textbf{performance testing} frameworks, cutting regression defects by \\textbf{50\\%} and reducing QA cycles by \\textbf{40\\%}.}
\\resumeItemsEnd
\\vspace{-8pt}


%---------- PROJECTS ----------
\\section{\\textcolor{metablue}{PROJECTS}}
\\vspace{-5pt}
\\begin{itemize}
\\resumeItem{\\textbf{AI-Enhanced Developer CLI \\& MCP Server Ecosystem} \\href{https://github.com/adityasugandhi}{Internal Tools} --- Built comprehensive \\textbf{developer toolchain} with \\textbf{Claude Code integration}, \\textbf{10+ MCP servers}, and \\textbf{custom Oracle DBMS connectors}. Features: intelligent code completion, automated debugging, cross-team workflow optimization, and \\textbf{claudecode.yml CI/CD integration}. Technologies: \\textbf{Python}, \\textbf{Node.js}, \\textbf{TypeScript}, \\textbf{Docker}, \\textbf{GitHub Actions}. Impact: \\textbf{60\\% productivity improvement} across \\textbf{15+ engineering teams}, \\textbf{85\\% reduction} in manual network commissioning workflows.}

\\resumeItem{\\textbf{Financial Data Extractor with NLP/AI Pipeline} \\href{https://huggingface.co/spaces/stranzersweb/youtube-financial-digest}{HuggingFace} --- Architected \\textbf{AI-powered financial analysis platform} using \\textbf{YouTube transcript processing}, \\textbf{Named Entity Recognition (NER)}, and \\textbf{vector databases} for semantic search. Integrated \\textbf{LLM APIs} for automated financial insights generation and trend analysis. Technologies: \\textbf{Python}, \\textbf{FastAPI}, \\textbf{spaCy/Transformers}, \\textbf{Qdrant}, \\textbf{OpenAI API}. Processes \\textbf{1000+ financial documents} with \\textbf{95\\% entity extraction accuracy}.}

% \\resumeItem{\\textbf{Large-Scale Asynchronous Network Discovery Platform} \\href{https://github.com/adityasugandhi}{GitHub} --- Designed and implemented \\textbf{microservices architecture} for \\textbf{BACnet/IP network scanning} using \\textbf{Python telnetlib} and \\textbf{asyncio}. Concurrent processing of \\textbf{172+ BLN networks} and \\textbf{35k+ panels}, discovering \\textbf{3,500+ new devices}. Built with \\textbf{FastAPI}, \\textbf{PostgreSQL}, \\textbf{Redis} queuing, and \\textbf{Docker}. Reduced manual network commissioning by \\textbf{85\\%} and improved device discovery accuracy to \\textbf{99.2\\%}.}

% \\resumeItem{\\textbf{Streaming Data Platform on AWS (Kafka/MSK, Spark on EMR)} \\href{https://github.com/adityasugandhi}{GitHub} --- Producers $\\rightarrow$ \\textbf{MSK (Kafka)} $\\rightarrow$ \\textbf{Kafka Connect} (\\textbf{S3}/\\textbf{Postgres} sinks with \\textbf{SMTs} for PII redaction/enrichment) $\\rightarrow$ \\textbf{S3 data lake} (\\textbf{Avro} raw $\\rightarrow$ EMR \\textbf{Spark} compaction to \\textbf{Parquet} 128--512MB, \\textbf{Snappy/ZSTD}) $\\rightarrow$ \\textbf{Glue Catalog} $\\rightarrow$ \\textbf{Athena}. Security: VPC private subnets, SGs, \\textbf{IAM} roles for MSK/S3, KMS. Observability: Prometheus + CloudWatch (\\textbf{consumer lag}, rebalances/min, throughput, DLQ size). Outcomes: p99 latency < \\textbf{50ms} at \\textbf{10k msgs/s}; \\textbf{60--70\\%} query-cost reduction via partition pruning/compression.}

\\end{itemize}
\\vspace{-5pt}


%---------- EDUCATION ----------
\\section{\\textcolor{metablue}{EDUCATION}}
\\vspace{-10pt}
\\resumeSubheading
{Florida State University}{Aug 2022 -- May 2024}
{M.S. in Computer Science}{Tallahassee, FL}
\\resumeItemsStart
\\resumeItem{\\textbf{Relevant Coursework:} Data Communications, Advanced Database Systems, Cryptography, Data Mining}
\\resumeItemsEnd
\\vspace{-5pt}
\\resumeSubheading
{SRM Institute of Science \\& Technology}{Aug 2016 -- May 2020}
{B.Tech. in Computer Science}{Chennai, India}
\\vspace{-10pt}

%---------- PUBLICATIONS \\& AWARDS ----------
\\section{\\textcolor{metablue}{PUBLICATIONS \\& AWARDS}}
\\vspace{-5pt}
\\begin{itemize}
\\resumeItem{Review Classification \\& False Feedback Detection (IJAST)}
\\resumeItem{2nd Place, SRM University Hackathon (2019)}
\\resumeItem{AWS Solutions Architect Course (Udemy, 2024)}
\\end{itemize}

\\end{document}
`;

export const SIMPLE_TEMPLATE = `\\documentclass{article}
\\usepackage[utf8]{inputenc}

\\title{Simple Document}
\\author{Your Name}
\\date{\\today}

\\begin{document}

\\maketitle

\\section{Introduction}
Write your content here.

\\end{document}
`;

// Parse LaTeX error messages
export function parseLatexError(errorLog: string): { line: number | null; message: string } {
  const lines = errorLog.split('\n');
  let errorLine: number | null = null;
  let errorMessage = 'Compilation failed';

  // Look for error patterns
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Pattern: ! LaTeX Error:
    if (line.startsWith('! LaTeX Error:')) {
      errorMessage = line.substring(14).trim();
    }

    // Pattern: ! Undefined control sequence
    if (line.startsWith('! Undefined control sequence')) {
      errorMessage = 'Undefined control sequence';
      // Try to find line number in next lines
      if (i + 1 < lines.length) {
        const lineMatch = lines[i + 1].match(/l\\.(\d+)/);
        if (lineMatch) {
          errorLine = parseInt(lineMatch[1], 10);
        }
      }
    }

    // Pattern: line number
    const lineMatch = line.match(/l\\.(\d+)/);
    if (lineMatch && !errorLine) {
      errorLine = parseInt(lineMatch[1], 10);
    }
  }

  return { line: errorLine, message: errorMessage };
}

// Validate LaTeX syntax (basic)
export function validateLatexSyntax(content: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for \begin{document} and \end{document}
  if (!content.includes('\\begin{document}')) {
    errors.push('Missing \\begin{document}');
  }
  if (!content.includes('\\end{document}')) {
    errors.push('Missing \\end{document}');
  }

  // Check for matching braces
  const openBraces = (content.match(/\\begin\{/g) || []).length;
  const closeBraces = (content.match(/\\end\{/g) || []).length;
  if (openBraces !== closeBraces) {
    errors.push('Mismatched \\begin and \\end commands');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// Extract document class
export function extractDocumentClass(content: string): string | null {
  const match = content.match(/\\documentclass(?:\[.*?\])?\{(.*?)\}/);
  return match ? match[1] : null;
}

// Get common LaTeX packages used in resume
export function getResumePackages(): string[] {
  return [
    'xcolor',
    'ragged2e',
    'latexsym',
    'enumitem',
    'graphicx',
    'titlesec',
    'marvosym',
    'hyperref',
    'babel',
    'tabularx',
    'fontawesome5',
    'multicol',
    'geometry',
    'CormorantGaramond',
    'charter'
  ];
}
