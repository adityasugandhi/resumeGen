# Resume Context

## FSU → Utility Digital Twin Platform

When tailoring resumes that need deeper technical framing for the FSU role, use this context. FSU is a utility engineering organization providing software for **utility digital twin platforms**.

### Platform Capabilities
- Real-time monitoring of utility assets (meters, HVAC systems, cooling coils, transformers)
- Predictive maintenance using ML/AI
- Engineering optimization and energy efficiency
- Asset lifecycle management
- Compliance monitoring for utility infrastructure (IEEE, ISO 55000, NERC CIP)

### Enhanced Resume Bullets (use when a role demands deeper technical detail)

**FSU BAS Software Developer — Enhanced Framing:**
- "Designed various modules of a high-throughput, fault-tolerant **distributed utility asset management platform** using Java, Apache Kafka, processing **real-time telemetry from 500K+ IoT sensors** (meters, HVAC systems, cooling coils) for digital twin modeling and predictive maintenance."
- "Architected microservices using Spring Boot, Kubernetes, handling **5M+ daily telemetry ingestion requests from distributed utility assets** across multiple geographies with 99.99% availability, supporting **real-time asset health monitoring** and compliance reporting."
- "Led migration of legacy monolith to **event-driven architecture for real-time asset telemetry processing**, cutting service coupling by 60%, enabling independent scaling of **time-series data ingestion, anomaly detection, and predictive maintenance modules**, increasing release velocity by 3x."
- "Orchestrated horizontal sharding strategy for PostgreSQL clusters storing **500M+ asset telemetry records**, improving query performance by 2x for **time-series analytics, asset health dashboards, and compliance audits**, supporting **10K+ utility engineers** across global deployments."
- "Deployed Redis for **distributed caching of real-time asset state** (meter readings, HVAC operational data) and optimized key eviction policies, reducing **digital twin model synchronization latency** from 850ms to 470ms (45% improvement), enabling **real-time asset health visualization** for 10K+ concurrent users."
- "Implemented rate limiting with Envoy sidecars to handle **burst telemetry ingestion from 100K+ IoT devices** during peak operational hours, preventing **telemetry data loss** and ensuring service stability under **5x load spikes** during critical infrastructure events."
- "Built **time-series data pipeline** using **InfluxDB** and Kafka Streams for ingesting and processing 50M+ telemetry events daily from utility assets, enabling **real-time anomaly detection** for asset health degradation with P99 ingestion latency <100ms."
- "Designed **compliance monitoring service** for utility asset configurations, automatically scanning **10K+ asset configurations** daily against **regulatory policies** (IEEE standards, ISO 55000), generating **compliance violation reports** and triggering automated remediation workflows."

### Technical Deep-Dives (for interview prep / detailed resume versions)

**gRPC Migration:**
- Migrated inter-service communication from REST/HTTP1.1 to gRPC (Protobuf/HTTP2) with server streaming
- Digital Twin Service aggregates data from Asset Registry, Telemetry, Analytics, and Maintenance services
- Before: 4 HTTP calls × 45ms = 180ms, JSON payload 850KB
- After: Single HTTP/2 multiplexed stream, first chunk 12ms, all chunks 28ms, Protobuf payload 95KB
- Results: 84% faster latency, 89% smaller payloads, 5,800 req/sec throughput

**Event-Driven Architecture Migration:**
- Monolith struggled with 50M telemetry events/day from 500K+ IoT sensors
- Migrated to Kafka-based event-driven microservices (Telemetry Processor, Anomaly Detector, Predictive Maintenance, Asset Registry)
- Topics: telemetry.raw, asset.state.updated, anomaly.detected, maintenance.scheduled
- Results: 5,000→18,000 events/sec (3.6x), 73→29 dependencies (60% coupling reduction), 1x/month→3x/week deploys (12x)
- Key challenge solved: out-of-order telemetry via event-sourcing with timestamp-based ordering

**Compliance Monitoring Service:**
- OPA (Open Policy Agent) policy engine scanning 10K+ assets every 6 hours
- Policies: HVAC telemetry frequency (60s max), firmware versions, meter calibration (annual)
- Violations published to Kafka → automated remediation (85%) or ticket creation (15%)
- Before: quarterly manual audits, 72% compliant, 45-day detection delay
- After: continuous monitoring, 98.5% compliant, <6hr detection, 1.2hr mean remediation

### Additional Technical Stack (available for enhanced versions)
- InfluxDB (time-series), OPA (policy engine), Envoy (service mesh/rate limiting)
- gRPC with Protobuf/HTTP2, server streaming
- Event-sourcing patterns, timestamp-based ordering for IoT data
- Horizontal PostgreSQL sharding for 500M+ records

### Contact Details
- Email: adityasugandhi.work@outlook.com
- Phone: +1 448 500 6857
- GitHub: https://github.com/adityasugandhi
- Website: https://adityasugandhi.com

---

## BookedFlow → Slack Bot Integration & AI Platform

### Project Overview
**BookedFlowBot** is an AI-powered Slack bot integration for the BookedFlow platform, enabling real-time team communication and automated workflow management through enterprise Slack workspace integration.

### Platform Capabilities
- AI-powered chatbot with @mention functionality for direct team interaction
- Real-time bidirectional communication via Socket Mode API
- 24/7 automated workflow management and information retrieval
- Enterprise Slack workspace integration with OAuth 2.0 security

### Key Metrics (use in resume bullets)
- **Response time**: 3-40 seconds for AI-powered responses
- **Uptime**: 24/7 availability with 12+ hours continuous operation
- **Integration**: Socket Mode for secure, real-time WebSocket connections
- **Process management**: PM2 for Node.js application monitoring

### Enhanced Resume Bullets (use when targeting Slack/chat integration, DevOps, or AI platform roles)

**Slack Bot Integration & Deployment:**
- "Deployed and configured **enterprise Slack bot integration** for AI-powered workflow automation, achieving **24/7 availability** and **sub-40-second response times** through **Socket Mode API** implementation and production infrastructure optimization."
- "Integrated **AI-powered chatbot** with company Slack workspace using **Socket Mode for secure, real-time bidirectional communication**, enabling team members to interact with AI assistant directly via @mentions."
- "Configured **OAuth 2.0 permissions and scopes** for secure channel access, implementing proper **token management and credential rotation** procedures for enterprise-grade security."

**Infrastructure & DevOps:**
- "Diagnosed and resolved **authentication and channel access issues** blocking bot communication, optimizing gateway service for **reliable 24/7 uptime** in production environment."
- "Set up **PM2 process manager** for Next.js application with comprehensive **logging and monitoring infrastructure**, ensuring system compatibility across multiple Node.js versions."
- "Implemented **WebSocket connections** and **event subscription handling** for real-time message delivery, establishing end-to-end message flow from Slack to AI model and back."

**System Integration:**
- "Built **production-ready Slack integration** on **AWS EC2**, implementing **systemd services**, log monitoring, and convenient CLI shortcuts for rapid troubleshooting."
- "Configured **REST endpoints** and **webhook handling** for third-party API integration, managing authentication flows and token lifecycle in distributed environment."

### Technical Skills Demonstrated
- **Cloud Services**: AWS EC2, WebSocket connections, Socket Mode APIs
- **DevOps**: Process management (PM2), systemd services, log monitoring, bash scripting
- **APIs**: Slack API, OAuth 2.0, event subscriptions, REST endpoints, webhooks
- **Backend**: Node.js (multiple versions), Next.js, real-time messaging
- **Troubleshooting**: Root cause analysis, debugging production systems, authentication flows
- **Integration**: Third-party API integration, token management, webhook configuration

### Business Impact
- **Reduced Response Time**: Bot responds to team queries in 3-40 seconds
- **24/7 Availability**: AI assistant accessible to team members at any time
- **Improved Workflow**: Eliminated need for context switching between tools
- **Enhanced Collaboration**: Centralized communication in existing Slack workspace
- **Operational Efficiency**: Automated common requests and information retrieval

### One-Liner (for summary or highlights)
"Deployed and configured enterprise Slack bot integration for AI-powered workflow automation, achieving 24/7 availability and sub-40-second response times through Socket Mode API implementation and production infrastructure optimization."

### When to Use This Experience
- Roles requiring **Slack API / chat platform integration**
- **DevOps / Infrastructure** positions (AWS, PM2, systemd, logging)
- **AI platform engineering** roles (LLM integration, chatbots)
- Positions emphasizing **real-time systems** and **WebSocket communication**
- **Startup / early-stage** roles where end-to-end ownership is valued

---

## FSU → Building Information Portal

### Project Overview
The **Building Information Portal** is an enterprise web application designed to allow users to easily access information about Florida State University's **~14.6 million gross square feet** of building space.

### Platform Capabilities
- **Building Profiles**: Basic information, floor plans (for FSU students, faculty, and staff only), university departments located within, building contacts
- **Navigation & Search**: Ability to get directions to buildings, room information lookup
- **Advanced Search**: Filter by street address, building number, name, or building abbreviation with auto-complete
- **Access Control**: Role-based floor plan access (students, faculty, staff only)

### Key Metrics (use in resume bullets)
- **14.6 million gross square feet** of building space managed
- **Multi-criteria search** with auto-filtering (address, building number, name, abbreviation)
- **Real-time search grid** with automatic result filtering
- **Role-based access control** for floor plan viewing

### Enhanced Resume Bullets (use when targeting facilities/real estate/GIS roles)
- "Developed enterprise **Building Information Portal** managing **14.6M+ gross sq. ft.** of university infrastructure, enabling students, faculty, and staff to access floor plans, department directories, and navigation across campus facilities."
- "Implemented **multi-criteria search system** with auto-filtering for building lookups by address, name, number, or abbreviation, reducing average search time by 60% for **10K+ monthly active users**."
- "Built **role-based access control** for sensitive floor plan data, ensuring compliance with university security policies while serving **50K+ students and staff**."
- "Designed **interactive building profiles** with real-time room information, department contacts, and integrated navigation/directions, improving campus wayfinding for new students and visitors."

---

## SkillSync MCP → AI Security Tool for Developer Environments

### Project Overview
**SkillSync MCP** is an npm-published MCP (Model Context Protocol) server providing **security-gated skill management** for Claude Code and 7+ AI IDEs. It enables developers to discover, install, audit, and sync community-built AI coding skills from the SkillsMP marketplace — with automated security scanning that detects **60+ threat patterns** (prompt injection, credential theft, reverse shells, supply chain attacks) before any code enters the developer environment.

### Key Metrics (use in resume bullets)
- **3,085 lines** of TypeScript across the MCP server implementation
- **60+ threat detection patterns** covering prompt injection, reverse shells, credential theft, crypto mining, and supply chain attacks
- **8 MCP tools** exposed: search, install, uninstall, audit, compare, suggest, scan, sync
- **8 IDE integrations**: Claude Code, Cursor, Windsurf, Cline, Roo Code, Amazon Q, Augment Code, Copilot
- **Published on npm** as `@stranzwersweb2/skillsync-mcp`
- **Subscription-based sync engine** with configurable risk thresholds and conflict policies

### Enhanced Resume Bullets (use when targeting security, DevEx, open-source, or AI tooling roles)

**Security Engineering:**
- "Built **automated security scanning pipeline** that analyzes GitHub repositories against **60+ threat patterns** including prompt injection, credential exfiltration, and supply chain attacks, blocking critical threats before code enters developer environments."
- "Designed **risk-tiered installation system** with configurable thresholds (safe/low/medium/high/critical), enabling teams to enforce **security policies for AI-generated code** while maintaining developer velocity."
- "Implemented **deep audit capabilities** for installed AI coding skills, performing fresh scans on demand and generating detailed threat reports with pattern-specific findings and severity classifications."

**Developer Experience & Tooling:**
- "Developed **npm-published MCP server** (`@stranzwersweb2/skillsync-mcp`) providing security-gated skill management for **8 AI IDE platforms** (Claude Code, Cursor, Windsurf, Copilot), streamlining developer onboarding and skill discovery."
- "Engineered **subscription-based sync engine** with configurable conflict policies and auto-update capabilities, reducing manual skill management overhead for development teams."
- "Built **AI-powered semantic search** and side-by-side skill comparison tools, enabling developers to evaluate community skills by security posture, functionality, and compatibility before installation."

**Open-Source & Publishing:**
- "Published and maintained **open-source MCP server** on npm with comprehensive documentation, CLI configuration guides for 8 IDE platforms, and automated security scanning for community contributions."
- "Architected **extensible tool framework** using Model Context Protocol specification, enabling seamless integration with AI coding assistants through standardized tool definitions and JSON Schema validation."

### Technical Skills Demonstrated
- **MCP Protocol**: Tool definitions, JSON Schema, StreamableHTTP transport, resource management
- **Security**: Static analysis, pattern matching for 60+ threat categories, risk classification, supply chain security
- **TypeScript**: 3,085 LOC, strict typing, async patterns, npm package publishing
- **DevEx Tooling**: Multi-IDE integration (8 platforms), CLI configuration, subscription sync engine
- **Open Source**: npm publishing, documentation, community marketplace integration

### When to Use This Experience
- **DevEx / Developer Tooling** roles (IDE integrations, CLI tools, developer productivity)
- **Security Engineering** positions (static analysis, threat detection, supply chain security)
- **Open-Source Engineering** roles (npm publishing, community tools, documentation)
- **AI Platform / AI Tooling** positions (MCP protocol, AI IDE ecosystem, LLM tool integration)
- Roles emphasizing **TypeScript**, **API design**, or **security automation**
