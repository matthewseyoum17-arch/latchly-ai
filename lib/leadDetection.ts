// Lead detection logic — analyzes chat messages to identify captured lead info

export interface DetectedLead {
  name?: string;
  phone?: string;
  email?: string;
  serviceNeeded?: string;
  isComplete: boolean;
}

const PHONE_REGEX = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

// Simple name detection: looks for "my name is X" or "I'm X" or "this is X"
const NAME_PATTERNS = [
  /(?:my name is|i'm|i am|this is|name's|it's)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
  /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)$/m, // standalone name on a line
];

export function detectLeadInfo(messages: { role: string; text: string }[]): DetectedLead {
  const userMessages = messages.filter((m) => m.role === "user").map((m) => m.text);
  const allUserText = userMessages.join("\n");

  const lead: DetectedLead = { isComplete: false };

  // Detect phone
  const phoneMatch = allUserText.match(PHONE_REGEX);
  if (phoneMatch) lead.phone = phoneMatch[0];

  // Detect email
  const emailMatch = allUserText.match(EMAIL_REGEX);
  if (emailMatch) lead.email = emailMatch[0];

  // Detect name
  for (const pattern of NAME_PATTERNS) {
    const nameMatch = allUserText.match(pattern);
    if (nameMatch && nameMatch[1]) {
      lead.name = nameMatch[1].trim();
      break;
    }
  }

  // A lead is "complete" when we have at least name + phone
  lead.isComplete = !!(lead.name && lead.phone);

  return lead;
}
