import { db } from '@/lib/db';
import { containerTypes } from '@/lib/db/schema/qr-workspace';
import * as XLSX from 'xlsx';

interface ExcelRow {
  chemical: string;
  Drum: 'Metal' | 'Poly';
  Pail: 'Metal' | 'Poly';
}

function generateVariantId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function generateProductId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export async function importExcelData() {
  console.log('Starting Excel data import...');
  
  try {
    // Read Excel file
    const filePath = '/home/andre/my-app/Chemical Container Type.xlsx';
    const workbook = XLSX.readFile(filePath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const excelData: ExcelRow[] = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`Loaded ${excelData.length} records from Excel file`);
    
    let createdCount = 0;
    
    // Process each Excel row
    for (const row of excelData) {
      const productId = generateProductId();
      
      // Create drum variant if specified
      if (row.Drum) {
        const drumVariantId = generateVariantId();
        
        await db.insert(containerTypes).values({
          shopifyProductId: productId,
          shopifyVariantId: drumVariantId,
          shopifyTitle: row.chemical,
          shopifyVariantTitle: `${row.chemical} - 55 Gallon Drum`,
          shopifySku: `${row.chemical.replace(/[^A-Z0-9]/gi, '-').toUpperCase()}-DRUM-55`,
          containerMaterial: row.Drum.toLowerCase() as 'metal' | 'poly',
          containerType: 'drum',
          capacity: '55',
          capacityUnit: 'gallons',
          length: '23',
          width: '23',
          height: '35',
          emptyWeight: '50',
          maxGrossWeight: '500',
          freightClass: row.Drum.toLowerCase() === 'metal' ? '85' : '60',
          isActive: true,
          createdBy: 'excel-import',
          updatedBy: 'excel-import',
        });
        
        createdCount++;
        console.log(`Created drum: ${row.chemical} (${row.Drum.toLowerCase()})`);
      }
      
      // Create pail variant if specified
      if (row.Pail) {
        const pailVariantId = generateVariantId();
        
        await db.insert(containerTypes).values({
          shopifyProductId: productId,
          shopifyVariantId: pailVariantId,
          shopifyTitle: row.chemical,
          shopifyVariantTitle: `${row.chemical} - 5 Gallon Pail`,
          shopifySku: `${row.chemical.replace(/[^A-Z0-9]/gi, '-').toUpperCase()}-PAIL-5`,
          containerMaterial: row.Pail.toLowerCase() as 'metal' | 'poly',
          containerType: 'pail',
          capacity: '5',
          capacityUnit: 'gallons',
          length: '12',
          width: '12',
          height: '14',
          emptyWeight: '5',
          maxGrossWeight: '50',
          freightClass: row.Pail.toLowerCase() === 'metal' ? '85' : '60',
          isActive: true,
          createdBy: 'excel-import',
          updatedBy: 'excel-import',
        });
        
        createdCount++;
        console.log(`Created pail: ${row.chemical} (${row.Pail.toLowerCase()})`);
      }
    }
    
    console.log('\n=== Import Summary ===');
    console.log(`Total containers created: ${createdCount}`);
    console.log('Import completed successfully!');
    
  } catch (error) {
    console.error('Import failed:', error);
    throw error;
  }
}

// Run the import if this script is called directly
if (require.main === module) {
  importExcelData()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Import failed:', error);
      process.exit(1);
    });
}