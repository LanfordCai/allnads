import { Template } from '../services/blockchain';

export interface TemplateDetails extends Template {
  componentTypeName?: string;
  isOwned?: boolean;
} 