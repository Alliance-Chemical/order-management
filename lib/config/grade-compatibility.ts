/**
 * Chemical grade compatibility configuration
 * Defines which grades are compatible with each other for mixing/transfer
 */

export interface GradeCompatibility {
  category: string;
  grades: string[];
  canMixWith?: string[];
}

export const GRADE_CATEGORIES: GradeCompatibility[] = [
  {
    category: 'food',
    grades: ['USP', 'FCC', 'Food Grade', 'Pharmaceutical'],
    canMixWith: ['USP', 'FCC', 'Food Grade', 'Pharmaceutical']
  },
  {
    category: 'reagent',
    grades: ['ACS', 'Reagent', 'HPLC', 'GC'],
    canMixWith: ['ACS', 'Reagent', 'HPLC', 'GC', 'USP', 'FCC']
  },
  {
    category: 'technical',
    grades: ['Tech', 'Technical', 'Industrial', 'Lab', 'Standard'],
    canMixWith: ['Tech', 'Technical', 'Industrial', 'Lab', 'Standard']
  },
  {
    category: 'electronic',
    grades: ['Electronic', 'Semi', 'Semiconductor'],
    canMixWith: ['Electronic', 'Semi', 'Semiconductor', 'HPLC', 'GC']
  }
];

/**
 * Check if two chemical grades are compatible
 */
export function areGradesCompatible(sourceGrade: string, destinationGrade: string): boolean {
  // Exact match is always compatible
  if (sourceGrade === destinationGrade) return true;
  
  // Normalize grades for comparison
  const normalizedSource = sourceGrade.toLowerCase().trim();
  const normalizedDest = destinationGrade.toLowerCase().trim();
  
  // Find categories for both grades
  const sourceCategory = GRADE_CATEGORIES.find(cat => 
    cat.grades.some(grade => normalizedSource.includes(grade.toLowerCase()))
  );
  
  const destCategory = GRADE_CATEGORIES.find(cat => 
    cat.grades.some(grade => normalizedDest.includes(grade.toLowerCase()))
  );
  
  // If either grade is unknown, allow with warning
  if (!sourceCategory || !destCategory) return true;
  
  // Check if destination grade is in source's compatible list
  if (sourceCategory.canMixWith) {
    return sourceCategory.canMixWith.some(grade => 
      normalizedDest.includes(grade.toLowerCase())
    );
  }
  
  // Default to same category compatibility
  return sourceCategory.category === destCategory.category;
}

/**
 * Get grade category for a given grade
 */
export function getGradeCategory(grade: string): string {
  const normalized = grade.toLowerCase().trim();
  const category = GRADE_CATEGORIES.find(cat => 
    cat.grades.some(g => normalized.includes(g.toLowerCase()))
  );
  return category?.category || 'unknown';
}

/**
 * Format grade for display
 */
export function formatGrade(grade: string): string {
  if (!grade) return 'Unknown Grade';
  
  // Common grade mappings for display
  const gradeMap: Record<string, string> = {
    'usp': 'USP',
    'fcc': 'FCC',
    'acs': 'ACS',
    'hplc': 'HPLC',
    'gc': 'GC',
    'tech': 'Technical',
    'industrial': 'Industrial',
    'lab': 'Laboratory',
    'food grade': 'Food Grade',
    'pharmaceutical': 'Pharmaceutical',
    'reagent': 'Reagent',
    'electronic': 'Electronic',
    'semiconductor': 'Semiconductor'
  };
  
  const lower = grade.toLowerCase();
  return gradeMap[lower] || grade;
}