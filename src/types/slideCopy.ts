export interface InclusionToggles {
  venueRental: boolean;
  platedDinnerOrFood: boolean;
  beerAndHouseWine: boolean;
  beveragesOnConsumption: boolean;
  tableSideService: boolean;
  chairsLinensNapkins: boolean;
  fullServiceTeam: boolean;
  serviceChargeGratuityTaxes: boolean;
  customInclusion: string;
}

export interface MenuOption {
  name: string;
  tags: string[];
  description?: string;
  selected: boolean;
  locked?: boolean;
}

export interface MenuCourse {
  name: string;
  selectionRule?: string;
  maxSelections?: number;
  scenario: 'final' | 'needs_selection';
  options: MenuOption[];
}

export interface TravelResult {
  distanceMiles: number;
  baseDriveMins: number;
  baseWalkMins: number | null;
  isSameProperty: boolean;
  driveLine: string;
  walkLine: string | null;
  planningNotes: string;
  calculatedAt: string;
}

export interface SlideCopyData {
  venueUrl?: string;
  sqft?: number;
  maxCapacity?: string;
  venueBio?: string;
  itinerary?: string;       // route / run-of-show for Slide 1
  barNotes?: string;        // free-text bar menu for Slide 2 (manual entry or paste)
  inclusions: InclusionToggles;
  menuSelections?: MenuCourse[];
  travelResult?: TravelResult;
  travelOrigin?: string;  // free-form "From" address (overrides client_hotel)
  travelDest?: string;    // free-form "To" address (overrides linked venue address)
}
