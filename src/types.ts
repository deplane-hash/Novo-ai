export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface Usage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  estimated?: boolean
}

export interface ProviderDefinition {
  id: string
  name: string
  tagline: string
  icon: string
  color: string
  needsKey: boolean
  keyPlaceholder: string
  baseUrlEditable: boolean
  defaultBaseUrl?: string
  models: string[]
  freeAll?: boolean
  freeModels?: string[]
}

export interface ProviderState {
  id: string
  configured: boolean
  keyMasked: string
  baseUrl: string
}

export interface PublicState {
  providers: Record<string, ProviderState>
  activeProvider: string
  activeModel: string
  theme: string
  maxTokens: number
  temperature: number
  workspace: string
  planMode: boolean
  autoApprove: boolean
  onboarded: boolean
}

export interface ToolStep {
  id: string
  name: string
  summary: string
  status: 'awaiting' | 'running' | 'done' | 'error' | 'denied'
  output?: string
  needApproval?: boolean
}

export interface SessionMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  providerId?: string
  model?: string
  usage?: Usage
  cost?: number
  steps?: ToolStep[]
  createdAt: number
  stopped?: boolean
  stoppedAfterMs?: number
  durationMs?: number
  preview?: string
}

export interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
}

export interface TodoItem {
  file: string
  line: number
  tag: string
  text: string
}

export interface Session {
  id: string
  title: string
  providerId: string
  model: string
  messages: SessionMessage[]
  createdAt: number
  updatedAt: number
}

export interface ChatDone {
  usage?: Usage
  cost?: number
  durationMs?: number
}
