
import { Detector, MicroscopyType, Vacuum } from "./types";

export const MATERIAL_TYPES: string[] = [
  'Nanocomposite / Hybrid Material',
  'Layered Double Hydroxides (LDHs)',
  'Mg-Al LDH',
  'Zn-Al LDH',
  'Ni-Fe LDH',
  'Cu-Mg-Al LDH',
  'Gold Nanoparticles (AuNPs)',
  'Silver Nanoparticles (AgNPs)',
  'Iron Oxide Nanoparticles (IONPs)',
  'Quantum Dots (QDs)',
  'Carbon Nanotubes (CNTs)',
  'Graphene / Graphene Oxide',
  'Metal-Organic Frameworks (MOFs)',
  'Core-Shell Nanostructures',
  'Janus Particles',
  'Polymeric Nanoparticles',
  'Liposomes',
  'Mixture / Hybrid Material',
  'N/I (Not Identified)',
  'Other'
];

export const STARTING_MATERIALS: string[] = [
  'AgNO3 (Silver Nitrate)',
  'HAuCl4 (Chloroauric Acid)',
  'FeCl3 (Iron(III) Chloride)',
  'FeCl2 (Iron(II) Chloride)',
  'Fe(NO3)3·9H2O',
  'Zn(NO3)2·6H2O',
  'ZnCl2 (Zinc Chloride)',
  'Zn(CH3COO)2 (Zinc Acetate)',
  'Co(NO3)2·6H2O',
  'CoCl2·6H2O',
  'Ni(NO3)2·6H2O',
  'NiCl2·6H2O',
  'Ni(CH3COO)2 (Nickel Acetate)',
  'PdCl2 (Palladium Chloride)',
  'PtCl2 (Platinum Chloride)',
  'Mg(NO3)2·6H2O',
  'Al(NO3)3·9H2O',
  'NaOH',
  'Na2CO3',
  'NaHCO3',
  'Urea (CO(NH2)2)',
  'Hexamethylenetetramine (HMT)',
  'Ethylene Glycol',
  'CTAB',
  'SDS',
  'Citric Acid',
  'Other Precursors'
];

export const SYNTHESIS_METHODS: string[] = [
  'Chemical Reduction',
  'Green Synthesis',
  'Co-precipitation (pH controlled)',
  'Hydrothermal',
  'Sol-gel',
  'Urea Hydrolysis',
  'Topotactic Transformation',
  'Ion Exchange',
  'Memory Effect Reconstruction',
  'Microwave-assisted Synthesis',
  'Microemulsion',
  'Biosynthesis / Phyto-synthesis',
  'Other'
];

export const EXTRACTION_METHODS: string[] = [
  'Aqueous Decoction / Boiling Reflux (Deionized H2O)',
  'Room Temperature Aqueous Maceration / Stirring',
  'Hydroalcoholic Maceration (Ethanol / Water)',
  'Methanolic Extraction',
  'Ultrasonic-Assisted Extraction (UAE / Sonication)',
  'Microwave-Assisted Extraction (MAE)',
  'Soxhlet Extraction',
  'Cold Percolation / Overnight Soaking',
  'Hydrodistillation (Essential Oil / Steam)',
  'Centrifugation & Whatman #1 Filtration',
  'Supercritical CO2 Fluid Extraction',
  'Standard Chemical Reduction (No Plant)',
  'Other / Custom Protocol'
];

export const PLANT_PARTS: string[] = [
  'Leaves / Foliage',
  'Fruit Peel / Rind',
  'Whole Fruit / Pulp / Juice',
  'Bark / Stem',
  'Seeds / Kernel',
  'Flowers / Petals',
  'Roots / Rhizomes',
  'Whole Aerial Plant',
  'Other Biomass / Agricultural Waste'
];

export const COMMON_REDUCING_AGENTS: string[] = [
  'Azadirachta indica (Neem) leaf extract',
  'Camellia sinensis (Green tea) extract',
  'Eucalyptus globulus leaf extract',
  'Aloe vera leaf gel/extract',
  'Citrus sinensis (Orange peel) extract',
  'Ocimum sanctum (Tulsi) extract',
  'Zingiber officinale (Ginger) extract',
  'Curcuma longa (Turmeric) extract',
  'Sodium Borohydride (NaBH4)',
  'Sodium Citrate / Trisodium Citrate',
  'Ascorbic Acid (Vitamin C)',
  'Polyvinylpyrrolidone (PVP)',
  'Hydrazine Hydrate'
];

export const MICROSCOPY_TYPES: MicroscopyType[] = ['TEM', 'SEM'];
export const DETECTORS: Detector[] = ['ETD', 'CBS', 'LFD', 'BED-C', 'LED', 'STEM'];
export const VACUUM_LEVELS: Vacuum[] = ['High', 'Low', 'Unknown'];

export const AGGREGATION_STATES: string[] = [
    'Not Specified',
    'Well-dispersed',
    'Slightly aggregated',
    'Moderately aggregated',
    'Highly aggregated',
    'Confluent / Film-like',
    'Stacked / Layered',
    'House-of-cards structure'
];

export const INTERPRETATION_TONES: string[] = [
    'Nature Materials (Concise/High-impact)',
    'JACS (In-depth/Mechanistic)',
    'ACS Nano (Morphology focused)',
    'Analytical Chemistry (Technical/Precise)',
    'Scientific Reports (Methodological)',
    'Review Article (Contextual/Broad)',
    'Industrial Patent (Claims-oriented)',
    'Grant Proposal (Innovation focused)',
    'Short Communication (Rapid report)'
];

export const TEM_MODES: ('Bright-field' | 'Dark-field')[] = ['Bright-field', 'Dark-field'];

export const PARTICLE_SHAPES: string[] = [
    'Hexagonal Plates',
    'Flower-like / Petals',
    'Sand-rose morphology',
    'Stacked Sheets',
    'Plate-like',
    'Spherical',
    'Near-spherical',
    'Irregular',
    'Polygonal',
    'Cubic',
    'Rod-shaped',
    'Nanowire',
    'Nanosheet',
    'Triangular',
    'Core-shell',
    'Hollow',
    'Porous',
    'Disc-shaped',
    'Scalloped / Rugged Edges'
];

export const NANOPARTICLE_APPLICATIONS: string[] = [
    'Not Specified',
    'Adsorption',
    'Photocatalysis',
    'Antibacterial',
    'Anti-cancer',
    'Drug Delivery',
    'Wastewater Treatment',
    'Sensors',
    'Catalysis',
    'Flame Retardancy',
    'Energy Storage (Batteries/Supercaps)',
    'Bio-imaging',
    'Other'
];
