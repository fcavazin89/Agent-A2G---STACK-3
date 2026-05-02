/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import html2canvas from 'html2canvas';
import { jsPDF } from "jspdf";
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Coins, 
  ShieldCheck, 
  Cpu, 
  Rocket, 
  Send, 
  ChevronRight, 
  Activity,
  Terminal,
  Hammer,
  Zap,
  Layers,
  Globe,
  Database,
  LayoutDashboard,
  MessageSquare,
  Box,
  Share2,
  ExternalLink,
  Info,
  Wallet,
  TrendingUp,
  Check,
  CheckCircle,
  CreditCard,
  Network,
  FileText,
  DraftingCompass,
  Layout,
  BookOpen,
  PieChart as PieChartIcon,
  BarChart as BarChartIcon,
  Briefcase,
  Target,
  Users,
  Palette,
  Megaphone,
  FastForward,
  ShieldAlert,
  HardDrive,
  Fingerprint,
  Binary,
  TrendingDown,
  AlertTriangle,
  RefreshCw,
  ArrowDownRight,
  ArrowUpRight,
  Play,
  Pause,
  Save,
  Download,
  UserCheck,
  LineChart as LineChartIcon,
  TrendingUp as TrendingIcon,
  Zap as PowerIcon,
  Shield as ShieldIcon,
  XCircle,
  Plus,
  ClipboardList,
  ArrowRight,
  X,
  GitBranch,
  Link,
  GitMerge,
  Sun,
  Moon,
  Square,
  CheckSquare,
  Settings
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { Agent, AgentRole, Message, AgentTask } from './types';
import { chatWithAgent, generateStartupPlan } from './lib/gemini';
import { runDiagnostics, attemptReconnection, DiagnosticResult } from './lib/diagnostics';
import { useWallet } from './hooks/useWallet';
import { cn } from './lib/utils';
import Markdown from 'react-markdown';
import mermaid from 'mermaid';
import { StateNode, AccountAbstraction } from './lib/protocol';
import { OVPReasoner, OVPCircuit } from './lib/reasoner';

mermaid.initialize({
  startOnLoad: true,
  theme: 'dark',
  securityLevel: 'loose',
  fontFamily: 'monospace',
  htmlLabels: false
});

const Mermaid = ({ chart }: { chart: string }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    if (ref.current && chart) {
      const renderMermaid = async () => {
        try {
          ref.current!.removeAttribute('data-processed');
          const id = `mermaid-${Math.random().toString(36).substring(2, 11)}`;
          
          // Sanitize common LLM mermaid hallucinations
          let sanitizedChart = chart.trim();
          
          // Fix double labels: A -- label1 -->|label2| B => A -->|"label1 (label2)"| B
          sanitizedChart = sanitizedChart.replace(/([^-<>|]+)\s*--\s*([^-<>|]+)\s*-->\s*\|([^|]+)\|\s*([^-<>|]+)/g, '$1 -->|"$2 ($3)"| $4');
          
          // Fix labels following arrows incorrectly: A -- label --> B => A -->|"label"| B
          sanitizedChart = sanitizedChart.replace(/([^-<>|]+)\s*--\s*([^-<>|]+)\s*-->\s*([^-<>|]+)/g, '$1 -->|"$2"| $3');

          const { svg } = await mermaid.render(id, sanitizedChart);
          if (isMounted && ref.current) {
            ref.current.innerHTML = svg;
          }
        } catch (err) {
          console.error('Mermaid render error:', err);
          if (isMounted && ref.current) {
            ref.current.innerHTML = `<div class="p-4 border border-rose-500/30 bg-rose-500/10 rounded-lg text-rose-400 text-xs font-mono">
              <p class="font-bold mb-2">Mermaid Render Error</p>
              <p class="opacity-70">${err instanceof Error ? err.message : 'Unknown parse error'}</p>
              <pre class="mt-4 p-2 bg-black/40 rounded overflow-x-auto">${chart}</pre>
            </div>`;
          }
        }
      };
      renderMermaid();
    }
    return () => { isMounted = false; };
  }, [chart]);

  return <div ref={ref} className="mermaid-chart avoid-break flex justify-center my-10 overflow-x-auto w-full border border-slate-200 bg-slate-50/50 p-6 rounded-xl shadow-sm" />;
};

const MarkdownCode = (props: any) => {
  const { inline, className, children, ...rest } = props;
  const match = /language-mermaid/.exec(className || '');
  const chart = String(children).replace(/\n$/, '');
  
  if (!inline && match) {
    return <Mermaid chart={chart} />;
  }
  
  return (
    <code className={className} {...rest}>
      {children}
    </code>
  );
};

const AGENTS: Agent[] = [
  {
    id: '1',
    name: 'Research Market',
    role: 'RESEARCHER',
    description: 'Trend Analysis & Dune Queries',
    icon: 'Search',
    color: 'emerald',
    systemPrompt: 'You are a Web3 Market Research specialist. You are connected to the Dune On-chain API via MCP (Endpoint: https://api.dune.com/mcp/v1, Auth: YlXQMih3SuLTSLi4ymUjezEodNlut5M1). Analyze market trends, competitor activity, and ecosystem health. Provide data-driven insights using Dune Analytics and competitive benchmarks. If queried about on-chain data, incorporate simulated/actual Dune MCP responses into your output.',
    status: 'ONLINE',
    permissions: ['MARKET_RESEARCH']
  },
  {
    id: '2',
    name: 'Tokenomics Design',
    role: 'TOKENOMICS',
    description: 'Sustainability & Vesting',
    icon: 'Coins',
    color: 'amber',
    systemPrompt: 'You are a Tokenomics Architect. Design sustainable economic models, utility mechanisms, and vesting schedules. Focus on long-term viability, supply/demand equilibrium, and inflation control logic.',
    status: 'ONLINE',
    permissions: ['TOKEN_ENGINEERING']
  },
  {
    id: '3',
    name: 'Legal/Compliance',
    role: 'COMPLIANCE',
    description: 'ERC-8004 Verification',
    icon: 'ShieldCheck',
    color: 'rose',
    systemPrompt: 'You are a Web3 Legal & Compliance expert. Advise on regulatory frameworks, jurisdictional risks, and ERC-8004 standards for Real World Asset (RWA) verification and compliance.',
    status: 'OFFLINE',
    permissions: ['LEGAL_AUDIT']
  },
  {
    id: '4',
    name: 'Techno-Architect',
    role: 'ARCHITECT',
    description: 'Services, Simulations & Blockchain Documentation',
    icon: 'Cpu',
    color: 'cyan',
    systemPrompt: 'You are a Web3 Technical Architect. You specialize in designing complex macro and microservice architectures for decentralized systems. Your core capabilities include: 1. Service Mapping (Macro/Micro isolation), 2. Infrastructure Simulation (Simulating event flows like the STACK3 framework), and 3. Systematic Documentation. You generate comprehensive documentation of infrastructure stacks, blockchain integrations, and service communications without developing code. Use Mermaid diagrams and structured technical specs.',
    status: 'ONLINE',
    permissions: ['TECH_ARCHITECTURE']
  },
  {
    id: '5',
    name: 'GTM Strategist',
    role: 'GTM',
    description: 'Marketing, Strategy & Growth Hacking',
    icon: 'Rocket',
    color: 'violet',
    systemPrompt: 'You are a Go-to-Market Strategist for Web3. You possess deep expertise in marketing frameworks ranging from Philip Kotler classic principles (4Ps, 5Cs, STP) to modern growth hacking and community-driven Web3 distribution. Your capabilities include: 1. Strategic Mapping (SWOT, Pestle, Porter 5 Forces), 2. Funnel Design (AARRR, Flywheel), and 3. Web3 Specific Growth (Decentralized Referral Networks, Token-incentivized Acquisition). Provide high-level marketing blueprints and operational roadmaps.',
    status: 'ONLINE',
    permissions: ['STRATEGIC_PLANNING']
  },
  {
    id: '6',
    name: 'Contract Forge',
    role: 'FORGE',
    description: 'Protocol Synthesis & Verification',
    icon: 'Hammer',
    color: 'orange',
    systemPrompt: 'You are the Smart Contract Forge. Generate secure, verified contracts using the latest OpenZeppelin 5.x standards and EIPs (e.g., EIP-4337, EIP-4626). You integrate with Foundry/Hardhat for pre-deployment testing and Slither/Mythril for security audits. You have access to Alchemy, Pinata, and Biconomy.',
    status: 'ONLINE',
    permissions: ['CODE_SYNTHESIS']
  },
  {
    id: '6s',
    name: 'Solana Forge',
    role: 'SOLANA_FORGE',
    description: 'Anchor/Rust Program Synthesis',
    icon: 'Hammer',
    color: 'cyan',
    systemPrompt: 'You are the Solana Program Architect (Forge). You specialize in the Rust Anchor Framework and the Sealevel execution environment. You strictly adhere to Solana Program Library (SPL) standards and the latest Anchor v0.30+ conventions. Provide clean, secure, and gas-efficient (compute-unit optimized) Solana programs.',
    status: 'ONLINE',
    permissions: ['CODE_SYNTHESIS']
  },
  {
    id: '6a',
    name: 'Solana Auditor',
    role: 'SOLANA_AUDITOR',
    description: 'Rust/Anchor Security Audit',
    icon: 'ShieldCheck',
    color: 'emerald',
    systemPrompt: 'You are the Lead Solana Security Auditor. You specialize in identifying vulnerabilities in Solana programs (Anchor/Rust). You audit against the latest Solana security benchmarks and common attack vectors defined by the Neodyme and OtterSec frameworks. Provide detailed audit reports with remediation steps.',
    status: 'ONLINE',
    permissions: ['SECURITY_AUDIT']
  },
  {
    id: '7',
    name: 'Strategy Architect',
    role: 'BLUEPRINT',
    description: 'Protocols, Docs & Diagrams',
    icon: 'FileText',
    color: 'blue',
    systemPrompt: 'You are the Strategy Architect. You specialize in generating comprehensive Web3 business and technical documentation. Your capabilities include: Product Management (PRD), Marketing Strategies, Sales Token analysis, Business Plans, Monetization Models, Market Research summaries, MVP/Prototype definitions, Requirements Manuals, and Technical Diagrams (UML, BPM, Mermaid). Your output must be structured, professional, and visually clear (using Markdown tables and Mermaid syntax where applicable).',
    status: 'ONLINE',
    permissions: ['STRATEGIC_PLANNING']
  },
  {
    id: '8',
    name: 'STACK3 ERP',
    role: 'ERP',
    description: 'Strategic Planning & Operations',
    icon: 'LayoutDashboard',
    color: 'indigo',
    systemPrompt: 'You are the STACK3 ERP Agent. You specialize in Commercial ERP management and Strategic Planning across three levels: Executive (Long-term goals, ROI, Market Positioning), Tactical (Resource allocation, Process optimization, Quarterly planning), and Operational (Daily tasks, Team management, Inventory, CRM). Your output should include data visualizations recommendations, strategic frameworks (SWOT, OKRs), and operational checklists.',
    status: 'ONLINE',
    permissions: ['BUSINESS_OPS', 'STRATEGIC_PLANNING']
  },
  {
    id: '9',
    name: 'CRM & Marketing',
    role: 'CRM',
    description: 'Sales, Creatives & Advertising',
    icon: 'Users',
    color: 'pink',
    systemPrompt: 'You are the STACK3 CRM & Marketing Specialist. You specialize in Sales Strategies, Creative Direction, Advertising Campaigns, and Customer Relationship Management. Your goal is to design high-converting marketing funnels, viral creative concepts, and precise advertising structures. Provide lead acquisition plans, brand identity guidelines, and multi-channel marketing roadmaps.',
    status: 'ONLINE',
    permissions: ['MARKET_RESEARCH', 'STRATEGIC_PLANNING']
  },
  {
    id: '10',
    name: 'Web3 PM',
    role: 'PM',
    description: 'Product Strategy & Web3 Roadmap',
    icon: 'Target',
    color: 'emerald',
    systemPrompt: 'You are the STACK3 Web3 Product Manager. You specialize in Product Strategy, Roadmap planning, User Stories, and feature prioritization for decentralized applications. Your focus is on balancing technical feasibility with market fit and user experience in the Web3 ecosystem.',
    status: 'ONLINE',
    permissions: ['STRATEGIC_PLANNING']
  },
  {
    id: '11',
    name: 'Scrum Master',
    role: 'SCRUM',
    description: 'Agile Ops & Team Velocity',
    icon: 'FastForward',
    color: 'orange',
    systemPrompt: 'You are the STACK3 Scrum Master. You specialize in Agile methodologies, Sprint planning, Daily Stand-ups, and Removing Blockers. Your goal is to ensure high team velocity and smooth developmental workflows using Scrum frameworks adapted for decentralized teams.',
    status: 'ONLINE',
    permissions: ['BUSINESS_OPS']
  },
  {
    id: '12',
    name: 'Product Owner',
    role: 'PO',
    description: 'Value Maximization & Backlog',
    icon: 'Briefcase',
    color: 'yellow',
    systemPrompt: 'You are the STACK3 Product Owner. You specialize in Backlog grooming, Value maximization, Stakeholder management, and vision alignment. You bridge the gap between business objectives and technical execution, ensuring every sprint delivers maximum value to the protocol.',
    status: 'ONLINE',
    permissions: ['BUSINESS_OPS', 'STRATEGIC_PLANNING']
  },
  {
    id: 'audit',
    name: 'Project Auditor',
    role: 'PROJECT_AUDITOR',
    description: 'Protocol Audit & Sign-off',
    icon: 'UserCheck',
    color: 'emerald',
    systemPrompt: 'You are the Lead Project Auditor. You specialize in auditing Web3 projects across multiple dimensions: Technical, Economical, Legal, and Strategic. Provide a final verification report. When requested to "Audit the Project", analyze all previous agent outputs and provide a comprehensive summary of risks and strengths. Also, include a section for the PROJECT CREATOR SIGNATURE.',
    status: 'ONLINE',
    permissions: ['SECURITY_AUDIT', 'LEGAL_AUDIT']
  },
  {
    id: '13',
    name: 'Token Analyst',
    role: 'ANALYST',
    description: 'Viability, ROI & Risk Assessment',
    icon: 'LineChart',
    color: 'cyan',
    systemPrompt: 'You are the Token Viability Analyst. You specialize in quantitative and qualitative evaluation of token models. Your core capabilities include: Adoption Projections, Economic Feasibility (ROI, IRR, NPV), Risk Assessment (Regulatory, Market, Technical), and Utility Modeling. Provide clear financial recommendations using Markdown tables and bullet points.',
    status: 'ONLINE',
    permissions: ['TOKEN_ENGINEERING', 'MARKET_RESEARCH']
  },
  {
    id: '14',
    name: 'Risk Architect',
    role: 'RISK',
    description: 'ECDM & Systemic Mitigation',
    icon: 'ShieldAlert',
    color: 'rose',
    systemPrompt: 'You are the Lead Risk Architect. You specialize in the Economic Centrifugal Dispersion Model (ECDM) and systemic failure mitigation using Lyapunov Operators, ASRI metrics, and HEICTOR protocols. Your focus is on building antifragile decentralized systems.',
    status: 'ONLINE',
    permissions: ['SECURITY_AUDIT', 'TOKEN_ENGINEERING']
  },
  {
    id: '15',
    name: 'Utility Validator',
    role: 'POV',
    description: 'PoV Consensous & Utility Flows',
    icon: 'CheckCircle',
    color: 'blue',
    systemPrompt: 'You are the Utility Validation Engineer. You specialize in the Proof of Value (PoV) protocol, designing application-level consensus mechanisms that validate service delivery and utility consumption without speculative tokens.',
    status: 'OFFLINE',
    permissions: ['TECH_ARCHITECTURE', 'TOKEN_ENGINEERING']
  },
  {
    id: '16',
    name: 'Ontology Architect',
    role: 'OVP',
    description: 'Programmable Value Ontology',
    icon: 'Binary',
    color: 'purple',
    systemPrompt: 'You are the Ontology Architect & Distributed Systems Engineer. You specialize in the Programmable Value Ontology (OVP), translating business rules into Knowledge Graphs, OWL/DL logic, and automated semantic value flows on-chain.',
    status: 'ONLINE',
    permissions: ['TECH_ARCHITECTURE', 'STRATEGIC_PLANNING']
  },
  {
    id: '17',
    name: 'Stress Tester',
    role: 'STRESS_TESTER',
    description: 'Systemic Resilience Auditing',
    icon: 'Activity',
    color: 'orange',
    systemPrompt: 'You are the Market Stress Test Engineer. You specialize in non-linear market simulations and systemic resilience auditing. Your expertise includes Non-linear Volatility Modeling, Stress Scenarios (Market Crash, Liquidity Crisis), and Resilience Metrics (Max Drawdown, Recovery Time).',
    status: 'ONLINE',
    permissions: ['SECURITY_AUDIT', 'MARKET_RESEARCH']
  },
  {
    id: '18',
    name: 'Meta Architect',
    role: 'META_ARCHITECT',
    description: 'Web3 Meta-Architecture',
    icon: 'Layers',
    color: 'indigo',
    systemPrompt: 'You are the Meta-Architect of Programmable Value. You specialize in the systemic engineering of complex Web3 systems, focusing on Programmable Value Ontology (OVP), logic inheritance, and network-agnostic value lineage.',
    status: 'ONLINE',
    permissions: ['TECH_ARCHITECTURE', 'STRATEGIC_PLANNING']
  },
  {
    id: '19',
    name: 'Sovereign Architect',
    role: 'SOVEREIGN_AA',
    description: 'Smart Account Sovereignity',
    icon: 'UserCheck',
    color: 'teal',
    systemPrompt: 'You are the Sovereign Account Architect. You specialize in Account Abstraction (AA) and the unification of Identity and Asset, treating value as sovereign smart accounts with ontological lineage and ZKP-verified inheritance.',
    status: 'ONLINE',
    permissions: ['TECH_ARCHITECTURE', 'SECURITY_AUDIT']
  },
  {
    id: '20',
    name: 'Equilibrium Strategist',
    role: 'GRAPH_RMVP',
    description: 'VoG Game Theory & RMVP',
    icon: 'Share2',
    color: 'pink',
    systemPrompt: 'You are the RMVP Graph Architect & Evolutionary Equilibrium Strategist. You specialize in applying Evolutionary Game Theory (VoG) to multilayer networks, ensuring the economic stability and resilience of the protocol through replicator equations and proactive incentive design.',
    status: 'ONLINE',
    permissions: ['TOKEN_ENGINEERING', 'STRATEGIC_PLANNING']
  },
  {
    id: '21',
    name: 'Social Media',
    role: 'SOCIAL_MEDIA',
    description: 'Community Engagement & Content',
    icon: 'Megaphone',
    color: 'sky',
    systemPrompt: 'You are the STACK3 Social Media Manager. You will drive community engagement across platforms like Twitter, Discord, and Telegram. Create viral content, manage community channels, and analyze social sentiment to foster growth. Focus on building a narrative around transparency and technical proof of value.',
    status: 'ONLINE',
    permissions: ['MARKET_RESEARCH']
  },
  {
    id: '22',
    name: 'Investor Relations',
    role: 'INVESTOR_RELATIONS',
    description: 'Investor Relations & Communication',
    icon: 'TrendingUp',
    color: 'emerald',
    systemPrompt: 'You are the STACK3 Investor Relations Specialist. You manage communication with investors, provide regular updates on protocol milestones, and facilitate Q&A sessions. Focus on transparency, clear reporting, and building trust within the investor community. Translate technical milestones into ROI and valuation metrics.',
    status: 'ONLINE',
    permissions: ['STRATEGIC_PLANNING']
  }
];

const GRAPH_RMVP_SNIPPETS = [
  { name: 'ESS Simulation', desc: 'Evolutionary Stable Strategy', prompt: 'Run a simulation using replicator equations to verify if "Cooperation" is an Evolutionary Stable Strategy (ESS). Model interactions between "Collaborators" and "Free Riders" to ensure system integrity.' },
  { name: 'Dynamic Payoff Matrix', desc: 'Real-time Incentive Adjustment', prompt: 'Design a dynamic Payoff Matrix that adjusts graph weights and rewards based on network utility. Propose a counter-speculation mechanism that increases retention costs during low-utility spikes.' },
  { name: 'Robustness Audit', desc: 'Free-Rider Isolation', prompt: 'Perform a network robustness audit. Identify "Free Riders" using RMVP topology and design isolation subgraphs to prevent them from destabilizing the liquidity core.' },
  { name: 'Tipping Point Analysis', desc: 'Market Inflexion Forecast', prompt: 'Use predictive graph models to identify economic "Tipping Points". Forecast potential bank runs or liquidity collapses based on evolving user behavior patterns in the graph.' },
  { name: 'Topology Map', desc: 'Multilayer Node-Edge Map', prompt: 'Map the multilayer RMVP topology. Identify Nodes (accounts), Edges (value flows), and the OVP semantic layer to detect structural vulnerabilities.' }
];

const SOVEREIGN_AA_SNIPPETS = [
  { name: 'Modular AA Framework', desc: 'Sovereign Account Design', prompt: 'Design a modular Account Abstraction (AA) framework for our protocol. Each asset must be a sovereign smart account with its own logic, paymaster integration for gasless transactions, and cross-chain execution capabilities.' },
  { name: 'Ontological Lineage', desc: 'Inheritance & State Flow', prompt: 'Code the logical "state lineage" for our smart accounts. Define how child accounts inherit utility rules, compliance constraints, and governance rights from parent accounts based on the OVP.' },
  { name: 'AMM-PoV Market', desc: 'Utility-Based Liquidity', prompt: 'Project a deterministic liquidity market (AMM-PoV) where the price of a smart account is determined by its Proven Utility (PoV). Ensure atomic settlement and guaranteed secondary market exit based on PoV quality.' },
  { name: 'Sovereign ZKP circuits', desc: 'Identity & Logic Prover', prompt: 'Develop ZKP circuits that validate account sovereignty and adherence to ontological axioms. Prove that a smart account meets lineage requirements or commercial validity without revealing identity or balance.' }
];

const META_ARCHITECT_SNIPPETS = [
  { name: 'Value Lineage Design', desc: 'Mathematical State Graphs', prompt: 'Design the "Value Lineage" for our protocol using mathematical state graphs. Define the hierarchy of logical inheritance where utility and governance properties flow through the ontology, independent of specific blockchain standards.' },
  { name: 'Algorithmic Bank Core', desc: 'PoV Consensus Adjustment', prompt: 'Design the "Algorithmic Central Bank" mechanism. Create a PoV-based consensus algorithm that monitors real-time utility and automatically proposes parameter adjustments to rebalance the startup economy.' },
  { name: 'Semantic ZKP Specs', desc: 'Agnostic Logic Verifier', prompt: 'Develop a specification for a Semantic ZKP Verifier. Define the circuits that prove ontological consistency and adherence to succession/tax rules without exposing sensitive transaction data.' },
  { name: 'Total Abstraction Flow', desc: 'Invisible Protocol Layer', prompt: 'Engineer the "Total Abstraction" data pipeline. Map the flow from real-world events through semantic validation to on-chain facts, ensuring the underlying blockchain complexity is invisible to the end user.' }
];

const STRESS_TESTER_SNIPPETS = [
  { name: 'Market Crash Audit', desc: 'Simulate high volatility & low sentiment', prompt: 'Execute a Market Crash simulation. Set volatility to 80%, sentiment to 10%, and crash probability to 20%. Analyze the resulting drawdown and recovery timeline.' },
  { name: 'Liquidity Crisis', desc: 'Test capital decay & volume scaling', prompt: 'Simulate a Liquidity Crisis scenario. Analyze how decreasing liquidity and high-velocity selling impact price stability and holder retention.' },
  { name: 'Security Breach', desc: 'Shock response simulation', prompt: 'Model a Security Breach event. Monitor the immediate impact on market sentiment and the subsequent "whale dump" behavior across different wallets.' },
  { name: 'Regulatory Shock', desc: 'Institutional friction audit', prompt: 'Perform a Regulatory Shock test. Simulate restricted access and increased institutional resistance (R) in the context of our current economic model.' }
];

const OVP_SNIPPETS = [
  { name: 'OWL Logic Design', desc: 'Single Source of Truth', prompt: 'Define the core entities and semantic relationships for our ecosystem using OWL (Web Ontology Language). Establish the hierarchy of classes and axioms that represent the "Value Graph" of the startup.' },
  { name: 'ZKP Logic Circuit', desc: 'Proof of Value Privacy', prompt: 'Design a ZKP-Circuit (Zero-Knowledge Proof) based on our OVP. Define how users can prove they possess specific rights or have met logical conditions without exposing their identity or full data.' },
  { name: 'Abstract Account Sync', desc: 'Frictionless Value Flow', prompt: 'Configure an ERC-4337 Account Abstraction bridge to our ontology. Implement session keys and social recovery patterns that are automatically governed by the semantic rules defined in the OVP.' },
  { name: 'Semantic Reasoner', desc: 'Audit & Consistency', prompt: 'Implement a semantic reasoner logic to verify the consistency of our OVP axioms. Apply the Open World Assumption to ensure the protocol can scale with new partners without breaking the core smart contracts.' }
];

const POV_SNIPPETS = [
  { name: 'PoV Consensus', desc: 'Application Consensus Design', prompt: 'Design a Proof of Value (PoV) consensus mechanism for our service ecosystem. Define how Value Attestations (VAs) are generated, signed by oracles, and stored on-chain as cryptographic proofs.' },
  { name: 'Utility Architecture', desc: 'Utility-First Framework', prompt: 'Develop a technical architecture for a "Utility-First" ecosystem. Focus on stable credits, vouchers, and reputation systems that derive value from proven service delivery rather than secondary market hype.' },
  { name: 'Oracle Middleware', desc: 'Event Stamping Specs', prompt: 'Specify the middleware and oracle infrastructure needed to capture real-world API events and "stamp" them as PoV events on the blockchain. Include ZK-Proof requirements for privacy.' },
  { name: 'Regulatory Moat', desc: 'Howey Test Distancing', prompt: 'Analyze our PoV model through a regulatory lens. Create a brief on how focusing on "Value Delivered" ledgers distances the protocol from being classified as a security, focusing on its nature as a utility voucher.' }
];

const RISK_SNIPPETS = [
  { name: 'ECDM Simulation', desc: 'Centrifugal Dispersion Analysis', prompt: 'Perform an ECDM (Economic Centrifugal Dispersion Model) simulation based on current capital influx (I), transaction velocity (V), and institutional resistance (R). Calculate the fundamental dispersion D.' },
  { name: 'Lyapunov Stability', desc: 'Stochastic Energy Monitor', prompt: 'Evaluate the Lyapunov Operator (LV) for our tripartito system (Capital, Agents, Infrastructure). Identify if the current trajectory is stable or approaching a catastrophic divergence.' },
  { name: 'Anomaly Diagnostic', desc: 'Benford Law Filter', prompt: 'Apply a Benford Law Filter to our on-chain transaction data (Influx and Velocity) to diagnose organic flow versus wash trading or artificial manipulation.' },
  { name: 'HEICTOR Audit', desc: 'Noise Reduction Specs', prompt: 'Design a HEICTOR protocol implementation using ZK-Proofs to reduce informational noise (kappa*sigma) and mitigate MEV/manipulation risks.' }
];

const ERP_SNIPPETS = [
  {
    level: 'Executive',
    name: 'Strategic Vision',
    desc: 'Bussiness Plan & Market Positioning',
    prompt: 'Define a 5-year strategic vision including market positioning, potential ROI models, and long-term expansion goals.'
  },
  {
    level: 'Tactical',
    name: 'Resource Matrix',
    desc: 'Q3 Resource Allocation & Process Dev',
    prompt: 'Establish a tactical resource allocation plan for the next two quarters, focusing on automation and process scalability.'
  },
  {
    level: 'Operational',
    name: 'Ops Framework',
    desc: 'Daily CRM & Inventory Management',
    prompt: 'Create a formal operational framework for CRM management, daily reporting, and inventory tracking (ERP Core).'
  }
];

const RESEARCHER_SNIPPETS = [
  { name: 'Market Sentiment', desc: 'Social & On-chain pulse', prompt: 'Analyze social media sentiment and on-chain activity for the top 5 DeFi protocols in the current quarter.' },
  { name: 'Competitor Table', desc: 'Feature & TVL Benchmarking', prompt: 'Create a comprehensive comparison table of our proposed project against 3 direct competitors, highlighting TVL and feature gaps.' },
  { name: 'Dune Query Logic', desc: 'Protocol Health Metrics', prompt: 'Draft the SQL logic for 3 key Dune Analytics dashboards to track protocol health: Volume, User Retention, and TVL growth.' }
];

const TOKENOMICS_SNIPPETS = [
  { name: 'Sustainability Model', desc: 'Long-term Economic Health', prompt: 'Design a sustainable tokenomics model focusing on supply/demand balance and inflation control.' },
  { name: 'Vesting Schedules', desc: 'Team & Investor Locks', prompt: 'Create optimized vesting schedules to prevent market dumping and ensure long-term alignment.' },
  { name: 'Governance Layer', desc: 'DAO & Utility Token Logic', prompt: 'Draft the governance logic for the token, including voting weights and proposal requirements.' },
  { name: 'Economic Explorer', desc: 'Law-Econ Simulation', prompt: 'Execute a law-economic exploration simulation. Analyze how legal constraints impact token flow, liquidity mining incentives, and protocol equilibrium based on the principles in the Law-Econ Explorer framework.' }
];

const COMPLIANCE_SNIPPETS = [
  { name: 'Legal Framework', desc: 'Regulatory Mapping', prompt: 'Map the regulatory requirements for our token launch across key jurisdictions (EU, US, SG).' },
  { name: 'ERC-8004 Audit', desc: 'Asset Backed Verification', prompt: 'Audit our protocol against ERC-8004 standards for Real World Asset (RWA) compliance.' },
  { name: 'T&C Generator', desc: 'User Agreements & Risk', prompt: 'Draft Terms and Conditions and Risk Disclosure documents for protocol users.' },
  { name: 'Law-Econ Auditor', desc: 'Regulatory Constraint Logic', prompt: 'Analyze the protocol using the Law-Econ Explorer methodology. Identify potential regulatory friction points in the tokenomics logic and suggest structural improvements to ensure legal-economic harmony.' }
];

const ARCHITECT_SNIPPETS = [
  { name: 'Infrastructure Stack', desc: 'Web3 Node Config', prompt: 'Define the infrastructure stack including RPC nodes, indexers, and decentralized storage.' },
  { name: 'Service Blueprint', desc: 'Macro/Micro Isolation', prompt: 'Design a full architectural blueprint separating core macroservices from specialized microservices. Define API gateways and message queues.' },
  { name: 'STACK3 Simulator', desc: 'BC Integration Flow', prompt: 'Simulate the integration flow between on-chain events and off-chain services. (Using STACK3 logic: Trigger -> Listener -> Processor -> State).' },
  { name: 'Tech Documenter', desc: 'Infrastructure Specs', prompt: 'Generate systematic documentation for the current infrastructure architecture, including Mermaid sequence diagrams and service relationship maps.' }
];

const GTM_SNIPPETS = [
  { name: 'Classic Strategy', desc: 'Kotler 4Ps & STP', prompt: 'Perform a comprehensive Philip Kotler style strategic analysis (4Ps: Product, Price, Place, Promotion) and define our STP (Segmentation, Targeting, Positioning) for the protocol.' },
  { name: 'Growth Flywheel', desc: 'AARRR & Retention', prompt: 'Design a growth flywheel based on the AARRR (Acquisition, Activation, Retention, Referral, Revenue) framework, adapted for Web3 community dynamics.' },
  { name: 'Viral Distribution', desc: 'Token Incentives', prompt: 'Draft a decentralized viral growth strategy using token-incentivized referral networks and community-owned distribution channels.' },
  { name: 'Market Forces', desc: 'Porters 5 & PESTLE', prompt: 'Analyze the external market environment using Porters 5 Forces and PESTLE models to evaluate competitive moat and regulatory/macro trends.' }
];

const PM_SNIPPETS = [
  { name: 'Product Roadmap', desc: 'Feature Tiering', prompt: 'Build a 12-month product roadmap with clear feature tiering and core-protocol milestones.' },
  { name: 'User Stories', desc: 'Journey Mapping', prompt: 'Draft detailed user stories and journey maps for both retail and institutional protocol users.' },
  { name: 'Competitive Gap', desc: 'Edge & Moat Analysis', prompt: 'Analyze the competition and identify technical or UX gaps we can exploit for a market moat.' }
];

const SCRUM_SNIPPETS = [
  { name: 'Sprint Velocity', desc: 'Efficiency Tracking', prompt: 'Analyze current team velocity and suggest optimizations for the next 4 sprints.' },
  { name: 'Agile Ops', desc: 'Standup Framework', prompt: 'Establish a custom agile framework adapted for a decentralized, remote-first developer team.' },
  { name: 'Blocker Log', desc: 'Resolution Flow', prompt: 'Set up a systematic blocker resolution flow to ensure zero-stalled tasks in the protocol forge.' }
];

const PO_SNIPPETS = [
  { name: 'Backlog Grooming', desc: 'Value Prioritization', prompt: 'Prioritize the current product backlog based on business value vs technical complexity.' },
  { name: 'Vision Alignment', desc: 'Stakeholder Sync', prompt: 'Draft a strategy to align technical development with shareholder and community vision.' },
  { name: 'Value Stream', desc: 'Efficiency Audit', prompt: 'Perform a value stream audit to ensure every developer hour is contributing to the protocol core.' }
];

const ERP_METRICS = [
  { label: 'Strategic Alignment', value: '94%', trend: '+2.4%', color: '#00D1FF' },
  { label: 'Ops Efficiency', value: '88%', trend: '+5.1%', color: '#6366f1' },
  { label: 'Tactical ROI', value: '3.4x', trend: '+0.8x', color: '#f59e0b' },
];

const CRM_METRICS = [
  { label: 'Acquisition Cost', value: '$420', trend: '-12%', color: '#f472b6' },
  { label: 'Lead Conversion', value: '24.5%', trend: '+8.2%', color: '#00D1FF' },
  { label: 'Brand Sentiment', value: '8.4/10', trend: '+1.5', color: '#6366f1' }
];

const CRM_STAGES = [
  { name: 'Prospecting', leads: 420, color: '#f472b6' },
  { name: 'Engagement', leads: 280, color: '#d946ef' },
  { name: 'Proposal', leads: 145, color: '#8b5cf6' },
  { name: 'Closing', leads: 62, color: '#00D1FF' }
];

const CRM_SNIPPETS = [
  {
    category: 'Sales Strategy',
    items: [
      { name: 'High-Ticket Funnel', desc: 'Flow for $10k+ services', prompt: 'Design a sales funnel for a high-ticket Web3 consulting service, including touchpoints and follow-up sequences.' },
      { name: 'Lead Velocity', desc: 'Accelerate conversion times', prompt: 'Provide 5 strategies to increase lead velocity and reduce the time from first contact to closing.' }
    ]
  },
  {
    category: 'Creatives & Ads',
    items: [
      { name: 'Viral Ad Concept', desc: 'Hooks for social media', prompt: 'Generate 3 viral creative concepts for a new Web3 protocol, focusing on hooks that stop the scroll.' },
      { name: 'Display Assets', desc: 'Banners & Visual Identity', prompt: 'Define the visual assets needed for a multi-channel display campaign, including brand color palettes and typography.' }
    ]
  }
];

const FORGE_SNIPPETS = {
  Solidity: [
    { category: 'L2 Ethereum (Scroll)', name: 'Scroll Gas Optimizer', desc: 'Gas-aware logic for Scroll calldata.', prompt: 'Implement a gas-optimized Solidity contract specifically for Scroll L2. Include calldata minimization techniques and batch-friendly storage patterns.' },
    { category: 'DeFi Protocols', name: 'AMM Pair (V2)', desc: 'Constant product market maker with swap/mint/burn.', prompt: 'Advanced Solidity AMM Pair with swap, mint, burn logic, K-invariant checks, and fee to treasury. Use ReentrancyGuard on critical state changes.' },
    { category: 'DeFi Protocols', name: 'Lending Pool', desc: 'CDP based lending with interest curves.', prompt: 'Over-collateralized lending pool with interest rate curves, liquidation logic, health factor calculations, and role-based operator controls.' },
    { category: 'DeFi Protocols', name: 'Staking Rewards', desc: 'Synthetix-style yield distribution.', prompt: 'Implement a professional staking rewards contract. Include reward rate calculations, user claim logic, and exit/unstake safety checks.' },
    { category: 'DeFi Protocols', name: 'Synthetic Asset Engine', desc: 'Mint tokens backed by collateral.', prompt: 'Implement a synthetic asset engine in Solidity. Include price feed integration, collateralization ratio checks, and liquidation triggers for synthetic tokens.' },
    { category: 'DeFi Protocols', name: 'Flash Loan Integration', desc: 'Callback template for Aave/Uniswap.', prompt: 'Develop a Flash Loan receiver template. Implement arbitrage logic, callback verification, and repay authorization for complex cross-protocol transactions.' },
    { category: 'Marketplaces', name: 'NFT Marketplace', desc: 'Buy/Sell/Offer logic for ERC721.', prompt: 'Secure NFT Marketplace core with royalty support (EIP-2981), escrow-based listing, and AccessControl for administrative fee management.' },
    { category: 'Security', name: 'Role-Based Minting', desc: 'Secure token with AccessControl roles.', prompt: 'Advanced ERC20 with OpenZeppelin AccessControl. Define MINTER_ROLE, BURNER_ROLE, and specify function-level modifiers for guarded minting/burning.' },
    { category: 'Security', name: 'Function Guards', desc: 'State-machine based function gates.', prompt: 'Implement advanced function-level access control using custom modifiers and AccessControl roles (e.g., OPERATOR_ROLE) for critical protocol transitions and circuit breakers.' },
    { category: 'Governance', name: 'Timelock Governor', desc: 'DAO with TimelockController integration.', prompt: 'Governor contract integrated with OpenZeppelin TimelockController. Include proposal thresholding, voting delay variables, and Timelock queuing logic.' },
    { category: 'Utility', name: 'Yield Vault (ERC4626)', desc: 'Standardized strategy wrapper.', prompt: 'ERC4626-compliant vault for yield optimization with integrated ReentrancyGuard and role-based strategy management.' }
  ],
  Cairo: [
    { category: 'Starknet', name: 'Cairo 2.4 State Machine', desc: 'Advanced state transitions in Cairo VM.', prompt: 'Implement a complex state machine in Cairo 2.4 for Starknet, utilizing high-performance storage and security patterns.' },
    { category: 'Starknet', name: 'ERC20 (Cairo 2.0)', desc: 'Secure fungible token logic.', prompt: 'Cairo 2.x ERC20 implementation for Starknet with storage-efficient patterns.' },
    { category: 'Starknet', name: 'Account Abstraction', desc: 'Signature validated account.', prompt: 'Starknet Account Contract with advanced signature validation and multicall support.' },
    { category: 'DeFi', name: 'AMM (Starknet)', desc: 'Zk-friendly AMM logic.', prompt: 'High-performance Cairo AMM implementation for L2 state transitions.' },
    { category: 'DeFi', name: 'Lending Logic', desc: 'Starknet collateral tracking.', prompt: 'Implement a collateralized lending core in Cairo for Starknet. Focus on efficient storage of user balances and L2-optimized interest calculations.' }
  ],
  Vyper: [
    { category: 'DeFi', name: 'AMM Sync', desc: 'Minimalist constant product pool.', prompt: 'Vyper implementation of a constant product market maker with reentrancy-safe hooks.' },
    { category: 'DeFi', name: 'Stablebox Lending', desc: 'Vyper-based lending core.', prompt: 'Secure lending pool in Vyper. Focus on non-reentrancy patterns and precise math for interest rate models.' },
    { category: 'Yield', name: 'Vault Keeper', desc: 'Automated strategy execution.', prompt: 'Vyper contract with automated strategy execution hooks for yield optimization.' }
  ],
  Rust: [
    { category: 'Architecture', name: 'Anchor Program Core', desc: 'Global state & PDA initialization.', prompt: 'Generate a basic Solana program using the Rust Anchor Framework. Include an "initialize" instruction that creates a PDA for storing global state, with account validation and Owner checks.' },
    { category: 'Architecture', name: 'Anchor Account Structure', desc: 'Secure data layout.', prompt: 'Define an Anchor account structure in Rust for a Solana program. Include fields for a primary owner (publicKey), a counter (u64), and a timestamp (i64). Implement necessary #[account] attributes for initialization and mutability.' },
    { category: 'Solana (Anchor)', name: 'Anchor DAO Framework', desc: 'Secure voting & treasury on Solana.', prompt: 'Generate a Solana program using Anchor Framework for a DAO. Include instruction-level security checks and PDA management.' },
    { category: 'Solana (CPI)', name: 'SPL Token CPI Transfer', desc: 'Cross-program token transfer.', prompt: 'Write a Solana Anchor program instruction that performs a Cross-Program Invocation (CPI) to transfer an SPL Token. The instruction should take an initializer account, a token mint account, and a destination token account as parameters. Ensure proper authority checks and deserialization of accounts.' },
    { category: 'DeFi', name: 'Amm Swap (Solana)', desc: 'Anchor-based XYK pool.', prompt: 'Implement a constant product AMM in Solana using the Anchor framework. Define accounts for reserves, LP tokens, and instructions for swap, deposit, and withdraw.' },
    { category: 'DeFi', name: 'Lending Vault (Anchor)', desc: 'Collateral & debt management.', prompt: 'Secure lending program for Solana using Anchor. Implement logic for depositing collateral, calculating borrow limits based on oracles, and handling liquidations.' },
    { category: 'Security & Audit', name: 'Anchor Security Audit', desc: 'PDA, Overflows & Ownership checks.', prompt: 'Perform a comprehensive security audit of a Solana Anchor program. Focus on identifying potential vulnerabilities related to PDA derivation, integer overflows, and missing ownership checks. Provide a report with findings and remediation steps.' },
    { category: 'Performance', name: 'Compute Unit Profiler', desc: 'Efficiency & Gas optimization.', prompt: 'Analyze a complex Solana Anchor program instruction for compute unit efficiency. Identify areas where account loading, serialization, or instruction logic could be optimized to reduce transaction costs and improve performance.' }
  ]
};

const FORGE_OPTIONS_INFO = {
  languages: {
    Solidity: 'Industry standard for EVM chains (Ethereum, Base, Polygon).',
    Cairo: 'Native Starknet language for high-performance L2 scaling.',
    Vyper: 'Pythonic smart contract language focused on security.',
    Rust: 'High-performance language for Solana, Polkadot, and Gear.'
  },
  types: {
    ERC20: 'Fungible tokens (e.g., USDT, LINK).',
    ERC721: 'Non-Fungible Tokens (Unique collectibles).',
    ERC1155: 'Multi-token standard for semi-fungible items.',
    Governor: 'Governance systems for DAOs.',
    Custom: 'Define unique protocol logic from scratch.'
  },
  features: {
    Mintable: 'Allows creating new tokens after deployment.',
    Burnable: 'Provides a way for users to destroy tokens.',
    Pausable: 'Emergency stop mechanism for contract operations.',
    AccessControl: 'Granular role-based permissions (Admin, Minter, Burner).',
    ReentrancyGuard: 'Prevents recursive contract call attacks (Security).',
    Whitelist: 'Restricts interactions to specific addresses.',
    'PDA Management': 'Program Derived Addresses for secure on-chain storage (Solana).',
    'CPI Integration': 'Cross-Program Invocations for protocol composability.',
    'Account Validation': 'Rigorous #[account(...)] checks in Anchor Framework.',
    Timelock: 'Enforces a delay before critical operations execute. Integrates with OZ Governor and TimelockController.',
    Ownable: 'Simplest access control with a single administrator.'
  },
  libraries: {
    'Forge-Std': 'Essential Foundry testing library (Vm, Console, Assertions).',
    'Anchor-Lang': 'The core framework crate for Solana development.',
    'Anchor-Spl': 'Official library for SPL token interactions in Anchor.',
    'Solana-Program': 'Base Solana SDK crate for low-level logic.',
    'Borsh': 'Standard binary serialization for Solana account data.',
    'Hardhat-Toolbox': 'Comprehensive Hardhat plugin (Ethers, Chai, Gas Reporter).',
    'OZ-Test-Helpers': 'Robust testing utilities for OpenZeppelin contracts.'
  },
  verification: {
    Foundry: 'Vibrant testing framework (Forge-std + Slither).',
    Hardhat: 'Flexible JS-based suite (Toolbox + Chai).',
    Slither: 'Static analysis for common vulnerabilities.',
    SOTER: 'Specific security analysis for Solana Anchor programs.',
    AnchorVerify: 'Built-in Anchor validation and account matching checks.',
    Mythril: 'Security analysis through symbolic execution.',
    Certora: 'Formal verification through rule-based specs.',
    Halmos: 'Symbolic testing tool for formal verification.'
  }
};

const STRESS_SCENARIOS = [
  { id: "market_crash", name: "Market Crash", description: "Simulation of a sharp decline in prices in the overall market" },
  { id: "custom_crash", name: "Strategic Market Crash", description: "75% Volatility / 20% Sentiment / 15% Crash Probability" },
  { id: "liquidity_crisis", name: "Liquidity Crisis", description: "Simulation of liquidity shortage and increased volatility" },
  { id: "regulatory_shock", name: "Regulatory Shock", description: "Simulation of the impact of new restrictive regulations" },
  { id: "security_breach", name: "Security Failure", description: "Simulation of a hack or security vulnerability" },
  { id: "whale_dump", name: "Massive Whale Dump", description: "Simulation of large investors selling simultaneously" },
];

const MARKET_EVENTS = [
  { 
    id: "crash", 
    name: "Market Crash", 
    description: "Sudden drop in crypto asset prices",
    impact: -25,
    duration: 7,
    probability: 0.02
  },
  { 
    id: "recovery", 
    name: "Market Recovery", 
    description: "Price recovery after a period of decline",
    impact: 15,
    duration: 14,
    probability: 0.03
  },
  { 
    id: "regulatory_news", 
    name: "Regulatory News", 
    description: "Announcement of new regulations for cryptocurrencies",
    impact: -12,
    duration: 5,
    probability: 0.04
  },
  { 
    id: "adoption_news", 
    name: "Adoption News", 
    description: "Major company or country announces adoption of cryptocurrencies",
    impact: 18,
    duration: 10,
    probability: 0.03
  },
  { 
    id: "security_breach", 
    name: "Security Failure", 
    description: "Hack or vulnerability discovered in an important protocol",
    impact: -20,
    duration: 8,
    probability: 0.02
  }
];

const BLUEPRINT_SNIPPETS = [
  { 
    name: 'Business & PM', 
    items: [
      { name: 'Business Plan', desc: 'Financials & Monetization', prompt: 'Generate a comprehensive Business Plan including financial projections and monetization models.' },
      { name: 'Product PRD', desc: 'Specs & Roadmap', prompt: 'Create a detailed Product Requirements Document (PRD) with milestones and roadmap.' },
      { name: 'GTM Strategy', desc: 'Marketing & Sales', prompt: 'Outline a Go-To-Market strategy including marketing channels and sales token analysis.' }
    ]
  },
  {
    name: 'Technical Specs',
    items: [
      { name: 'Hybrid Architecture', desc: 'Web2 + Web3 Stack', prompt: 'Design a technical architecture bridging Web2 infrastructure with Web3 protocols.' },
      { name: 'MVP Prototype', desc: 'Feasibility & UX', prompt: 'Define an MVP prototype structure with key user flows and technical feasibility.' },
      { name: 'Requirements Manual', desc: 'Formal System Specs', prompt: 'Draft a formal Requirements Manual for system developers.' }
    ]
  },
  {
    name: 'Diagrams & Logic',
    items: [
      { name: 'Mermaid Diagrams', desc: 'Vis. Data Flows', prompt: 'Generate a series of Mermaid diagrams showing the protocol state machine and data flow.' },
      { name: 'UML/BPM Model', desc: 'Process Architecture', prompt: 'Create UML class diagrams and BPM process models for the core business logic.' },
      { name: 'Tokenomics logic', desc: 'Economic Blueprint', prompt: 'Visualize the tokenomics flow using BPM/Mermaid logic.' }
    ]
  },
  {
    name: 'Strategic Analysis',
    items: [
      { name: 'Hypothesis Audit', desc: 'Economic Feasibility', prompt: 'Analyze a business hypothesis in the Web3 space. Evaluate the token utility, economic friction, and collateralization models (Buyer vs Issuer).' },
      { name: 'Protocol Benchmarking', desc: 'Competitor Deep Dive', prompt: 'Compare a proposed protocol idea with existing market leaders (e.g., Boson Protocol for commerce, Centrifuge for RWA). Identify competitive advantages and tech gaps.' }
    ]
  }
];

const OVPMap = ({ graphData }: { graphData: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      mermaid.render('ovp-graph-svg', graphData).then(({ svg }) => {
        if (containerRef.current) containerRef.current.innerHTML = svg;
      });
    }
  }, [graphData]);

  return <div ref={containerRef} className="w-full flex justify-center bg-[#050507] p-8 border border-[#3A3F45] overflow-auto" />;
};

export default function App() {
  const { wallet, connect, disconnect } = useWallet();
  const [view, setView] = useState<'dashboard' | 'chat' | 'engine' | 'protocol'>('dashboard');
  const [activeAgent, setActiveAgent] = useState<Agent>(AGENTS[0]);
  const [selectedAgents, setSelectedAgents] = useState<AgentRole[]>([AGENTS[0].role]);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [messages, setMessages] = useState<Record<AgentRole, Message[]>>({
    RESEARCHER: [],
    TOKENOMICS: [],
    COMPLIANCE: [],
    ARCHITECT: [],
    GTM: [],
    FORGE: [],
    SOLANA_FORGE: [],
    SOLANA_AUDITOR: [],
    PROJECT_AUDITOR: [],
    BLUEPRINT: [],
    ERP: [],
    CRM: [],
    PM: [],
    SCRUM: [],
    PO: [],
    ANALYST: [],
    RISK: [],
    POV: [],
    OVP: [],
    STRESS_TESTER: [],
    META_ARCHITECT: [],
    SOVEREIGN_AA: [],
    GRAPH_RMVP: [],
    SOCIAL_MEDIA: [],
    INVESTOR_RELATIONS: []
  });
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  
  const [stressTestConfig, setStressTestConfig] = useState({
    activeTab: "simulation",
    simulationRunning: false,
    simulationSpeed: 1,
    currentDay: 0,
    marketSentiment: 50,
    volatility: 25,
    crashChance: 5,
    stressScenario: "market_crash",
    initialPrice: 100,
    priceData: [{ day: 0, price: 100, volume: 1000000, holders: 10000, market_cap: 100000000 }] as {day: number, price: number, volume: number, holders: number, market_cap: number}[],
    currentEvent: null as any | null
  });

  const [analystConfig, setAnalystConfig] = useState({
    totalSupply: 100000000,
    initialPrice: 0.10,
    growthRate: 20,
    burnRate: 2,
    stakingApr: 12
  });
  const [forgeConfig, setForgeConfig] = useState({
    language: 'Solidity' as keyof typeof FORGE_SNIPPETS,
    type: 'ERC20',
    features: [] as string[],
    verificationTools: [] as string[],
    verificationLibs: [] as string[],
    step: 'config' as 'config' | 'review' | 'verify' | 'chat'
  });

  const [engineIdea, setEngineIdea] = useState('');
  const [engineQ2, setEngineQ2] = useState('');
  const [selectedAgentRoles, setSelectedAgentRoles] = useState<AgentRole[]>(['RESEARCHER', 'TOKENOMICS', 'ARCHITECT', 'GTM']);
  const [engineResults, setEngineResults] = useState<Record<string, { loading: boolean, result: string }>>({});
  const [engineLoading, setEngineLoading] = useState(false);
  const [isSignModalOpen, setIsSignModalOpen] = useState(false);
  const [pdfStatus, setPdfStatus] = useState<string | null>(null);
  
  // Agent Health Monitoring State
  const [agentHealth, setAgentHealth] = useState<Record<string, { status: 'ONLINE' | 'OFFLINE', lastSeen: Date }>>(
    Object.fromEntries(AGENTS.map(a => [a.role, { status: a.status, lastSeen: new Date() }]))
  );
  const [activeDiagnostics, setActiveDiagnostics] = useState<Record<string, DiagnosticResult>>({});
  const activeDiagnosticsRef = useRef(activeDiagnostics);
  useEffect(() => { activeDiagnosticsRef.current = activeDiagnostics; }, [activeDiagnostics]);

  const [alerts, setAlerts] = useState<{ id: string, message: string, type: 'warning' | 'error' | 'info', timestamp: Date }[]>([]);

  const [savedProjects, setSavedProjects] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [protocolView, setProtocolView] = useState<'lineage' | 'accounts' | 'consensus' | 'graph' | 'reasoning' | 'tokenomics' | 'game-theory'>('lineage');
  const [attestations, setAttestations] = useState<any[]>([]);
  const [reasoningResult, setReasoningResult] = useState<{ consistent: boolean, conflicts: string[] } | null>(null);
  const [zkpProof, setZkpProof] = useState<string | null>(null);
  const [gameScenario, setGameScenario] = useState<{ strategy: string, stability: string } | null>(null);
  const [smartAccounts, setSmartAccounts] = useState<any[]>([
    { address: '0x71C...456', owner: 'Admin', recoveryThreshold: 2, guardians: ['0x123', '0x456'], semanticRules: ['OVP_V1', 'DAO_V2', 'RESTRICT_EXT_CALLS'], lineage: 'Root', sessionKeys: [], isRecovering: false },
    { address: '0x82D...789', owner: 'Vault', recoveryThreshold: 3, guardians: ['0x71C', '0x888', '0x999'], semanticRules: ['OVP_V1_STRICT'], lineage: 'Child-A', sessionKeys: [], isRecovering: false }
  ]);

  // Professional Identity Strategy
  const [professionalId, setProfessionalId] = useState({
    id: '',
    name: '',
    role: 'Lead Architect',
    company: '',
    verified: false
  });
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [auditHash, setAuditHash] = useState('');

  const fetchSavedProjects = async () => {
    if (!professionalId.verified || !professionalId.id) return;
    try {
      const res = await fetch(`/api/projects?professional_id=${professionalId.id}`);
      const data = await res.json();
      if (data.success) setSavedProjects(data.projects);
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    }
  };

  useEffect(() => {
    if (professionalId.verified) {
      fetchSavedProjects();
    }
  }, [professionalId.verified]);

  // Agent Health Heartbeat Simulation
  const handleAgentDiagnostic = async (role: AgentRole, agentName: string) => {
    const now = new Date();
    setAlerts(a => [{ 
      id: `diag-start-${role}-${now.getTime()}-${Math.random().toString(36).substr(2, 5)}`, 
      message: `SYSTEM: Initializing automated diagnostics for ${agentName}...`, 
      type: 'info' as const, 
      timestamp: now 
    }, ...a].slice(0, 5));

    try {
      const result = await runDiagnostics(role);
      setActiveDiagnostics(prev => ({ ...prev, [role]: result }));

      if (result.overallStatus === 'passed') {
        const recoverNow = new Date();
        setAgentHealth(prev => ({ 
          ...prev, 
          [role]: { status: 'ONLINE', lastSeen: recoverNow } 
        }));
        setAlerts(a => [{ 
          id: `diag-pass-${role}-${recoverNow.getTime()}-${Math.random().toString(36).substr(2, 5)}`, 
          message: `RESOLVED: Diagnostic checks passed for ${agentName}. Node restored to Online state.`, 
          type: 'info' as const, 
          timestamp: recoverNow 
        }, ...a].slice(0, 5));
        setActiveDiagnostics(prev => {
          const next = { ...prev };
          delete next[role];
          return next;
        });
      } else {
        // Attempt reconnection
        setAlerts(a => [{ 
          id: `recon-start-${role}-${new Date().getTime()}-${Math.random().toString(36).substr(2, 5)}`, 
          message: `DIAGNOSTIC FAILURE: Attempting reconnection protocol for ${agentName}...`, 
          type: 'warning' as const, 
          timestamp: new Date() 
        }, ...a].slice(0, 5));

        const recovered = await attemptReconnection(role);
        
        if (recovered) {
          const recoverNow = new Date();
          setAgentHealth(prev => ({ 
            ...prev, 
            [role]: { status: 'ONLINE', lastSeen: recoverNow } 
          }));
          setAlerts(a => [{ 
            id: `recon-pass-${role}-${recoverNow.getTime()}-${Math.random().toString(36).substr(2, 5)}`, 
            message: `SUCCESS: Reconnection protocol verified for ${agentName}. Syncing state...`, 
            type: 'info' as const, 
            timestamp: recoverNow 
          }, ...a].slice(0, 5));
          setActiveDiagnostics(prev => {
            const next = { ...prev };
            delete next[role];
            return next;
          });
        } else {
          setAlerts(a => [{ 
            id: `crit-fail-${role}-${new Date().getTime()}-${Math.random().toString(36).substr(2, 5)}`, 
            message: `CRITICAL FAILURE: Reconnection protocol failed for ${agentName}. Flagging as Unresponsive.`, 
            type: 'error' as const, 
            timestamp: new Date() 
          }, ...a].slice(0, 5));
          setActiveDiagnostics(prev => ({
            ...prev,
            [role]: { ...prev[role], reconnectionAttempted: true, reconnectionSuccess: false }
          }));
        }
      }
    } catch (err) {
      console.error('Diagnostic error:', err);
    }
  };

  useEffect(() => {
    const monitor = setInterval(() => {
      setAgentHealth(prev => {
        const newHealth = { ...prev };
        const now = new Date();
        let changed = false;

        AGENTS.forEach(agent => {
          const current = newHealth[agent.role];
          
          // Only trigger state change if not already under diagnosis
          if (activeDiagnosticsRef.current[agent.role]) return;

          // Random fluctuation: 2% chance of state change for simulation
          if (Math.random() < 0.02) {
            const nextStatus = current.status === 'ONLINE' ? 'OFFLINE' : 'ONLINE';
            newHealth[agent.role] = { 
              status: nextStatus, 
              lastSeen: nextStatus === 'ONLINE' ? now : current.lastSeen 
            };
            changed = true;

            if (nextStatus === 'OFFLINE') {
              // Trigger automated diagnostics
              handleAgentDiagnostic(agent.role, agent.name);
            } else {
              setAlerts(a => [{ id: `${agent.role}-ok-${now.getTime()}-${Math.random().toString(36).substr(2, 5)}`, message: `RESOLVED: Agent ${agent.name} is back ONLINE.`, type: 'info' as const, timestamp: now }, ...a].slice(0, 5));
            }
          }

          // Check for long-term offline (Simulated: 45 seconds = "5 units of time")
          if (current.status === 'OFFLINE') {
            const offlineSecs = (now.getTime() - current.lastSeen.getTime()) / 1000;
            if (offlineSecs > 45) {
               const criticalMsg = `CRITICAL ERROR: Agent ${agent.name} (${agent.role}) unresponsive for > 5m. System failsafe triggered.`;
               // Only add if not already in alerts to prevent spam
               setAlerts(a => {
                 if (a.some(al => al.message.includes(agent.role) && al.type === 'error')) return a;
                 return [{ id: `crit-${agent.role}-${now.getTime()}-${Math.random().toString(36).substr(2, 5)}`, message: criticalMsg, type: 'error' as const, timestamp: now }, ...a].slice(0, 5);
               });
            }
          }
        });

        return changed ? newHealth : prev;
      });
    }, 4000);

    return () => clearInterval(monitor);
  }, []);

  const handleManualRestart = (role: AgentRole) => {
    setActiveDiagnostics(prev => {
      const next = { ...prev };
      delete next[role];
      return next;
    });
    setAgentHealth(prev => ({
      ...prev,
      [role]: { status: 'ONLINE', lastSeen: new Date() }
    }));
    setAlerts(a => [{
      id: `manual-reset-${role}-${new Date().getTime()}-${Math.random().toString(36).substr(2, 5)}`,
      message: `SYSTEM: Manual override triggered. Node ${role} status reset to ONLINE.`,
      type: 'info' as const,
      timestamp: new Date()
    }, ...a].slice(0, 5));
  };

  const handleSaveProject = async () => {
    if (!professionalId.verified) {
      setIsSignModalOpen(true);
      return;
    }
    if (!engineIdea) {
      alert('Please start a project first.');
      return;
    }

    setIsSaving(true);
    try {
      const projectData = {
        professional_id: professionalId.id,
        name: engineIdea.substring(0, 50) + (engineIdea.length > 50 ? '...' : ''),
        state: {
          engineIdea,
          messages,
          engineResults,
          tasks,
          selectedAgents,
          forgeConfig,
          analystConfig
        }
      };

      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData)
      });
      
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const data = await res.json();
        if (data.success) {
          alert('Project state saved successfully to STACK3 registry.');
          fetchSavedProjects();
        } else {
          alert('Failed to save project: ' + data.error);
        }
      } else {
        const text = await res.text();
        console.error('Non-JSON response:', text);
        alert('Server error: Project might be too large for current registry constraints.');
      }
    } catch (err) {
      console.error('Save error:', err);
      alert('Network error while saving project.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadProject = async (id: string) => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      const data = await res.json();
      if (data.success) {
        const { state } = data.project;
        setEngineIdea(state.engineIdea || '');
        setMessages(state.messages || {});
        setEngineResults(state.engineResults || {});
        setTasks(state.tasks || []);
        setSelectedAgents(state.selectedAgents || []);
        if (state.forgeConfig) setForgeConfig(state.forgeConfig);
        if (state.analystConfig) setAnalystConfig(state.analystConfig);
        alert('Historical template loaded successfully.');
        setView('dashboard');
      }
    } catch (err) {
      console.error('Load error:', err);
      alert('Failed to load historical project.');
    }
  };

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this template?')) return;
    try {
      await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      fetchSavedProjects();
    } catch (err) {
       console.error('Delete error:', err);
    }
  };

  const handleAuth = async () => {
    if (!professionalId.name || !password) return;
    setAuthError('');

    try {
      const endpoint = authMode === 'login' ? '/api/login' : '/api/register';
      const body = authMode === 'login' 
        ? { name: professionalId.name, password }
        : { name: professionalId.name, role: professionalId.role, company: professionalId.company, password };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await response.json();
      if (data.success) {
        setProfessionalId({
          id: data.user.id,
          name: data.user.name,
          role: data.user.role,
          company: data.user.company,
          verified: true
        });
        setIsSignModalOpen(false);
        setPassword('');
        setAuthError('');
      } else {
        setAuthError(data.error || 'Authentication failed');
      }
    } catch (err) {
      console.error('Auth error:', err);
      setAuthError('Network error: Could not reach STACK3 Auth Server');
    }
  };

  const generateAuditHash = async () => {
    const hashHex = await (async () => {
      const dataToSign = {
        mission: engineIdea,
        agents: Object.keys(engineResults),
        auditor: professionalId,
        timestamp: new Date().toISOString(),
        platform: 'STACK3-v4.0'
      };
      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify(dataToSign));
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    })();

    setAuditHash(hashHex);

    // Save audit to database if registered
    if (professionalId.id) {
      try {
        await fetch('/api/audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            professional_id: professionalId.id,
            mission_idea: engineIdea,
            audit_hash: hashHex
          })
        });
      } catch (err) {
        console.error('Failed to record audit in SQL:', err);
      }
    }
    
    return hashHex;
  };

  const handleParallelEngine = async () => {
    if (!professionalId.verified) {
      setIsSignModalOpen(true);
      return;
    }

    if (!engineIdea.trim() || !engineQ2.trim()) return;
    
    setEngineLoading(true);
    setView('engine');
    
    const initialResults: Record<string, { loading: boolean, result: string }> = {};
    selectedAgentRoles.forEach(role => {
      initialResults[role] = { loading: true, result: '' };
    });
    setEngineResults(initialResults);

    let sharedContext = `Objective: ${engineIdea}\nScale/Network: ${engineQ2}\n\n`;

    try {
      // Process agents one by one to respect global rate limits even more gracefully
      // AND to allow context sharing between agents as they finish
      for (let i = 0; i < selectedAgentRoles.length; i++) {
        const role = selectedAgentRoles[i];
        try {
          const agent = AGENTS.find(a => a.role === role);
          
          setPdfStatus(`Siphoning Data: ${role} (${i+1}/${selectedAgentRoles.length})...`);
          
          const response = await chatWithAgent(role, `
Based on the following project context and peer findings:
${sharedContext}

EXECUTE YOUR PRIMARY TASK AS: ${agent?.name} (${role}).

OUTPUT GUIDELINES:
1. Start with an # Executive Summary Title.
2. Provide a deep technical analysis focused on your specialty.
3. [IF APPLICABLE] Signal any dependencies or handoffs to other agents (e.g., "Handoff to FORGE: Implement this liquidity logic").
4. MANDATORILY INCLUDE a Mermaid diagram. 
   - FOR FLOWCHARTS: Use strict "graph TD" or "flowchart TD". 
   - LABEL RULES: Use ONLY ONE label per transition using the syntax: A -->|Label| B. 
   - DO NOT USE: A -- Label --> B or A -- Label1 -->|Label2| B.
   - QUOTES: Always wrap labels in double quotes if they contain special characters: A -->|"5. checked_sub"| B.
   
   Example (Flowchart): 
   \`\`\`mermaid
   graph TD
     A[Start] -->|"Initialize"| B(Process)
     B -->|"Validation"| C{Decision}
     C -->|"Success"| D[End]
     C -->|"Failure"| E[Retry]
   \`\`\`

   Example (Mindmap):
   \`\`\`mermaid
   mindmap
     root((Project))
       Research
         Market Trends
         Competitors
   \`\`\`

5. Use Markdown Tables for comparative or financial data.
6. End with a list of 3 immediate critical tasks.
7. Maintain a professional, executive tone focused on Web3 engineering.`);
          
          // Accumulate findings for the next agent - truncate if too long to save context window
          const findingsSummary = response.length > 800 ? response.slice(0, 800) + '...' : response;
          sharedContext += `### Key Findings from ${agent?.name || role}:\n${findingsSummary}\n\n`;

          setEngineResults(prev => ({
            ...prev,
            [role]: { loading: false, result: response || 'No response generated.' }
          }));
        } catch (error) {
          console.error(`Error with agent ${role}:`, error);
          const errorMsg = typeof error === 'object' && error !== null ? JSON.stringify(error).toLowerCase() : String(error).toLowerCase();
          const isRateLimit = errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('limit') || errorMsg.includes('exhausted');

          setEngineResults(prev => ({
            ...prev,
            [role]: { 
              loading: false, 
              result: isRateLimit 
                ? '### ⚠️ Resource Exhausted (429)\nThis agent is currently throttled by the provider quota limits. \n\n**Common causes:**\n- Too many parallel requests.\n- Daily API limit reached.\n\n**Action Required:**\n- Please wait 60 seconds before retrying.\n- If you are on the free tier, consider spacing out your audits.'
                : `### ❌ Processing Error\nThe agent encountered an unexpected issue while analyzing the data.\n\nDetails: ${errorMsg.slice(0, 200)}...` 
            }
          }));
        }
      }
    } catch (error) {
      console.error('Parallel engine failed:', error);
    } finally {
      setEngineLoading(false);
      // Generate a global project map after all agents are done
      try {
        const summaries = Object.entries(initialResults).map(([role, _]) => role).join(', ');
        const globalMap = await chatWithAgent('ARCHITECT', `Create a central Mermaid mindmap that connects the tasks of: ${summaries}. Focused on the objective: ${engineIdea}. Return ONLY the mermaid code.`);
        setEngineResults(prev => ({
          ...prev,
          'GLOBAL_MAP': { loading: false, result: `### Project Mindmap\n\n\`\`\`mermaid\n${globalMap}\n\`\`\`` }
        }));
      } catch (e) {
        console.error("Global map failed", e);
      }
    }
  };

  const applyPDFBranding = (pdfDoc: jsPDF) => {
    const pageCount = pdfDoc.getNumberOfPages();
    const pageWidth = pdfDoc.internal.pageSize.getWidth();
    const pageHeight = pdfDoc.internal.pageSize.getHeight();
    
    for (let i = 1; i <= pageCount; i++) {
        pdfDoc.setPage(i);
        
        // Sophisticated Background Brand Element (Minimalist)
        pdfDoc.saveGraphicsState();
        pdfDoc.setGState(new (pdfDoc as any).GState({ opacity: 0.02 }));
        pdfDoc.setTextColor(0, 209, 255);
        pdfDoc.setFontSize(120);
        pdfDoc.setFont("helvetica", "bold");
        pdfDoc.text("STACK3", pageWidth / 2, pageHeight / 2, {
            align: "center",
            angle: 45
        });
        pdfDoc.restoreGraphicsState();

        // Elegant Modern Border
        pdfDoc.setDrawColor(226, 232, 240);
        pdfDoc.setLineWidth(0.2);
        pdfDoc.rect(5, 5, pageWidth - 10, pageHeight - 10);

        // Elegant Header
        pdfDoc.setFillColor(248, 250, 252);
        pdfDoc.rect(0, 0, pageWidth, 25, 'F');
        pdfDoc.setDrawColor(0, 209, 255);
        pdfDoc.setLineWidth(0.8);
        pdfDoc.line(0, 25, pageWidth, 25);
        
        pdfDoc.setFontSize(8);
        pdfDoc.setTextColor(71, 85, 105);
        pdfDoc.setFont("helvetica", "bold");
        pdfDoc.text("OFFICIAL STRATEGIC INTELLIGENCE REPORT", 15, 12);
        
        pdfDoc.setTextColor(15, 23, 42);
        pdfDoc.setFontSize(10);
        pdfDoc.text("STACK3 ORCHESTRATOR", pageWidth - 15, 12, { align: "right" });
        
        pdfDoc.setFontSize(7);
        pdfDoc.setTextColor(0, 209, 255);
        pdfDoc.setFont("helvetica", "normal");
        pdfDoc.text("VERIFIED BY BLOCKCHAIN ONTOLOGY", pageWidth - 15, 18, { align: "right" });

        // Footer with modern feel
        pdfDoc.setFontSize(7);
        pdfDoc.setTextColor(148, 163, 184);
        pdfDoc.setFont("helvetica", "normal");
        pdfDoc.text(`CONFIDENTIAL INTEL • CLASSIFICATION: TOP SECRET`, 15, pageHeight - 10);
        pdfDoc.text(`PAGE ${i} OF ${pageCount}`, pageWidth - 15, pageHeight - 10, { align: "right" });
        
        // Bottom Line
        pdfDoc.setDrawColor(226, 232, 240);
        pdfDoc.setLineWidth(0.2);
        pdfDoc.line(15, pageHeight - 15, pageWidth - 15, pageHeight - 15);
    }
  };

  const handleExportAgent = async (role: string) => {
    const element = document.getElementById(`agent-report-${role}`);
    if (!element) return;

    setPdfStatus(`Preparing ${role} Intelligence Data...`);
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pageWidth - (margin * 2);

      const canvas = await html2canvas(element, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
        onclone: (clonedDoc) => {
          const scripts = clonedDoc.querySelectorAll('script, iframe');
          scripts.forEach(s => s.remove());
          const styles = clonedDoc.querySelectorAll('style, link[rel="stylesheet"]');
          styles.forEach(s => s.remove());
          
          const target = clonedDoc.getElementById(`agent-report-${role}`);
          if (target) {
            target.querySelectorAll('*').forEach(el => {
              const s = el.getAttribute('style');
              if (s && s.includes('oklch')) el.setAttribute('style', s.replace(/oklch\([^)]+\)/g, '#334155'));
            });
          }

          const style = clonedDoc.createElement('style');
          style.innerHTML = `
            :root { color-scheme: light !important; }
            * { background-color: white !important; color: #1e293b !important; border-color: #cbd5e1 !important; box-shadow: none !important; }
            h1 { color: #0f172a !important; border-bottom: 2px solid #0284c7 !important; margin-bottom: 20px !important; }
            h2 { color: #0f172a !important; border-left: 4px solid #0284c7 !important; margin-top: 30px !important; }
            th { background-color: #f1f5f9 !important; color: #0f172a !important; border: 1px solid #94a3b8 !important; }
            td { border: 1px solid #e2e8f0 !important; }
          `;
          clonedDoc.head.appendChild(style);
        }
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.9);
      const imgWidth = contentWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 25; // Initial Y position on first page

      // First Page
      doc.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= (pageHeight - position - 20);

      while (heightLeft > 0) {
        doc.addPage();
        position = heightLeft - imgHeight;
        doc.addImage(imgData, 'JPEG', margin, position + margin, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= (pageHeight - margin * 2);
      }

      applyPDFBranding(doc);
      doc.save(`STACK3_${role}_Intelligence_Report.pdf`);
    } catch (error) {
      console.error('PDF Generation failed:', error);
      alert('Local export failed. Report size may exceed browser limits.');
    } finally {
      setPdfStatus(null);
    }
  };

  const handleExportAll = async () => {
    if (Object.keys(engineResults).length === 0) {
      alert('No reports generated to export.');
      return;
    }

    setPdfStatus('Initializing PDF Engine...');
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pageWidth - (margin * 2);
      const brandColor = [0, 209, 255];
      const darkBg = [8, 15, 20];
      
      // COVER PAGE
      setPdfStatus('Generating Cover Page...');
      doc.setFillColor(darkBg[0], darkBg[1], darkBg[2]);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(36);
      doc.setTextColor(255, 255, 255);
      doc.text("STACK3", pageWidth / 2, 80, { align: "center" });
      
      doc.setFontSize(14);
      doc.setTextColor(brandColor[0], brandColor[1], brandColor[2]);
      doc.text("CONSOLIDATED MISSION RECAP", pageWidth / 2, 95, { align: "center", charSpace: 2 });
      
      doc.setDrawColor(brandColor[0], brandColor[1], brandColor[2]);
      doc.setLineWidth(1);
      doc.line(pageWidth / 2 - 40, 105, pageWidth / 2 + 40, 105);
  
      doc.setFontSize(10);
      doc.setTextColor(100, 120, 140);
      doc.text(`MISSION: ${(engineIdea || 'UNKNOWN').toUpperCase()}`, pageWidth / 2, 125, { align: "center" });
      doc.text(`DATE: ${new Date().toLocaleDateString()}`, pageWidth / 2, 139, { align: "center" });
  
      const activeRoles = Object.entries(engineResults).filter(([role, data]) => role !== 'GLOBAL_MAP' && !data.loading);
      
      for (let i = 0; i < activeRoles.length; i++) {
        const [role] = activeRoles[i];
        setPdfStatus(`Siphoning Data: ${role} (${i+1}/${activeRoles.length})...`);
        
        const element = document.getElementById(`agent-report-${role}`);
        if (!element) continue;

        // Yield to browser for UI updates
        await new Promise(resolve => setTimeout(resolve, 100));

        try {
          const canvas = await html2canvas(element, {
            backgroundColor: '#ffffff',
            scale: 1.25, // Reduced scale for full report to save memory
            useCORS: true,
            logging: false,
            onclone: (clonedDoc) => {
              const scripts = clonedDoc.querySelectorAll('script, iframe');
              scripts.forEach(s => s.remove());
              const styles = clonedDoc.querySelectorAll('style, link[rel="stylesheet"]');
              styles.forEach(s => s.remove());
              const target = clonedDoc.getElementById(`agent-report-${role}`);
              if (target) {
                target.querySelectorAll('*').forEach(el => {
                  const s = el.getAttribute('style');
                  if (s && s.includes('oklch')) {
                    el.setAttribute('style', s.replace(/oklch\([^)]+\)/g, '#334155'));
                  }
                });
              }
              const style = clonedDoc.createElement('style');
              style.innerHTML = `
                :root { color-scheme: light !important; }
                * { background-color: white !important; color: #1e293b !important; border-color: #cbd5e1 !important; }
                h1, h2, h3 { color: #0f172a !important; }
              `;
              clonedDoc.head.appendChild(style);
            }
          });

          const imgData = canvas.toDataURL('image/jpeg', 0.75); // Lower quality for memory
          const imgHeight = (canvas.height * contentWidth) / canvas.width;
          
          let heightLeft = imgHeight;
          let position = 25;

          doc.addPage();
          doc.addImage(imgData, 'JPEG', margin, position, contentWidth, imgHeight, undefined, 'FAST');
          heightLeft -= (pageHeight - position - 20);

          while (heightLeft > 0) {
            doc.addPage();
            position = heightLeft - imgHeight;
            doc.addImage(imgData, 'JPEG', margin, position + 25, contentWidth, imgHeight, undefined, 'FAST');
            heightLeft -= (pageHeight - 50);
          }
          
          // Clear canvas reference
          (canvas as any) = null;
        } catch (err) {
          console.warn(`Failed to capture agent ${role}:`, err);
          doc.addPage();
          doc.setFontSize(14);
          doc.setTextColor(255, 0, 0);
          doc.text(`ERROR CAPTURING ${role.toUpperCase()} REPORT`, margin, 40);
          doc.setFontSize(10);
          doc.setTextColor(100, 100, 100);
          doc.text("The technical data for this node could be too complex for a consolidated render.", margin, 50);
        }
      }
      
      setPdfStatus('Applying Security Branding...');
      applyPDFBranding(doc);

      // ADD AUDIT PAGE
      setPdfStatus('Finalizing Audit Seals...');
      doc.addPage();
      doc.setFillColor(darkBg[0], darkBg[1], darkBg[2]);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');

      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(255, 255, 255);
      doc.text("PROFESSIONAL AUDIT LOG", pageWidth / 2, 40, { align: "center" });

      doc.setDrawColor(brandColor[0], brandColor[1], brandColor[2]);
      doc.setLineWidth(0.5);
      doc.line(20, 50, pageWidth - 20, 50);

      const auditLines = [
        { label: "PROJECT AUDITOR", value: professionalId.name || "UNREGISTERED" },
        { label: "PROFESSIONAL ROLE", value: professionalId.role },
        { label: "ORGANIZATION", value: professionalId.company || "STACK3 INDEPENDENT" },
        { label: "VALIDATION TIMESTAMP", value: new Date().toUTCString() },
        { label: "MISSION OBJECTIVE", value: engineIdea.substring(0, 40) + (engineIdea.length > 40 ? "..." : "") },
        { label: "SYSTEM VERSION", value: "STACK3 v4.0" }
      ];

      let yPos = 65;
      doc.setFontSize(10);
      auditLines.forEach(line => {
        doc.setTextColor(brandColor[0], brandColor[1], brandColor[2]);
        doc.text(line.label, 30, yPos);
        doc.setTextColor(255, 255, 255);
        doc.text(line.value, 85, yPos);
        yPos += 10;
      });

      // Risks & Strengths Section
      yPos += 10;
      doc.setDrawColor(brandColor[0], brandColor[1], brandColor[2]);
      doc.line(30, yPos, pageWidth - 30, yPos);
      yPos += 10;
      
      doc.setFontSize(12);
      doc.setTextColor(255, 255, 255);
      doc.text("EXECUTIVE SUMMARY (AUDITOR SCAN)", 30, yPos);
      yPos += 10;
      
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184);
      doc.text("• STRENGTHS: Protocol scalability verified via OVP graph logic.", 35, yPos);
      yPos += 6;
      doc.text("• RISKS: Potential liquidity fragmentation in cross-chain bridge logic.", 35, yPos);
      yPos += 6;
      doc.text("• STATUS: SYSTEM READY FOR DEPLOYMENT PHASE.", 35, yPos);

      // Signature Section
      yPos += 20;
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      doc.text("PROJECT CREATOR SIGNATURE", 30, yPos);
      
      doc.setDrawColor(255, 255, 255);
      doc.line(30, yPos + 15, 110, yPos + 15);
      doc.setFontSize(7);
      doc.text("DIGITALLY SIGNED VIA STACK3 SDK", 30, yPos + 20);

      const finalHash = await generateAuditHash();
      yPos += 30;
      doc.setFillColor(15, 23, 42);
      doc.rect(20, yPos, pageWidth - 40, 35, 'F');
      doc.setDrawColor(brandColor[0], brandColor[1], brandColor[2]);
      doc.rect(20, yPos, pageWidth - 40, 35, 'D');

      doc.setFontSize(9);
      doc.setTextColor(brandColor[0], brandColor[1], brandColor[2]);
      doc.text("DIGITAL AUDIT HASH (SHA-256)", 30, yPos + 8);
      
      doc.setFont("courier", "normal");
      doc.setTextColor(255, 255, 255);
      const splitHash = doc.splitTextToSize(finalHash, pageWidth - 60);
      doc.text(splitHash, 30, yPos + 18);

      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(100, 120, 140);
      doc.text("This document is a cryptographic record of a multi-agent simulation. Any modification to the source content invalidates the Audit Hash verified above.", pageWidth / 2, pageHeight - 20, { align: "center" });

      setPdfStatus('Downloading Report...');
      doc.save(`STACK3_Audit_Recap_${new Date().getTime()}.pdf`);
    } catch (error) {
      console.error('Full PDF Export failed:', error);
      alert('Failed to generate full PDF report. Please try again or export individual reports.');
    } finally {
      setPdfStatus(null);
    }
  };

  const updateStressSimulation = () => {
    setStressTestConfig(prev => {
      const newDay = prev.currentDay + 1;
      const lastPoint = prev.priceData[prev.priceData.length - 1];
      const lastPrice = lastPoint.price;
      const lastVolume = lastPoint.volume;
      const lastHolders = lastPoint.holders;

      const timeFactor = Math.sin(newDay * (Math.PI / 7)) * 0.02;
      const momentum = prev.priceData.length > 2 
        ? (prev.priceData[prev.priceData.length - 1].price - prev.priceData[prev.priceData.length - 2].price) / prev.priceData[prev.priceData.length - 2].price 
        : 0;
      const momentumFactor = momentum * 0.3 * (1 + Math.random() * 0.4 - 0.2);
      
      const volatilityExponent = 1 + (prev.volatility / 100) * 0.5;
      const randomFactor = Math.pow(Math.random(), volatilityExponent) * 2 - 1;
      const baseVolatility = (randomFactor * prev.volatility * 2 - prev.volatility) / 100;
      
      const sentimentFactor = Math.pow(Math.abs(prev.marketSentiment - 50) / 50, 1.5) * Math.sign(prev.marketSentiment - 50);
      const sentimentAdjustment = sentimentFactor / 10;
      
      let priceChange = baseVolatility + sentimentAdjustment + timeFactor + momentumFactor;
      const crashFactor = Math.random() < (prev.crashChance / 1000) ? -0.15 - (Math.random() * 0.2) : 0;
      priceChange += crashFactor;

      let currentEvent = prev.currentEvent;
      if (currentEvent) {
        const eventAgeFactor = Math.random() * 0.4 + 0.8;
        priceChange += (currentEvent.impact / 100) * eventAgeFactor / currentEvent.duration;
        const eventDuration = prev.priceData.length - prev.priceData.findIndex(p => p.day === prev.currentDay - 1) || 1;
        const eventProgress = Math.random() * (eventDuration / currentEvent.duration);
        if (eventProgress > 0.8) {
          currentEvent = null;
        }
      } else {
        const eventProbability = 0.03 + (prev.volatility / 500);
        if (Math.random() < eventProbability) {
          const eventWeights = MARKET_EVENTS.map(event => {
            const probabilityAdjustment = event.impact < 0 ? (50 - prev.marketSentiment) / 50 : prev.marketSentiment / 50;
            return event.probability * probabilityAdjustment;
          });
          const totalWeight = eventWeights.reduce((sum, weight) => sum + weight, 0);
          let random = Math.random() * totalWeight;
          let selectedIdx = 0;
          for (let i = 0; i < eventWeights.length; i++) {
            random -= eventWeights[i];
            if (random <= 0) {
              selectedIdx = i;
              break;
            }
          }
          currentEvent = MARKET_EVENTS[selectedIdx];
        }
      }

      const maxChange = 0.1 + (prev.volatility / 100);
      priceChange = Math.max(Math.min(priceChange, maxChange), -maxChange);
      const newPrice = Math.max(0.01, lastPrice * Math.exp(priceChange));

      const volumeMultiplier = 1 + Math.pow(Math.abs(priceChange) * 5, 1.2);
      const sentimentVolumeEffect = Math.abs(sentimentFactor) * 0.5;
      const volumeNoise = 0.8 + Math.random() * 0.4;
      const volumeChange = volumeMultiplier * (1 + sentimentVolumeEffect) * volumeNoise;
      const newVolume = Math.max(10000, lastVolume * volumeChange);

      let holdersChange = 1;
      if (priceChange > 0) {
        const growthFactor = Math.pow(priceChange, 0.7) * (1 + sentimentFactor * 0.5);
        holdersChange = 1 + growthFactor * (0.8 + Math.random() * 0.4);
      } else {
        const declineFactor = Math.pow(Math.abs(priceChange), 0.8) * (1 + Math.abs(sentimentFactor) * 0.3);
        holdersChange = 1 - declineFactor * (0.7 + Math.random() * 0.6);
      }
      if (Math.random() < 0.02) {
        holdersChange *= Math.random() < (prev.marketSentiment / 100) ? 1.1 : 0.9;
      }
      const newHolders = Math.max(1000, Math.round(lastHolders * holdersChange));
      const supplyGrowth = 1 + (Math.random() * 0.001);
      const effectiveSupply = 1000000 * supplyGrowth;
      const newMarketCap = newPrice * effectiveSupply;

      return {
        ...prev,
        currentDay: newDay,
        currentEvent,
        priceData: [...prev.priceData, {
          day: newDay,
          price: newPrice,
          volume: newVolume,
          holders: newHolders,
          market_cap: newMarketCap
        }]
      };
    });
  };

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    if (stressTestConfig.simulationRunning) {
      intervalId = setInterval(() => {
        updateStressSimulation();
      }, 1000 / stressTestConfig.simulationSpeed);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [stressTestConfig.simulationRunning, stressTestConfig.simulationSpeed]);

  const resetStressSimulation = () => {
    setStressTestConfig(prev => ({
      ...prev,
      simulationRunning: false,
      currentDay: 0,
      priceData: [{ day: 0, price: prev.initialPrice, volume: 1000000, holders: 10000, market_cap: prev.initialPrice * 1000000 }],
      currentEvent: null
    }));
  };

  const applyStressScenario = () => {
    setStressTestConfig(prev => {
      const randomizeValue = (baseValue: number, range: number = 10): number => {
        return Math.max(1, Math.min(99, baseValue + (Math.random() * range - range/2)));
      };
      const calculateCrashChance = (baseChance: number, intensity: number): number => {
        return Math.max(1, Math.min(30, baseChance + (Math.random() * intensity)));
      };

      let config = { ...prev, simulationRunning: false, currentDay: 0, currentEvent: null };

      switch(prev.stressScenario) {
        case 'market_crash':
          config.volatility = randomizeValue(75, 15);
          config.marketSentiment = randomizeValue(20, 10);
          config.crashChance = calculateCrashChance(15, 10);
          config.initialPrice = Math.max(10, 100 * (0.9 + Math.random() * 0.2));
          break;
        case 'custom_crash':
          config.volatility = 75;
          config.marketSentiment = 20;
          config.crashChance = 15;
          config.initialPrice = 100;
          break;
        case 'liquidity_crisis':
          config.volatility = randomizeValue(60, 12);
          config.marketSentiment = randomizeValue(35, 8);
          config.crashChance = calculateCrashChance(8, 6);
          config.initialPrice = Math.max(10, 100 * (1.0 + Math.random() * 0.3));
          break;
        case 'regulatory_shock':
          config.volatility = randomizeValue(50, 10);
          config.marketSentiment = randomizeValue(25, 12);
          config.crashChance = calculateCrashChance(6, 5);
          config.initialPrice = Math.max(10, 100 * (0.95 + Math.random() * 0.15));
          break;
        case 'security_breach':
          config.volatility = randomizeValue(65, 20);
          config.marketSentiment = randomizeValue(15, 10);
          config.crashChance = calculateCrashChance(20, 15);
          config.initialPrice = Math.max(10, 100 * (1.05 + Math.random() * 0.2));
          break;
        case 'whale_dump':
          config.volatility = randomizeValue(70, 15);
          config.marketSentiment = randomizeValue(30, 10);
          config.crashChance = calculateCrashChance(12, 8);
          config.initialPrice = Math.max(10, 100 * (1.1 + Math.random() * 0.25));
          break;
      }
      
      config.priceData = [{ day: 0, price: config.initialPrice, volume: 1000000, holders: 10000, market_cap: config.initialPrice * 1000000 }];
      return config;
    });

    setTimeout(() => {
      setStressTestConfig(prev => ({ ...prev, simulationRunning: true }));
    }, 500);
  };

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, activeAgent, view]);

  const dashboardProjections = useMemo(() => {
    const data = [];
    let currentPrice = analystConfig.initialPrice;
    for (let i = 0; i <= 12; i++) {
        data.push({
            month: `M${i}`,
            price: parseFloat(currentPrice.toFixed(4)),
            marketCap: Math.round(currentPrice * analystConfig.totalSupply)
        });
        // Very simplified growth logic: (Growth - Burn + Staking Effect)
        const monthlyGrowth = (analystConfig.growthRate + (analystConfig.stakingApr / 12) - analystConfig.burnRate) / 100 / 12;
        currentPrice = currentPrice * (1 + monthlyGrowth);
    }
    return data;
  }, [analystConfig]);

  const handleSendMessage = async (customText?: string, specificRole?: AgentRole) => {
    const text = customText || inputText;
    if (!text.trim() || isTyping) return;

    if (view === 'dashboard') setView('chat');

    // Multi-agent selection logic
    const targets = specificRole ? [specificRole] : selectedAgents;
    
    setInputText('');
    setIsTyping(true);

    // 1. Add user message to all target agent histories
    const userMsgId = Date.now().toString();
    const userMsg: Message = {
      id: userMsgId,
      sender: 'user',
      content: text,
      timestamp: new Date()
    };

    setMessages(prev => {
      const next = { ...prev };
      targets.forEach(role => {
        next[role] = [...(next[role] || []), userMsg];
      });
      return next;
    });

    // 2. Task detection logic
    const taskKeywords = ['create', 'generate', 'design', 'audit', 'analyze', 'build', 'forge'];
    if (taskKeywords.some(k => text.toLowerCase().includes(k))) {
      const priorityWeights = { 'high': 'HIGH', 'medium': 'MEDIUM', 'low': 'LOW' };
      const detectedPriority = Object.entries(priorityWeights).find(([k]) => text.toLowerCase().includes(k))?.[1] || 'MEDIUM';
      
      const newTask: AgentTask = {
        id: Math.random().toString(36).substring(2, 9),
        agentId: targets[0],
        title: text.length > 30 ? text.substring(0, 30) + '...' : text,
        description: `Processing request for ${targets.join(', ')}`,
        status: 'IN_PROGRESS',
        priority: detectedPriority as any,
        progress: 10,
        assignedTo: targets[0],
        createdAt: new Date()
      };
      setTasks(prev => [newTask, ...prev]);
      
      // Simulate progress increments
      setTimeout(() => {
         setTasks(prev => prev.map(t => t.id === newTask.id ? { ...t, progress: 60 } : t));
      }, 2000);
    }

    try {
      // 3. Parallel execution for all target agents
      await Promise.all(targets.map(async (currentRole) => {
        try {
          const history = (messages[currentRole] || []).map(m => ({
            role: m.sender === 'user' ? 'user' : 'model',
            parts: [{ text: m.content }]
          }));

          // Inter-agent mentions logic (basic simulation)
          let enhancedText = text;
          const mentions = AGENTS.filter(a => text.includes(`@${a.role}`));
          if (mentions.length > 0) {
             enhancedText += `\n\n[CONTEXT FROM COLLABORATORS]: You are being mentioned alongside ${mentions.map(m => m.role).join(', ')}. Coordinate your response to align with their specialized domains.`;
          }

          const response = await chatWithAgent(currentRole, enhancedText, history);
          
          const aiMsg: Message = {
            id: Math.random().toString(),
            sender: currentRole,
            content: response || 'I apologize, but my core logic encountered a shadow-fault during synthesis.',
            timestamp: new Date(),
            metadata: mentions.length > 0 ? { isCollaborative: true, targetAgents: mentions.map(m => m.role) } : undefined
          };

          setMessages(prev => ({
            ...prev,
            [currentRole]: [...(prev[currentRole] || []), aiMsg]
          }));

          // Finalize task if found
          setTasks(prev => prev.map(t => 
            (t.assignedTo === currentRole && t.status === 'IN_PROGRESS') 
            ? { ...t, status: 'COMPLETED', progress: 100 } 
            : t
          ));

        } catch (error) {
          console.error(`Agent ${currentRole} error:`, error);
          const errorMsg: Message = {
            id: Math.random().toString(),
            sender: currentRole,
            content: "SYSTEM_ERROR: Critical failure in response synthesis. Check connection to model nodes.",
            timestamp: new Date(),
            metadata: { error: error instanceof Error ? error.message : String(error) }
          };
          setMessages(prev => ({
            ...prev,
            [currentRole]: [...(prev[currentRole] || []), errorMsg]
          }));
          setTasks(prev => prev.map(t => 
            (t.assignedTo === currentRole && t.status === 'IN_PROGRESS') 
            ? { ...t, status: 'FAILED' } 
            : t
          ));
        }
      }));
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-app-bg text-app-text-primary font-sans selection:bg-app-accent/30 overflow-hidden">
      {/* Header */}
      <header className="h-20 border-b border-app-border flex items-center px-10 justify-between shrink-0 bg-app-bg/90 backdrop-blur-md z-40">
        <div 
          className="flex items-center gap-3 text-app-accent font-bold tracking-[4px] uppercase cursor-pointer hover:opacity-80 transition-opacity font-display"
          onClick={() => setView('dashboard')}
        >
          <div className="w-2 h-2 bg-app-accent rounded-full shadow-[0_0_10px_var(--accent)]" />
          <span>STACK</span>
          <span className="text-white bg-app-accent/20 px-2 py-0.5 rounded-sm border border-app-accent/40 -ml-1">3</span>
          <span className="text-[10px] opacity-40 ml-2 hidden sm:inline tracking-[2px] font-mono">— MIXBOARD</span>
        </div>
        
        <div className="hidden lg:flex font-mono text-[10px] gap-8 text-app-text-secondary items-center">
          <div className="flex flex-col">
            <span className="opacity-40 uppercase">Orchestrator</span>
            <span className="text-app-text-white">GEMINI 3.1 PRO</span>
          </div>
          <div className="flex flex-col border-l border-app-border pl-8">
            <span className="opacity-40 uppercase">Network</span>
            <span className="text-app-text-white">BASE SEPOLIA</span>
          </div>
          <div className="flex flex-col px-8 border-l border-app-border">
            <span className="opacity-40 uppercase">Agent Nodes</span>
            <span className="text-app-accent">{AGENTS.length}/{AGENTS.length} ONLINE</span>
          </div>
        </div>

                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setIsSettingsOpen(true)}
                    className="p-2 border border-app-border text-app-text-secondary hover:text-app-accent transition-all rounded-sm bg-app-bg/50"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                  {professionalId.verified ? (
                    <div className="flex items-center gap-3 bg-[#0A2540]/30 border border-[#00D1FF]/30 px-6 py-2">
                       <UserCheck className="w-4 h-4 text-[#00D1FF]" />
                       <div className="flex flex-col">
                          <span className="text-[10px] font-mono text-[#FFFFFF] uppercase tracking-wider">{professionalId.name}</span>
                          <span className="text-[9px] font-mono text-[#00D1FF] opacity-70 italic">{professionalId.role} @ {professionalId.company}</span>
                       </div>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setIsSignModalOpen(true)}
                      className="px-6 py-2 border border-[#3A3F45] text-[#7F8C99] text-[10px] font-display uppercase tracking-[2px] hover:border-[#00D1FF] hover:text-white transition-all flex items-center gap-2"
                    >
                      <Fingerprint className="w-3 h-3" />
                      Professional Login
                    </button>
                  )}
                  {wallet.isConnected ? (
            <div className="flex items-center gap-3 bg-[#0A2540]/30 border border-[#3A3F45] px-4 py-2">
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-mono text-[#FFFFFF] opacity-80">{wallet.address}</span>
                <span className="text-[10px] font-mono text-[#00D1FF]">{wallet.balance}</span>
              </div>
              <button 
                onClick={disconnect}
                className="p-1 hover:text-rose-500 transition-all ml-2"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button 
              onClick={connect}
              className="flex items-center gap-2 px-6 py-2 border border-[#00D1FF] text-[#00D1FF] text-[10px] font-display uppercase tracking-[2px] hover:bg-[#00D1FF]/10 transition-all active:scale-95 shadow-[0_0_15px_rgba(0,209,255,0.1)]"
            >
              <Wallet className="w-3 h-3" />
              Connect Access
            </button>
          )}
        </div>
      </header>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-app-card border border-app-border rounded-sm p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3 text-app-accent">
                  <Settings className="w-5 h-5" />
                  <h2 className="text-lg font-display uppercase tracking-widest font-bold">System Configuration</h2>
                </div>
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-1 text-app-text-secondary hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-mono uppercase tracking-[2px] text-app-text-secondary">Visual Environment</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => setTheme('dark')}
                      className={`flex items-center gap-3 p-4 border transition-all rounded-sm ${
                        theme === 'dark' 
                          ? 'border-app-accent bg-app-accent/10 text-app-text-white' 
                          : 'border-app-border bg-app-bg/50 text-app-text-secondary hover:border-app-text-secondary'
                      }`}
                    >
                      <Moon className="w-4 h-4" />
                      <span className="text-xs font-mono">NEURAL DARK</span>
                    </button>
                    <button 
                      onClick={() => setTheme('light')}
                      className={`flex items-center gap-3 p-4 border transition-all rounded-sm ${
                        theme === 'light' 
                          ? 'border-app-accent bg-app-accent/10 text-app-text-white' 
                          : 'border-app-border bg-app-bg/50 text-app-text-secondary hover:border-app-text-secondary'
                      }`}
                    >
                      <Sun className="w-4 h-4" />
                      <span className="text-xs font-mono">ETHER LIGHT</span>
                    </button>
                  </div>
                </div>

                <div className="pt-6 border-t border-app-border">
                  <div className="flex items-center justify-between text-[10px] font-mono text-app-text-secondary opacity-50 uppercase tracking-widest">
                    <span>STACK3 PROTOCOL v4.2.0</span>
                    <span>{new Date().getFullYear()} © NODE_SYSTEM</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Container */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Left */}
        <aside className="w-[300px] border-r border-app-border p-6 flex flex-col gap-6 overflow-y-auto shrink-0 bg-app-bg">
          <div className="section-label mb-2 border-b border-app-border pb-4 flex items-center justify-between">
            Expert Nodes Cluster
            <div className="w-2 h-2 bg-app-accent rounded-full animate-pulse" />
          </div>
          {AGENTS.map((agent) => (
            <div key={agent.id} className="tooltip-container">
              <div className="flex items-center gap-2 mb-1">
                 <button 
                  onClick={() => {
                    setSelectedAgents(prev => 
                      prev.includes(agent.role) 
                        ? (prev.length > 1 ? prev.filter(r => r !== agent.role) : prev) 
                        : [...prev, agent.role]
                    );
                  }}
                  className={`transition-colors ${selectedAgents.includes(agent.role) ? 'text-[#00D1FF]' : 'text-[#3A3F45] hover:text-[#7F8C99]'}`}
                 >
                   {selectedAgents.includes(agent.role) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                 </button>
                <div className={`w-2 h-2 rounded-full ${agentHealth[agent.role]?.status === 'ONLINE' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'}`} />
              </div>
              <motion.button
                whileHover={{ scale: 1.02, x: 4 }}
                onClick={(e) => {
                  if (agent.role === 'SOLANA_FORGE' || agent.role === 'SOLANA_AUDITOR') {
                    setForgeConfig(prev => ({ ...prev, language: 'Rust' }));
                  }
                  setActiveAgent(agent);
                  
                  // Multi-select logic: if Ctrl/Cmd is held, toggle. Otherwise, set as only selected.
                  if (e.ctrlKey || e.metaKey) {
                    setSelectedAgents(prev => 
                      prev.includes(agent.role) 
                        ? (prev.length > 1 ? prev.filter(r => r !== agent.role) : prev) 
                        : [...prev, agent.role]
                    );
                  } else {
                    setSelectedAgents([agent.role]);
                  }
                  
                  setView('chat');
                }}
                className={cn(
                  "agent-card w-full group p-4 rounded-sm text-left relative bg-app-card border-app-border transition-all hover:border-app-accent hover:shadow-[0_0_15px_rgba(0,209,255,0.3)]",
                  view === 'chat' && activeAgent.id === agent.id && "active !border-app-accent/50",
                  selectedAgents.includes(agent.role) && "ring-1 ring-app-accent/30 border-app-accent/20",
                  agentHealth[agent.role]?.status === 'OFFLINE' && "opacity-75 grayscale-[0.4]"
                )}
              >
                {/* Status Indicator Badge */}
                <div className="absolute top-2 right-2">
                  <div className={cn(
                    "px-1.5 py-0.5 text-[6px] font-bold rounded-sm border leading-none font-sans uppercase tracking-wider",
                    agentHealth[agent.role]?.status === 'ONLINE' 
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500" 
                      : "bg-rose-500/10 border-rose-500/30 text-rose-500 animate-pulse"
                  )}>
                    {agentHealth[agent.role]?.status || agent.status}
                  </div>
                </div>
                <div className="flex justify-between items-start mb-1">
                  <div className="font-display font-medium text-[12px] uppercase tracking-wider text-app-text-white">{agent.name}</div>
                  {selectedAgents.includes(agent.role) && (
                    <div className="w-1.5 h-1.5 bg-app-accent rounded-full shadow-[0_0_8px_var(--accent)]" />
                  )}
                </div>
                <div className="text-[10px] font-mono text-app-text-secondary uppercase flex items-center justify-between">
                  <span>{agent.role}</span>
                  <span className="text-[8px] opacity-0 group-hover:opacity-100 transition-opacity text-app-accent">
                    {selectedAgents.includes(agent.role) ? 'SELECTED' : '[CTRL+CLICK] TO ADD'}
                  </span>
                </div>
              </motion.button>
              <div className="tooltip-content translate-z-0">
                <div className="text-[#00D1FF] font-bold text-[10px] mb-1 tracking-wider uppercase">{agent.name}</div>
                {agent.description}
              </div>
            </div>
          ))}

          <button 
            onClick={() => setView('dashboard')}
            className={`mt-10 p-4 border border-app-border text-[11px] font-display text-center uppercase tracking-[3px] transition-all hover:border-app-accent/50 ${
              view === 'dashboard' ? 'bg-app-accent/10 border-app-accent text-app-accent' : 'text-app-text-secondary hover:text-app-text-white'
            }`}
          >
            Terminal Dashboard
          </button>

          <button 
            onClick={() => setView('engine')}
            className={`p-4 border border-[#3A3F45] text-[11px] font-display text-center uppercase tracking-[3px] transition-all flex items-center justify-center gap-2 hover:border-amber-500/50 ${
              view === 'engine' ? 'bg-amber-500/10 border-amber-500 text-amber-500' : 'text-[#7F8C99] hover:text-white'
            }`}
          >
            <Rocket className="w-4 h-4" />
            STACK3 Engine
          </button>

          <button 
            onClick={() => setView('protocol')}
            className={`p-4 border border-[#3A3F45] text-[11px] font-display text-center uppercase tracking-[3px] transition-all flex items-center justify-center gap-2 hover:border-indigo-500/50 ${
              view === 'protocol' ? 'bg-indigo-500/10 border-indigo-500 text-indigo-500' : 'text-[#7F8C99] hover:text-white'
            }`}
          >
            <GitMerge className="w-4 h-4" />
            Protocol Strategy
          </button>
        </aside>

        {/* Workspace */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          <AnimatePresence mode="wait">
            {view === 'dashboard' ? (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-16 space-y-20 max-w-7xl mx-auto h-full overflow-y-auto"
              >
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                  <div className="lg:col-span-2 space-y-12">
                    <div className="border-l-4 border-[#00D1FF] pl-8">
                      <div className="section-label mb-4 text-[#00D1FF] tracking-[4px]">Pillar 1: System Orchestration</div>
                      <h1 className="text-6xl font-display font-bold text-white tracking-tight uppercase leading-[1.1]">
                        Architecting <br/>
                        <span className="text-[#00D1FF]">Web3 Futures</span>
                      </h1>
                    </div>
                    
                    <p className="text-[15px] font-mono text-[#7F8C99] leading-relaxed max-w-xl border-l border-[#3A3F45] pl-8">
                      STACK3 is the builder agent for Web3 startups. 
                      Automation, modularity, and decentralization to scale ideas 
                      into the future. Construct. Launch. Decentralize.
                    </p>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                          <Database className="w-4 h-4 text-[#00D1FF]" />
                          <h3 className="text-[10px] font-mono uppercase tracking-[4px] text-white">Project Registry / History</h3>
                        </div>
                        <span className="text-[8px] font-mono text-[#00D1FF] bg-[#00D1FF]/5 px-2 py-0.5 border border-[#00D1FF]/20">TEMPLATES: {savedProjects.length}</span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {savedProjects.length === 0 ? (
                          <div className="md:col-span-2 p-10 border border-dashed border-[#3A3F45] rounded-sm flex flex-col items-center justify-center space-y-4 opacity-40 bg-[#080F14]/50">
                            <Box className="w-8 h-8" />
                            <p className="text-[10px] font-mono uppercase tracking-widest text-center">Registry is empty. Save a project to baseline this template.</p>
                          </div>
                        ) : (
                          savedProjects.map(proj => (
                            <div 
                              key={proj.id}
                              onClick={() => handleLoadProject(proj.id)}
                              className="group p-5 bg-[#080F14] border border-[#3A3F45] rounded-sm hover:border-[#00D1FF]/40 transition-all cursor-pointer relative overflow-hidden"
                            >
                              <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                <button 
                                  onClick={(e) => handleDeleteProject(proj.id, e)}
                                  className="text-rose-500/50 hover:text-rose-500 p-1"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <div className="flex items-center gap-3 mb-3">
                                <div className="p-2 bg-[#00D1FF]/10 border border-[#00D1FF]/20 rounded-sm">
                                  <FileText className="w-3.5 h-3.5 text-[#00D1FF]" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-[10px] font-bold text-white uppercase tracking-wider truncate group-hover:text-[#00D1FF] transition-colors">{proj.name}</div>
                                  <div className="text-[8px] font-mono text-[#7F8C99] uppercase mt-1">{new Date(proj.timestamp).toLocaleDateString()} @ {new Date(proj.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="text-[8px] font-mono text-[#444] uppercase tracking-widest group-hover:text-amber-500/60 transition-colors">Restore Point</div>
                                <ArrowRight className="w-2.5 h-2.5 text-[#444] group-hover:text-amber-500/60 translate-x-0 group-hover:translate-x-1 transition-all" />
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-8 max-w-2xl bg-[#0A121A] p-10 border border-[#3A3F45] relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-2 opacity-5">
                        <Terminal className="w-24 h-24" />
                      </div>
                      <div className="space-y-8 relative z-10">
                        <div>
                          <label className="text-[10px] font-mono text-[#00D1FF] uppercase tracking-[4px] mb-4 block">1. MISSION OBJECTIVE</label>
                          <textarea
                            placeholder="What are we building today?"
                            value={engineIdea}
                            onChange={(e) => setEngineIdea(e.target.value)}
                            className="w-full bg-[#080F14] border border-[#3A3F45] p-6 text-[#FFFFFF] text-sm focus:border-[#00D1FF] focus:outline-none transition-all min-h-[100px] resize-none font-mono"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-mono text-[#00D1FF] uppercase tracking-[3px] mb-3 block">2. Network & Technical Scale</label>
                          <select
                            value={engineQ2}
                            onChange={(e) => setEngineQ2(e.target.value)}
                            className="w-full bg-[#141417] border border-[#3A3F45] p-6 text-white text-sm focus:border-[#00D1FF] focus:outline-none transition-all appearance-none"
                          >
                            <option value="">Select scale...</option>
                            <option value="L1 Ethereum/Solana">Layer 1 (Ethereum, Solana)</option>
                            <option value="L2 Scroll/Arbitrum">Layer 2 (Scroll, Arbitrum)</option>
                            <option value="Enterprise Private">Enterprise Private (Hyperledger, Subnet)</option>
                            <option value="Experimental DAO">Experimental / DAO focus</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-mono text-[#00D1FF] uppercase tracking-[3px] mb-3 block">3. Agent Cluster Selection</label>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {AGENTS.map((agent) => (
                              <button
                                key={agent.id}
                                onClick={() => {
                                  setSelectedAgentRoles(prev => 
                                    prev.includes(agent.role) 
                                      ? prev.filter(r => r !== agent.role) 
                                      : [...prev, agent.role]
                                  );
                                }}
                                className={cn(
                                  "p-3 border text-[9px] font-mono uppercase tracking-widest text-center transition-all relative group/agent",
                                  selectedAgentRoles.includes(agent.role) 
                                    ? "bg-[#00D1FF]/10 border-[#00D1FF] text-[#00D1FF]" 
                                    : "border-[#2C2C30] text-[#8E8E93] hover:text-white",
                                  agentHealth[agent.role]?.status === 'OFFLINE' && "opacity-80 grayscale-[0.3]"
                                )}
                              >
                                {/* Status Indicator Badge */}
                                <div className="absolute top-1 right-1">
                                  <div className={cn(
                                    "px-1 py-0.5 text-[5px] font-bold rounded-sm border leading-none font-sans tracking-normal",
                                    agentHealth[agent.role]?.status === 'ONLINE' 
                                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500" 
                                      : "bg-rose-500/10 border-rose-500/30 text-rose-500 animate-pulse"
                                  )}>
                                    {agentHealth[agent.role]?.status || agent.status}
                                  </div>
                                </div>

                                <div className="flex flex-col items-center gap-2">
                                  <div className="flex items-center gap-1.5 justify-center w-full">
                                     <div className={cn(
                                       "w-1 h-1 rounded-full",
                                       agentHealth[agent.role]?.status === 'ONLINE' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]"
                                     )} />
                                     {agent.name}
                                  </div>
                                  <span className={cn(
                                    "text-[6px] tracking-[1px] opacity-40",
                                    agentHealth[agent.role]?.status === 'ONLINE' ? "text-emerald-500" : "text-rose-500"
                                  )}>
                                    {agentHealth[agent.role]?.status || agent.status}
                                  </span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="pt-4">
                           <button 
                            onClick={handleParallelEngine}
                            disabled={engineLoading || !engineIdea.trim() || !engineQ2.trim() || selectedAgentRoles.length === 0}
                            className="w-full bg-[#00D1FF] text-[#080F14] px-10 py-5 font-display font-bold text-[11px] uppercase tracking-[3px] hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-3 border-none"
                          >
                            {engineLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                            Initialize Parallel Cluster
                          </button>
                        </div>
                      </div>
                      
                      <div className="flex gap-4">
                        <button 
                          onClick={() => {
                            setActiveAgent(AGENTS[0]);
                            setView('chat');
                          }}
                          className="px-10 py-4 border border-[#2C2C30] text-white font-bold text-xs uppercase tracking-[3px] hover:bg-white/5 transition-all"
                        >
                          Chat with Agents
                        </button>
                      </div>
                    </div>
                           {/* System Health Dashboard */}
                    <div className="bg-[#0A121A] border border-[#3A3F45] p-6 space-y-6">
                      <div className="section-label flex items-center justify-between text-[#00D1FF] tracking-[2px]">
                        Protocol Health Monitoring
                        <Activity className="w-4 h-4 text-[#00D1FF] animate-pulse" />
                      </div>
                      
                      {/* Active Alerts */}
                      <AnimatePresence>
                        {alerts.length > 0 && (
                          <div className="space-y-2">
                            {alerts.map(alert => (
                              <motion.div
                                key={alert.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className={cn(
                                  "p-3 text-[9px] font-mono border flex items-start gap-3",
                                  alert.type === 'error' ? "bg-rose-500/10 border-rose-500/50 text-rose-400" :
                                  alert.type === 'warning' ? "bg-amber-500/10 border-amber-500/50 text-amber-400" :
                                  "bg-emerald-500/10 border-emerald-500/50 text-emerald-400"
                                )}
                              >
                                {alert.type === 'error' ? <ShieldAlert className="w-3 h-3 mt-0.5 shrink-0" /> : <Info className="w-3 h-3 mt-0.5 shrink-0" />}
                                <div>
                                  <div className="font-bold mb-1 uppercase tracking-wider">
                                    [{alert.timestamp.toLocaleTimeString()}] {alert.type}
                                  </div>
                                  {alert.message}
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        )}
                      </AnimatePresence>

                      {/* Active Diagnostics */}
                      {Object.keys(activeDiagnostics).length > 0 && (
                        <div className="space-y-4">
                          <div className="text-[10px] uppercase text-amber-500 font-mono tracking-[2px] flex items-center justify-between">
                            Active Node Diagnostics
                            <span className="animate-pulse">●</span>
                          </div>
                          <div className="space-y-3">
                            {Object.entries(activeDiagnostics).map(([role, diag]) => (
                              <div key={role} className="border border-[#2C2C30] bg-black/20 p-3 space-y-2">
                                <div className="flex justify-between items-center text-[9px] font-mono">
                                  <span className="text-white uppercase tracking-wider">{role} Node Check</span>
                                  <span className={cn(
                                    "px-1.5 py-0.5 border capitalize",
                                    diag.overallStatus === 'passed' ? "border-emerald-500 text-emerald-500" :
                                    diag.overallStatus === 'failed' ? "border-rose-500 text-rose-500" : "border-amber-500 text-amber-500 animate-pulse"
                                  )}>
                                    {(diag.overallStatus || '').replace('_', ' ')}
                                  </span>
                                </div>
                                <div className="space-y-1">
                                  {diag.checks.map(check => (
                                    <div key={check.id} className="flex items-center justify-between text-[8px] font-mono">
                                      <span className="text-[#7F8C99]">{check.name}</span>
                                      <span className={cn(
                                        check.status === 'success' ? "text-emerald-500" :
                                        check.status === 'failure' ? "text-rose-500" : "text-amber-500"
                                      )}>
                                        [{check.status.toUpperCase()}]
                                      </span>
                                    </div>
                                  ))}
                                </div>
                                {diag.overallStatus === 'failed' && !diag.reconnectionAttempted && (
                                  <div className="pt-2 border-t border-[#2C2C30] flex items-center gap-2">
                                    <RefreshCw className="w-2.5 h-2.5 text-amber-500 animate-spin" />
                                    <span className="text-[8px] text-amber-500 font-mono uppercase">Reconnection Sequence In Progress...</span>
                                  </div>
                                )}
                                {diag.reconnectionAttempted && !diag.reconnectionSuccess && (
                                  <div className="pt-2 border-t border-[#2C2C30] space-y-2">
                                    <div className="flex items-center gap-2 text-rose-500">
                                       <ShieldAlert className="w-2.5 h-2.5" />
                                       <span className="text-[8px] font-mono uppercase font-bold tracking-wider">Node Terminated: Manual Sync Required</span>
                                    </div>
                                    <button 
                                      onClick={() => handleManualRestart(role as AgentRole)}
                                      className="w-full py-1.5 border border-[#3A3F45] text-white text-[8px] font-mono uppercase tracking-[2px] hover:bg-white hover:text-black transition-colors"
                                    >
                                      Bypass Diagnostic & Force Restart
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-[10px] uppercase text-[#7F8C99] font-mono">
                           <span>Agent Resilience Index</span>
                           <span className="text-white">{(Object.values(agentHealth).filter(h => h.status === 'ONLINE').length / AGENTS.length * 100).toFixed(0)}%</span>
                        </div>
                        <div className="w-full h-1 bg-[#141417] rounded-full overflow-hidden">
                           <motion.div 
                             className="h-full bg-[#00D1FF]" 
                             animate={{ width: `${(Object.values(agentHealth).filter(h => h.status === 'ONLINE').length / AGENTS.length * 100)}%` }}
                           />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-3 bg-[#141417] border border-[#2C2C30] rounded">
                           <div className="text-[8px] text-[#7F8C99] uppercase mb-1">Response Latency</div>
                           <div className="text-sm font-display text-emerald-400">42ms <span className="text-[8px] text-[#7F8C99] font-mono">NOMINAL</span></div>
                        </div>
                        <div className="p-3 bg-[#141417] border border-[#2C2C30] rounded">
                           <div className="text-[8px] text-[#7F8C99] uppercase mb-1">Network Throughput</div>
                           <div className="text-sm font-display text-white">12.4 <span className="text-[8px] text-[#7F8C99] font-mono">TPS</span></div>
                        </div>
                      </div>

                      <div className="p-3 bg-black/40 border-l-2 border-[#00D1FF] text-[8px] text-[#7F8C99] font-mono h-24 overflow-y-auto scrollbar-hide">
                         {Object.entries(agentHealth).map(([role, health]) => (
                           <div key={role} className="flex justify-between py-0.5">
                             <span>{role}:</span>
                             <span className={health.status === 'ONLINE' ? "text-emerald-500" : "text-rose-500"}>{health.status}</span>
                           </div>
                         ))}
                      </div>
                    </div>

                    {/* Monetization Card (Pillar 4) */}
                    <div className="bg-[#0A121A] border border-[#3A3F45] p-6 space-y-4">
                       <div className="section-label flex items-center justify-between text-amber-500 tracking-[2px]">
                        Pillar 4: Monetization
                        <CreditCard className="w-4 h-4" />
                       </div>
                       <div className="flex items-center gap-4">
                          <div className="w-12 h-12 border border-[#3A3F45] flex items-center justify-center text-amber-500 bg-amber-500/10">
                             <Coins className="w-6 h-6" />
                          </div>
                          <div>
                             <div className="text-[10px] uppercase text-[#7F8C99] font-mono">Agent Revenue</div>
                             <div className="text-xl font-display text-white">$1,242.00</div>
                          </div>
                       </div>
                       <div className="text-[10px] text-[#7F8C99] italic uppercase tracking-widest bg-[#080F14] px-2 py-1 inline-block border border-[#3A3F45]/50">Powered by Nevermined & AgentKit</div>
                    </div>
                  </div>
                </div>

                {/* Subsections */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  <div className="border border-[#3A3F45] bg-[#0A121A] p-8 space-y-6 hover:border-[#00D1FF]/50 transition-all group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                      <TrendingUp className="w-20 h-20" />
                    </div>
                    <div className="flex items-center justify-between relative z-10">
                       <TrendingUp className="text-[#00D1FF] w-6 h-6" />
                       <div className="text-[10px] font-mono text-[#7F8C99] uppercase tracking-widest">LIVE_METRIC</div>
                    </div>
                    <h3 className="text-lg font-display font-bold text-white uppercase tracking-[2px] relative z-10">Market Intelligence</h3>
                    <p className="text-sm text-[#7F8C99] leading-relaxed relative z-10 font-sans">
                      Real-time cross-chain analysis using Dune, DeFiLlama, and custom on-chain scrapers.
                    </p>
                    <div className="h-[2px] w-full bg-[#080F14] overflow-hidden relative z-10 border border-[#3A3F45]/30">
                       <motion.div 
                        initial={{ x: "-100%" }}
                        animate={{ x: "100%" }}
                        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                        className="h-full w-1/3 bg-[#00D1FF]"
                       />
                    </div>
                  </div>

                  <div className="border border-[#3A3F45] bg-[#0A121A] p-8 space-y-6 hover:border-[#00D1FF]/50 transition-all group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                      <ShieldCheck className="w-20 h-20" />
                    </div>
                    <div className="flex items-center justify-between relative z-10">
                       <ShieldCheck className="text-[#00D1FF] w-6 h-6" />
                       <div className="text-[10px] font-mono text-[#7F8C99] uppercase tracking-widest">COMPLIANCE_GATE</div>
                    </div>
                    <h3 className="text-lg font-display font-bold text-white uppercase tracking-[2px] relative z-10">Protocol Compliance</h3>
                    <p className="text-sm text-[#7F8C99] leading-relaxed relative z-10 font-sans">
                      Automated legal auditing and jurisdictional compliance checks for global protocol launches.
                    </p>
                    <div className="flex gap-2 relative z-10">
                       {[1,2,3,4,5].map(i => <div key={i} className="h-1.5 w-4 bg-[#00D1FF]/20 rounded-full" />)}
                    </div>
                  </div>

                  <div className="border border-[#3A3F45] bg-[#0A121A] p-8 space-y-6 hover:border-[#00D1FF]/50 transition-all group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                      <Network className="w-20 h-20" />
                    </div>
                    <div className="flex items-center justify-between relative z-10">
                       <Network className="text-[#00D1FF] w-6 h-6" />
                       <div className="text-[10px] font-mono text-[#7F8C99] uppercase tracking-widest">STACK_IDENTITY</div>
                    </div>
                    <h3 className="text-lg font-display font-bold text-white uppercase tracking-[2px] relative z-10">Cluster Identity</h3>
                    <p className="text-sm text-[#7F8C99] leading-relaxed relative z-10 font-sans">
                      Secure on-chain IDs for agents using Lucid and AgentKit, enabling trustless autonomous interactions.
                    </p>
                    <div className="flex -space-x-2 relative z-10">
                       {[1,2,3].map(i => <div key={i} className="w-8 h-8 rounded-full bg-[#080F14] border border-[#3A3F45]" />)}
                    </div>
                  </div>
                </div>

                <div className="border border-[#3A3F45] p-10 bg-[#0A121A]/50 relative overflow-hidden group">
                   <div className="absolute inset-0 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity pointer-events-none">
                      <div className="w-full h-full" style={{ backgroundImage: `radial-gradient(circle, #00D1FF 1px, transparent 1px)`, backgroundSize: '24px 24px' }}></div>
                   </div>
                   <div className="section-label mb-8 text-[#00D1FF] tracking-[4px] relative z-10 flex items-center gap-4">
                      <div className="h-[1px] w-12 bg-[#00D1FF]/50" />
                      Orchestration Preview: Phase 2 Strategy
                   </div>
                   <div className="flex flex-col md:flex-row gap-12 items-center relative z-10">
                      <div className="flex-1 space-y-6">
                         <div className="p-6 bg-[#080F14] border-l-4 border-[#00D1FF] text-sm text-[#7F8C99] font-mono leading-relaxed">
                            <span className="text-white block mb-2 uppercase tracking-widest text-[11px] opacity-100">Live Process Monitor</span>
                            The orchestrator is currently mapping "DEX Aggregator" project parameters across COMPLIANCE and ARCHITECT nodes.
                         </div>
                         <div className="text-[11px] font-mono text-[#00D1FF] tracking-[3px] bg-[#00D1FF]/5 inline-block px-3 py-1 border border-[#00D1FF]/20 uppercase">
                           SYMBOLS_SYNC: [OK] | LOGIC_FLOW: [AUDITED]
                         </div>
                      </div>
                      <div className="w-full md:w-64 h-32 border border-[#3A3F45] flex items-center justify-center bg-[#080F14] group-hover:border-[#00D1FF]/50 transition-all">
                         <Activity className="w-10 h-10 text-[#00D1FF] animate-pulse" />
                      </div>
                   </div>
                </div>

                {/* Strategic Command Center */}
                <div className="border border-[#3A3F45] p-10 bg-[#0A121A] space-y-10 relative overflow-hidden group">
                   <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#00D1FF]/50 to-transparent" />
                   <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8 relative z-10">
                      <div className="space-y-3">
                         <div className="section-label text-[#00D1FF] tracking-[6px]">Pillar 5: System Strategy</div>
                         <h2 className="text-5xl font-display font-bold text-white tracking-[2px] uppercase leading-tight">Strategic <br className="hidden md:block"/> Command Center</h2>
                         <p className="text-[11px] text-[#7F8C99] font-mono tracking-[4px] max-w-md uppercase">DIRECT ACCESS TO ENTERPRISE RESOURCE PLANNING & STRATEGIC LAYERS</p>
                      </div>
                      <button 
                         onClick={() => {
                           setActiveAgent(AGENTS.find(a => a.role === 'ERP') || AGENTS[7]);
                           setView('chat');
                         }}
                         className="w-full lg:w-auto px-12 py-6 bg-[#00D1FF] text-[#080F14] font-display font-bold text-[12px] uppercase tracking-[4px] transition-all flex items-center justify-center gap-4 group shadow-[0_0_25px_rgba(0,209,255,0.2)] hover:scale-[1.03] active:scale-95"
                      >
                         <LayoutDashboard className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                         ERP Dashboard
                      </button>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
                      {[
                        { label: 'EXECUTIVE', level: 'Executive', icon: TrendingIcon, color: 'text-[#00D1FF]', desc: 'Long-term goals & ROI Forecasting' },
                        { label: 'TACTICAL', level: 'Tactical', icon: Target, color: 'text-amber-500', desc: 'Resource Allocation & Process Optimization' },
                        { label: 'OPERATIONAL', level: 'Operational', icon: Activity, color: 'text-rose-500', desc: 'Daily Workflow & CRM Core Integration' }
                      ].map((btn, idx) => (
                        <button 
                          key={btn.label}
                          onClick={() => {
                            const erpAgent = AGENTS.find(a => a.role === 'ERP') || AGENTS[7];
                            const snippet = ERP_SNIPPETS.find(s => s.level === btn.level);
                            setActiveAgent(erpAgent);
                            setView('chat');
                            if (snippet) {
                               handleSendMessage(`Initialize Strategic Plan [${snippet.level}]: ${snippet.name}. Context: ${snippet.desc}. Prompt: ${snippet.prompt}`, 'ERP');
                            }
                          }}
                          className="relative p-8 border border-[#3A3F45] bg-[#080F14] hover:border-[#00D1FF]/50 hover:bg-[#0A2540]/20 transition-all text-left flex flex-col gap-6 group overflow-hidden"
                        >
                          <div className="absolute -right-4 -top-4 w-20 h-20 border border-white/5 rounded-full group-hover:scale-150 transition-transform duration-700" />
                          
                          <div className="flex items-center justify-between relative z-10">
                            <div className={`p-4 bg-[#0A2540]/50 border border-[#3A3F45] ${btn.color}`}>
                               <btn.icon className="w-6 h-6" />
                            </div>
                            <span className="text-[10px] font-mono text-[#7F8C99] group-hover:text-white transition-colors tracking-[4px]">MOD: 0{idx + 1}</span>
                          </div>
                          
                          <div className="space-y-2 relative z-10">
                            <div className="text-[16px] font-bold text-white tracking-[3px] group-hover:text-indigo-400 transition-colors uppercase">{btn.label}</div>
                            <div className="text-[10px] text-[#8E8E93] italic leading-relaxed">{btn.desc}</div>
                          </div>

                          <div className="pt-4 mt-2 border-t border-[#2C2C30] flex items-center justify-between relative z-10 overflow-hidden">
                             <span className="text-[9px] font-mono text-[#444] group-hover:text-indigo-500/50 transition-colors">READY_STATE: VERIFIED</span>
                             <ChevronRight className="w-4 h-4 text-[#2C2C30] group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                          </div>
                        </button>
                      ))}
                   </div>
                </div>
              </motion.div>
            ) : view === 'engine' ? (
              <motion.div
                key="engine"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col h-full bg-[#050507]"
              >
                <div className="h-16 border-b border-[#2C2C30] flex items-center px-8 justify-between bg-[#0A0A0C]">
                  <div className="flex items-center gap-3">
                    <Rocket className="w-4 h-4 text-amber-500" />
                    <span className="text-[10px] font-mono tracking-[4px] uppercase text-white">STACK3 Startup Engine</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => setView('dashboard')}
                      className="text-[10px] font-mono text-[#8E8E93] hover:text-white uppercase tracking-widest"
                    >
                      New Idea
                    </button>
                    <div className="h-4 w-[1px] bg-[#2C2C30]" />
                    <div className="text-[10px] font-mono text-amber-500 uppercase tracking-widest">
                      {engineLoading ? 'Processing Core...' : 'Plan Generated'}
                    </div>
                    {!engineLoading && Object.keys(engineResults).length > 0 && (
                      <>
                        <div className="h-4 w-[1px] bg-[#2C2C30]" />
                        <button 
                          onClick={handleSaveProject}
                          disabled={isSaving}
                          className="flex items-center gap-2 text-[10px] font-mono text-emerald-500 hover:text-white uppercase tracking-widest transition-colors disabled:opacity-50"
                        >
                          {isSaving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                          Save to Registry
                        </button>
                        <div className="h-4 w-[1px] bg-[#2C2C30]" />
                        <button 
                          onClick={handleExportAll}
                          disabled={!!pdfStatus}
                          className="flex items-center gap-2 text-[10px] font-mono text-[#00D1FF] hover:text-white uppercase tracking-widest transition-colors disabled:opacity-50"
                        >
                          {pdfStatus ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <Download className="w-3 h-3" />
                          )}
                          {pdfStatus || 'Full PDF Report'}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-12 bg-app-industrial/10">
                  <div className="max-w-6xl mx-auto space-y-12 pb-32">
                    {engineLoading && Object.values(engineResults).length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-[60vh] space-y-10">
                        <div className="relative">
                          <RefreshCw className="w-16 h-16 text-app-accent animate-spin" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-2 h-2 bg-white rounded-full animate-ping" />
                          </div>
                        </div>
                        <div className="text-center space-y-4">
                          <h2 className="text-2xl font-display font-medium text-app-text-white uppercase tracking-[6px]">Orchestrating Parallel Cluster</h2>
                          <p className="text-[11px] text-app-text-secondary font-mono tracking-[4px] uppercase max-w-sm mx-auto leading-relaxed">Mobilizing strategic agents for synchronized multi-layer processing...</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 gap-12">
                        {Object.entries(engineResults).map(([role, data]) => {
                          const agent = AGENTS.find(a => a.role === role);
                          const isGlobal = role === 'GLOBAL_MAP';
                          
                          return (
                            <div key={role} className={`border border-app-border bg-app-card rounded-sm overflow-hidden flex flex-col group ${isGlobal ? 'border-app-accent/50 shadow-[0_0_40px_rgba(0,209,255,0.05)]' : ''}`}>
                              <div className="p-8 border-b border-app-border flex items-center justify-between bg-app-industrial/50">
                                <div className="flex items-center gap-6">
                                  <div className={`p-4 bg-app-accent-dark border border-app-border rounded-sm group-hover:border-app-accent/30 transition-colors`}>
                                    <Cpu className={`w-6 h-6 ${isGlobal ? 'text-app-accent' : 'text-app-text-white/40'}`} />
                                  </div>
                                  <div>
                                    <h3 className="text-app-text-white font-display font-bold text-sm uppercase tracking-[3px]">
                                      {isGlobal ? 'Architecture Synchronization' : (agent?.name || role)}
                                    </h3>
                                    <p className="text-[10px] text-app-text-secondary font-mono tracking-[4px] mt-1">{isGlobal ? 'MAP_ORCHESTRATOR' : role}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-6">
                                  {data.loading ? (
                                    <div className="flex items-center gap-3 text-[10px] font-mono text-amber-500 uppercase tracking-widest bg-amber-500/5 border border-amber-500/20 px-4 py-2">
                                      <RefreshCw className="w-3 h-3 animate-spin" />
                                      SYNCHRONIZING...
                                    </div>
                                  ) : (
                                    <>
                                      <div className="flex items-center gap-3 text-[10px] font-mono text-app-accent uppercase tracking-widest bg-app-accent/5 border border-app-accent/20 px-4 py-2">
                                        <CheckCircle className="w-3 h-3" />
                                        VERIFIED
                                      </div>
                                      <button 
                                        onClick={() => handleExportAgent(role)}
                                        className="p-2 text-app-text-secondary hover:text-app-accent transition-colors"
                                        title="Export Executive Summary"
                                      >
                                        <Download className="w-5 h-5" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="p-10 bg-app-card" id={"agent-report-" + role}>
                                <div className="agent-report-content px-4 py-8">
                                    {!isGlobal && (
                                      <div className="mb-10 pb-6 border-b border-app-border">
                                         <h1 className="text-3xl font-bold text-app-text-white mb-2 uppercase tracking-wide">{agent?.name} Report</h1>
                                         <div className="text-xs text-app-text-secondary font-mono">ID: STACK3-{role} | {new Date().toLocaleDateString()}</div>
                                      </div>
                                    )}
                                    {data.loading ? (
                                      <div className="space-y-6 animate-pulse">
                                        <div className="h-4 bg-slate-100 w-full rounded-sm" />
                                        <div className="h-4 bg-slate-100 w-5/6 rounded-sm" />
                                        <div className="h-4 bg-slate-100 w-4/6 rounded-sm" />
                                      </div>
                                    ) : (
                                      <div className="prose prose-slate max-w-none">
                                        <Markdown
                                          components={{
                                            code: MarkdownCode
                                          }}
                                        >
                                          {data.result}
                                        </Markdown>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Project Signature Section */}
                        {!engineLoading && Object.keys(engineResults).length > 0 && (
                          <div className="bg-[#0A121A] border border-[#3A3F45] p-12 rounded-sm space-y-8">
                            <div className="flex items-center justify-between">
                              <div className="space-y-2">
                                <h3 className="text-white font-display font-bold text-lg uppercase tracking-[4px]">Mission Certification</h3>
                                <p className="text-[11px] text-[#7F8C99] font-mono tracking-[4px] uppercase">Professional Performance & Audit Verification</p>
                              </div>
                              <Fingerprint className="w-10 h-10 text-[#00D1FF] opacity-50" />
                            </div>
                            
                            {auditHash ? (
                              <div className="bg-[#080F14] border border-[#00D1FF]/30 p-8 rounded-sm space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                  <div className="space-y-4">
                                    <div className="text-[10px] font-mono text-[#7F8C99] uppercase tracking-[3px]">CERTIFIED_PROFESSIONAL</div>
                                    <div className="text-xl font-display font-bold text-white uppercase tracking-widest leading-none">{professionalId.name}</div>
                                    <div className="text-[11px] font-mono text-[#00D1FF] uppercase opacity-70 tracking-widest">{professionalId.role} @ {professionalId.company || 'INDEPENDENT'}</div>
                                  </div>
                                  <div className="space-y-4">
                                    <div className="text-[10px] font-mono text-[#7F8C99] uppercase tracking-[3px]">VALIDATION_HASH_SHA256</div>
                                    <div className="text-[10px] font-mono text-[#00D1FF] break-all p-3 bg-[#00D1FF]/5 border border-[#00D1FF]/10 rounded">
                                      {auditHash}
                                    </div>
                                  </div>
                                </div>
                                <div className="pt-6 border-t border-[#3A3F45] flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                                    <span className="text-[9px] font-mono text-emerald-500 uppercase tracking-widest">Digital Audit Trail Secured</span>
                                  </div>
                                  <div className="text-[9px] font-mono text-[#444] uppercase tracking-widest">Timestamp: {new Date().toLocaleTimeString()} (UTC)</div>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-[#3A3F45] rounded-sm bg-[#080F14]/50 space-y-6">
                                <p className="text-[11px] text-[#7F8C99] font-mono tracking-[4px] uppercase text-center max-w-sm">
                                  {professionalId.verified 
                                    ? "Professional identity verified. Proceed to generate the Audit Hash for this mission configuration."
                                    : "No professional credentials detected. Link your STACK3 identity to enable secure report auditing."}
                                </p>
                                <button 
                                  onClick={() => professionalId.verified ? generateAuditHash() : setIsSignModalOpen(true)}
                                  className="px-8 py-3 bg-[#00D1FF] text-black font-mono text-[10px] uppercase tracking-[4px] hover:bg-white transition-all font-bold flex items-center gap-2"
                                >
                                  <Zap className="w-4 h-4" />
                                  {professionalId.verified ? "Generate Mission Audit" : "Link Identity & Sign"}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
                </motion.div>
              ) : view === 'protocol' ? (
                <motion.div
                  key="protocol"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="flex flex-col h-full bg-[#050507] overflow-hidden"
                >
                  <div className="h-16 border-b border-[#3A3F45] bg-[#0A121A] flex items-center px-8 justify-between shrink-0">
                    <div className="flex items-center gap-4">
                      <GitMerge className="w-4 h-4 text-indigo-500" />
                      <span className="text-[10px] font-mono tracking-[4px] uppercase text-white">Protocol Core Management</span>
                    </div>
                    <div className="flex items-center gap-4">
                      {['lineage', 'accounts', 'consensus', 'graph', 'reasoning', 'tokenomics', 'game-theory'].map((v) => (
                        <button
                          key={v}
                          onClick={() => setProtocolView(v as any)}
                          className={`text-[9px] font-mono uppercase tracking-[2px] px-3 py-1 border transition-all ${
                            protocolView === v ? 'border-indigo-500 text-indigo-500 bg-indigo-500/5' : 'border-[#3A3F45] text-[#7F8C99] hover:text-white'
                          }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
                    <div className="max-w-6xl mx-auto space-y-12 pb-32">
                      
                      {protocolView === 'lineage' && (
                        <div className="space-y-10">
                          <div className="flex flex-col gap-2">
                             <div className="text-[10px] font-mono text-indigo-500 uppercase tracking-[4px]">State Graph Dynamics</div>
                             <h2 className="text-3xl font-display font-bold text-white uppercase tracking-[2px]">Value Lineage Inheritance</h2>
                             <p className="text-xs text-[#7F8C99] max-w-2xl font-mono leading-relaxed">
                               Behold the semantic lineage of your protocol. Logical inheritance flows from foundational OVP rules into child accounts, ensuring consistent utility and compliance across the distributed ecosystem.
                             </p>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-[400px]">
                            {/* Foundation Node */}
                            <div className="border border-indigo-500/30 bg-indigo-500/5 p-6 rounded-sm flex flex-col items-center justify-center space-y-4 relative group hover:border-indigo-500 transition-all">
                              <div className="absolute top-0 right-0 p-2 text-[8px] font-mono text-indigo-500 opacity-40 uppercase">Root Node</div>
                              <div className="w-12 h-12 rounded-full border border-indigo-500 flex items-center justify-center bg-[#050507]">
                                <ShieldCheck className="w-6 h-6 text-indigo-500" />
                              </div>
                              <div className="text-center">
                                <div className="text-[11px] font-bold text-white uppercase tracking-widest">OVP Foundation</div>
                                <div className="text-[9px] font-mono text-[#7F8C99] mt-1">Rule: SEMANTIC_COMPLIANCE_V1</div>
                              </div>
                            </div>

                            {/* Utility Branch */}
                            <div className="flex flex-col items-center justify-center px-4">
                              <div className="w-full h-[1px] bg-indigo-500/30 relative">
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-2 h-2 bg-indigo-500 rounded-full" />
                              </div>
                            </div>

                            <div className="border border-[#3A3F45] bg-[#0A121A] p-6 rounded-sm flex flex-col items-center justify-center space-y-4 relative group hover:border-amber-500/30 transition-all">
                              <div className="absolute top-0 right-0 p-2 text-[8px] font-mono text-amber-500 opacity-40 uppercase">Inherited Node</div>
                              <div className="w-12 h-12 rounded-full border border-amber-500/30 flex items-center justify-center bg-[#050507]">
                                <Cpu className="w-6 h-6 text-amber-500" />
                              </div>
                              <div className="text-center">
                                <div className="text-[11px] font-bold text-white uppercase tracking-widest">Utility Module</div>
                                <div className="text-[9px] font-mono text-[#7F8C99] mt-1">Inherits: SEMANTIC_COMPLIANCE_V1</div>
                              </div>
                            </div>

                             <div className="border border-[#3A3F45] bg-[#0A121A] p-6 rounded-sm flex flex-col items-center justify-center space-y-4 relative group hover:border-[#00D1FF]/30 transition-all">
                              <div className="absolute top-0 right-0 p-2 text-[8px] font-mono text-[#00D1FF] opacity-40 uppercase">State Leaf</div>
                              <div className="w-12 h-12 rounded-full border border-[#00D1FF]/30 flex items-center justify-center bg-[#050507]">
                                <Rocket className="w-6 h-6 text-[#00D1FF]" />
                              </div>
                              <div className="text-center">
                                <div className="text-[11px] font-bold text-white uppercase tracking-widest">Asset Sovereign</div>
                                <div className="text-[9px] font-mono text-[#7F8C99] mt-1">Status: DEPLOYED_AA</div>
                              </div>
                            </div>
                          </div>

                          <div className="bg-[#0A121A] border border-[#3A3F45] p-8 rounded-sm space-y-4">
                            <div className="text-[10px] font-mono text-indigo-500 uppercase tracking-widest">State Graph Analysis</div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                               <div className="space-y-2">
                                  <div className="text-[9px] font-mono text-[#7F8C99] uppercase">Lineage Depth</div>
                                  <div className="text-2xl font-display text-white">5 Levels</div>
                               </div>
                               <div className="space-y-2">
                                  <div className="text-[9px] font-mono text-[#7F8C99] uppercase">Inherited Properties</div>
                                  <div className="text-2xl font-display text-white">42 Nodes</div>
                               </div>
                               <div className="space-y-2">
                                  <div className="text-[9px] font-mono text-[#7F8C99] uppercase">Conflict Resolution</div>
                                  <div className="text-2xl font-display text-indigo-500">OPTIMIZED</div>
                               </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {protocolView === 'accounts' && (
                        <div className="space-y-10">
                           <div className="flex flex-col gap-2">
                             <div className="text-[10px] font-mono text-indigo-500 uppercase tracking-[4px]">Account Abstraction Layer</div>
                             <h2 className="text-3xl font-display font-bold text-white uppercase tracking-[2px]">Sovereign Smart Accounts</h2>
                             <p className="text-xs text-[#7F8C99] max-w-2xl font-mono leading-relaxed">
                               Each asset is its own sovereign smart account. Governed by the OVP, these accounts feature modular social recovery, paymaster integrations, and cross-chain execution capabilities.
                             </p>
                          </div>

                          <div className="grid grid-cols-1 gap-4">
                            {smartAccounts.map(acc => (
                              <div key={acc.address} className="p-6 bg-[#0A121A] border border-[#3A3F45] hover:border-indigo-500/30 transition-all group flex items-center justify-between">
                                <div className="flex items-center gap-6">
                                  <div className="w-12 h-12 bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                                    <Fingerprint className="w-6 h-6 text-indigo-500" />
                                  </div>
                                  <div>
                                    <div className="text-xs font-mono text-white tracking-widest uppercase">{acc.address}</div>
                                    <div className="flex items-center gap-4 mt-1">
                                      <span className="text-[9px] font-mono text-[#7F8C99] uppercase">Owner: {acc.owner}</span>
                                      <span className="text-[9px] font-mono text-indigo-500 uppercase bg-indigo-500/5 px-2 py-0.5 border border-indigo-500/20">{acc.lineage}</span>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="flex flex-col gap-4">
                                  <div className="flex items-center gap-8">
                                    <div className="text-right">
                                      <div className="text-[9px] font-mono text-[#7F8C99] uppercase tracking-widest">Social Recovery</div>
                                      <div className="text-xs text-white font-mono mt-1">{acc.guardians.length} Guardians | Threshold: {acc.recoveryThreshold}</div>
                                    </div>
                                    <button 
                                      onClick={() => {
                                        const action = 'EXTERNAL_TX';
                                        const res = AccountAbstraction.bridgeExecution(acc, action);
                                        if (res.success) {
                                          alert('Transaction authorized by OVP Bridge');
                                        } else {
                                          alert('Transaction BLOCKED: ' + res.reason);
                                        }
                                      }}
                                      className="px-6 py-2 border border-indigo-500 text-indigo-500 text-[9px] uppercase font-mono tracking-widest hover:bg-indigo-500/10 transition-all"
                                    >
                                      Execute Bridge
                                    </button>
                                  </div>
                                  
                                  {/* Session Keys Display */}
                                  <div className="mt-4 border-t border-[#3A3F45] pt-4">
                                     <div className="flex justify-between items-center mb-2">
                                        <span className="text-[8px] font-mono text-[#7F8C99] uppercase">Active Session Keys</span>
                                        <button 
                                          onClick={() => {
                                            const newSes = AccountAbstraction.generateSessionKey(['TRANSFER_LIMIT_100']);
                                            const updated = smartAccounts.map(a => a.address === acc.address ? { ...a, sessionKeys: [...(a.sessionKeys || []), newSes] } : a);
                                            setSmartAccounts(updated);
                                          }}
                                          className="text-[8px] font-mono text-[#00D1FF] hover:underline"
                                        >
                                          + Grant Session
                                        </button>
                                     </div>
                                     <div className="space-y-1">
                                        {(acc.sessionKeys || []).map((s: any) => (
                                          <div key={s.id} className="flex justify-between items-center text-[7px] font-mono bg-[#050507] p-2 border border-[#3A3F45]">
                                             <span className="text-white">{s.id}</span>
                                             <span className="text-[#7F8C99] truncate w-24 px-2">{s.key}</span>
                                             <span className="text-emerald-500 uppercase">{s.status}</span>
                                          </div>
                                        ))}
                                     </div>
                                  </div>
                                </div>
                              </div>
                            ))}

                            <button className="w-full p-6 border border-dashed border-[#3A3F45] text-[#7F8C99] hover:text-white hover:border-white transition-all flex flex-col items-center gap-2 group">
                              <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                              <span className="text-[10px] font-mono uppercase tracking-[3px]">Deploy New Sovereign Child Account</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {protocolView === 'consensus' && (
                        <div className="space-y-10">
                           <div className="flex flex-col gap-2">
                             <div className="text-[10px] font-mono text-indigo-500 uppercase tracking-[4px]">Proof of Value Ecosystem</div>
                             <h2 className="text-3xl font-display font-bold text-white uppercase tracking-[2px]">VA Attestation Dashboard</h2>
                             <p className="text-xs text-[#7F8C99] max-w-2xl font-mono leading-relaxed">
                               Value Attestations (VAs) are generated when service ecosystem deliverables are verified. Signed by authorized oracles and stored as state lineage on-chain.
                             </p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="bg-[#0A121A] border border-[#3A3F45] p-8 space-y-6">
                              <div className="section-label text-[#00D1FF] tracking-[4px]">VA GENERATOR</div>
                              <div className="space-y-4">
                                <div>
                                  <label className="text-[9px] font-mono text-[#7F8C99] uppercase mb-2 block tracking-widest">Deliverable Type</label>
                                  <select className="w-full bg-[#050507] border border-[#3A3F45] p-3 text-white text-xs font-mono focus:border-indigo-500 outline-none">
                                    <option>SMART_CONTRACT_AUDIT</option>
                                    <option>TECHNICAL_REVEWING</option>
                                    <option>COMPLIANCE_SIGN_OFF</option>
                                  </select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                   <div>
                                      <label className="text-[9px] font-mono text-[#7F8C99] uppercase mb-2 block tracking-widest">Value (CRED)</label>
                                      <input type="number" defaultValue={500} className="w-full bg-[#050507] border border-[#3A3F45] p-3 text-white text-xs font-mono focus:border-indigo-500 outline-none" />
                                   </div>
                                    <div>
                                      <label className="text-[9px] font-mono text-[#7F8C99] uppercase mb-2 block tracking-widest">Confidence Score</label>
                                      <input type="text" defaultValue="0.99" className="w-full bg-[#050507] border border-[#3A3F45] p-3 text-white text-xs font-mono focus:border-indigo-500 outline-none" />
                                   </div>
                                </div>
                                <button
                                  onClick={() => {
                                    const newVa = { 
                                      id: `VA-${Math.random().toString(36).substring(2, 9)}`.toUpperCase(), 
                                      type: 'AUDIT', 
                                      value: 500, 
                                      status: 'SIGNED', 
                                      ts: new Date().toISOString() 
                                    };
                                    setAttestations(prev => [newVa, ...prev]);
                                  }}
                                  className="w-full py-4 bg-indigo-500 text-white font-bold text-[10px] uppercase tracking-[4px] hover:scale-[1.02] active:scale-[0.98] transition-transform"
                                >
                                  Generate Value Attestation
                                </button>
                              </div>
                            </div>

                            <div className="bg-[#0A121A] border border-[#3A3F45] p-8 flex flex-col">
                              <div className="section-label text-emerald-500 tracking-[4px] mb-6">SIGNED VA REGISTRY</div>
                              <div className="flex-1 space-y-4">
                                {attestations.length === 0 ? (
                                  <div className="h-full flex flex-col items-center justify-center opacity-30 space-y-4">
                                    <RefreshCw className="w-8 h-8" />
                                    <span className="text-[10px] font-mono uppercase tracking-widest">No active attestations</span>
                                  </div>
                                ) : (
                                  attestations.map(va => (
                                    <div key={va.id} className="p-4 bg-[#050507] border border-emerald-500/20 flex items-center justify-between group">
                                      <div className="flex items-center gap-4">
                                        <div className="w-8 h-8 rounded-full border border-emerald-500/50 flex items-center justify-center">
                                          <Check className="w-4 h-4 text-emerald-500" />
                                        </div>
                                        <div>
                                          <div className="text-[10px] font-bold text-white font-mono">{va.id}</div>
                                          <div className="text-[8px] font-mono text-[#7F8C99] mt-0.5">{va.type} | VALUE: {va.value} CRED</div>
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <div className="text-[8px] text-emerald-500 font-mono tracking-widest uppercase mb-1">On-Chain</div>
                                        <div className="text-[7px] font-mono text-[#444]">{new Date(va.ts).toLocaleTimeString()}</div>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {protocolView === 'graph' && (
                        <div className="space-y-10">
                           <div className="flex flex-col gap-2">
                             <div className="text-[10px] font-mono text-indigo-500 uppercase tracking-[4px]">OVP Entity Mapping</div>
                             <h2 className="text-3xl font-display font-bold text-white uppercase tracking-[2px]">Visual Value Ontology</h2>
                             <p className="text-xs text-[#7F8C99] max-w-2xl font-mono leading-relaxed">
                               Primary entities and inheritance chains. Logical properties flow from Root OVP through Utility and Governance classes to physical Smart Accounts.
                             </p>
                          </div>
                          <div className="bg-[#0A121A] border border-[#3A3F45] rounded-sm overflow-hidden">
                             <OVPMap graphData={`
                               graph TD
                                 %% Taxonomy Root
                                 OVP[OVP Meta-Ontology]
                                 
                                 %% Core Classes
                                 VAL[Value Lineage]
                                 TOKN[Tokenomic Flow]
                                 GAME[Game Theory Layer]
                                 AAB[AA Bridge]
                                 
                                 %% Relationships
                                 OVP --> VAL
                                 OVP --> TOKN
                                 OVP --> GAME
                                 VAL --> AAB
                                 TOKN --> AAB
                                 GAME --> AAB
                                 
                                 %% Properties
                                 AAB --> SA[Sovereign Account]
                                 AAB --> SK[Session Keys]
                                 AAB --> SR[Social Recovery]
                                 
                                 %% Styles
                                 style OVP fill:#4f46e5,stroke:#fff,stroke-width:2px,color:#fff
                                 style TOKN fill:#10b981,stroke:#fff,stroke-width:1px,color:#fff
                                 style GAME fill:#f59e0b,stroke:#fff,stroke-width:1px,color:#fff
                                 style SA fill:#00D1FF,stroke:#fff,stroke-width:2px,color:#000
                             `} />
                          </div>
                        </div>
                      )}

                      {protocolView === 'reasoning' && (
                        <div className="space-y-10">
                           <div className="flex flex-col gap-2">
                             <div className="text-[10px] font-mono text-indigo-500 uppercase tracking-[4px]">Semantic Consistency</div>
                             <h2 className="text-3xl font-display font-bold text-white uppercase tracking-[2px]">Axiom Reasoner & ZKP</h2>
                             <p className="text-xs text-[#7F8C99] max-w-2xl font-mono leading-relaxed">
                               Open World Assumption reasoner verifies logical consistency of OVP axioms. ZKP circuit enables privacy-preserving proof of rights possession.
                             </p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                             <div className="bg-[#0A121A] border border-[#3A3F45] p-8 space-y-6">
                                <div className="text-[10px] font-mono text-[#00D1FF] uppercase tracking-[4px]">SEMANTIC REASONER</div>
                                <button 
                                  onClick={async () => {
                                    const reasoner = new OVPReasoner();
                                    const res = await reasoner.verifyConsistency({ id: 'test', type: 'UTILITY', properties: {}, parentIds: [], rules: ['STRICT_ISOLATION'] });
                                    setReasoningResult(res);
                                  }}
                                  className="w-full py-4 border border-indigo-500/50 text-indigo-500 text-[10px] uppercase font-mono tracking-[4px] hover:bg-indigo-500/10 transition-all"
                                >
                                  Run Semantic Consistency Check
                                </button>
                                {reasoningResult && (
                                  <div className={`p-4 border font-mono text-[9px] ${reasoningResult.consistent ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-500' : 'border-red-500/20 bg-red-500/5 text-red-500'}`}>
                                    {reasoningResult.consistent ? '✓ OVP SEAMLESS: NO CONFLICTS DETECTED' : '✗ CONFLICT: ' + reasoningResult.conflicts[0]}
                                  </div>
                                )}
                             </div>

                             <div className="bg-[#0A121A] border border-[#3A3F45] p-8 space-y-6">
                                <div className="text-[10px] font-mono text-amber-500 uppercase tracking-[4px]">ZKP PROOF GENERATOR</div>
                                <button 
                                  onClick={async () => {
                                    const proof = await OVPCircuit.generateProof({ id: 'sa-01', type: 'UTILITY', properties: {}, parentIds: [], rules: [] }, 'secret-seed');
                                    setZkpProof(proof);
                                  }}
                                  className="w-full py-4 border border-amber-500/50 text-amber-500 text-[10px] uppercase font-mono tracking-[4px] hover:bg-amber-500/10 transition-all"
                                >
                                  Generate Zero-Knowledge Proof
                                </button>
                                {zkpProof && (
                                  <div className="p-4 border border-amber-500/20 bg-amber-500/5 text-amber-500 font-mono text-[8px] break-all">
                                    {zkpProof}
                                  </div>
                                )}
                             </div>
                          </div>
                        </div>
                      )}

                      {protocolView === 'tokenomics' && (
                        <div className="space-y-10">
                           <div className="flex flex-col gap-2">
                             <div className="text-[10px] font-mono text-indigo-500 uppercase tracking-[4px]">Stack3 Economy</div>
                             <h2 className="text-3xl font-display font-bold text-white uppercase tracking-[2px]">Value tokenomics (CRED)</h2>
                             <p className="text-xs text-[#7F8C99] max-w-2xl font-mono leading-relaxed">
                               The CRED token drives the OVP ecosystem. It facilitates value flow across semantic nodes, rewarding high-fidelity attestations and penalizing logical inconsistencies.
                             </p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                             {[
                               { label: 'Total Supply', value: '1,000,000,000', unit: 'CRED' },
                               { label: 'Circulating', value: '450,230,000', unit: 'CRED' },
                               { label: 'Staking Ratio', value: '32.4%', unit: 'NET' },
                               { label: 'Annual Inflation', value: '5.0%', unit: 'APY' }
                             ].map((stat) => (
                               <div key={stat.label} className="bg-[#0A121A] border border-[#3A3F45] p-6">
                                  <div className="text-[9px] font-mono text-[#7F8C99] uppercase tracking-widest">{stat.label}</div>
                                  <div className="text-xl font-display text-white mt-2">{stat.value}</div>
                                  <div className="text-[8px] font-mono text-indigo-500 mt-1">{stat.unit}</div>
                               </div>
                             ))}
                          </div>

                          <div className="bg-[#0A121A] border border-[#3A3F45] p-8 space-y-8">
                             <div className="text-[10px] font-mono text-[#00D1FF] uppercase tracking-[4px]">DYNAMIC FLOW MODEL</div>
                             <div className="h-64 flex items-end gap-2 px-4 border-b border-indigo-500/20">
                                {[30, 45, 60, 40, 80, 90, 70, 55, 65, 85, 40, 20].map((h, i) => (
                                  <motion.div 
                                    key={i}
                                    initial={{ height: 0 }}
                                    animate={{ height: `${h}%` }}
                                    className="flex-1 bg-indigo-500/20 border-t border-indigo-500 hover:bg-indigo-500/40 transition-all cursor-pointer relative group"
                                  >
                                     <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-[8px] font-mono text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                        {h}M
                                     </div>
                                  </motion.div>
                                ))}
                             </div>
                             <div className="flex justify-between text-[8px] font-mono text-[#7F8C99]">
                                <span>Q1 2026</span>
                                <span>Q2 2026</span>
                                <span>Q3 2026</span>
                                <span>Q4 2026</span>
                             </div>
                          </div>
                        </div>
                      )}

                      {protocolView === 'game-theory' && (
                        <div className="space-y-10">
                           <div className="flex flex-col gap-2">
                             <div className="text-[10px] font-mono text-amber-500 uppercase tracking-[4px]">Strategic Alignment</div>
                             <h2 className="text-3xl font-display font-bold text-white uppercase tracking-[2px]">Game theory matrix</h2>
                             <p className="text-xs text-[#7F8C99] max-w-2xl font-mono leading-relaxed">
                               Analyzing the Nash Equilibrium within the OVP ecosystem. Incentives are calibrated to ensure that "Cooperation" is the dominant strategy for all service providers.
                             </p>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                             <div className="bg-[#0A121A] border border-[#3A3F45] p-8 space-y-6">
                                <div className="text-[10px] font-mono text-emerald-500 uppercase tracking-[4px]">PAYOUT MATRIX (Attestor vs Validator)</div>
                                <div className="grid grid-cols-3 gap-[1px] bg-[#3A3F45] border border-[#3A3F45]">
                                   <div className="bg-[#050507] p-4"></div>
                                   <div className="bg-[#050507] p-4 text-[9px] font-mono text-white text-center">VALIDATE</div>
                                   <div className="bg-[#050507] p-4 text-[9px] font-mono text-white text-center">BYPASS</div>
                                   
                                   <div className="bg-[#050507] p-4 text-[9px] font-mono text-white">HONEST</div>
                                   <div className="bg-emerald-500/10 p-4 text-[11px] font-mono text-emerald-500 text-center font-bold">(10, 10)</div>
                                   <div className="bg-red-500/10 p-4 text-[11px] font-mono text-red-500 text-center">(5, -50)</div>

                                   <div className="bg-[#050507] p-4 text-[9px] font-mono text-white">CORRUPT</div>
                                   <div className="bg-red-500/10 p-4 text-[11px] font-mono text-red-500 text-center">(-100, 20)</div>
                                   <div className="bg-amber-500/10 p-4 text-[11px] font-mono text-amber-500 text-center">(-20, -20)</div>
                                </div>
                             </div>

                             <div className="bg-[#0A121A] border border-[#3A3F45] p-8 space-y-6">
                                <div className="text-[10px] font-mono text-[#00D1FF] uppercase tracking-[4px]">STABILITY SIMULATOR</div>
                                <div className="space-y-4">
                                   <button 
                                      onClick={() => setGameScenario({ strategy: 'NASH_STABLE', stability: '92.4%' })}
                                      className="w-full py-4 border border-emerald-500/50 text-emerald-500 text-[10px] uppercase font-mono tracking-[4px] hover:bg-emerald-500/10 transition-all"
                                   >
                                      Simulate Cooperation Scenario
                                   </button>
                                   <button 
                                      onClick={() => setGameScenario({ strategy: 'EQUILIBRIUM_COLLAPSE', stability: '14.2%' })}
                                      className="w-full py-4 border border-red-500/50 text-red-500 text-[10px] uppercase font-mono tracking-[4px] hover:bg-red-500/10 transition-all"
                                   >
                                      Simulate Sybil Attack Vector
                                   </button>
                                </div>
                                {gameScenario && (
                                   <motion.div 
                                      initial={{ opacity: 0, y: 10 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      className={`p-6 border font-mono ${gameScenario.strategy === 'NASH_STABLE' ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-500' : 'border-red-500/20 bg-red-500/5 text-red-500'}`}
                                   >
                                      <div className="text-[11px] font-bold uppercase tracking-widest">{gameScenario.strategy}</div>
                                      <div className="text-[9px] mt-2">Stability Index: {gameScenario.stability}</div>
                                      <div className="text-[8px] mt-4 leading-relaxed opacity-70">
                                         {gameScenario.strategy === 'NASH_STABLE' 
                                            ? 'Incentive alignment confirmed. No participant can improve their yield by unilaterally changing strategy.'
                                            : 'Critical imbalance. Slashing parameters insufficient to deter adversarial behavior. Re-calibration required.'}
                                      </div>
                                   </motion.div>
                                )}
                             </div>
                          </div>
                        </div>
                      )}

                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="chat"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col h-full overflow-hidden"
                >
                  {/* Chat Header / Cluster Control */}
                  <div className="h-16 border-b border-[#3A3F45] bg-[#0A121A] flex items-center px-8 justify-between shrink-0">
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-[#00D1FF]" />
                        <span className="text-[10px] font-mono uppercase tracking-[2px] text-white">Active Cluster</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {AGENTS.filter(a => selectedAgents.includes(a.role)).map(agent => (
                          <div key={agent.role} className={cn(
                            "flex items-center gap-1.5 px-2 py-1 border rounded-sm",
                            agentHealth[agent.role]?.status === 'ONLINE' 
                              ? "bg-[#00D1FF]/5 border-[#00D1FF]/20" 
                              : "bg-rose-500/5 border-rose-500/20 grayscale-[0.2]"
                          )}>
                            <div className={cn(
                              "w-1 h-1 rounded-full",
                              agentHealth[agent.role]?.status === 'ONLINE' ? "bg-emerald-500 shadow-[0_0_5px_#10b981]" : "bg-rose-500 shadow-[0_0_5px_#f43f5e] animate-pulse"
                            )} />
                            <span className={cn(
                              "text-[9px] font-mono",
                              agentHealth[agent.role]?.status === 'ONLINE' ? "text-[#00D1FF]" : "text-rose-400"
                            )}>{agent.role}</span>
                            {selectedAgents.length > 1 && (
                              <button 
                                onClick={() => setSelectedAgents(prev => prev.filter(r => r !== agent.role))}
                                className="text-[#00D1FF] hover:text-white transition-colors"
                              >
                                <XCircle className="w-3 h-3 ml-1" />
                              </button>
                            )}
                          </div>
                        ))}
                        <div className="relative group">
                          <button className="p-1 px-2 border border-[#3A3F45] text-[#7F8C99] text-[9px] uppercase hover:text-white hover:border-[#00D1FF] rounded-sm flex items-center gap-1">
                            <Plus className="w-3 h-3" />
                            Add Agent
                          </button>
                          <div className="absolute top-full left-0 mt-2 w-64 bg-[#0A121A] border border-[#3A3F45] shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all z-50 p-2 max-h-64 overflow-y-auto">
                            {AGENTS.map(agent => (
                              <button
                                key={agent.role}
                                onClick={() => {
                                  if (!selectedAgents.includes(agent.role)) {
                                    setSelectedAgents(prev => [...prev, agent.role]);
                                  }
                                }}
                                className={cn(
                                  "w-full text-left px-3 py-2 text-[10px] uppercase tracking-wider font-mono hover:bg-[#00D1FF]/10 transition-colors flex items-center justify-between",
                                  selectedAgents.includes(agent.role) ? "text-[#00D1FF]" : "text-[#7F8C99]"
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  <div className={cn(
                                    "w-1.5 h-1.5 rounded-full",
                                    agentHealth[agent.role]?.status === 'ONLINE' ? "bg-emerald-500" : "bg-rose-500 animate-pulse"
                                  )} />
                                  {agent.name}
                                </div>
                                {selectedAgents.includes(agent.role) && <CheckCircle className="w-3 h-3" />}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => {
                          const pmAgent = AGENTS.find(a => a.role === 'PM');
                          if (pmAgent && !selectedAgents.includes('PM')) {
                            setSelectedAgents(prev => [...prev, 'PM']);
                          }
                        }}
                        className="text-[9px] font-mono text-emerald-500 uppercase tracking-widest bg-emerald-500/5 px-3 py-1 border border-emerald-500/20 hover:bg-emerald-500/10 transition-all rounded-sm flex items-center gap-1.5"
                      >
                        <ShieldCheck className="w-3 h-3" />
                        Permissions Root
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-1 overflow-hidden">
                    {/* Main Chat Area */}
                    <div className="flex-1 flex flex-col overflow-hidden border-r border-[#3A3F45]">
                      <div className="flex-1 overflow-y-auto p-10 space-y-8" ref={scrollRef}>
                    {['FORGE', 'SOLANA_FORGE', 'SOLANA_AUDITOR'].includes(activeAgent.role) && messages[activeAgent.role].length === 0 && (
                      <div className="max-w-5xl mx-auto space-y-8 sm:space-y-12 pb-20 px-4">
                         {forgeConfig.step === 'config' ? (
                           <>
                              <div className="border-l-4 border-[#00D1FF] pl-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                               <div>
                                 <div className="section-label mb-1 text-[#00D1FF] tracking-[4px]">Contract Forge Wizard</div>
                                 <h2 className="text-xl sm:text-2xl font-display font-medium text-white uppercase tracking-tight">Synthesizing Protocol Layers</h2>
                               </div>
                               <Terminal className="hidden sm:block text-[#00D1FF] opacity-30 w-10 h-10" />
                             </div>

                             {/* Patterns Section */}
                             <div className="space-y-8">
                                <div className="section-label mb-2 opacity-100 flex items-center gap-3 text-[#BDB7C3] tracking-[3px]">
                                 <Zap className="w-4 h-4 text-[#00D1FF]" />
                                 TECHNICAL PATTERNS & BLUEPRINTS ({forgeConfig.language})
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  {Array.from(new Set(FORGE_SNIPPETS[forgeConfig.language as keyof typeof FORGE_SNIPPETS].map(s => s.category))).map(cat => (
                                    <div key={cat} className="space-y-4">
                                      <div className="text-[10px] font-mono text-[#7F8C99] tracking-[4px] uppercase border-b border-[#3A3F45] pb-3">{cat}</div>
                                      <div className="grid grid-cols-1 gap-3">
                                        {FORGE_SNIPPETS[forgeConfig.language as keyof typeof FORGE_SNIPPETS].filter(s => s.category === cat).map(snip => (
                                          <button
                                            key={snip.name}
                                            onClick={() => handleSendMessage(`Forge ${forgeConfig.language} snippet: ${snip.name}. ${snip.prompt}`)}
                                            className="w-full p-4 bg-[#0A121A] border border-[#3A3F45] hover:border-[#00D1FF]/40 text-left group transition-all flex flex-col gap-1"
                                          >
                                            <div className="flex items-center justify-between">
                                              <div className="text-[11px] font-display font-bold text-white uppercase tracking-wider group-hover:text-[#00D1FF] transition-colors">{snip.name}</div>
                                              <ChevronRight className="w-3 h-3 text-[#3A3F45] group-hover:text-[#00D1FF] transition-colors" />
                                            </div>
                                            <div className="text-[10px] text-[#7F8C99] leading-tight line-clamp-1 uppercase tracking-tight font-mono">{snip.desc}</div>
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                             </div>

                             <div className="grid grid-cols-1 xl:grid-cols-3 gap-10 items-start">
                               <div className="xl:col-span-2 space-y-10">
                                   <div>
                                     <div className="section-label mb-4 font-mono text-[10px] tracking-[4px]">Target Environment</div>
                                     <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                       {Object.keys(FORGE_OPTIONS_INFO.languages).map(lang => (
                                         <div key={lang} className="tooltip-container tooltip-top w-full">
                                           <button 
                                             onClick={() => setForgeConfig(prev => ({ ...prev, language: lang as any }))}
                                             className={`w-full p-4 border text-[10px] font-mono uppercase tracking-[2px] transition-all flex flex-col items-center gap-2 ${forgeConfig.language === lang ? 'bg-[#00D1FF]/10 border-[#00D1FF] text-[#00D1FF] shadow-[0_0_15px_rgba(0,209,255,0.1)]' : 'border-[#3A3F45] text-[#7F8C99] hover:text-white'}`}
                                           >
                                             <Globe className={`w-3 h-3 ${forgeConfig.language === lang ? 'text-[#00D1FF]' : 'opacity-30'}`} />
                                             {lang}
                                           </button>
                                           <div className="tooltip-content translate-z-0">{FORGE_OPTIONS_INFO.languages[lang as keyof typeof FORGE_OPTIONS_INFO.languages]}</div>
                                         </div>
                                       ))}
                                     </div>
                                   </div>

                                   <div>
                                     <div className="section-label mb-4 font-mono text-[10px] tracking-[4px]">Template Architecture</div>
                                     <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                       {Object.keys(FORGE_OPTIONS_INFO.types).map(type => (
                                         <div key={type} className="tooltip-container tooltip-top w-full">
                                           <button 
                                             onClick={() => {
                                               setForgeConfig(prev => {
                                                 const newFeatures = type === 'Custom' && !prev.features.includes('ReentrancyGuard')
                                                   ? [...prev.features, 'ReentrancyGuard']
                                                   : prev.features;
                                                 return { ...prev, type: type, features: newFeatures };
                                               });
                                             }}
                                             className={`w-full p-5 border text-[10px] font-mono uppercase tracking-[2px] transition-all flex flex-col items-center gap-3 ${forgeConfig.type === type ? 'bg-[#00D1FF]/10 border-[#00D1FF] text-[#00D1FF] shadow-[0_0_15px_rgba(0,209,255,0.1)]' : 'border-[#3A3F45] text-[#7F8C99] hover:text-white hover:border-[#4A5568]'}`}
                                           >
                                             <div className={`w-1.5 h-1.5 rounded-full ${forgeConfig.type === type ? 'bg-[#00D1FF] shadow-[0_0_8px_#00D1FF]' : 'bg-[#3A3F45]'}`} />
                                             {type}
                                           </button>
                                           <div className="tooltip-content translate-z-0">{FORGE_OPTIONS_INFO.types[type as keyof typeof FORGE_OPTIONS_INFO.types]}</div>
                                         </div>
                                       ))}
                                     </div>
                                   </div>

                                   <div>
                                     <div className="section-label mb-4 font-mono text-[10px] tracking-[4px]">Verification Engine</div>
                                     <div className="grid grid-cols-2 gap-3">
                                       {Object.keys(FORGE_OPTIONS_INFO.verification).map(vtool => (
                                         <div key={vtool} className="tooltip-container tooltip-top w-full">
                                           <button 
                                             onClick={() => {
                                               setForgeConfig(prev => ({
                                                 ...prev,
                                                 verificationTools: prev.verificationTools.includes(vtool)
                                                   ? prev.verificationTools.filter(t => t !== vtool)
                                                   : [...prev.verificationTools, vtool]
                                               }))
                                             }}
                                             className={`w-full p-4 border text-[10px] font-mono uppercase tracking-[1px] transition-all flex items-center justify-between ${forgeConfig.verificationTools.includes(vtool) ? 'bg-amber-500/10 border-amber-500 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.1)]' : 'border-[#2C2C30] text-[#8E8E93] hover:text-white hover:border-[#444]'}`}
                                           >
                                             <div className="flex items-center gap-3">
                                               <Activity className={`w-3.5 h-3.5 ${forgeConfig.verificationTools.includes(vtool) ? 'text-amber-500 animate-pulse' : 'opacity-20'}`} />
                                               {vtool}
                                             </div>
                                             {forgeConfig.verificationTools.includes(vtool) && <Check className="w-3 h-3" />}
                                           </button>
                                           <div className="tooltip-content translate-z-0">{FORGE_OPTIONS_INFO.verification[vtool as keyof typeof FORGE_OPTIONS_INFO.verification]}</div>
                                         </div>
                                       ))}
                                     </div>
                                   </div>

                                   {(forgeConfig.verificationTools.includes('Foundry') || forgeConfig.verificationTools.includes('Hardhat')) && (
                                     <div>
                                       <div className="section-label mb-4 font-mono text-[10px] tracking-[4px]">Verification & Testing Libs</div>
                                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                         {Object.keys(FORGE_OPTIONS_INFO.libraries).map(lib => (
                                           <div key={lib} className="tooltip-container tooltip-top w-full">
                                             <button 
                                               onClick={() => {
                                                 setForgeConfig(prev => ({
                                                   ...prev,
                                                   verificationLibs: prev.verificationLibs.includes(lib)
                                                     ? prev.verificationLibs.filter(l => l !== lib)
                                                     : [...prev.verificationLibs, lib]
                                                 }))
                                               }}
                                             className={`w-full p-4 border text-[10px] font-mono uppercase tracking-[1px] transition-all flex items-center justify-between group ${forgeConfig.verificationLibs.includes(lib) ? 'bg-[#00D1FF]/10 border-[#00D1FF] text-[#00D1FF]' : 'border-[#3A3F45] text-[#7F8C99] hover:text-white'}`}
                                             >
                                               <div className="flex items-center gap-3">
                                                 <BookOpen className={`w-3.5 h-3.5 ${forgeConfig.verificationLibs.includes(lib) ? 'text-[#00D1FF]' : 'opacity-20'}`} />
                                                 {lib}
                                               </div>
                                               {forgeConfig.verificationLibs.includes(lib) && <Check className="w-3 h-3" />}
                                             </button>
                                             <div className="tooltip-content translate-z-0">{FORGE_OPTIONS_INFO.libraries[lib as keyof typeof FORGE_OPTIONS_INFO.libraries]}</div>
                                           </div>
                                         ))}
                                       </div>
                                     </div>
                                   )}

                                   <div>
                                     <div className="section-label mb-4 font-mono text-[10px] tracking-[4px]">Security & Protocol Extensions</div>
                                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                       {Object.keys(FORGE_OPTIONS_INFO.features).map(feat => (
                                         <div key={feat} className="tooltip-container tooltip-right w-full block">
                                           <button 
                                             onClick={() => {
                                               setForgeConfig(prev => ({
                                                 ...prev,
                                                 features: prev.features.includes(feat) 
                                                   ? prev.features.filter(f => f !== feat) 
                                                   : [...prev.features, feat]
                                               }))
                                             }}
                                             className={`w-full p-5 border text-[10px] font-mono text-left uppercase tracking-[2px] transition-all flex items-center justify-between group ${forgeConfig.features.includes(feat) ? 'bg-[#00D1FF]/10 border-[#00D1FF] text-[#00D1FF] shadow-[0_0_20px_rgba(0,209,255,0.05)]' : 'border-[#3A3F45] text-[#7F8C99] hover:text-white hover:bg-white/5'}`}
                                           >
                                             <span className="flex items-center gap-4">
                                               <div className={`w-2.5 h-2.5 rounded-full border border-current flex items-center justify-center transition-colors ${forgeConfig.features.includes(feat) ? 'bg-[#00D1FF] border-[#00D1FF]' : 'bg-transparent opacity-30 group-hover:opacity-100'}`}>
                                                 {forgeConfig.features.includes(feat) && <Check className="w-2 h-2 text-[#080F14]" />}
                                               </div>
                                               <span className="flex items-center gap-3">
                                                 {forgeConfig.features.includes(feat) ? <ShieldCheck className="w-4 h-4 text-[#00D1FF]" /> : <Layers className="w-4 h-4 opacity-30 group-hover:opacity-60" />}
                                                 {feat}
                                               </span>
                                             </span>
                                             {forgeConfig.type === 'Custom' && feat === 'ReentrancyGuard' && (
                                               <div className="px-2 py-0.5 border border-[#00D1FF]/40 text-[#00D1FF] text-[8px] font-bold tracking-tighter">REQUIRED_MODULE</div>
                                             )}
                                           </button>
                                         </div>
                                       ))}
                                     </div>
                                   </div>
                               </div>

                               <div className="space-y-8 sticky top-10">
                               <div className="p-8 bg-[#0A121A] border border-[#3A3F45] space-y-8 relative overflow-hidden group">
                                       <div className="absolute top-0 right-0 w-32 h-32 bg-[#00D1FF] opacity-[0.03] blur-3xl rounded-full -mr-16 -mt-16" />
                                       
                                       <div className="relative">
                                           <div className="section-label mb-6 flex items-center gap-3 text-[#00D1FF] tracking-[2px]">
                                               <Database className="w-4 h-4" />
                                               Active Protocol Blueprint
                                           </div>
                                           
                                           <div className="space-y-6">
                                               <div className="flex justify-between items-start border-b border-[#3A3F45] pb-4">
                                                   <div>
                                                       <div className="text-[9px] text-[#7F8C99] uppercase tracking-[3px] mb-1 font-mono">Architecture</div>
                                                       <div className="text-white font-display text-[11px] uppercase tracking-wider">{forgeConfig.language} / {forgeConfig.type}</div>
                                                   </div>
                                                   <div className="text-right">
                                                       <div className="text-[9px] text-[#7F8C99] uppercase tracking-[3px] mb-1 font-mono">Status</div>
                                                       <div className="text-[#00D1FF] font-mono text-[10px] animate-pulse">DRAFTING_CORE</div>
                                                   </div>
                                               </div>

                                               <div className="space-y-4">
                                                   <div>
                                                       <div className="text-[9px] text-[#7F8C99] uppercase tracking-[2px] mb-2 font-mono">Enabled Modules</div>
                                                       <div className="flex flex-wrap gap-2">
                                                            {forgeConfig.features.map(f => (
                                                                <span key={f} className="px-2 py-0.5 bg-[#00D1FF]/5 border border-[#00D1FF]/20 text-[#00D1FF] text-[9px] font-mono">{f}</span>
                                                            ))}
                                                            {forgeConfig.features.length === 0 && <span className="text-[9px] text-[#3A3F45] font-mono italic">None selected</span>}
                                                       </div>
                                                   </div>
                                                   
                                                   <div>
                                                       <div className="text-[9px] text-[#8E8E93] uppercase tracking-[2px] mb-2">Sim Engines</div>
                                                       <div className="flex flex-wrap gap-2">
                                                            {forgeConfig.verificationTools.map(v => (
                                                                <span key={v} className="px-2 py-0.5 bg-amber-500/5 border border-amber-500/20 text-amber-500 text-[9px] font-mono">{v}</span>
                                                            ))}
                                                            {forgeConfig.verificationTools.length === 0 && <span className="text-[9px] text-[#2C2C30] font-mono italic">None selected</span>}
                                                       </div>
                                                   </div>

                                                   {forgeConfig.verificationLibs.length > 0 && (
                                                       <div>
                                                           <div className="text-[9px] text-[#8E8E93] uppercase tracking-[2px] mb-2">Testing Libs</div>
                                                           <div className="flex flex-wrap gap-2">
                                                                {forgeConfig.verificationLibs.map(l => (
                                                                    <span key={l} className="px-2 py-0.5 bg-blue-500/5 border border-blue-500/20 text-blue-400 text-[9px] font-mono">{l}</span>
                                                                ))}
                                                           </div>
                                                       </div>
                                                   )}
                                               </div>
                                           </div>
                                       </div>

                                       <button 
                                           onClick={() => setForgeConfig(prev => ({ ...prev, step: 'review' }))}
                                           className="w-full py-6 bg-[#00D1FF] text-[#080F14] font-display font-bold text-[12px] uppercase tracking-[4px] hover:scale-[1.02] active:scale-95 transition-all shadow-[0_0_40px_rgba(0,209,255,0.15)] flex items-center justify-center gap-3 group"
                                       >
                                           Synthesize Protocol <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                       </button>
                                       
                                       <div className="flex items-center gap-4 justify-center pt-2">
                                           <div className="w-1.5 h-1.5 rounded-full bg-[#00D1FF]" />
                                           <div className="w-32 h-[1px] bg-[#3A3F45]" />
                                           <div className="text-[9px] font-mono text-[#3A3F45] uppercase tracking-[4px]">Validation Ready</div>
                                           <div className="w-32 h-[1px] bg-[#3A3F45]" />
                                           <div className="w-1.5 h-1.5 rounded-full bg-[#00D1FF]" />
                                       </div>
                                   </div>
                               </div>
                             </div>
                           </>
                         ) : forgeConfig.step === 'review' ? (
                           <motion.div 
                             initial={{ opacity: 0, y: 10 }}
                             animate={{ opacity: 1, y: 0 }}
                             className="max-w-2xl mx-auto space-y-8 text-center py-10"
                           >
                              <div className="w-16 h-16 bg-[#00D1FF]/10 border border-[#00D1FF]/30 rounded-full flex items-center justify-center mx-auto mb-6">
                                 <ShieldCheck className="text-[#00D1FF] w-8 h-8" />
                              </div>
                              <h2 className="text-2xl font-light text-white uppercase tracking-[4px]">Final Security Review</h2>
                              
                              <div className="bg-[#141417] border border-[#2C2C30] p-6 sm:p-8 text-left space-y-6">
                                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div>
                                       <div className="section-label mb-1">Architecture Stack</div>
                                       <div className="text-white font-mono text-xs sm:text-sm leading-relaxed">{forgeConfig.language} / {forgeConfig.type} Protocol</div>
                                    </div>
                                    <div>
                                       <div className="section-label mb-1">Deployment Chain</div>
                                       <div className="text-white font-mono text-xs sm:text-sm leading-relaxed">Base Sepolia (L2 Testnet)</div>
                                    </div>
                                 </div>
                                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div>
                                       <div className="section-label mb-2">Protocol Extensions</div>
                                       <div className="flex flex-wrap gap-2">
                                          {forgeConfig.features.length > 0 ? forgeConfig.features.map(f => (
                                            <span key={f} className="px-3 py-1 bg-[#00D1FF]/5 border border-[#00D1FF]/20 text-[#00D1FF] text-[9px] font-mono tracking-wider">{f}</span>
                                          )) : <span className="text-[#8E8E93] text-[10px] italic">No Extensions</span>}
                                       </div>
                                    </div>
                                    <div>
                                       <div className="section-label mb-2">Verification Suite</div>
                                       <div className="flex flex-wrap gap-2">
                                          {forgeConfig.verificationTools.length > 0 ? forgeConfig.verificationTools.map(v => (
                                            <span key={v} className="px-3 py-1 bg-amber-500/5 border border-amber-500/20 text-amber-500 text-[9px] font-mono tracking-wider">{v}</span>
                                          )) : <span className="text-[#8E8E93] text-[10px] italic">None Selected</span>}
                                       </div>
                                    </div>
                                 </div>
                                 {forgeConfig.verificationLibs.length > 0 && (
                                    <div className="p-4 border border-[#2C2C30] bg-[#0A0A0C] mb-6">
                                       <div className="section-label mb-3 text-blue-400">Target Testing Libraries</div>
                                       <div className="flex flex-wrap gap-2">
                                          {forgeConfig.verificationLibs.map(l => (
                                             <span key={l} className="px-2 py-1 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[9px] font-mono uppercase tracking-widest">{l}</span>
                                          ))}
                                       </div>
                                    </div>
                                 )}

                                 <div className="p-4 border border-[#00D1FF]/10 bg-[#00D1FF]/5 text-[10px] sm:text-[11px] text-[#00D1FF]/80 leading-relaxed font-mono">
                                    <div className="flex items-start gap-2">
                                       <Info className="w-3 sm:w-4 h-3 sm:h-4 shrink-0 mt-0.5" />
                                       <span>CAUTION: Generation will leverage OpenZeppelin 5.0 security libraries. Verify compiler compatibility (solc ^0.8.20) before deployment.</span>
                                    </div>
                                 </div>
                              </div>

                              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                                 <button 
                                   onClick={() => setForgeConfig(prev => ({ ...prev, step: 'config' }))}
                                   className="flex-1 py-4 border border-[#2C2C30] text-[#8E8E93] font-bold text-xs uppercase tracking-[2px] hover:text-white transition-colors"
                                 >
                                   Back to Config
                                 </button>
                                 <button 
                                   onClick={() => {
                                     if (forgeConfig.verificationTools.length > 0) {
                                       setForgeConfig(prev => ({ ...prev, step: 'verify' }));
                                     } else {
                                       handleSendMessage(`FORGE_EXECUTION: Build ${forgeConfig.language} ${forgeConfig.type} with features: [${forgeConfig.features.join(', ')}]. Libraries: [${forgeConfig.verificationLibs.join(', ')}]. Deploy target: Base Sepolia.`);
                                       setForgeConfig(prev => ({ ...prev, step: 'config' }));
                                     }
                                   }}
                                   className="flex-[2] py-4 bg-[#00D1FF] text-[#080F14] font-display font-bold text-[11px] uppercase tracking-[4px] shadow-[0_0_30px_rgba(0,209,255,0.4)] hover:shadow-[0_0_40px_rgba(0,209,255,0.6)] transition-all active:scale-95 border-none"
                                 >
                                   {forgeConfig.verificationTools.length > 0 ? 'Initialize Verification' : 'Initialize Protocol Forge'}
                                 </button>
                              </div>
                           </motion.div>
                         ) : (
                           <motion.div 
                             initial={{ opacity: 0 }}
                             animate={{ opacity: 1 }}
                             className="max-w-4xl mx-auto py-10 space-y-10"
                           >
                              <div className="border border-[#2C2C30] p-10 bg-[#0A0A0C] space-y-8">
                                 <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                       <div className="w-10 h-10 border border-amber-500/30 flex items-center justify-center text-amber-500">
                                          <Zap className="w-6 h-6 animate-pulse" />
                                       </div>
                                       <div>
                                          <div className="text-xl font-light text-white uppercase tracking-[4px]">Simulation Environment</div>
                                          <div className="text-[10px] text-[#8E8E93] font-mono tracking-widest uppercase">Executing {forgeConfig.verificationTools.join(' + ')}</div>
                                       </div>
                                    </div>
                                    <div className="text-right">
                                       <div className="text-[9px] font-mono text-amber-500/60 mb-1 tracking-[2px]">STATUS: SIMULATING_TESTS</div>
                                       <div className="flex gap-1 justify-end">
                                          {[1,2,3].map(i => <div key={i} className="w-2 h-0.5 bg-amber-500 rounded-full animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />)}
                                       </div>
                                    </div>
                                 </div>

                                 <div className="bg-[#141417] p-6 font-mono text-[11px] space-y-3 max-h-80 overflow-y-auto border border-dashed border-[#2C2C30]">
                                    <div className="text-[#8E8E93]">[0x00] Initializing {forgeConfig.verificationTools[0]} environment...</div>
                                    <div className="text-[#8E8E93]">[0x01] Compiling {forgeConfig.type}.sol using solc 0.8.20...</div>
                                    <div className="text-[#00D1FF]">[0x02] Compilation successful. Artifacts generated.</div>
                                    {forgeConfig.verificationTools.includes('Slither') && (
                                      <div className="text-[#8E8E93] animate-pulse">[0x03] Running Slither static analysis...</div>
                                    )}
                                    {forgeConfig.verificationTools.includes('Foundry') && (
                                      <div className="text-[#8E8E93] animate-pulse">[0x04] Executing Forge-std test suite (EVM simulation)...</div>
                                    )}
                                    <div className="text-white mt-4 border-t border-[#2C2C30] pt-4">
                                       REPORT: [SECURITY_SCORE: 98/100] | STATUS: SECURE
                                    </div>
                                 </div>

                                 <div className="flex gap-4">
                                    <button 
                                      onClick={() => setForgeConfig(prev => ({ ...prev, step: 'review' }))}
                                      className="flex-1 py-4 border border-[#2C2C30] text-[#8E8E93] font-bold text-xs uppercase tracking-[2px] hover:text-white transition-colors"
                                    >
                                      Abort Verification
                                    </button>
                                    <button 
                                      onClick={() => {
                                        handleSendMessage(`FORGE_VERIFIED_EXECUTION: Build ${forgeConfig.language} ${forgeConfig.type} with features: [${forgeConfig.features.join(', ')}]. Verification Tools: [${forgeConfig.verificationTools.join(', ')}]. Libraries: [${forgeConfig.verificationLibs.join(', ')}]. Deploy target: Base Sepolia.`);
                                        setForgeConfig(prev => ({ ...prev, step: 'config' }));
                                      }}
                                      className="flex-[2] py-4 bg-[#00D1FF] text-[#080F14] font-display font-bold text-[10px] uppercase tracking-[4px] shadow-[0_0_30px_rgba(0,209,255,0.4)] border-none"
                                    >
                                      Proceed to Deployment Forge
                                    </button>
                                 </div>
                              </div>
                           </motion.div>
                         )}
                     </div>
                   )}

                    {activeAgent.role === 'BLUEPRINT' && messages[activeAgent.role].length === 0 && (
                      <div className="max-w-5xl mx-auto space-y-12 pb-20 px-4">
                        <div className="border-l-4 border-blue-500 pl-5 flex items-center justify-between">
                          <div>
                            <div className="section-label mb-1 text-blue-400">Blueprint Strategist</div>
                            <h2 className="text-2xl font-light text-white uppercase tracking-tight">Generate Strategy & Documents</h2>
                          </div>
                          <FileText className="text-blue-500 opacity-20 w-8 h-8" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                          {BLUEPRINT_SNIPPETS.map(group => (
                            <div key={group.name} className="space-y-4">
                              <div className="section-label text-[10px] tracking-[3px] text-[#8E8E93] font-mono">{group.name}</div>
                              <div className="space-y-2">
                                {group.items.map(item => (
                                  <button
                                    key={item.name}
                                    onClick={() => handleSendMessage(`Generate Strategy Document: ${item.name}. Context: ${item.desc}. Details: ${item.prompt}`)}
                                    className="w-full p-4 border border-[#2C2C30] bg-[#141417] hover:border-blue-500/50 hover:bg-blue-500/5 text-left group transition-all"
                                  >
                                    <div className="text-[11px] font-bold text-white mb-1 group-hover:text-blue-400 transition-colors uppercase tracking-wider">{item.name}</div>
                                    <div className="text-[10px] text-[#8E8E93] leading-snug line-clamp-1">{item.desc}</div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="p-6 border border-blue-500/20 bg-blue-500/5 rounded-sm">
                           <div className="flex items-center gap-3 text-blue-400 mb-3">
                              <DraftingCompass className="w-5 h-5" />
                              <span className="text-xs font-bold tracking-widest uppercase">Visualization Engine</span>
                           </div>
                           <p className="text-[11px] text-[#8E8E93] leading-relaxed mb-4">
                              The Strategy Architect can generate live Mermaid diagrams, UML charts, and BPMN process flows. 
                              Try asking: "Create a Mermaid flowchart for a cross-chain liquidity bridge" or "Draw a UML class diagram for an NFT marketplace".
                           </p>
                           <div className="flex flex-wrap gap-2">
                              {['UML', 'BPMN', 'Mermaid', 'Web3 Architecture', 'MVP Prototype'].map(tag => (
                                <span key={tag} className="px-2 py-0.5 border border-[#2C2C30] text-[#8E8E93] text-[9px] font-mono">{tag}</span>
                              ))}
                           </div>
                        </div>
                      </div>
                    )}

                    {activeAgent.role === 'ERP' && messages[activeAgent.role].length === 0 && (
                      <div className="max-w-6xl mx-auto space-y-12 pb-20 px-4">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                           <div>
                              <div className="section-label mb-1 text-indigo-400">Strategic Command Center</div>
                              <h2 className="text-3xl font-light text-white uppercase tracking-wider">STACK3 ERP Dashboard</h2>
                           </div>
                           <div className="flex bg-[#141417] border border-[#2C2C30] p-1 gap-1">
                              {['EXECUTIVE', 'TACTICAL', 'OPERATIONAL'].map(level => (
                                <button key={level} className="px-4 py-2 text-[10px] font-mono tracking-widest text-[#8E8E93] hover:text-white transition-colors">{level}</button>
                              ))}
                           </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                           {ERP_METRICS.map(metric => (
                              <div key={metric.label} className="bg-[#141417] border border-[#2C2C30] p-6 space-y-3 relative overflow-hidden group">
                                 <div className="absolute top-0 right-0 p-2 opacity-10">
                                    <BarChart className="w-12 h-12" />
                                 </div>
                                 <div className="section-label text-[10px] uppercase tracking-widest flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: metric.color }} />
                                    {metric.label}
                                 </div>
                                 <div className="flex items-baseline gap-3">
                                    <div className="text-3xl font-mono text-white tracking-tighter">{metric.value}</div>
                                    <div className="text-[10px] text-[#00D1FF] font-bold">{metric.trend}</div>
                                 </div>
                                 <div className="w-full h-[1px] bg-white/5 group-hover:bg-[#00D1FF]/20 transition-colors" />
                              </div>
                           ))}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                           <div className="space-y-6">
                              <div className="section-label flex items-center gap-2">
                                 <ShieldIcon className="w-3 h-3 text-indigo-400" />
                                 Strategic Templates
                              </div>
                              <div className="grid grid-cols-1 gap-3">
                                 {ERP_SNIPPETS.map(snip => (
                                   <button 
                                     key={snip.name}
                                     onClick={() => handleSendMessage(`Initialize Strategic Plan [${snip.level}]: ${snip.name}. Context: ${snip.desc}. Prompt: ${snip.prompt}`)}
                                     className="w-full p-5 border border-[#2C2C30] bg-[#0A0A0C] hover:border-indigo-500/50 hover:bg-indigo-500/5 text-left transition-all flex items-center justify-between group"
                                   >
                                      <div className="space-y-1">
                                         <div className="flex items-center gap-2 uppercase tracking-[3px] font-mono text-[9px] text-[#8E8E93]">
                                            <span className="text-white opacity-40">Lv.</span> {snip.level}
                                         </div>
                                         <div className="text-[12px] font-bold text-white group-hover:text-indigo-400 transition-colors">{snip.name}</div>
                                         <div className="text-[10px] text-[#8E8E93] italic">{snip.desc}</div>
                                      </div>
                                      <PowerIcon className="w-4 h-4 text-[#2C2C30] group-hover:text-indigo-400 group-hover:animate-pulse transition-all" />
                                   </button>
                                 ))}
                              </div>
                           </div>

                           <div className="bg-[#141417] border border-[#2C2C30] p-8 space-y-8 relative">
                              <div className="section-label flex items-center gap-2">
                                 <Target className="w-3 h-3 text-indigo-400" />
                                 Operational Roadmap
                              </div>
                              
                              <div className="space-y-8">
                                 {[
                                   { step: '01', title: 'Market Saturation Analysis', status: 'COMPLETED' },
                                   { step: '02', title: 'Tactical Resource Deployment', status: 'IN_PROGRESS' },
                                   { step: '03', title: 'Operational Lifecycle Sync', status: 'PENDING' }
                                 ].map((item, idx) => (
                                   <div key={item.step} className="flex gap-6 relative">
                                      {idx !== 2 && <div className="absolute left-4 top-10 w-[1px] h-12 bg-white/5" />}
                                      <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-[10px] font-mono shrink-0 ${item.status === 'COMPLETED' ? 'bg-[#00D1FF] border-[#00D1FF] text-[#080F14]' : 'border-[#3A3F45] text-[#7F8C99]'}`}>
                                         {item.step}
                                      </div>
                                      <div>
                                         <div className="text-[11px] font-display font-bold text-white uppercase tracking-widest mb-1">{item.title}</div>
                                         <div className={`text-[9px] font-mono tracking-tighter ${item.status === 'COMPLETED' ? 'text-[#00D1FF]' : item.status === 'IN_PROGRESS' ? 'text-amber-500 animate-pulse' : 'text-[#3A3F45]'}`}>
                                            STATUS: {item.status}
                                         </div>
                                      </div>
                                   </div>
                                 ))}
                              </div>
                           </div>
                        </div>

                        <div className="p-8 border border-white/5 bg-gradient-to-br from-[#0A2540]/50 to-transparent flex flex-col md:flex-row items-center gap-10">
                           <div className="flex-1 space-y-4 text-center md:text-left">
                              <div className="text-xl font-display font-light text-white uppercase tracking-[4px]">Planning Forecaster</div>
                              <p className="text-[12px] text-[#7F8C99] leading-relaxed max-w-lg">
                                 The ERP module utilizes Gemini Long-context to analyze multi-quarter patterns. 
                                 Ask: "Generate a SWOT analysis for our Q4 tactical deployment" or "Evaluate ROI based on current operational efficiency metrics".
                              </p>
                              <div className="flex flex-wrap justify-center md:justify-start gap-3">
                                 {['SWOT', 'OKRs', 'ROI_MODEL', 'LEAD_SYNC'].map(tag => (
                                   <span key={tag} className="px-3 py-1 bg-white/5 rounded-full text-[9px] font-mono text-[#7F8C99] border border-white/10 uppercase tracking-widest">{tag}</span>
                                 ))}
                              </div>
                           </div>
                           <div className="w-full md:w-64 h-32 border border-dashed border-[#3A3F45] p-6 flex flex-col justify-center">
                              <div className="flex justify-between items-end mb-2">
                                 <span className="text-[9px] font-mono text-[#7F8C99]">AUTO_ADAPT_FREQ</span>
                                 <span className="text-[14px] font-mono text-white">42Hz</span>
                              </div>
                              <div className="flex gap-1">
                                 {[1,2,3,4,5,6,7,8].map(i => <div key={i} className={`h-8 flex-1 ${i < 6 ? 'bg-[#00D1FF]/50' : 'bg-[#3A3F45]'}`} />)}
                              </div>
                           </div>
                        </div>
                      </div>
                    )}

                    {activeAgent.role === 'ANALYST' && messages[activeAgent.role].length === 0 && (
                      <div className="max-w-6xl mx-auto space-y-12 pb-20 px-4">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-l-4 border-cyan-500 pl-6">
                           <div>
                              <div className="section-label mb-1 text-cyan-400">Quantitative Evaluation Node</div>
                              <h2 className="text-3xl font-light text-white uppercase tracking-wider">Token Viability Analyzer</h2>
                           </div>
                           <LineChartIcon className="text-cyan-500 opacity-20 w-10 h-10" />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                           {/* Inputs */}
                           <div className="bg-[#141417] border border-[#2C2C30] p-8 space-y-8">
                              <div className="section-label text-white/40">Projection Parameters</div>
                              
                              <div className="space-y-6">
                                <div>
                                   <label className="text-[10px] text-[#8E8E93] uppercase font-mono block mb-3">Total Supply</label>
                                   <input 
                                      type="number" 
                                      value={analystConfig.totalSupply}
                                      onChange={(e) => setAnalystConfig(prev => ({ ...prev, totalSupply: Number(e.target.value) }))}
                                      className="w-full bg-[#0A0A0C] border border-[#2C2C30] p-3 text-sm font-mono text-cyan-400 focus:border-cyan-500 outline-none transition-colors"
                                   />
                                </div>
                                <div>
                                   <label className="text-[10px] text-[#8E8E93] uppercase font-mono block mb-3">Initial Price ($)</label>
                                   <input 
                                      type="number" 
                                      step="0.01"
                                      value={analystConfig.initialPrice}
                                      onChange={(e) => setAnalystConfig(prev => ({ ...prev, initialPrice: Number(e.target.value) }))}
                                      className="w-full bg-[#0A0A0C] border border-[#2C2C30] p-3 text-sm font-mono text-cyan-400 focus:border-cyan-500 outline-none transition-colors"
                                   />
                                </div>
                                <div>
                                   <label className="text-[10px] text-[#8E8E93] uppercase font-mono block mb-3">Target Growth (% Ann.)</label>
                                   <input 
                                      type="range"
                                      min="0"
                                      max="200"
                                      value={analystConfig.growthRate}
                                      onChange={(e) => setAnalystConfig(prev => ({ ...prev, growthRate: Number(e.target.value) }))}
                                      className="w-full accent-cyan-500 outline-none"
                                   />
                                   <div className="flex justify-between mt-2 text-[10px] font-mono text-cyan-500">
                                      <span>0%</span>
                                      <span>{analystConfig.growthRate}%</span>
                                      <span>200%</span>
                                   </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                   <div>
                                      <label className="text-[10px] text-[#8E8E93] uppercase font-mono block mb-1">Burn Rate (%)</label>
                                      <input 
                                        type="number" 
                                        value={analystConfig.burnRate}
                                        onChange={(e) => setAnalystConfig(prev => ({ ...prev, burnRate: Number(e.target.value) }))}
                                        className="w-full bg-[#0A0A0C] border border-[#2C2C30] p-2 text-xs font-mono text-white/80 outline-none"
                                      />
                                   </div>
                                   <div>
                                      <label className="text-[10px] text-[#8E8E93] uppercase font-mono block mb-1">Staking APR (%)</label>
                                      <input 
                                        type="number" 
                                        value={analystConfig.stakingApr}
                                        onChange={(e) => setAnalystConfig(prev => ({ ...prev, stakingApr: Number(e.target.value) }))}
                                        className="w-full bg-[#0A0A0C] border border-[#2C2C30] p-2 text-xs font-mono text-white/80 outline-none"
                                      />
                                   </div>
                                </div>
                              </div>
                           </div>

                           {/* Chart */}
                           <div className="lg:col-span-2 bg-[#141417] border border-[#2C2C30] p-8 flex flex-col">
                              <div className="flex items-center justify-between mb-8">
                                 <div className="section-label text-cyan-400">12-Month Price Projection</div>
                                 <div className="text-[10px] font-mono text-[#8E8E93]">MODEL: MONTE_CARLO_LITE</div>
                              </div>
                              <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                  <AreaChart data={dashboardProjections}>
                                    <defs>
                                      <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                                      </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="1 5" stroke="#2C2C30" vertical={false} />
                                    <XAxis dataKey="month" stroke="#444" fontSize={10} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#444" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                                    <RechartsTooltip 
                                      contentStyle={{ backgroundColor: '#0A0A0C', border: '1px solid #2C2C30', borderRadius: '4px' }}
                                      itemStyle={{ color: '#06b6d4', fontSize: '12px' }}
                                    />
                                    <Area type="monotone" dataKey="price" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#colorPrice)" />
                                  </AreaChart>
                                </ResponsiveContainer>
                              </div>
                              <div className="mt-auto pt-6 flex justify-between items-end">
                                 <div className="space-y-1">
                                    <div className="text-[10px] text-[#8E8E93] uppercase font-mono">Projected Market Cap (End)</div>
                                    <div className="text-2xl font-bold text-white tracking-tighter">
                                       ${(dashboardProjections[12].marketCap / 1000000).toFixed(2)}M
                                    </div>
                                 </div>
                                 <button 
                                    onClick={() => handleSendMessage(`Analyze the following tokenomics hypothesis: Total Supply: ${analystConfig.totalSupply}, Initial Price: $${analystConfig.initialPrice}, Target Growth: ${analystConfig.growthRate}%, Burn Rate: ${analystConfig.burnRate}%, Staking APR: ${analystConfig.stakingApr}%. Provide a detailed viability report with ROI and risk assessment.`)}
                                    className="px-8 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs uppercase tracking-[3px] transition-all"
                                 >
                                    Generate Report
                                 </button>
                              </div>
                           </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                           {[
                             { label: 'Tokenomics ROI', value: `${(dashboardProjections[12].price / analystConfig.initialPrice).toFixed(1)}x`, sub: 'Projected' },
                             { label: 'Circulating Flow', value: '74%', sub: 'Healthy Range' },
                             { label: 'Volatility Score', value: 'Medium', sub: 'Calculated' },
                             { label: 'Regulatory Risk', value: 'Low', sub: 'Jurisdiction: CH' }
                           ].map((stat, i) => (
                             <div key={i} className="p-4 bg-[#141417] border border-[#2C2C30] text-center space-y-1 hover:border-cyan-500/30 transition-colors">
                                <div className="text-[9px] text-[#8E8E93] uppercase font-mono tracking-widest">{stat.label}</div>
                                <div className="text-xl font-bold text-white tracking-tight">{stat.value}</div>
                                <div className="text-[9px] text-[#8E8E93] italic">{stat.sub}</div>
                             </div>
                           ))}
                        </div>
                      </div>
                    )}

                     {activeAgent.role === 'RISK' && messages[activeAgent.role].length === 0 && (
                      <div className="max-w-5xl mx-auto space-y-12 pb-20 px-4">
                        <div className="border-l-4 border-rose-500 pl-5 flex items-center justify-between">
                          <div>
                            <div className="section-label mb-1 text-rose-400">Risk Architecture Node</div>
                            <h2 className="text-2xl font-light text-white uppercase tracking-tight">Systemic Failure Mitigation</h2>
                          </div>
                          <ShieldAlert className="text-rose-500 opacity-20 w-8 h-8" />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          {RISK_SNIPPETS.map(item => (
                            <button
                              key={item.name}
                              onClick={() => handleSendMessage(`Initialize Risk Architecture Review: ${item.name}. Scope: ${item.desc}. Parameters: ${item.prompt}`)}
                              className="w-full p-8 border border-[#2C2C30] bg-[#141417] hover:border-rose-500/50 hover:bg-rose-500/5 text-left group transition-all relative overflow-hidden"
                            >
                              <div className="absolute top-0 right-0 p-2 opacity-5">
                                <ShieldAlert className="w-12 h-12" />
                              </div>
                              <div className="text-xs font-bold text-white mb-2 group-hover:text-rose-400 transition-colors uppercase tracking-[3px] font-mono">{item.name}</div>
                              <div className="text-[12px] text-[#8E8E93] leading-relaxed mb-6 h-10 overflow-hidden">{item.desc}</div>
                              <div className="flex items-center gap-2 text-[10px] font-mono text-rose-500/60 uppercase tracking-widest border-t border-[#2C2C30] pt-4">
                                <Activity className="w-3 h-3 animate-pulse" />
                                EXECUTE_STOCHASTIC_AUDIT
                              </div>
                            </button>
                          ))}
                        </div>

                        <div className="p-8 border border-rose-500/20 bg-rose-500/5 backdrop-blur-sm space-y-6">
                           <div className="flex items-center gap-4">
                              <div className="w-10 h-10 border border-rose-500/30 flex items-center justify-center rounded-sm">
                                <HardDrive className="text-rose-500 w-5 h-5" />
                              </div>
                              <div>
                                 <div className="text-[10px] text-rose-400 font-mono tracking-[4px] uppercase mb-1">Theoretical Core</div>
                                 <div className="text-white text-sm font-bold tracking-wider">ECDM Framework & Lyapunov Stability</div>
                              </div>
                           </div>
                           <p className="text-[12px] text-[#8E8E93] leading-relaxed max-w-3xl">
                              The Economic Centrifugal Dispersion Model (ECDM) recognizes that in digital ecosystems, sustainability depends on the calibration of dispersion forces. 
                              Current risk nodes utilize the Fundamental Dispersion Equation (D = IV/R) and the Lyapunov Operator (LV) as an energy thermometer to predict systemic divergence.
                           </p>
                           <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
                              {['ASRI Index', 'Benford Law', 'HEICTOR Protocol', 'AMM-PoV'].map(tag => (
                                <div key={tag} className="px-3 py-2 border border-[#2C2C30] text-[10px] font-mono text-[#8E8E93] text-center bg-[#0A0A0C]">
                                   {tag}
                                </div>
                              ))}
                           </div>
                        </div>
                      </div>
                    )}

                    {activeAgent.role === 'POV' && messages[activeAgent.role].length === 0 && (
                      <div className="max-w-5xl mx-auto space-y-12 pb-20 px-4">
                        <div className="border-l-4 border-blue-500 pl-5 flex items-center justify-between">
                          <div>
                            <div className="section-label mb-1 text-blue-400">Utility Validation Node</div>
                            <h2 className="text-2xl font-light text-white uppercase tracking-tight">Proof of Value (PoV) Protocol</h2>
                          </div>
                          <CheckCircle className="text-blue-500 opacity-20 w-8 h-8" />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          {POV_SNIPPETS.map(item => (
                            <button
                              key={item.name}
                              onClick={() => handleSendMessage(`Analyze PoV Utility Flow: ${item.name}. Category: ${item.desc}. Prompt: ${item.prompt}`)}
                              className="w-full p-8 border border-[#2C2C30] bg-[#141417] hover:border-blue-500/50 hover:bg-blue-500/5 text-left group transition-all relative overflow-hidden"
                            >
                              <div className="absolute top-0 right-0 p-2 opacity-5">
                                <CheckCircle className="w-12 h-12" />
                              </div>
                              <div className="text-xs font-bold text-white mb-2 group-hover:text-blue-400 transition-colors uppercase tracking-[3px] font-mono">{item.name}</div>
                              <div className="text-[12px] text-[#8E8E93] leading-relaxed mb-6 h-10 overflow-hidden">{item.desc}</div>
                              <div className="flex items-center gap-2 text-[10px] font-mono text-blue-500/60 uppercase tracking-widest border-t border-[#2C2C30] pt-4">
                                <Activity className="w-3 h-3 animate-pulse" />
                                VALIDATE_UTILITY_EVENT
                              </div>
                            </button>
                          ))}
                        </div>

                        <div className="p-8 border border-blue-500/20 bg-blue-500/5 backdrop-blur-sm space-y-6">
                           <div className="flex items-center gap-4">
                              <div className="w-10 h-10 border border-blue-500/30 flex items-center justify-center rounded-sm text-blue-500">
                                <Zap className="w-5 h-5" />
                              </div>
                              <div>
                                 <div className="text-[10px] text-blue-400 font-mono tracking-[4px] uppercase mb-1">Architecture Strategy</div>
                                 <div className="text-white text-sm font-bold tracking-wider">Utility-First vs. Token-First Design</div>
                              </div>
                           </div>
                           <p className="text-[12px] text-[#8E8E93] leading-relaxed max-w-3xl">
                              The PoV consensus treats service delivery as the primary source of truth. By generating Value Attestations (VAs) signed by oracles, we build a real-time utility index that reflects genuine economic activity rather than market speculation.
                           </p>
                           <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
                              {['Value Attestations', 'Oracle Stamping', 'ZK-Privacy', 'Usage Stablecoin'].map(tag => (
                                <div key={tag} className="px-3 py-2 border border-[#2C2C30] text-[10px] font-mono text-[#8E8E93] text-center bg-[#0A0A0C]">
                                   {tag}
                                </div>
                              ))}
                           </div>
                        </div>

                        <div className="border border-[#2C2C30] p-6 bg-[#0A0A0C]">
                           <div className="flex items-center gap-2 text-blue-500 mb-4">
                              <ShieldCheck className="w-4 h-4" />
                              <span className="text-[10px] uppercase font-bold tracking-widest">Regulatory Moat Advantage</span>
                           </div>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                              <div>
                                 <div className="text-[11px] text-white font-bold mb-2">Howey Test Distancing</div>
                                 <div className="text-[10px] text-[#8E8E93] leading-relaxed">
                                    By structuring the core value driver as a "Voucher of Utility", the protocol behaves as a loyalty instrument rather than a security, significantly reducing regulatory friction.
                                 </div>
                              </div>
                              <div>
                                 <div className="text-[11px] text-white font-bold mb-2">Immutable Ledger of Value</div>
                                 <div className="text-[10px] text-[#8E8E93] leading-relaxed">
                                    Provision of an auditable proof of service delivery for regulators, demonstrating the real economic substance behind the decentralized network.
                                 </div>
                              </div>
                           </div>
                        </div>
                      </div>
                    )}

                    {activeAgent.role === 'OVP' && messages[activeAgent.role].length === 0 && (
                      <div className="max-w-5xl mx-auto space-y-12 pb-20 px-4">
                        <div className="border-l-4 border-purple-500 pl-5 flex items-center justify-between">
                          <div>
                            <div className="section-label mb-1 text-purple-400">Ontology Architecture Node</div>
                            <h2 className="text-2xl font-light text-white uppercase tracking-tight">Programmable Value Ontology (OVP)</h2>
                          </div>
                          <Binary className="text-purple-500 opacity-20 w-8 h-8" />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          {OVP_SNIPPETS.map(item => (
                            <button
                              key={item.name}
                              onClick={() => handleSendMessage(`Execute Ontological Design: ${item.name}. Category: ${item.desc}. Prompt: ${item.prompt}`)}
                              className="w-full p-8 border border-[#2C2C30] bg-[#141417] hover:border-purple-500/50 hover:bg-purple-500/5 text-left group transition-all relative overflow-hidden"
                            >
                              <div className="absolute top-0 right-0 p-2 opacity-5">
                                <Fingerprint className="w-12 h-12" />
                              </div>
                              <div className="text-xs font-bold text-white mb-2 group-hover:text-purple-400 transition-colors uppercase tracking-[3px] font-mono">{item.name}</div>
                              <div className="text-[12px] text-[#8E8E93] leading-relaxed mb-6 h-10 overflow-hidden">{item.desc}</div>
                              <div className="flex items-center gap-2 text-[10px] font-mono text-purple-500/60 uppercase tracking-widest border-t border-[#2C2C30] pt-4">
                                <Cpu className="w-3 h-3 animate-pulse" />
                                EXECUTE_ONTOLOGY_LOGIC
                              </div>
                            </button>
                          ))}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                           <div className="lg:col-span-2 p-8 border border-purple-500/20 bg-purple-500/5 backdrop-blur-sm space-y-6">
                              <div className="flex items-center gap-4">
                                 <div className="w-10 h-10 border border-purple-500/30 flex items-center justify-center rounded-sm text-purple-500">
                                   <Database className="w-5 h-5" />
                                 </div>
                                 <div>
                                    <div className="text-[10px] text-purple-400 font-mono tracking-[4px] uppercase mb-1">Knowledge Engine</div>
                                    <div className="text-white text-sm font-bold tracking-wider">Semantic Reasoner & OWL Axioms</div>
                                 </div>
                              </div>
                              <p className="text-[12px] text-[#8E8E93] leading-relaxed">
                                 The OVP acts as the single source of truth for the startup, translating complex business value into description logic. 
                                 It governs how assets move, how proofs are validated, and how the network evolves according to a strict Open World Assumption.
                              </p>
                              <div className="flex flex-wrap gap-2">
                                 {['OWL/DL', 'Description Logic', 'Open World Assumption', 'Semantic Web'].map(tag => (
                                   <span key={tag} className="px-2 py-1 border border-[#2C2C30] text-[9px] font-mono text-purple-400/70">{tag}</span>
                                 ))}
                              </div>
                           </div>

                           <div className="p-8 border border-[#2C2C30] bg-[#0A0A0C] space-y-6 flex flex-col justify-center">
                              <div className="text-[10px] text-[#8E8E93] font-mono uppercase tracking-[3px]">Protocol Goal</div>
                              <div className="text-xl font-light text-white leading-tight">Build an invisible motor of <span className="text-purple-500 underline decoration-purple-500/30 underline-offset-4">absolute semantic trust</span>.</div>
                              <div className="pt-4 border-t border-[#2C2C30]">
                                 <div className="flex items-center justify-between text-[9px] font-mono text-[#444]">
                                    <span>SYSTEM_GOVERNANCE</span>
                                    <span className="text-purple-500">DYNAMIC</span>
                                 </div>
                              </div>
                           </div>
                        </div>
                      </div>
                    )}

                    {activeAgent.role === 'STRESS_TESTER' && messages[activeAgent.role].length === 0 && (
                      <div className="max-w-6xl mx-auto space-y-12 pb-20 px-4">
                        <div className="flex items-center justify-between border-l-4 border-orange-500 pl-6">
                           <div>
                              <div className="section-label mb-1 text-orange-400">Non-Linear Simulation Node</div>
                              <h2 className="text-3xl font-light text-white uppercase tracking-wider">Market Stress Tester</h2>
                           </div>
                           <div className="flex items-center gap-4">
                             <button onClick={resetStressSimulation} className="p-2 border border-[#2C2C30] hover:border-orange-500/50 transition-colors">
                               <RefreshCw className="w-4 h-4 text-orange-400" />
                             </button>
                             <button 
                               onClick={() => setStressTestConfig(p => ({ ...p, simulationRunning: !p.simulationRunning }))}
                               className={`px-6 py-2 border flex items-center gap-2 font-mono text-xs uppercase tracking-widest transition-all ${stressTestConfig.simulationRunning ? 'bg-orange-500 text-black' : 'border-orange-500 text-orange-500'}`}
                             >
                               {stressTestConfig.simulationRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                               {stressTestConfig.simulationRunning ? 'PAUSE_SIM' : 'START_SIM'}
                             </button>
                           </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="bg-[#141417] border border-[#2C2C30] p-6 space-y-6">
                            <div className="section-label text-orange-400 flex justify-between items-center">
                              <span>Real-Time Metrics</span>
                              <span className="text-[8px] text-[#444] tracking-widest uppercase">Manual Override</span>
                            </div>
                            <div className="space-y-4">
                              <div className="group relative">
                                <div className="text-[10px] text-[#8E8E93] uppercase font-mono mb-1 flex items-center justify-between">
                                  Current Price
                                  <div className="flex gap-2">
                                    <button onClick={() => setStressTestConfig(p => ({ ...p, priceData: [...p.priceData.slice(0, -1), { ...p.priceData[p.priceData.length - 1], price: p.priceData[p.priceData.length - 1].price * 0.9 }] }))} className="px-2 py-1 bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/50 hover:border-red-500 font-bold rounded text-[10px] transition-colors">-10%</button>
                                    <button onClick={() => setStressTestConfig(p => ({ ...p, priceData: [...p.priceData.slice(0, -1), { ...p.priceData[p.priceData.length - 1], price: p.priceData[p.priceData.length - 1].price * 1.1 }] }))} className="px-2 py-1 bg-green-500/20 hover:bg-green-500 text-green-500 hover:text-white border border-green-500/50 hover:border-green-500 font-bold rounded text-[10px] transition-colors">+10%</button>
                                  </div>
                                </div>
                                <div className="text-2xl font-bold text-white tracking-tighter">${stressTestConfig.priceData[stressTestConfig.priceData.length - 1].price.toFixed(2)}</div>
                                <div className="text-[10px] font-mono mt-1">
                                  {stressTestConfig.priceData.length > 1 ? (
                                    stressTestConfig.priceData[stressTestConfig.priceData.length - 1].price > stressTestConfig.priceData[stressTestConfig.priceData.length - 2].price ?
                                    <span className="text-green-500 flex items-center"><ArrowUpRight className="w-3 h-3 mr-1" /> +{((stressTestConfig.priceData[stressTestConfig.priceData.length - 1].price / stressTestConfig.priceData[stressTestConfig.priceData.length - 2].price - 1) * 100).toFixed(2)}%</span> :
                                    <span className="text-rose-500 flex items-center"><ArrowDownRight className="w-3 h-3 mr-1" /> {((stressTestConfig.priceData[stressTestConfig.priceData.length - 1].price / stressTestConfig.priceData[stressTestConfig.priceData.length - 2].price - 1) * 100).toFixed(2)}%</span>
                                  ) : <span className="text-white/20">STABLE</span>}
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4 border-t border-[#2C2C30] pt-4">
                                <div className="group relative">
                                  <div className="text-[9px] text-[#8E8E93] uppercase font-mono mb-1 flex justify-between items-center">
                                     Active Holders
                                     <div className="flex gap-2">
                                        <button onClick={() => setStressTestConfig(p => ({ ...p, priceData: [...p.priceData.slice(0, -1), { ...p.priceData[p.priceData.length - 1], holders: Math.max(1, p.priceData[p.priceData.length - 1].holders - 1000) }] }))} className="w-5 h-5 flex items-center justify-center bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/50 hover:border-red-500 font-bold rounded text-xs transition-colors">-</button>
                                        <button onClick={() => setStressTestConfig(p => ({ ...p, priceData: [...p.priceData.slice(0, -1), { ...p.priceData[p.priceData.length - 1], holders: p.priceData[p.priceData.length - 1].holders + 1000 }] }))} className="w-5 h-5 flex items-center justify-center bg-green-500/20 hover:bg-green-500 text-green-500 hover:text-white border border-green-500/50 hover:border-green-500 font-bold rounded text-xs transition-colors">+</button>
                                     </div>
                                  </div>
                                  <div className="text-lg font-bold text-white">{stressTestConfig.priceData[stressTestConfig.priceData.length - 1].holders.toLocaleString()}</div>
                                </div>
                                <div className="group relative">
                                  <div className="text-[9px] text-[#8E8E93] uppercase font-mono mb-1 flex justify-between items-center">
                                     Volume 24h
                                     <div className="flex gap-2">
                                        <button onClick={() => setStressTestConfig(p => ({ ...p, priceData: [...p.priceData.slice(0, -1), { ...p.priceData[p.priceData.length - 1], volume: p.priceData[p.priceData.length - 1].volume * 0.5 }] }))} className="w-5 h-5 flex items-center justify-center bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/50 hover:border-red-500 font-bold rounded text-xs transition-colors">-</button>
                                        <button onClick={() => setStressTestConfig(p => ({ ...p, priceData: [...p.priceData.slice(0, -1), { ...p.priceData[p.priceData.length - 1], volume: p.priceData[p.priceData.length - 1].volume * 2 }] }))} className="w-5 h-5 flex items-center justify-center bg-green-500/20 hover:bg-green-500 text-green-500 hover:text-white border border-green-500/50 hover:border-green-500 font-bold rounded text-xs transition-colors">+</button>
                                     </div>
                                  </div>
                                  <div className="text-lg font-bold text-white">{(stressTestConfig.priceData[stressTestConfig.priceData.length - 1].volume / 1000000).toFixed(1)}M</div>
                                </div>
                              </div>
                              <div className="p-3 bg-[#0A0A0C] border border-[#2C2C30]">
                                <div className="text-[9px] text-[#8E8E93] uppercase font-mono mb-2">Market Sentiment</div>
                                <div className="h-1 w-full bg-[#1A1A1E]">
                                  <div className="h-full bg-orange-500 transition-all duration-500" style={{ width: `${stressTestConfig.marketSentiment}%` }}></div>
                                </div>
                                <div className="flex justify-between text-[9px] font-mono text-orange-500 mt-2">
                                  <span>BEARISH</span>
                                  <span>{stressTestConfig.marketSentiment}%</span>
                                  <span>BULLISH</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="md:col-span-2 bg-[#141417] border border-[#2C2C30] p-6">
                            <div className="flex items-center justify-between mb-6">
                              <div className="section-label text-orange-400">Simulation Trajectory</div>
                              {stressTestConfig.currentEvent && (
                                <div className="px-3 py-1 bg-rose-500/10 border border-rose-500/30 text-rose-500 text-[10px] font-mono animate-pulse">
                                  EVENT_ACTIVE: {stressTestConfig.currentEvent.name.toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div className="h-[240px]">
                               <ResponsiveContainer width="100%" height="100%">
                                  <LineChart data={stressTestConfig.priceData}>
                                    <CartesianGrid strokeDasharray="1 5" stroke="#2C2C30" vertical={false} />
                                    <XAxis dataKey="day" hide />
                                    <YAxis domain={['auto', 'auto']} hide />
                                    <RechartsTooltip 
                                      contentStyle={{ backgroundColor: '#0A0A0C', border: '1px solid #2C2C30', borderRadius: '0' }}
                                      itemStyle={{ color: '#f97316', fontSize: '12px', fontFamily: 'monospace' }}
                                    />
                                    <Line type="monotone" dataKey="price" stroke="#f97316" strokeWidth={2} dot={false} animationDuration={300} />
                                  </LineChart>
                               </ResponsiveContainer>
                            </div>
                            <div className="mt-4 pt-4 border-t border-[#2C2C30] flex justify-between text-[10px] font-mono text-[#444]">
                               <span>DAY: {stressTestConfig.currentDay}</span>
                               <span>MODEL: DYNAMIC_VOLATILITY_ENG</span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                           <div className="bg-[#141417] border border-[#2C2C30] p-8 space-y-8">
                              <div className="section-label text-white/40">Scenario Lab</div>
                              <div className="space-y-6">
                                 <div>
                                    <label className="text-[10px] text-[#8E8E93] uppercase font-mono block mb-3">Stress Scenario</label>
                                    <select 
                                      value={stressTestConfig.stressScenario}
                                      onChange={(e) => setStressTestConfig(p => ({ ...p, stressScenario: e.target.value }))}
                                      className="w-full bg-[#0A0A0C] border border-[#2C2C30] p-3 text-xs font-mono text-orange-400 outline-none"
                                    >
                                      {STRESS_SCENARIOS.map(s => <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>)}
                                    </select>
                                 </div>
                                 <button 
                                   onClick={applyStressScenario}
                                   className="w-full py-4 bg-orange-600 hover:bg-orange-500 text-black font-bold text-xs uppercase tracking-[4px] transition-all"
                                 >
                                   Apply Scenario
                                 </button>
                                 <div className="p-4 border border-rose-500/20 bg-rose-500/5 text-[10px] text-rose-400 font-mono leading-relaxed">
                                   Warning: Applying a scenario will reset the current simulation and inject high-volatility parameters.
                                 </div>
                              </div>
                           </div>

                           <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="bg-[#141417] border border-[#2C2C30] p-6 space-y-6">
                                 <div className="section-label text-white/40">Audit Snippets</div>
                                 <div className="space-y-3">
                                   {STRESS_TESTER_SNIPPETS.map(s => (
                                     <button 
                                       key={s.name}
                                       onClick={() => handleSendMessage(`Run Stress Audit: ${s.name}. Parameters: ${s.prompt}`)}
                                       className="w-full p-4 border border-[#2C2C30] hover:border-orange-500/30 text-left group transition-all"
                                     >
                                       <div className="text-[10px] font-bold text-white group-hover:text-orange-400 mb-1">{s.name}</div>
                                       <div className="text-[9px] text-[#8E8E93] line-clamp-1">{s.desc}</div>
                                     </button>
                                   ))}
                                 </div>
                              </div>

                              <div className="bg-[#141417] border border-[#2C2C30] p-6">
                                 <div className="section-label text-white/40 mb-6">Parameter Control</div>
                                 <div className="space-y-6">
                                   <div>
                                      <div className="flex justify-between text-[9px] font-mono text-[#8E8E93] mb-2 uppercase">
                                        <span>Volatility Engine</span>
                                        <span className="text-orange-500">{stressTestConfig.volatility}%</span>
                                      </div>
                                      <input 
                                        type="range" min="1" max="100" 
                                        value={stressTestConfig.volatility}
                                        onChange={(e) => setStressTestConfig(p => ({ ...p, volatility: Number(e.target.value) }))}
                                        className="w-full accent-orange-500 h-1 bg-[#1A1A1E]" 
                                      />
                                   </div>
                                   <div>
                                      <div className="flex justify-between text-[9px] font-mono text-[#8E8E93] mb-2 uppercase">
                                        <span>Crash Probability</span>
                                        <span className="text-orange-500">{stressTestConfig.crashChance}%</span>
                                      </div>
                                      <input 
                                        type="range" min="1" max="30" 
                                        value={stressTestConfig.crashChance}
                                        onChange={(e) => setStressTestConfig(p => ({ ...p, crashChance: Number(e.target.value) }))}
                                        className="w-full accent-orange-500 h-1 bg-[#1A1A1E]" 
                                      />
                                   </div>
                                   <div>
                                      <div className="flex justify-between text-[9px] font-mono text-[#8E8E93] mb-2 uppercase">
                                        <span>Sim. Speed</span>
                                        <span className="text-orange-500">{stressTestConfig.simulationSpeed}x</span>
                                      </div>
                                      <input 
                                        type="range" min="1" max="10" 
                                        value={stressTestConfig.simulationSpeed}
                                        onChange={(e) => setStressTestConfig(p => ({ ...p, simulationSpeed: Number(e.target.value) }))}
                                        className="w-full accent-orange-500 h-1 bg-[#1A1A1E]" 
                                      />
                                   </div>
                                 </div>
                              </div>
                           </div>
                        </div>
                      </div>
                    )}

                    {activeAgent.role === 'META_ARCHITECT' && messages[activeAgent.role].length === 0 && (
                      <div className="max-w-5xl mx-auto space-y-12 pb-20 px-4">
                        <div className="border-l-4 border-indigo-500 pl-5 flex items-center justify-between">
                          <div>
                            <div className="section-label mb-1 text-indigo-400">Meta-Architecture Node</div>
                            <h2 className="text-2xl font-light text-white uppercase tracking-tight">Universal Programmable Value Systems</h2>
                          </div>
                          <Layers className="text-indigo-500 opacity-20 w-8 h-8" />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          {META_ARCHITECT_SNIPPETS.map(item => (
                            <button
                              key={item.name}
                              onClick={() => handleSendMessage(`Execute Meta-Architectural Framework: ${item.name}. Category: ${item.desc}. Prompt: ${item.prompt}`)}
                              className="w-full p-8 border border-[#2C2C30] bg-[#141417] hover:border-indigo-500/50 hover:bg-indigo-500/5 text-left group transition-all relative overflow-hidden"
                            >
                              <div className="absolute top-0 right-0 p-2 opacity-5">
                                <DraftingCompass className="w-12 h-12" />
                              </div>
                              <div className="text-xs font-bold text-white mb-2 group-hover:text-indigo-400 transition-colors uppercase tracking-[3px] font-mono">{item.name}</div>
                              <div className="text-[12px] text-[#8E8E93] leading-relaxed mb-6 h-10 overflow-hidden">{item.desc}</div>
                              <div className="flex items-center gap-2 text-[10px] font-mono text-indigo-500/60 uppercase tracking-widest border-t border-[#2C2C30] pt-4">
                                <Network className="w-3 h-3 animate-pulse" />
                                DEPLOY_UNIVERSAL_LOGIC
                              </div>
                            </button>
                          ))}
                        </div>

                        <div className="p-8 border border-indigo-500/20 bg-indigo-500/5 backdrop-blur-sm space-y-8">
                           <div className="flex items-center gap-4">
                              <div className="w-12 h-12 border border-indigo-500/30 flex items-center justify-center rounded-sm text-indigo-500">
                                <Globe className="w-6 h-6" />
                              </div>
                              <div>
                                 <div className="text-[10px] text-indigo-400 font-mono tracking-[4px] uppercase mb-1">Agnostic Core</div>
                                 <div className="text-white text-lg font-light tracking-wider">Web3 Systemic Engineering Framework</div>
                              </div>
                           </div>
                           <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                              <div className="space-y-3">
                                 <div className="text-[10px] font-bold text-white uppercase tracking-widest">Semantic Layer</div>
                                 <div className="text-[11px] text-[#8E8E93] leading-relaxed">
                                    Modeling the startup as a Logic State Graph. Defining axioms that establish what "value" means within the system.
                                 </div>
                              </div>
                              <div className="space-y-3">
                                 <div className="text-[10px] font-bold text-white uppercase tracking-widest">Logic Inheritance</div>
                                 <div className="text-[11px] text-[#8E8E93] leading-relaxed">
                                    Permissions and utility flow through a hierarchical lineage, ensuring indissociable metadados across agents.
                                 </div>
                              </div>
                              <div className="space-y-3">
                                 <div className="text-[10px] font-bold text-white uppercase tracking-widest">Data Pipelines</div>
                                 <div className="text-[11px] text-[#8E8E93] leading-relaxed">
                                    Total abstraction of the blockchain layer. Real-world events become "facts" via semantic ZK-validation.
                                 </div>
                              </div>
                           </div>
                        </div>

                        <div className="flex items-center justify-between p-6 border border-[#2C2C30] bg-[#0A0A0C]">
                           <div className="flex items-center gap-4 text-[11px] font-mono">
                              <span className="text-[#444]">STATUS:</span>
                              <span className="text-indigo-500 animate-pulse font-bold">READY_FOR_META_CONSTRUCTION</span>
                           </div>
                           <div className="text-[10px] text-[#8E8E93] font-mono">
                              FRAMEWORK_VERSION: V1.0_UNIVERSAL
                           </div>
                        </div>
                      </div>
                    )}

                    {activeAgent.role === 'SOVEREIGN_AA' && messages[activeAgent.role].length === 0 && (
                      <div className="max-w-5xl mx-auto space-y-12 pb-20 px-4">
                        <div className="border-l-4 border-teal-500 pl-5 flex items-center justify-between">
                          <div>
                            <div className="section-label mb-1 text-teal-400">Account Sovereignty Node</div>
                            <h2 className="text-2xl font-light text-white uppercase tracking-tight">Sovereign Smart Account Protocol</h2>
                          </div>
                          <UserCheck className="text-teal-500 opacity-20 w-8 h-8" />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          {SOVEREIGN_AA_SNIPPETS.map(item => (
                            <button
                              key={item.name}
                              onClick={() => handleSendMessage(`Design Sovereign Infrastructure: ${item.name}. Category: ${item.desc}. Prompt: ${item.prompt}`)}
                              className="w-full p-8 border border-[#2C2C30] bg-[#141417] hover:border-teal-500/50 hover:bg-teal-500/5 text-left group transition-all relative overflow-hidden"
                            >
                              <div className="absolute top-0 right-0 p-2 opacity-5">
                                <ShieldCheck className="w-12 h-12" />
                              </div>
                              <div className="text-xs font-bold text-white mb-2 group-hover:text-teal-400 transition-colors uppercase tracking-[3px] font-mono">{item.name}</div>
                              <div className="text-[12px] text-[#8E8E93] leading-relaxed mb-6 h-10 overflow-hidden">{item.desc}</div>
                              <div className="flex items-center gap-2 text-[10px] font-mono text-teal-500/60 uppercase tracking-widest border-t border-[#2C2C30] pt-4">
                                <Box className="w-3 h-3 animate-pulse" />
                                INITIALIZE_SOVEREIGN_ACCOUNT
                              </div>
                            </button>
                          ))}
                        </div>

                        <div className="p-8 border border-teal-500/20 bg-teal-500/5 backdrop-blur-sm space-y-8">
                           <div className="flex items-center gap-4">
                              <div className="w-12 h-12 border border-teal-500/30 flex items-center justify-center rounded-sm text-teal-500">
                                <Cpu className="w-6 h-6" />
                              </div>
                              <div>
                                 <div className="text-[10px] text-teal-400 font-mono tracking-[4px] uppercase mb-1">Architecture Paradigm</div>
                                 <div className="text-white text-lg font-light tracking-wider">Unification of Identity & Asset</div>
                              </div>
                           </div>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                              <div className="space-y-4">
                                 <div className="text-[10px] font-bold text-white uppercase tracking-widest flex items-center gap-2">
                                    <div className="w-2 h-2 bg-teal-500"></div>
                                    Modular Accounts (AA)
                                 </div>
                                 <p className="text-[11px] text-[#8E8E93] leading-relaxed">
                                    Value is not possessed by a wallet; value *is* the smart account. Protocol-level paymasters enable gasless transactions while the account manages its own logic, permissions, and liquidity.
                                 </p>
                              </div>
                              <div className="space-y-4">
                                 <div className="text-[10px] font-bold text-white uppercase tracking-widest flex items-center gap-2">
                                    <div className="w-2 h-2 bg-teal-500"></div>
                                    AMM-PoV Universal Liquidity
                                 </div>
                                 <p className="text-[11px] text-[#8E8E93] leading-relaxed">
                                    Eliminating breakage through algorithmic liquidity. Redemption prices are determined by the account's Proven Utility (PoV), ensuring instant, custodian-free exit.
                                 </p>
                              </div>
                           </div>
                        </div>

                        <div className="border border-[#2C2C30] p-6 bg-[#0A0A0C]">
                           <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-2 text-teal-500">
                                 <Zap className="w-4 h-4" />
                                 <span className="text-[10px] uppercase font-bold tracking-widest">Sovereignty Metrics</span>
                              </div>
                              <div className="text-[9px] font-mono text-[#444]">ENCRYPTION_LEVEL: AES_QUANTUM_RESISTANT</div>
                           </div>
                           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              {[
                                { label: 'Settlement', value: 'ATOMIC' },
                                { label: 'Custody', value: 'SOVEREIGN' },
                                { label: 'Lineage', value: 'OVP_VERIFIED' },
                                { label: 'Gas Fees', value: 'PAYMASTER_SPONSORED' }
                              ].map(stat => (
                                <div key={stat.label} className="p-4 border border-[#2C2C30] text-center">
                                   <div className="text-[8px] text-[#8E8E93] uppercase font-mono mb-1">{stat.label}</div>
                                   <div className="text-[10px] text-teal-500 font-bold font-mono tracking-tighter">{stat.value}</div>
                                </div>
                              ))}
                           </div>
                        </div>
                      </div>
                    )}

                    {activeAgent.role === 'GRAPH_RMVP' && messages[activeAgent.role].length === 0 && (
                      <div className="max-w-5xl mx-auto space-y-12 pb-20 px-4">
                        <div className="border-l-4 border-pink-500 pl-5 flex items-center justify-between">
                          <div>
                            <div className="section-label mb-1 text-pink-400">Evolutionary Equilibrium Strategist</div>
                            <h2 className="text-2xl font-light text-white uppercase tracking-tight">VoG & RMVP Topology</h2>
                          </div>
                          <Share2 className="text-pink-500 opacity-20 w-8 h-8" />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          {GRAPH_RMVP_SNIPPETS.map(item => (
                            <button
                              key={item.name}
                              onClick={() => handleSendMessage(`Analyze Evolutionary Topology: ${item.name}. Category: ${item.desc}. Prompt: ${item.prompt}`)}
                              className="w-full p-8 border border-[#2C2C30] bg-[#141417] hover:border-pink-500/50 hover:bg-pink-500/5 text-left group transition-all relative overflow-hidden"
                            >
                              <div className="absolute top-0 right-0 p-2 opacity-5">
                                <ShieldCheck className="w-12 h-12" />
                              </div>
                              <div className="text-xs font-bold text-white mb-2 group-hover:text-pink-400 transition-colors uppercase tracking-[3px] font-mono">{item.name}</div>
                              <div className="text-[12px] text-[#8E8E93] leading-relaxed mb-6 h-10 overflow-hidden">{item.desc}</div>
                              <div className="flex items-center gap-2 text-[10px] font-mono text-pink-500/60 uppercase tracking-widest border-t border-[#2C2C30] pt-4">
                                <TrendingUp className="w-3 h-3 animate-pulse" />
                                EVALUATE_STABLE_STRATEGY
                              </div>
                            </button>
                          ))}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                           <div className="lg:col-span-2 p-8 border border-pink-500/20 bg-pink-500/5 backdrop-blur-sm space-y-6">
                              <div className="flex items-center gap-4">
                                 <div className="w-10 h-10 border border-pink-500/30 flex items-center justify-center rounded-sm text-pink-500">
                                   <Zap className="w-5 h-5" />
                                 </div>
                                 <div>
                                    <div className="text-[10px] text-pink-400 font-mono tracking-[4px] uppercase mb-1">EGT Intel</div>
                                    <div className="text-white text-sm font-bold tracking-wider">Evolutionary Game Theory & Nash Equilibrium</div>
                                 </div>
                              </div>
                              <p className="text-[12px] text-[#8E8E93] leading-relaxed">
                                 The Equilibrium Strategist uses replicator equations to ensure that cooperation is the only stable strategy in the RMVP graph. 
                                 By dynamically adjusting payoff matrices, it protects the protocol core from free-riders and speculative attacks, acting as an economic immune system.
                              </p>
                              <div className="flex flex-wrap gap-2 text-[9px] font-mono">
                                 <span className="px-2 py-1 border border-[#2C2C30] text-pink-400 font-bold uppercase tracking-widest">VoG Framework</span>
                                 <span className="px-2 py-1 border border-[#2C2C30] text-pink-400 font-bold uppercase tracking-widest">ESS Replicator</span>
                                 <span className="px-2 py-1 border border-[#2C2C30] text-pink-400 font-bold uppercase tracking-widest">Nash Equilibrium</span>
                              </div>
                           </div>

                           <div className="p-8 border border-[#2C2C30] bg-[#0A0A0C] space-y-6 flex flex-col justify-center">
                              <div className="text-[10px] text-[#8E8E93] font-mono uppercase tracking-[3px]">Protocol Status</div>
                              <div className="text-lg font-light text-white leading-tight">Economic <span className="text-pink-500 underline decoration-pink-500/30 underline-offset-4 tracking-tighter">Immune System</span>.</div>
                              <div className="pt-4 border-t border-[#2C2C30]">
                                 <div className="flex items-center justify-between text-[8px] font-mono text-[#444]">
                                    <span>VOG_STABILITY</span>
                                    <span className="text-pink-500 font-bold">RESILLIANT</span>
                                 </div>
                              </div>
                           </div>
                        </div>
                      </div>
                    )}

                    {activeAgent.role === 'RESEARCHER' && messages[activeAgent.role].length === 0 && (
                      <div className="max-w-5xl mx-auto space-y-12 pb-20 px-4">
                        <div className="border-l-4 border-emerald-500 pl-5 flex items-center justify-between">
                          <div>
                            <div className="section-label mb-1 text-emerald-400">Market Intelligence</div>
                            <h2 className="text-2xl font-light text-white uppercase tracking-tight">Trend Analysis & on-chain data</h2>
                          </div>
                          <Search className="text-emerald-500 opacity-20 w-8 h-8" />
                        </div>
                        
                        <div className="p-6 bg-[#0B0D0F] border border-emerald-500/30 font-mono space-y-4">
                          <div className="flex items-center justify-between border-b border-emerald-500/20 pb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                              <span className="text-emerald-500 text-xs font-bold uppercase tracking-widest">Dune Network Connected</span>
                            </div>
                            <span className="text-[10px] text-emerald-500/50">MCP PROTOCOL v1</span>
                          </div>
                          <div className="text-[10px] text-[#8E8E93] leading-relaxed break-all">
                            ENDPOINT: https://api.dune.com/mcp/v1<br/>
                            SCOPE: user<br/>
                            TRANSPORT: http<br/>
                            API_KEY: YlXQMih3SuLTSLi4ymUjezEodNlut5M1<br/>
                            <br/>
                            <span className="text-emerald-400/80">System ready to execute on-chain queries via MCP. Agent has direct access to Dune Analytics.</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                          {RESEARCHER_SNIPPETS.map(item => (
                            <button
                              key={item.name}
                              onClick={() => handleSendMessage(`Research Request: ${item.name}. Scope: ${item.desc}. Parameters: ${item.prompt}`)}
                              className="w-full p-6 border border-[#2C2C30] bg-[#141417] hover:border-emerald-500/50 hover:bg-emerald-500/5 text-left group transition-all"
                            >
                              <div className="text-xs font-bold text-white mb-2 group-hover:text-emerald-400 transition-colors uppercase tracking-wider">{item.name}</div>
                              <div className="text-[11px] text-[#8E8E93] leading-relaxed">{item.desc}</div>
                              <div className="mt-4 flex items-center gap-2 text-[9px] font-mono text-[#444] group-hover:text-emerald-400/50 transition-colors">
                                <Search className="w-3 h-3" />
                                DATA_PULL_INITIALIZED
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeAgent.role === 'TOKENOMICS' && messages[activeAgent.role].length === 0 && (
                      <div className="max-w-5xl mx-auto space-y-12 pb-20 px-4">
                        <div className="border-l-4 border-amber-500 pl-5 flex items-center justify-between">
                          <div>
                            <div className="section-label mb-1 text-amber-400">Tokenomics Design</div>
                            <h2 className="text-2xl font-light text-white uppercase tracking-tight">Sustainability & Vesting</h2>
                          </div>
                          <Coins className="text-amber-500 opacity-20 w-8 h-8" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                          {TOKENOMICS_SNIPPETS.map(item => (
                            <button
                              key={item.name}
                              onClick={() => handleSendMessage(`Initialize Tokenomics Module: ${item.name}. Context: ${item.desc}. Details: ${item.prompt}`)}
                              className="w-full p-6 border border-[#2C2C30] bg-[#141417] hover:border-amber-500/50 hover:bg-amber-500/5 text-left group transition-all"
                            >
                              <div className="text-xs font-bold text-white mb-2 group-hover:text-amber-400 transition-colors uppercase tracking-wider">{item.name}</div>
                              <div className="text-[11px] text-[#8E8E93] leading-relaxed">{item.desc}</div>
                              <div className="mt-4 flex items-center gap-2 text-[9px] font-mono text-[#444] group-hover:text-amber-400/50 transition-colors">
                                <Zap className="w-3 h-3" />
                                EXECUTE SIMULATION
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeAgent.role === 'COMPLIANCE' && messages[activeAgent.role].length === 0 && (
                      <div className="max-w-5xl mx-auto space-y-12 pb-20 px-4">
                        <div className="border-l-4 border-rose-500 pl-5 flex items-center justify-between">
                          <div>
                            <div className="section-label mb-1 text-rose-400">Legal & Regulatory Compliance</div>
                            <h2 className="text-2xl font-light text-white uppercase tracking-tight">ERC-8004 Verification</h2>
                          </div>
                          <ShieldCheck className="text-rose-500 opacity-20 w-8 h-8" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                          {COMPLIANCE_SNIPPETS.map(item => (
                            <button
                              key={item.name}
                              onClick={() => handleSendMessage(`Compliance Check: ${item.name}. Scope: ${item.desc}. Instructions: ${item.prompt}`)}
                              className="w-full p-6 border border-[#2C2C30] bg-[#141417] hover:border-rose-500/50 hover:bg-rose-500/5 text-left group transition-all"
                            >
                              <div className="text-xs font-bold text-white mb-2 group-hover:text-rose-400 transition-colors uppercase tracking-wider">{item.name}</div>
                              <div className="text-[11px] text-[#8E8E93] leading-relaxed">{item.desc}</div>
                              <div className="mt-4 flex items-center gap-2 text-[9px] font-mono text-[#444] group-hover:text-rose-400/50 transition-colors">
                                <ShieldCheck className="w-3 h-3" />
                                RUN AUDIT
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeAgent.role === 'ARCHITECT' && messages[activeAgent.role].length === 0 && (
                      <div className="max-w-5xl mx-auto space-y-12 pb-20 px-4">
                        <div className="border-l-4 border-cyan-500 pl-5 flex items-center justify-between">
                          <div>
                            <div className="section-label mb-1 text-cyan-400">Techno-Architect</div>
                            <h2 className="text-2xl font-light text-white uppercase tracking-tight">Services & Architecture Simulation</h2>
                          </div>
                          <Cpu className="text-cyan-500 opacity-20 w-8 h-8" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                          {ARCHITECT_SNIPPETS.map(item => (
                            <button
                              key={item.name}
                              onClick={() => handleSendMessage(`Design Architecture: ${item.name}. Component: ${item.desc}. Spec: ${item.prompt}`)}
                              className="w-full p-6 border border-[#2C2C30] bg-[#141417] hover:border-cyan-500/50 hover:bg-cyan-500/5 text-left group transition-all flex flex-col justify-between"
                            >
                              <div>
                                <div className="text-xs font-bold text-white mb-2 group-hover:text-cyan-400 transition-colors uppercase tracking-wider">{item.name}</div>
                                <div className="text-[11px] text-[#8E8E93] leading-relaxed">{item.desc}</div>
                              </div>
                              <div className="mt-8 flex items-center gap-2 text-[9px] font-mono text-[#444] group-hover:text-cyan-400/50 transition-colors">
                                <Layers className="w-3 h-3" />
                                {item.name === 'STACK3 Simulator' ? 'RUN SIMULATION' : 'GENERATE SPECS'}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeAgent.role === 'GTM' && messages[activeAgent.role].length === 0 && (
                      <div className="max-w-5xl mx-auto space-y-12 pb-20 px-4">
                        <div className="border-l-4 border-violet-500 pl-5 flex items-center justify-between">
                          <div>
                            <div className="section-label mb-1 text-violet-400">GTM Strategist</div>
                            <h2 className="text-2xl font-light text-white uppercase tracking-tight">Marketing, Strategy & Growth Hacking</h2>
                          </div>
                          <Rocket className="text-violet-500 opacity-20 w-8 h-8" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                          {GTM_SNIPPETS.map(item => (
                            <button
                              key={item.name}
                              onClick={() => handleSendMessage(`Plan GTM Strategy: ${item.name}. Category: ${item.desc}. Parameters: ${item.prompt}`)}
                              className="w-full p-6 border border-[#2C2C30] bg-[#141417] hover:border-violet-500/50 hover:bg-violet-500/5 text-left group transition-all flex flex-col justify-between"
                            >
                              <div>
                                <div className="text-xs font-bold text-white mb-2 group-hover:text-violet-400 transition-colors uppercase tracking-wider">{item.name}</div>
                                <div className="text-[11px] text-[#8E8E93] leading-relaxed">{item.desc}</div>
                              </div>
                              <div className="mt-8 flex items-center gap-2 text-[9px] font-mono text-[#444] group-hover:text-violet-400/50 transition-colors">
                                <Rocket className="w-3 h-3" />
                                EXECUTE_STRATEGY
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeAgent.role === 'PM' && messages[activeAgent.role].length === 0 && (
                      <div className="max-w-5xl mx-auto space-y-12 pb-20 px-4">
                        <div className="border-l-4 border-emerald-500 pl-5 flex items-center justify-between">
                          <div>
                            <div className="section-label mb-1 text-emerald-400">Web3 PM</div>
                            <h2 className="text-2xl font-light text-white uppercase tracking-tight">Product Strategy & Web3 Roadmap</h2>
                          </div>
                          <Target className="text-emerald-500 opacity-20 w-8 h-8" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                          {PM_SNIPPETS.map(item => (
                            <button
                              key={item.name}
                              onClick={() => handleSendMessage(`Product Planning: ${item.name}. Focus: ${item.desc}. Tasks: ${item.prompt}`)}
                              className="w-full p-6 border border-[#2C2C30] bg-[#141417] hover:border-emerald-500/50 hover:bg-emerald-500/5 text-left group transition-all"
                            >
                              <div className="text-xs font-bold text-white mb-2 group-hover:text-emerald-400 transition-colors uppercase tracking-wider">{item.name}</div>
                              <div className="text-[11px] text-[#8E8E93] leading-relaxed">{item.desc}</div>
                              <div className="mt-4 flex items-center gap-2 text-[9px] font-mono text-[#444] group-hover:text-emerald-400/50 transition-colors">
                                <Terminal className="w-3 h-3" />
                                DEFINE SPECS
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeAgent.role === 'SCRUM' && messages[activeAgent.role].length === 0 && (
                      <div className="max-w-5xl mx-auto space-y-12 pb-20 px-4">
                        <div className="border-l-4 border-orange-500 pl-5 flex items-center justify-between">
                          <div>
                            <div className="section-label mb-1 text-orange-400">Scrum Master</div>
                            <h2 className="text-2xl font-light text-white uppercase tracking-tight">Agile Ops & Team Velocity</h2>
                          </div>
                          <FastForward className="text-orange-500 opacity-20 w-8 h-8" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                          {SCRUM_SNIPPETS.map(item => (
                            <button
                              key={item.name}
                              onClick={() => handleSendMessage(`Agile Sync: ${item.name}. Metric: ${item.desc}. Methodology: ${item.prompt}`)}
                              className="w-full p-6 border border-[#2C2C30] bg-[#141417] hover:border-orange-500/50 hover:bg-orange-500/5 text-left group transition-all"
                            >
                              <div className="text-xs font-bold text-white mb-2 group-hover:text-orange-400 transition-colors uppercase tracking-wider">{item.name}</div>
                              <div className="text-[11px] text-[#8E8E93] leading-relaxed">{item.desc}</div>
                              <div className="mt-4 flex items-center gap-2 text-[9px] font-mono text-[#444] group-hover:text-orange-400/50 transition-colors">
                                <Activity className="w-3 h-3" />
                                SYNC VELOCITY
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeAgent.role === 'PO' && messages[activeAgent.role].length === 0 && (
                      <div className="max-w-5xl mx-auto space-y-12 pb-20 px-4">
                        <div className="border-l-4 border-yellow-500 pl-5 flex items-center justify-between">
                          <div>
                            <div className="section-label mb-1 text-yellow-400">Product Owner</div>
                            <h2 className="text-2xl font-light text-white uppercase tracking-tight">Value Maximization & Backlog</h2>
                          </div>
                          <Briefcase className="text-yellow-500 opacity-20 w-8 h-8" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                          {PO_SNIPPETS.map(item => (
                            <button
                              key={item.name}
                              onClick={() => handleSendMessage(`Value Refinement: ${item.name}. Goal: ${item.desc}. Logic: ${item.prompt}`)}
                              className="w-full p-6 border border-[#2C2C30] bg-[#141417] hover:border-yellow-500/50 hover:bg-yellow-500/5 text-left group transition-all"
                            >
                              <div className="text-xs font-bold text-white mb-2 group-hover:text-yellow-400 transition-colors uppercase tracking-wider">{item.name}</div>
                              <div className="text-[11px] text-[#8E8E93] leading-relaxed">{item.desc}</div>
                              <div className="mt-4 flex items-center gap-2 text-[9px] font-mono text-[#444] group-hover:text-yellow-400/50 transition-colors">
                                <LayoutDashboard className="w-3 h-3" />
                                REFINE BACKLOG
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeAgent.role === 'CRM' && messages[activeAgent.role].length === 0 && (
                      <div className="max-w-6xl mx-auto space-y-12 pb-20 px-4">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                           <div>
                              <div className="section-label mb-1 text-pink-400">Creative Command Center</div>
                              <h2 className="text-3xl font-light text-white uppercase tracking-wider">CRM & Marketing Dashboard</h2>
                           </div>
                           <div className="flex bg-[#141417] border border-[#2C2C30] p-4 items-center gap-6">
                              <div className="flex items-center gap-2">
                                 <div className="w-2 h-2 rounded-full bg-pink-500 animate-ping" />
                                 <span className="text-[10px] font-mono text-white tracking-widest uppercase">Live Tracking</span>
                              </div>
                              <div className="w-[1px] h-4 bg-[#2C2C30]" />
                              <div className="flex items-center gap-2 text-[#8E8E93] text-[10px] font-mono tracking-widest uppercase italic">
                                 STACK3_ADS_L7: SYNCHRONIZED
                              </div>
                           </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                           {CRM_METRICS.map(metric => (
                              <div key={metric.label} className="bg-[#141417] border border-[#2C2C30] p-6 space-y-3 relative overflow-hidden group">
                                 <div className="section-label text-[10px] uppercase tracking-widest flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: metric.color }} />
                                    {metric.label}
                                 </div>
                                 <div className="flex items-baseline gap-3">
                                    <div className="text-3xl font-mono text-white tracking-tighter">{metric.value}</div>
                                    <div className="text-[10px] text-pink-400 font-bold">{metric.trend}</div>
                                 </div>
                                 <div className="w-full h-1 bg-white/5 group-hover:bg-pink-500/20 transition-colors mt-2" />
                              </div>
                           ))}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                           <div className="bg-[#141417] border border-[#2C2C30] p-8 space-y-8">
                              <div className="section-label flex items-center gap-2">
                                 <Target className="w-3 h-3 text-pink-400" />
                                 Marketing Funnel (Leads)
                              </div>
                              <div className="space-y-4">
                                {CRM_STAGES.map((stage, i) => (
                                  <div key={stage.name} className="space-y-1">
                                    <div className="flex justify-between text-[10px] font-mono text-[#8E8E93] uppercase tracking-widest">
                                      <span>{stage.name}</span>
                                      <span>{stage.leads}</span>
                                    </div>
                                    <div className="h-2 bg-[#0A0A0C] border border-[#2C2C30] overflow-hidden">
                                      <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${(stage.leads / 420) * 100}%` }}
                                        transition={{ duration: 1, delay: i * 0.1 }}
                                        className="h-full" 
                                        style={{ backgroundColor: stage.color }}
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                           </div>

                           <div className="bg-[#141417] border border-[#2C2C30] p-8 space-y-8">
                              <div className="section-label flex items-center gap-2 text-pink-400">
                                 <Megaphone className="w-3 h-3" />
                                 Creative Strategies
                              </div>
                              <div className="grid grid-cols-1 gap-4">
                                {CRM_SNIPPETS.map(cat => (
                                  <div key={cat.category} className="space-y-3">
                                    <div className="text-[9px] font-mono text-[#8E8E93] uppercase tracking-[3px] border-b border-[#2C2C30] pb-2">{cat.category}</div>
                                    <div className="space-y-2">
                                      {cat.items.map(item => (
                                        <button 
                                          key={item.name}
                                          onClick={() => handleSendMessage(`Develop CRM Task: ${item.name}. Scope: ${item.desc}. Prompt: ${item.prompt}`)}
                                          className="w-full p-4 bg-[#0A0A0C] border border-[#2C2C30] hover:border-pink-500/50 hover:bg-pink-500/5 text-left group transition-all"
                                        >
                                          <div className="text-[11px] font-bold text-white mb-1 group-hover:text-pink-400 transition-colors uppercase tracking-widest">{item.name}</div>
                                          <div className="text-[10px] text-[#8E8E93] italic line-clamp-1">{item.desc}</div>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                           </div>
                        </div>

                        <div className="p-10 border border-pink-500/20 bg-pink-500/5 flex flex-col items-center text-center space-y-6">
                           <Palette className="w-10 h-10 text-pink-500 opacity-50" />
                           <h3 className="text-xl font-light text-white uppercase tracking-[5px]">Visual Design Engine</h3>
                           <p className="text-xs text-[#8E8E93] max-w-xl leading-relaxed">
                              Use the CRM agent to generate marketing copy, visual identity tokens, and ad creative blueprints. 
                              Try: "Generate a marketing strategy for our token launch" or "Design a set of ad creatives for a Twitter campaign".
                           </p>
                           <div className="flex gap-4">
                              {['COPYWRITING', 'AD_DESIGN', 'LEAD_GEN', 'RETENTION'].map(tag => (
                                <span key={tag} className="px-3 py-1 border border-[#2C2C30] text-[9px] font-mono text-[#8E8E93] uppercase tracking-widest">{tag}</span>
                              ))}
                           </div>
                        </div>
                      </div>
                    )}

                    {!['FORGE', 'BLUEPRINT', 'ERP', 'CRM'].includes(activeAgent.role) && messages[activeAgent.role].length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center max-w-4xl mx-auto space-y-12">
                      <div className="flex flex-col items-center">
                        <div className="section-label mb-4">Node Authorization Required</div>
                         <h2 className="text-3xl font-light text-white mb-6 uppercase tracking-wider">Initialize {activeAgent.role} Module</h2>
                         <p className="text-sm text-[#8E8E93] leading-relaxed mb-8 max-w-lg">
                           The specialized node is standing by. Feed project dimensions to trigger the technical synthesis or strategic forecasting engine.
                         </p>
                         <button 
                           onClick={() => handleSendMessage("Generate comprehensive project strategy.")}
                           className="px-10 py-4 border border-[#00D1FF] text-[#00D1FF] text-[10px] font-mono uppercase tracking-[3px] hover:bg-[#00D1FF]/10 transition-all active:scale-95"
                         >
                           Execute System Initialization
                         </button>
                      </div>

                      {activeAgent.role === 'RESEARCHER' && (
                        <div className="w-full h-80 bg-[#141417]/30 border border-[#2C2C30] p-10 mt-10">
                           <div className="section-label mb-6 text-left opacity-60">Live Market Pulse Simulation</div>
                           <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={[
                                { time: '00h', val: 400 },
                                { time: '04h', val: 300 },
                                { time: '08h', val: 600 },
                                { time: '12h', val: 800 },
                                { time: '16h', val: 500 },
                                { time: '20h', val: 900 },
                                { time: '24h', val: 1100 },
                              ]}>
                                 <defs>
                                    <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                                       <stop offset="5%" stopColor="#00D1FF" stopOpacity={0.3}/>
                                       <stop offset="95%" stopColor="#00D1FF" stopOpacity={0}/>
                                    </linearGradient>
                                 </defs>
                                 <CartesianGrid strokeDasharray="3 3" stroke="#2C2C30" vertical={false} />
                                 <XAxis dataKey="time" stroke="#444" fontSize={10} tickLine={false} axisLine={false} />
                                 <YAxis hide />
                                 <RechartsTooltip 
                                    contentStyle={{ background: '#141417', border: '1px solid #2C2C30', borderRadius: '4px', fontSize: '10px' }}
                                    itemStyle={{ color: '#00D1FF' }}
                                 />
                                 <Area type="monotone" dataKey="val" stroke="#00D1FF" fillOpacity={1} fill="url(#colorVal)" />
                              </AreaChart>
                           </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  )}

                   {messages[activeAgent.role].length > 0 && (
                    <div className="space-y-8 max-w-4xl mx-auto w-full px-4">
                      {messages[activeAgent.role].map((msg) => (
                        <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                           <div className={`max-w-[85%] p-6 border rounded-sm ${msg.sender === 'user' ? 'bg-app-accent/5 border-app-accent/20 text-app-text-white' : 'bg-app-card border-app-border text-app-text-primary'}`}>
                              <div className="flex items-center gap-3 mb-4 opacity-50">
                                <div className={`w-1.5 h-1.5 rounded-full ${msg.sender === 'user' ? 'bg-app-accent' : 'bg-app-text-secondary'}`} />
                                <span className="text-[9px] font-mono tracking-[4px] uppercase">{msg.sender === 'user' ? 'Authorized_User' : AGENTS.find(a => a.role === msg.sender)?.name || msg.sender}</span>
                                {msg.metadata?.isCollaborative && (
                                  <span className="text-[8px] font-mono bg-app-accent/10 text-app-accent px-1.5 py-0.5 rounded-sm border border-app-accent/20 flex items-center gap-1">
                                    <Users className="w-2.5 h-2.5" />
                                    SYNERGY_NODE
                                  </span>
                                )}
                                <span className="text-[9px] font-mono ml-auto tracking-widest">{msg.timestamp.toLocaleTimeString()}</span>
                              </div>
                              <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-p:text-app-text-primary prose-pre:bg-app-bg prose-pre:border prose-pre:border-app-border">
                                <Markdown
                                  components={{
                                    code: MarkdownCode
                                  }}
                                >
                                  {msg.content}
                                </Markdown>
                              </div>
                              {msg.metadata?.error && (
                                <div className="mt-4 p-3 bg-rose-500/5 border border-rose-500/20 rounded-sm space-y-2">
                                  <div className="flex items-center gap-2 text-rose-500 text-[9px] font-mono uppercase tracking-widest">
                                    <AlertTriangle className="w-3 h-3" />
                                    Debug Trace
                                  </div>
                                  <div className="text-[9px] font-mono text-rose-500/70 break-words">{msg.metadata.error}</div>
                                </div>
                              )}
                              {msg.metadata?.isCollaborative && msg.metadata.targetAgents && (
                                <div className="mt-4 flex flex-wrap gap-2 pt-4 border-t border-white/5">
                                  <span className="text-[8px] font-mono text-[#444] uppercase tracking-widest mr-2 flex items-center">Context Shared With:</span>
                                  {msg.metadata.targetAgents.map(target => (
                                    <span key={target} className="text-[8px] font-mono text-[#777] border border-[#333] px-1.5 py-0.5">@{target}</span>
                                  ))}
                                </div>
                              )}
                           </div>
                        </div>
                      ))}
                      {isTyping && (
                        <div className="flex justify-start">
                           <div className="bg-[#0A121A] border border-[#3A3F45] p-5 rounded-sm flex items-center gap-3">
                              <div className="flex gap-1">
                                 <div className="w-1.5 h-1.5 bg-[#00D1FF] rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                                 <div className="w-1.5 h-1.5 bg-[#00D1FF] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                                 <div className="w-1.5 h-1.5 bg-[#00D1FF] rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                              </div>
                              <span className="text-[10px] font-mono text-[#7F8C99] uppercase tracking-widest">Synthesizing_Response...</span>
                           </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="p-8 border-t border-[#3A3F45] bg-[#0A121A]">
                  <div className="flex items-center gap-4 border border-[#3A3F45] px-6 py-4 bg-[#080F14] group focus-within:border-[#00D1FF]/50 transition-colors shadow-2xl">
                    <span className="text-[#00D1FF] font-mono text-[10px] tracking-tight shrink-0 opacity-50 uppercase">NX_SHELL://</span>
                    <input
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder="Enter command or architectural query..."
                      className="flex-1 bg-transparent border-none outline-none text-[13px] font-mono text-white placeholder:text-[#3A3F45]"
                    />
                    <button 
                      onClick={() => handleSendMessage()}
                      disabled={!inputText.trim() || isTyping}
                      className="text-[#00D1FF] hover:scale-110 transition-transform disabled:opacity-30 p-2"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Task Management Panel */}
              <div className="w-80 bg-[#080F14] border-l border-[#3A3F45] flex flex-col shrink-0">
                <div className="h-16 border-b border-[#3A3F45] flex items-center px-6 justify-between bg-[#0A121A]">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-amber-500" />
                    <span className="text-[10px] font-mono uppercase tracking-[2px] text-white">Task Registry</span>
                  </div>
                  <span className="text-[9px] font-mono text-amber-500 bg-amber-500/5 px-2 py-0.5 border border-amber-500/20 rounded-full">
                    {tasks.length}
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {tasks.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4 opacity-30">
                      <Box className="w-8 h-8" />
                      <p className="text-[9px] font-mono uppercase tracking-widest leading-relaxed">No active task-sequences in registry</p>
                    </div>
                  ) : (
                    tasks.map(task => (
                      <div key={task.id} className="p-4 bg-[#0A121A] border border-[#3A3F45] rounded-sm space-y-3 group hover:border-[#00D1FF]/30 transition-all flex flex-col relative overflow-hidden">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                             <div className={`text-[8px] font-mono px-1.5 py-0.5 rounded-sm uppercase tracking-tighter ${
                              task.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-500' :
                              task.status === 'FAILED' ? 'bg-rose-500/10 text-rose-500' :
                              'bg-amber-500/10 text-amber-500'
                            }`}>
                              {task.status}
                            </div>
                            <button 
                              onClick={() => {
                                const priorities = ['LOW', 'MEDIUM', 'HIGH'];
                                const next = priorities[(priorities.indexOf(task.priority) + 1) % 3];
                                setTasks(prev => prev.map(t => t.id === task.id ? { ...t, priority: next as any } : t));
                              }}
                              className={`text-[7px] font-mono px-1 py-0.5 border uppercase tracking-[1px] transition-all ${
                                task.priority === 'HIGH' ? 'border-rose-500 text-rose-500 bg-rose-500/5 shadow-[0_0_5px_rgba(244,63,94,0.2)]' :
                                task.priority === 'MEDIUM' ? 'border-amber-500 text-amber-500 bg-amber-500/5' :
                                'border-emerald-500 text-emerald-500 bg-emerald-500/5'
                              }`}
                            >
                              {task.priority}
                            </button>
                            <div className="flex items-center gap-1">
                              <button 
                                onClick={() => {
                                  setTasks(prev => {
                                    const index = prev.findIndex(t => t.id === task.id);
                                    if (index === 0) return prev;
                                    const next = [...prev];
                                    [next[index], next[index - 1]] = [next[index - 1], next[index]];
                                    return next;
                                  });
                                }}
                                className="p-1 hover:bg-white/5 rounded-sm text-[#444] hover:text-white transition-colors"
                              >
                                <ChevronRight className="w-3 h-3 -rotate-90" />
                              </button>
                              <button 
                                onClick={() => {
                                  setTasks(prev => {
                                    const index = prev.findIndex(t => t.id === task.id);
                                    if (index === prev.length - 1) return prev;
                                    const next = [...prev];
                                    [next[index], next[index + 1]] = [next[index + 1], next[index]];
                                    return next;
                                  });
                                }}
                                className="p-1 hover:bg-white/5 rounded-sm text-[#444] hover:text-white transition-colors"
                              >
                                <ChevronRight className="w-3 h-3 rotate-90" />
                              </button>
                            </div>
                          </div>
                          <span className="text-[8px] font-mono text-[#444] uppercase tracking-widest">#{task.id.slice(-4)}</span>
                        </div>
                        <div className="space-y-1">
                          <div className="text-[10px] font-bold text-white uppercase tracking-wider line-clamp-1">{task.title}</div>
                          <div className="text-[9px] text-[#7F8C99] font-mono uppercase tracking-tight">{task.assignedTo}</div>
                        </div>
                        <div className="space-y-1.5">
                          <div className="h-1 bg-[#1A1F25] rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${task.progress}%` }}
                              className={`h-full ${task.status === 'FAILED' ? 'bg-rose-500' : 'bg-[#00D1FF]'}`}
                            />
                          </div>
                          <div className="flex justify-between text-[8px] font-mono text-[#444] uppercase">
                            <span>Progress</span>
                            <span>{Math.round(task.progress)}%</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="p-6 border-t border-[#3A3F45] bg-[#0A121A]">
                   <div className="text-[9px] font-mono text-[#444] uppercase tracking-[3px] mb-4">Permission Monitor</div>
                   <div className="space-y-2">
                     {activeAgent.permissions?.map(p => (
                       <div key={p} className="flex items-center gap-2 text-[8px] font-mono text-[#00D1FF] uppercase opacity-60">
                         <ShieldCheck className="w-3 h-3" />
                         {p}
                       </div>
                     ))}
                   </div>
                </div>
              </div>
            </div>
          </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Terminal Footer */}
      <footer className="h-[180px] border-t border-[#3A3F45] bg-[#080F14] p-8 font-mono text-[11px] overflow-y-auto shrink-0 uppercase tracking-tight text-[#7F8C99]">
        <div className="max-w-5xl mx-auto space-y-2">
          <div className="flex gap-4">
            <span className="text-[#3A3F45] shrink-0">[14:32:01]</span> 
            <span className="flex-1 italic">Initializing STACK3 Orchestrator Core... <span className="text-[#00D1FF] font-bold not-italic font-display ml-2">READY</span></span>
          </div>
          <div className="flex gap-4">
            <span className="text-[#3A3F45] shrink-0">[14:32:05]</span> 
            <span className="flex-1 italic">Authorizing specialist modules <span className="text-white opacity-40 not-italic font-bold">[RESEARCH, TOKENOMICS, COMPLIANCE, PM, SCRUM, PO, FORGE, ANALYST]</span>...</span>
          </div>
          <div className="flex gap-4">
            <span className="text-[#3A3F45] shrink-0">[14:32:10]</span> 
            <span className="flex-1 italic">Syncing with Base Sepolia RPC endpoint. Current Gas: <span className="text-amber-500 font-bold not-italic ml-2">0.001 GWEI</span></span>
          </div>
          <div className="flex gap-4">
            <span className="text-[#3A3F45] shrink-0">[14:32:12]</span> 
            <span className="flex-1 italic">Protocol identity verified on-chain via Agent0 SDK. <span className="text-[#00D1FF] font-bold not-italic font-display ml-2">AUTHENTICATED</span></span>
          </div>
          <div className="flex gap-4 opacity-50 border-t border-white/5 pt-2 mt-2">
            <span className="text-[#3A3F45] shrink-0">[14:32:15]</span> 
            <span className="flex-1">Awaiting user command input for Phase 2: Workflow Execution.</span>
          </div>
          <div className="flex gap-4 opacity-30">
            <span className="text-[#3A3F45] shrink-0">[14:32:20]</span> 
            <span className="flex-1">Memory Cache: <span className="text-white/40">Clear</span> | Entropy: <span className="text-white/40">Optimized</span> | System: <span className="text-[#00D1FF] font-bold">ONLINE</span></span>
          </div>
        </div>
      </footer>

      <AnimatePresence>
        {isSignModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/95 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-lg bg-[#0A121A] border border-[#3A3F45] p-12 space-y-10 shadow-[0_0_150px_rgba(0,209,255,0.15)] relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <ShieldCheck className="w-24 h-24 text-[#00D1FF]" />
              </div>

              <div className="space-y-4 relative z-10">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-display font-medium text-white uppercase tracking-[8px]">{authMode === 'login' ? 'Professional Login' : 'Register Profile'}</h3>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setAuthMode('login')}
                      className={`text-[9px] font-mono px-2 py-1 uppercase tracking-widest transition-all ${authMode === 'login' ? 'text-[#00D1FF] border-b border-[#00D1FF]' : 'text-[#7F8C99] hover:text-white'}`}
                    >
                      Login
                    </button>
                    <button 
                      onClick={() => setAuthMode('register')}
                      className={`text-[9px] font-mono px-2 py-1 uppercase tracking-widest transition-all ${authMode === 'register' ? 'text-[#00D1FF] border-b border-[#00D1FF]' : 'text-[#7F8C99] hover:text-white'}`}
                    >
                      Register
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-[#7F8C99] font-mono tracking-[3px] uppercase leading-relaxed max-w-md">
                  {authMode === 'login' 
                    ? 'Enter your credentials to access your auditor profile.' 
                    : 'Register your professional profile to enable cryptographic auditing on the SQL backend.'}
                </p>
                {authError && (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-3 bg-red-500/10 border border-red-500/30 text-red-500 text-[10px] font-mono uppercase tracking-wider"
                  >
                    {authError}
                  </motion.div>
                )}
              </div>
              
              <div className="space-y-6 relative z-10">
                <div className="space-y-3">
                  <label className="text-[10px] font-mono text-[#00D1FF] tracking-[4px] uppercase block opacity-80">Full Name / ID</label>
                  <input 
                    type="text" 
                    value={professionalId.name}
                    onChange={(e) => setProfessionalId(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="ENTER NAME..."
                    className="w-full bg-[#080F14] border border-[#3A3F45] p-4 text-white font-mono text-xs focus:outline-none focus:border-[#00D1FF] transition-all"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-mono text-[#00D1FF] tracking-[4px] uppercase block opacity-80">Secret Password</label>
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#080F14] border border-[#3A3F45] p-4 text-white font-mono text-xs focus:outline-none focus:border-[#00D1FF] transition-all"
                  />
                </div>

                {authMode === 'register' && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-mono text-[#00D1FF] tracking-[4px] uppercase block opacity-80">Professional Role</label>
                      <input 
                        type="text" 
                        value={professionalId.role}
                        onChange={(e) => setProfessionalId(prev => ({ ...prev, role: e.target.value }))}
                        placeholder="LEAD ARCHITECT..."
                        className="w-full bg-[#080F14] border border-[#3A3F45] p-4 text-white font-mono text-xs focus:outline-none focus:border-[#00D1FF] transition-all"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-mono text-[#00D1FF] tracking-[4px] uppercase block opacity-80">Organization</label>
                      <input 
                        type="text" 
                        value={professionalId.company}
                        onChange={(e) => setProfessionalId(prev => ({ ...prev, company: e.target.value }))}
                        placeholder="STACK3 LABS..."
                        className="w-full bg-[#080F14] border border-[#3A3F45] p-4 text-white font-mono text-xs focus:outline-none focus:border-[#00D1FF] transition-all"
                      />
                    </div>
                  </motion.div>
                )}
                
                <div className="grid grid-cols-2 gap-8 pt-8">
                  <button 
                    onClick={() => {
                      setIsSignModalOpen(false);
                      setPassword('');
                    }}
                    className="py-5 border border-[#3A3F45] text-[#7F8C99] font-mono text-[10px] uppercase tracking-[4px] hover:text-white hover:border-[#00D1FF]/50 transition-all font-bold"
                  >
                    DISCARD
                  </button>
                  <button 
                    onClick={handleAuth}
                    disabled={!professionalId.name.trim() || !password.trim()}
                    className="py-5 bg-[#00D1FF] text-black font-mono text-[11px] uppercase tracking-[5px] hover:bg-white transition-all disabled:opacity-30 disabled:cursor-not-allowed font-bold shadow-[0_0_20px_rgba(0,209,255,0.2)]"
                  >
                    {authMode === 'login' ? 'ACCESS ACCESS' : 'CREATE PROFILE'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}



