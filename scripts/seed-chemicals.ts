import dotenv from 'dotenv';
import path from 'path';

// Load environment variables FIRST
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Now import db after env vars are loaded
import { db } from '@/lib/db';
import { chemicals } from '@/lib/db/schema/qr-workspace';

// Your provided chemical data
const chemicalData = [
  {
    name: 'Acetic Acid 100% / Vinegar 100%',
    specificGravity: '1.049',
    initialConcentration: '100.0',
    method: 'ww' as const,
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield, acid resistant apron',
    grade: null,
    gradeCategory: 'standard' as const
  },
  {
    name: 'Aluminum Sulfate Solution 48%',
    specificGravity: '1.335',
    initialConcentration: '48.0',
    method: 'ww' as const,
    hazardClass: 'Corrosive, Skin/Eye Irritant',
    ppeSuggestion: 'Closed goggles or face shield, chemical resistant gloves (rubber, neoprene, PVC), work clothing.',
    grade: null,
    gradeCategory: 'standard' as const
  },
  {
    name: 'Ammonium Hydroxide 29%',
    specificGravity: '0.897',
    initialConcentration: '29.0',
    method: 'ww' as const,
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield, respirator',
    grade: null,
    gradeCategory: 'standard' as const
  },
  {
    name: 'Ferric Chloride Solution 40%',
    specificGravity: '1.37',
    initialConcentration: '40.0',
    method: 'ww' as const,
    hazardClass: 'Corrosive, Serious Eye Damage, Skin Irritant, Harmful if Swallowed',
    ppeSuggestion: 'Chemical splash goggles or face shield, impervious rubber gloves, rubber boots, rain suit or rubber apron.',
    grade: null,
    gradeCategory: 'standard' as const
  },
  {
    name: 'Hydrochloric Acid 31%',
    specificGravity: '1.15',
    initialConcentration: '31.0',
    method: 'ww' as const,
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield, acid resistant apron, respirator',
    grade: null,
    gradeCategory: 'standard' as const
  },
  {
    name: 'Hydrochloric Acid 35%',
    specificGravity: '1.18',
    initialConcentration: '35.0',
    method: 'ww' as const,
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield, acid resistant apron, respirator',
    grade: null,
    gradeCategory: 'standard' as const
  },
  {
    name: 'Hydrogen Peroxide 35%',
    specificGravity: '1.13',
    initialConcentration: '35.0',
    method: 'ww' as const,
    hazardClass: 'Oxidizer',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield',
    grade: null,
    gradeCategory: 'standard' as const
  },
  {
    name: 'Hydrogen Peroxide 50%',
    specificGravity: '1.20',
    initialConcentration: '50.0',
    method: 'ww' as const,
    hazardClass: 'Oxidizer',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield, chemical resistant suit',
    grade: null,
    gradeCategory: 'standard' as const
  },
  {
    name: 'Isopropyl Alcohol 99.9%',
    specificGravity: '0.785',
    initialConcentration: '99.9',
    method: 'vv' as const,
    hazardClass: 'Flammable',
    ppeSuggestion: 'Chemical resistant gloves, safety glasses',
    grade: null,
    gradeCategory: 'standard' as const
  },
  {
    name: 'Methanol 100%',
    specificGravity: '0.791',
    initialConcentration: '100.0',
    method: 'vv' as const,
    hazardClass: 'Flammable, Toxic',
    ppeSuggestion: 'Chemical resistant gloves, goggles, respirator',
    grade: null,
    gradeCategory: 'standard' as const
  },
  {
    name: 'Monoethanolamine (MEA) 100%',
    specificGravity: '1.012',
    initialConcentration: '100.0',
    method: 'ww' as const,
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield',
    grade: null,
    gradeCategory: 'standard' as const
  },
  {
    name: 'Nitric Acid 65%',
    specificGravity: '1.40',
    initialConcentration: '65.0',
    method: 'ww' as const,
    hazardClass: 'Corrosive, Oxidizer',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield, acid resistant apron, respirator',
    grade: null,
    gradeCategory: 'standard' as const
  },
  {
    name: 'Phosphoric Acid 85%',
    specificGravity: '1.685',
    initialConcentration: '85.0',
    method: 'ww' as const,
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield, acid resistant apron',
    grade: null,
    gradeCategory: 'standard' as const
  },
  {
    name: 'Propylene Glycol 100%',
    specificGravity: '1.038',
    initialConcentration: '100.0',
    method: 'vv' as const,
    hazardClass: 'Mild Skin Irritant, Eye Irritant',
    ppeSuggestion: 'Chemical safety glasses or goggles, nitrile or rubber gloves, apron or lab coat.',
    grade: null,
    gradeCategory: 'standard' as const
  },
  {
    name: 'Sodium Hydroxide 50%',
    specificGravity: '1.54',
    initialConcentration: '50.0',
    method: 'ww' as const,
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield, caustic resistant apron',
    grade: null,
    gradeCategory: 'standard' as const
  },
  {
    name: 'Sodium Hypochlorite 12.5%',
    specificGravity: '1.21',
    initialConcentration: '12.50',
    method: 'ww' as const,
    hazardClass: 'Corrosive (Skin Burns, Eye Damage), Very Toxic to Aquatic Life',
    ppeSuggestion: 'Chemical safety glasses or goggles, face shield, nitrile or rubber gloves, complete body suit.',
    grade: null,
    gradeCategory: 'standard' as const
  },
  {
    name: 'Sulfuric Acid 50%',
    specificGravity: '1.40',
    initialConcentration: '50.0',
    method: 'ww' as const,
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield, acid resistant apron',
    grade: null,
    gradeCategory: 'standard' as const
  },
  {
    name: 'Sulfuric Acid 93%',
    specificGravity: '1.84',
    initialConcentration: '93.0',
    method: 'ww' as const,
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield, acid resistant suit, respirator',
    grade: null,
    gradeCategory: 'standard' as const
  },
  {
    name: 'Ethylene Glycol 100%',
    specificGravity: '1.113',
    initialConcentration: '100.0',
    method: 'vv' as const,
    hazardClass: 'Toxic',
    ppeSuggestion: 'Chemical resistant gloves, safety glasses',
    grade: null,
    gradeCategory: 'standard' as const
  },
  {
    name: 'Denatured Ethanol 200 Proof',
    specificGravity: '0.789',
    initialConcentration: '100.0',
    method: 'vv' as const,
    hazardClass: 'Flammable, Toxic',
    ppeSuggestion: 'Chemical resistant gloves, goggles, respirator',
    grade: null,
    gradeCategory: 'standard' as const
  },
  // Add food grade variations
  {
    name: 'Citric Acid USP',
    specificGravity: '1.665',
    initialConcentration: '100.0',
    method: 'ww' as const,
    hazardClass: 'Irritant',
    ppeSuggestion: 'Safety glasses, gloves',
    grade: 'USP',
    gradeCategory: 'food' as const
  },
  {
    name: 'Citric Acid FCC',
    specificGravity: '1.665',
    initialConcentration: '100.0',
    method: 'ww' as const,
    hazardClass: 'Irritant',
    ppeSuggestion: 'Safety glasses, gloves',
    grade: 'FCC',
    gradeCategory: 'food' as const
  },
  {
    name: 'Phosphoric Acid 85% Food Grade',
    specificGravity: '1.685',
    initialConcentration: '85.0',
    method: 'ww' as const,
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield, acid resistant apron',
    grade: 'Food Grade',
    gradeCategory: 'food' as const
  },
  // Add reagent grade variations
  {
    name: 'Sulfuric Acid 93% ACS',
    specificGravity: '1.84',
    initialConcentration: '93.0',
    method: 'ww' as const,
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield, acid resistant suit, respirator',
    grade: 'ACS',
    gradeCategory: 'reagent' as const
  },
  {
    name: 'Hydrochloric Acid 37% Reagent',
    specificGravity: '1.19',
    initialConcentration: '37.0',
    method: 'ww' as const,
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield, acid resistant apron, respirator',
    grade: 'Reagent',
    gradeCategory: 'reagent' as const
  },
  // Add tech grade variations
  {
    name: 'Sulfuric Acid 93% Tech',
    specificGravity: '1.84',
    initialConcentration: '93.0',
    method: 'ww' as const,
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield, acid resistant suit, respirator',
    grade: 'Tech',
    gradeCategory: 'tech' as const
  },
  {
    name: 'Sodium Hydroxide 50% Industrial',
    specificGravity: '1.54',
    initialConcentration: '50.0',
    method: 'ww' as const,
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield, caustic resistant apron',
    grade: 'Industrial',
    gradeCategory: 'tech' as const
  }
];

async function seedChemicals() {
  console.log('Starting to seed chemicals table...');
  
  try {
    // Clear existing chemicals (optional - comment out if you want to keep existing)
    await db.delete(chemicals);
    console.log('Cleared existing chemicals');
    
    // Insert new chemicals
    for (const chemical of chemicalData) {
      await db.insert(chemicals).values({
        name: chemical.name,
        specificGravity: chemical.specificGravity,
        initialConcentration: chemical.initialConcentration,
        method: chemical.method,
        hazardClass: chemical.hazardClass,
        ppeSuggestion: chemical.ppeSuggestion,
        grade: chemical.grade,
        gradeCategory: chemical.gradeCategory,
        isActive: true
      });
      console.log(`Inserted: ${chemical.name}`);
    }
    
    console.log(`Successfully seeded ${chemicalData.length} chemicals`);
  } catch (error) {
    console.error('Error seeding chemicals:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the seed function
seedChemicals();