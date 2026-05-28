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

export interface SlideCopyData {
  venueUrl?: string;
  sqft?: number;
  maxCapacity?: string;
  venueBio?: string;
  inclusions: InclusionToggles;
  menuSelections?: MenuCourse[];
}
