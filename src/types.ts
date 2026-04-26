
export type AgentRole = 'RESEARCHER' | 'TOKENOMICS' | 'COMPLIANCE' | 'ARCHITECT' | 'GTM' | 'FORGE' | 'SOLANA_FORGE' | 'SOLANA_AUDITOR' | 'PROJECT_AUDITOR' | 'BLUEPRINT' | 'ERP' | 'CRM' | 'PM' | 'SCRUM' | 'PO' | 'ANALYST' | 'RISK' | 'POV' | 'OVP' | 'STRESS_TESTER' | 'META_ARCHITECT' | 'SOVEREIGN_AA' | 'GRAPH_RMVP' | 'SOCIAL_MEDIA' | 'INVESTOR_RELATIONS';

export type Permission = 
  | 'MARKET_RESEARCH' 
  | 'TOKEN_ENGINEERING' 
  | 'LEGAL_AUDIT' 
  | 'TECH_ARCHITECTURE' 
  | 'STRATEGIC_PLANNING' 
  | 'CODE_SYNTHESIS' 
  | 'SECURITY_AUDIT' 
  | 'BUSINESS_OPS';

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
export type TaskPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export interface AgentTask {
  id: string;
  agentId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  progress: number;
  assignedTo: AgentRole;
  createdAt: Date;
}

export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  description: string;
  icon: string;
  color: string;
  systemPrompt: string;
  status: 'ONLINE' | 'OFFLINE';
  permissions?: Permission[];
}

export interface Message {
  id: string;
  sender: 'user' | AgentRole;
  content: string;
  timestamp: Date;
  metadata?: {
    isCollaborative?: boolean;
    targetAgents?: AgentRole[];
    originalSender?: AgentRole;
    error?: string;
  };
}

export interface BusinessPlan {
  name: string;
  summary: string;
  research?: string;
  tokenomics?: string;
  compliance?: string;
  architecture?: string;
  gtm?: string;
}
