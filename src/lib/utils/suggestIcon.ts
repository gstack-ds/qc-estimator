export type LucideIconName =
  | 'Bus' | 'Mic2' | 'Lightbulb' | 'Utensils' | 'Wine' | 'Monitor'
  | 'Speaker' | 'Battery' | 'Cable' | 'Flower2' | 'Package'
  | 'Camera' | 'Music' | 'Truck' | 'Users' | 'Star' | 'Tent' | 'Shirt';

const RULES: [RegExp, LucideIconName][] = [
  [/bus|van|shuttle|transport|vehicle|limo/i,              'Bus'],
  [/mic|microphone|podium|lectern/i,                       'Mic2'],
  [/light|uplight|bulb|lamp|illuminat|ambient/i,          'Lightbulb'],
  [/food|meal|dinner|lunch|breakfast|catering|buffet|plat/i, 'Utensils'],
  [/drink|bar|beverage|wine|beer|cocktail|alcohol|keg/i,  'Wine'],
  [/monitor|screen|display|lcd|led.wall|projector/i,      'Monitor'],
  [/speaker|audio|sound|pa.system|subwoofer/i,            'Speaker'],
  [/battery|power.strip|generator|power.pack/i,           'Battery'],
  [/cable|cord|wire|rigging/i,                            'Cable'],
  [/floral|flower|boutonniere|centerpiece|arrangement/i,  'Flower2'],
  [/camera|photo|video|record|stream/i,                   'Camera'],
  [/music|band|dj|entertain|performer/i,                  'Music'],
  [/truck|delivery|haul|freight|cargo/i,                  'Truck'],
  [/staff|crew|personnel|labor|team|server|waiter/i,      'Users'],
  [/drape|fabric|pipe|linen|curtain|backdrop/i,           'Shirt'],
  [/tent|canopy|marquee|gazebo/i,                         'Tent'],
  [/award|trophy|plaque|prize|gift/i,                     'Star'],
];

export function suggestIcon(itemName: string): LucideIconName {
  for (const [pattern, icon] of RULES) {
    if (pattern.test(itemName)) return icon;
  }
  return 'Package';
}
