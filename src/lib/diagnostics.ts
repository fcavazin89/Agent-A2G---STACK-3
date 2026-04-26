import { AgentRole } from '../types';

export interface DiagnosticCheck {
  id: string;
  name: string;
  status: 'pending' | 'success' | 'failure';
  details?: string;
}

export interface DiagnosticResult {
  role: AgentRole;
  timestamp: Date;
  checks: DiagnosticCheck[];
  overallStatus: 'passed' | 'failed' | 'in_progress';
  reconnectionAttempted: boolean;
  reconnectionSuccess?: boolean;
}

const BASE_CHECKS = [
  { id: 'ping', name: 'Network Connectivity (Ping)' },
  { id: 'auth', name: 'Authentication Credentials' },
  { id: 'load', name: 'System Load & Memory' },
  { id: 'api', name: 'Provider API Handshake' }
];

export async function runDiagnostics(role: AgentRole): Promise<DiagnosticResult> {
  const checks: DiagnosticCheck[] = BASE_CHECKS.map(c => ({ ...c, status: 'pending' }));
  
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  let allPassed = true;
  for (const check of checks) {
    // Simulate a failure chance (30% per check if diagnosing)
    const passed = Math.random() > 0.3;
    check.status = passed ? 'success' : 'failure';
    if (!passed) {
      allPassed = false;
      check.details = `Probe timed out or returned invalid response for ${role} node.`;
    } else {
      check.details = 'Normal parameters detected.';
    }
    // Artificial staggering
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  return {
    role,
    timestamp: new Date(),
    checks,
    overallStatus: allPassed ? 'passed' : 'failed',
    reconnectionAttempted: false
  };
}

export async function attemptReconnection(role: AgentRole): Promise<boolean> {
  // Simulate reconnection handshake
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // 60% chance of recovery
  const recovered = Math.random() > 0.4;
  return recovered;
}
