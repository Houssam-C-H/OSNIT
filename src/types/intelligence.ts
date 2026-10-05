export type EntityCategory = 
  // --- Core Identities ---
  | 'person' 
  | 'company' 
  | 'organization' // NGOs, political groups, threat actor groups
  
  // --- Communications ---
  | 'phone' 
  | 'email' 
  | 'social' 
  | 'forum_profile' // Dark web or public forum accounts
  
  // --- Digital Infrastructure (Cyber) ---
  | 'ip_address' 
  | 'domain'       // e.g., example.com
  | 'url'          // Specific web pages or endpoints
  | 'mac_address' 
  | 'asn'          // Autonomous System Number (ISP mapping)
  | 'hash'         // File hashes (MD5, SHA-256) for malware/evidence
  
  // --- Financial ---
  | 'crypto_wallet' 
  | 'bank_account' 
  | 'credit_card' 
  
  // --- Physical & Real World ---
  | 'location'     // Physical addresses or GPS coordinates
  | 'vehicle'      // License plates, VIN numbers, aircraft tail numbers
  
  // --- Documents & Identifiers ---
  | 'passport' 
  | 'national_id' 
  
  // --- Fallback ---
  | string; 

export type SocialPlatform = 
  | 'twitter' 
  | 'telegram' 
  | 'instagram' 
  | 'facebook' 
  | 'linkedin' 
  | 'tiktok' 
  | 'youtube' 
  | 'reddit'
  | 'discord'
  | 'github'
  | 'whatsapp'
  | 'snapchat'
  | 'vk'           // Popular in Eastern European/Russian OSINT
  | 'generic';

export interface GraphNode {
  id: string;
  name: string;
  category: EntityCategory;
  platform?: SocialPlatform;
  badge?: string; // e.g. Flag code or sub-role
  groupCluster?: string; // e.g. "Ownership", "Offshore Holdings"
  val?: number; // Size weight
  x?: number;
  y?: number;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  label: string; // e.g., "Shareholder (50%)", "Brother", "Registered Address"
  curvature?: number; // For multiple parallel edges between same nodes
}
