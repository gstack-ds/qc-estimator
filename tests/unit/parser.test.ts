import { describe, it, expect } from 'vitest';
import { parseWithRegex } from '../../src/lib/scanner/parser';

const SAMPLE_GDP_EMAIL = `
GDP INITIAL LEAD

Client: Acme Corporation
End Company: Acme Corporation
Contact: Jane Smith
Email: jane.smith@acme.com
Role: Senior Event Manager
Third Party: Premier Events Group
Third Party Contact: Bob Johnson
Program Name: Acme Annual Leadership Summit
Program Type: Corporate Conference
Start Date: 2026-09-14
End Date: 2026-09-16
Nights: 2
Guest Count: 150
City: Charlotte
State: NC
Hotel: The Ritz-Carlton Charlotte
Venue: Charlotte Convention Center
Region: Charlotte
Lead Source: GDP
Advisor: Sarah Brown
Coordinator: Mike Davis
Commission: 10%
Third Party Commission: 6.5%
Commission Notes: GDP takes 10%, Premier Events gets 6.5% override
Billing Notes: Net 30
Returning Client: Yes
Special Instructions: VIP room block for executives, requires AV for 3 breakout rooms
`;

describe('parseWithRegex — GDP sample email', () => {
  let lead: ReturnType<typeof parseWithRegex>;

  beforeAll(() => {
    lead = parseWithRegex(SAMPLE_GDP_EMAIL);
  });

  it('parses client_name', () => expect(lead.client_name).toBe('Acme Corporation'));
  it('parses contact_name', () => expect(lead.contact_name).toBe('Jane Smith'));
  it('parses contact_email', () => expect(lead.contact_email).toBe('jane.smith@acme.com'));
  it('parses contact_role', () => expect(lead.contact_role).toBe('Senior Event Manager'));
  it('parses third_party_company', () => expect(lead.third_party_company).toBe('Premier Events Group'));
  it('parses program_name', () => expect(lead.program_name).toBe('Acme Annual Leadership Summit'));
  it('parses program_type', () => expect(lead.program_type).toBe('Corporate Conference'));
  it('parses start_date as ISO', () => expect(lead.start_date).toBe('2026-09-14'));
  it('parses end_date as ISO', () => expect(lead.end_date).toBe('2026-09-16'));
  it('parses num_nights as integer', () => expect(lead.num_nights).toBe(2));
  it('parses guest_count as integer', () => expect(lead.guest_count).toBe(150));
  it('parses city', () => expect(lead.city).toBe('Charlotte'));
  it('parses state', () => expect(lead.state).toBe('NC'));
  it('parses hotel', () => expect(lead.hotel).toBe('The Ritz-Carlton Charlotte'));
  it('parses venue', () => expect(lead.venue).toBe('Charlotte Convention Center'));
  it('parses region', () => expect(lead.region).toBe('Charlotte'));
  it('parses lead_source', () => expect(lead.lead_source).toBe('GDP'));
  it('parses source_advisor', () => expect(lead.source_advisor).toBe('Sarah Brown'));
  it('parses source_coordinator', () => expect(lead.source_coordinator).toBe('Mike Davis'));
  it('parses source_commission as decimal', () => expect(lead.source_commission).toBeCloseTo(0.10));
  it('parses third_party_commission as decimal', () => expect(lead.third_party_commission).toBeCloseTo(0.065));
  it('parses commission_notes', () => expect(lead.commission_notes).toBeTruthy());
  it('parses returning_client as true', () => expect(lead.returning_client).toBe(true));
  it('parses special_instructions', () => expect(lead.special_instructions).toBeTruthy());
});

describe('parseWithRegex — edge cases', () => {
  it('handles missing fields gracefully', () => {
    const lead = parseWithRegex('Client: Solo Event\nGuest Count: 50');
    expect(lead.client_name).toBe('Solo Event');
    expect(lead.guest_count).toBe(50);
    expect(lead.start_date).toBeNull();
    expect(lead.contact_name).toBeNull();
  });

  it('parses "City, State" destination format', () => {
    const lead = parseWithRegex('Destination: Atlanta, GA\nGuest Count: 100');
    expect(lead.city).toBe('Atlanta');
    expect(lead.state).toBe('GA');
  });

  it('converts percentage commission > 1 to decimal', () => {
    const lead = parseWithRegex('Commission: 15%');
    expect(lead.source_commission).toBeCloseTo(0.15);
  });

  it('keeps decimal commission as-is', () => {
    const lead = parseWithRegex('Commission: 0.10');
    expect(lead.source_commission).toBeCloseTo(0.10);
  });

  it('defaults lead_source to GDP when not specified', () => {
    const lead = parseWithRegex('Client: Test Co');
    expect(lead.lead_source).toBe('GDP');
  });

  it('treats "No" returning client as false', () => {
    const lead = parseWithRegex('Returning Client: No');
    expect(lead.returning_client).toBe(false);
  });

  it('parses natural language dates', () => {
    const lead = parseWithRegex('Start Date: September 14, 2026');
    expect(lead.start_date).toBe('2026-09-14');
  });

  it('strips commas from guest counts like "1,200"', () => {
    const lead = parseWithRegex('Guest Count: 1,200');
    expect(lead.guest_count).toBe(1200);
  });
});

// Need beforeAll from vitest
import { beforeAll } from 'vitest';
