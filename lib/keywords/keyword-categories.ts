/**
 * Keyword categories and comprehensive word lists for resume analysis
 * Used for ATS scoring and keyword extraction
 */

export type KeywordCategory =
  | 'hard_skill'
  | 'soft_skill'
  | 'action_verb'
  | 'industry_term'
  | 'metric'
  | 'technology';

export const ACTION_VERBS = [
  // Achievement & Results
  'achieved', 'accomplished', 'attained', 'completed', 'delivered', 'exceeded',
  'surpassed', 'outperformed', 'realized', 'fulfilled', 'maximized',

  // Leadership & Management
  'administered', 'directed', 'led', 'managed', 'orchestrated', 'oversaw',
  'supervised', 'coordinated', 'guided', 'mentored', 'coached', 'trained',
  'facilitated', 'championed', 'spearheaded', 'pioneered',

  // Creation & Development
  'built', 'created', 'developed', 'designed', 'engineered', 'established',
  'formulated', 'founded', 'generated', 'implemented', 'initiated', 'instituted',
  'introduced', 'launched', 'originated', 'produced', 'programmed', 'prototyped',

  // Improvement & Optimization
  'enhanced', 'improved', 'optimized', 'refined', 'revitalized', 'streamlined',
  'transformed', 'upgraded', 'modernized', 'automated', 'simplified', 'accelerated',
  'boosted', 'increased', 'expanded', 'strengthened', 'fortified',

  // Analysis & Research
  'analyzed', 'assessed', 'audited', 'evaluated', 'examined', 'investigated',
  'researched', 'studied', 'tested', 'validated', 'verified', 'diagnosed',
  'measured', 'quantified', 'calculated', 'forecasted', 'modeled',

  // Communication & Collaboration
  'collaborated', 'communicated', 'consulted', 'presented', 'negotiated',
  'advocated', 'articulated', 'briefed', 'corresponded', 'liaised', 'networked',
  'persuaded', 'influenced', 'aligned', 'partnered',

  // Problem Solving
  'resolved', 'solved', 'troubleshot', 'debugged', 'fixed', 'corrected',
  'addressed', 'mitigated', 'remediated', 'reconciled',

  // Strategy & Planning
  'strategized', 'planned', 'architected', 'conceived', 'designed', 'devised',
  'drafted', 'mapped', 'outlined', 'scheduled', 'organized', 'prioritized',

  // Execution & Operations
  'executed', 'performed', 'operated', 'maintained', 'administered', 'processed',
  'deployed', 'rolled out', 'integrated', 'migrated', 'consolidated',

  // Cost & Efficiency
  'reduced', 'decreased', 'eliminated', 'minimized', 'consolidated', 'saved',
  'cut', 'lowered', 'trimmed',

  // Growth & Scale
  'grew', 'scaled', 'expanded', 'amplified', 'multiplied', 'diversified',
  'broadened', 'extended',
];

export const HARD_SKILLS = {
  // Programming Languages
  programming: [
    'Python', 'JavaScript', 'TypeScript', 'Java', 'C++', 'C#', 'C', 'Go', 'Rust',
    'Ruby', 'PHP', 'Swift', 'Kotlin', 'Objective-C', 'Scala', 'R', 'MATLAB',
    'Perl', 'Shell', 'Bash', 'PowerShell', 'SQL', 'PL/SQL', 'T-SQL', 'Dart',
    'Elixir', 'Erlang', 'Haskell', 'Clojure', 'F#', 'Julia', 'Lua', 'Assembly',
  ],

  // Web Frameworks & Libraries
  frameworks: [
    'React', 'Next.js', 'Vue.js', 'Angular', 'Svelte', 'Node.js', 'Express',
    'Django', 'Flask', 'FastAPI', 'Spring Boot', 'Spring', 'ASP.NET', '.NET Core',
    'Ruby on Rails', 'Laravel', 'Symfony', 'NestJS', 'Nuxt.js', 'Gatsby',
    'Remix', 'SvelteKit', 'Astro', 'Solid.js', 'Qwik', 'Blazor',
  ],

  // Mobile Development
  mobile: [
    'React Native', 'Flutter', 'SwiftUI', 'UIKit', 'Android SDK', 'Jetpack Compose',
    'Ionic', 'Xamarin', 'Cordova', 'Capacitor', 'Expo', 'Kotlin Multiplatform',
  ],

  // Databases
  databases: [
    'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch', 'Cassandra',
    'Oracle', 'SQL Server', 'MariaDB', 'SQLite', 'DynamoDB', 'Firestore',
    'CouchDB', 'Neo4j', 'InfluxDB', 'TimescaleDB', 'RethinkDB', 'Supabase',
    'PlanetScale', 'Neon', 'Prisma', 'Drizzle', 'TypeORM', 'Sequelize',
    'Mongoose', 'Knex', 'SQLAlchemy', 'Hibernate', 'Entity Framework',
  ],

  // Cloud Platforms
  cloud: [
    'AWS', 'Azure', 'GCP', 'Google Cloud', 'DigitalOcean', 'Heroku', 'Vercel',
    'Netlify', 'Railway', 'Render', 'Fly.io', 'Cloudflare', 'Linode', 'Vultr',
    'OVH', 'IBM Cloud', 'Oracle Cloud', 'Alibaba Cloud',
  ],

  // Cloud Services
  cloudServices: [
    'EC2', 'S3', 'Lambda', 'RDS', 'DynamoDB', 'CloudFront', 'Route 53', 'ECS',
    'EKS', 'SNS', 'SQS', 'SES', 'CloudWatch', 'CloudFormation', 'CDK',
    'Azure Functions', 'Azure Storage', 'Azure SQL', 'Azure DevOps',
    'Cloud Functions', 'Cloud Run', 'Cloud Storage', 'BigQuery', 'Pub/Sub',
  ],

  // DevOps & Infrastructure
  devops: [
    'Docker', 'Kubernetes', 'Terraform', 'Ansible', 'Jenkins', 'CircleCI',
    'GitHub Actions', 'GitLab CI', 'Travis CI', 'ArgoCD', 'Helm', 'Vagrant',
    'Puppet', 'Chef', 'SaltStack', 'Nomad', 'Consul', 'Vault', 'Packer',
    'Pulumi', 'CloudFormation', 'ARM Templates', 'Bicep', 'OpenTofu',
  ],

  // Version Control & Collaboration
  versionControl: [
    'Git', 'GitHub', 'GitLab', 'Bitbucket', 'SVN', 'Mercurial', 'Perforce',
    'Azure Repos', 'Gitea', 'Gogs',
  ],

  // Testing & Quality
  testing: [
    'Jest', 'Vitest', 'Mocha', 'Chai', 'Jasmine', 'Cypress', 'Playwright',
    'Selenium', 'Puppeteer', 'TestCafe', 'WebdriverIO', 'JUnit', 'TestNG',
    'PyTest', 'unittest', 'RSpec', 'Postman', 'k6', 'Gatling', 'JMeter',
    'SonarQube', 'ESLint', 'Prettier', 'Black', 'Flake8', 'Pylint',
  ],

  // Frontend Tools
  frontend: [
    'Webpack', 'Vite', 'Rollup', 'Parcel', 'esbuild', 'Turbopack', 'SWC',
    'Babel', 'PostCSS', 'Sass', 'LESS', 'Tailwind CSS', 'Material-UI',
    'Ant Design', 'Chakra UI', 'shadcn/ui', 'Radix UI', 'Headless UI',
    'Styled Components', 'Emotion', 'CSS Modules', 'Bootstrap', 'Foundation',
  ],

  // Backend Tools
  backend: [
    'GraphQL', 'REST', 'gRPC', 'WebSocket', 'tRPC', 'Apollo', 'Hasura',
    'Prisma', 'Supabase', 'Firebase', 'Auth0', 'Clerk', 'NextAuth',
    'Passport', 'JWT', 'OAuth', 'SAML', 'OpenID Connect',
  ],

  // Data Science & ML
  dataScience: [
    'TensorFlow', 'PyTorch', 'Keras', 'scikit-learn', 'pandas', 'NumPy',
    'Matplotlib', 'Seaborn', 'Jupyter', 'Apache Spark', 'Hadoop', 'Airflow',
    'Databricks', 'MLflow', 'Kubeflow', 'SageMaker', 'Vertex AI', 'H2O.ai',
    'XGBoost', 'LightGBM', 'CatBoost', 'NLTK', 'spaCy', 'Hugging Face',
    'LangChain', 'LlamaIndex', 'OpenAI API', 'Anthropic API', 'Cohere',
  ],

  // Monitoring & Observability
  monitoring: [
    'Prometheus', 'Grafana', 'Datadog', 'New Relic', 'Splunk', 'Sentry',
    'LogRocket', 'Honeycomb', 'Lightstep', 'Jaeger', 'Zipkin', 'OpenTelemetry',
    'ELK Stack', 'Elastic', 'Kibana', 'Logstash', 'Fluentd', 'Loki',
  ],

  // Security
  security: [
    'OWASP', 'Burp Suite', 'Metasploit', 'Nmap', 'Wireshark', 'Snort',
    'SIEM', 'Splunk', 'CrowdStrike', 'Palo Alto', 'Fortinet', 'Cisco',
    'Vault', 'KMS', 'HSM', 'SSL/TLS', 'PKI', 'IAM', 'RBAC', 'MFA',
  ],

  // Design & Creative
  design: [
    'Figma', 'Sketch', 'Adobe XD', 'InVision', 'Framer', 'Principle',
    'Photoshop', 'Illustrator', 'After Effects', 'Premiere Pro', 'Blender',
    'Cinema 4D', 'Unity', 'Unreal Engine', 'Three.js', 'WebGL', 'Canvas',
  ],

  // Project Management
  projectManagement: [
    'Jira', 'Confluence', 'Asana', 'Monday', 'Trello', 'ClickUp', 'Linear',
    'Notion', 'Airtable', 'Smartsheet', 'Basecamp', 'Microsoft Project',
    'Azure Boards', 'GitHub Projects', 'GitLab Issues',
  ],

  // Communication
  communication: [
    'Slack', 'Microsoft Teams', 'Discord', 'Zoom', 'Google Meet', 'Miro',
    'Mural', 'FigJam', 'Loom', 'Calendly', 'Intercom', 'Zendesk',
  ],
};

export const SOFT_SKILLS = [
  // Leadership
  'leadership', 'team leadership', 'technical leadership', 'mentorship', 'coaching',
  'people management', 'stakeholder management', 'executive presence',

  // Communication
  'communication', 'verbal communication', 'written communication', 'presentation',
  'public speaking', 'technical writing', 'documentation', 'storytelling',
  'active listening', 'negotiation', 'persuasion', 'conflict resolution',

  // Collaboration
  'teamwork', 'collaboration', 'cross-functional collaboration', 'partnership',
  'relationship building', 'networking', 'influence', 'diplomacy',

  // Problem Solving
  'problem-solving', 'critical thinking', 'analytical thinking', 'troubleshooting',
  'debugging', 'root cause analysis', 'decision making', 'strategic thinking',

  // Adaptability
  'adaptability', 'flexibility', 'resilience', 'learning agility', 'growth mindset',
  'change management', 'innovation', 'creativity', 'resourcefulness',

  // Organization
  'time management', 'prioritization', 'organization', 'planning', 'multitasking',
  'attention to detail', 'process improvement', 'efficiency', 'productivity',

  // Initiative
  'self-motivation', 'initiative', 'proactivity', 'ownership', 'accountability',
  'independence', 'autonomy', 'drive', 'ambition',

  // Quality
  'quality focus', 'excellence', 'precision', 'thoroughness', 'reliability',
  'consistency', 'professionalism', 'work ethic',
];

export const INDUSTRY_TERMS = {
  // Software Engineering
  tech: [
    'agile', 'scrum', 'kanban', 'sprint', 'stand-up', 'retrospective',
    'microservices', 'monolith', 'API', 'RESTful', 'GraphQL', 'serverless',
    'event-driven', 'CQRS', 'DDD', 'TDD', 'BDD', 'CI/CD', 'DevOps', 'SRE',
    'scalability', 'performance', 'latency', 'throughput', 'reliability',
    'availability', 'fault tolerance', 'disaster recovery', 'high availability',
    'load balancing', 'caching', 'CDN', 'edge computing', 'containerization',
    'orchestration', 'infrastructure as code', 'observability', 'telemetry',
    'SLA', 'SLO', 'SLI', 'uptime', 'downtime', 'incident response',
    'on-call', 'postmortem', 'RCA', 'runbook', 'playbook',
  ],

  // Business & Product
  business: [
    'ROI', 'KPI', 'OKR', 'stakeholder', 'revenue', 'growth', 'strategy',
    'roadmap', 'milestone', 'deliverable', 'timeline', 'budget', 'cost savings',
    'profit margin', 'market share', 'competitive advantage', 'value proposition',
    'customer acquisition', 'retention', 'churn', 'lifetime value', 'conversion',
    'engagement', 'user experience', 'customer satisfaction', 'NPS', 'CSAT',
    'MVP', 'PMF', 'GTM', 'B2B', 'B2C', 'SaaS', 'PaaS', 'IaaS',
  ],

  // Data & Analytics
  data: [
    'data pipeline', 'ETL', 'ELT', 'data warehouse', 'data lake', 'data mesh',
    'data governance', 'data quality', 'master data', 'metadata', 'schema',
    'normalization', 'denormalization', 'OLTP', 'OLAP', 'batch processing',
    'stream processing', 'real-time', 'near real-time', 'analytics', 'BI',
    'dashboard', 'visualization', 'reporting', 'insights', 'metrics',
    'A/B testing', 'experimentation', 'statistical analysis', 'predictive analytics',
    'machine learning', 'deep learning', 'neural network', 'model training',
    'inference', 'deployment', 'MLOps', 'feature engineering', 'model evaluation',
  ],

  // Security & Compliance
  security: [
    'security', 'cybersecurity', 'infosec', 'appsec', 'devsecops', 'zero trust',
    'penetration testing', 'vulnerability assessment', 'threat modeling',
    'risk assessment', 'compliance', 'GDPR', 'HIPAA', 'SOC 2', 'ISO 27001',
    'PCI DSS', 'CCPA', 'encryption', 'authentication', 'authorization',
    'access control', 'least privilege', 'defense in depth', 'incident response',
  ],

  // AI & Machine Learning
  ai: [
    'artificial intelligence', 'machine learning', 'deep learning', 'NLP',
    'natural language processing', 'computer vision', 'reinforcement learning',
    'supervised learning', 'unsupervised learning', 'transfer learning',
    'fine-tuning', 'prompt engineering', 'RAG', 'vector database', 'embedding',
    'transformer', 'LLM', 'generative AI', 'GPT', 'diffusion model',
    'neural network', 'CNN', 'RNN', 'LSTM', 'GAN', 'autoencoder',
  ],
};

export const KEYWORD_COLORS: Record<KeywordCategory, { light: string; dark: string }> = {
  hard_skill: {
    light: 'bg-blue-100 text-blue-700 border-blue-200',
    dark: 'bg-blue-950/50 text-blue-300 border-blue-800'
  },
  soft_skill: {
    light: 'bg-purple-100 text-purple-700 border-purple-200',
    dark: 'bg-purple-950/50 text-purple-300 border-purple-800'
  },
  action_verb: {
    light: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    dark: 'bg-emerald-950/50 text-emerald-300 border-emerald-800'
  },
  industry_term: {
    light: 'bg-orange-100 text-orange-700 border-orange-200',
    dark: 'bg-orange-950/50 text-orange-300 border-orange-800'
  },
  metric: {
    light: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    dark: 'bg-cyan-950/50 text-cyan-300 border-cyan-800'
  },
  technology: {
    light: 'bg-pink-100 text-pink-700 border-pink-200',
    dark: 'bg-pink-950/50 text-pink-300 border-pink-800'
  },
};

export const KEYWORD_LABELS: Record<KeywordCategory, string> = {
  hard_skill: 'Hard Skill',
  soft_skill: 'Soft Skill',
  action_verb: 'Action Verb',
  industry_term: 'Industry Term',
  metric: 'Metric',
  technology: 'Technology',
};

/**
 * Flatten all hard skills into a single array for easier matching
 */
export function getAllHardSkills(): string[] {
  return Object.values(HARD_SKILLS).flat();
}

/**
 * Get all keywords by category
 */
export function getKeywordsByCategory(category: KeywordCategory): string[] {
  switch (category) {
    case 'action_verb':
      return ACTION_VERBS;
    case 'hard_skill':
    case 'technology':
      return getAllHardSkills();
    case 'soft_skill':
      return SOFT_SKILLS;
    case 'industry_term':
      return Object.values(INDUSTRY_TERMS).flat();
    case 'metric':
      return []; // Metrics are extracted via regex patterns
    default:
      return [];
  }
}
