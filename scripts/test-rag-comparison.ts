#!/usr/bin/env tsx

/**
 * Test and compare JSON RAG vs Database RAG performance and accuracy
 */

import * as dotenv from 'dotenv';
import { classifyWithRAG } from '../lib/hazmat/classify';
import { classifyWithEnhancedRAG } from '../lib/hazmat/classify-enhanced';
import { classifyWithDatabaseRAG } from '../lib/services/rag/database-rag';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Test cases covering various chemical types
const testCases = [
  // Acids
  { sku: 'HCL-32', name: 'Hydrochloric Acid 32%', expectedUN: 'UN1789', expectedClass: '8' },
  { sku: 'SA-98', name: 'Sulfuric Acid 98%', expectedUN: 'UN1830', expectedClass: '8' },
  { sku: 'NA-70', name: 'Nitric Acid 70%', expectedUN: 'UN2031', expectedClass: '8' },
  { sku: 'AA-10', name: 'Acetic Acid 10%', expectedUN: null, expectedClass: null }, // Non-regulated
  
  // Solvents
  { sku: 'EA-99', name: 'Ethyl Acetate 99%', expectedUN: 'UN1173', expectedClass: '3' },
  { sku: 'HEX-95', name: 'n-Hexane 95%', expectedUN: 'UN1208', expectedClass: '3' },
  { sku: 'IPA-99', name: 'Isopropyl Alcohol 99%', expectedUN: 'UN1219', expectedClass: '3' },
  { sku: 'ETH-190', name: 'Ethanol 190 Proof', expectedUN: 'UN1170', expectedClass: '3' },
  
  // Bases
  { sku: 'SH-50', name: 'Sodium Hydroxide 50% Solution', expectedUN: 'UN1824', expectedClass: '8' },
  { sku: 'KOH-45', name: 'Potassium Hydroxide 45%', expectedUN: 'UN1814', expectedClass: '8' },
  
  // Oxidizers
  { sku: 'HP-35', name: 'Hydrogen Peroxide 35%', expectedUN: 'UN2014', expectedClass: '5.1' },
  { sku: 'SH-12', name: 'Sodium Hypochlorite 12%', expectedUN: 'UN1791', expectedClass: '8' },
  { sku: 'BLEACH-5', name: 'Bleach 5%', expectedUN: null, expectedClass: null }, // Non-regulated
  
  // Complex/Ambiguous
  { sku: 'FC-40', name: 'Ferric Chloride Solution 40%', expectedUN: 'UN2582', expectedClass: '8' },
  { sku: 'DRAIN-1', name: 'Sulfuric Acid Drain Cleaner', expectedUN: 'UN1830', expectedClass: '8' },
  
  // Non-hazardous
  { sku: 'PG-99', name: 'Propylene Glycol 99%', expectedUN: null, expectedClass: null },
  { sku: 'GLY-99', name: 'Vegetable Glycerin USP', expectedUN: null, expectedClass: null },
];

interface TestResult {
  testCase: typeof testCases[0];
  jsonResult: any;
  databaseResult: any;
  enhancedResult: any;
  jsonTime: number;
  databaseTime: number;
  enhancedTime: number;
  jsonCorrect: boolean;
  databaseCorrect: boolean;
  enhancedCorrect: boolean;
}

async function runTest(testCase: typeof testCases[0]): Promise<TestResult> {
  console.log(`\nTesting: ${testCase.name} (${testCase.sku})`);
  console.log('Expected:', testCase.expectedUN || 'Non-regulated', testCase.expectedClass || 'N/A');
  
  // Test JSON RAG
  const jsonStart = Date.now();
  let jsonResult: any;
  try {
    jsonResult = await classifyWithRAG(testCase.sku, testCase.name);
  } catch (error) {
    console.error('JSON RAG failed:', error);
    jsonResult = { un_number: null, hazard_class: null, confidence: 0 };
  }
  const jsonTime = Date.now() - jsonStart;
  
  // Test Database RAG
  const dbStart = Date.now();
  let databaseResult: any;
  try {
    databaseResult = await classifyWithDatabaseRAG(testCase.sku, testCase.name);
  } catch (error) {
    console.error('Database RAG failed:', error);
    databaseResult = { un_number: null, hazard_class: null, confidence: 0 };
  }
  const databaseTime = Date.now() - dbStart;
  
  // Test Enhanced RAG (hybrid)
  const enhancedStart = Date.now();
  let enhancedResult: any;
  try {
    enhancedResult = await classifyWithEnhancedRAG(testCase.sku, testCase.name, {
      preferDatabase: true,
      enableTelemetry: false
    });
  } catch (error) {
    console.error('Enhanced RAG failed:', error);
    enhancedResult = { un_number: null, hazard_class: null, confidence: 0 };
  }
  const enhancedTime = Date.now() - enhancedStart;
  
  // Check correctness
  const jsonCorrect = (
    jsonResult.un_number === testCase.expectedUN &&
    jsonResult.hazard_class === testCase.expectedClass
  ) || (
    !testCase.expectedUN && 
    (!jsonResult.un_number || jsonResult.exemption_reason)
  );
  
  const databaseCorrect = (
    databaseResult.un_number === testCase.expectedUN &&
    databaseResult.hazard_class === testCase.expectedClass
  ) || (
    !testCase.expectedUN && 
    (!databaseResult.un_number || databaseResult.exemption_reason)
  );
  
  const enhancedCorrect = (
    enhancedResult.un_number === testCase.expectedUN &&
    enhancedResult.hazard_class === testCase.expectedClass
  ) || (
    !testCase.expectedUN && 
    (!enhancedResult.un_number || enhancedResult.exemption_reason)
  );
  
  // Print results
  console.log('Results:');
  console.log(`  JSON:     ${jsonResult.un_number || 'Non-reg'} Class ${jsonResult.hazard_class || 'N/A'} (${Math.round(jsonResult.confidence * 100)}% conf, ${jsonTime}ms) ${jsonCorrect ? '✅' : '❌'}`);
  console.log(`  Database: ${databaseResult.un_number || 'Non-reg'} Class ${databaseResult.hazard_class || 'N/A'} (${Math.round(databaseResult.confidence * 100)}% conf, ${databaseTime}ms) ${databaseCorrect ? '✅' : '❌'}`);
  console.log(`  Enhanced: ${enhancedResult.un_number || 'Non-reg'} Class ${enhancedResult.hazard_class || 'N/A'} (${Math.round(enhancedResult.confidence * 100)}% conf, ${enhancedTime}ms) ${enhancedCorrect ? '✅' : '❌'}`);
  
  return {
    testCase,
    jsonResult,
    databaseResult,
    enhancedResult,
    jsonTime,
    databaseTime,
    enhancedTime,
    jsonCorrect,
    databaseCorrect,
    enhancedCorrect
  };
}

async function main() {
  console.log('🧪 RAG System Comparison Test');
  console.log('=' .repeat(60));
  console.log('Comparing JSON vs Database vs Enhanced RAG performance\n');
  
  const results: TestResult[] = [];
  
  // Run all tests
  for (const testCase of testCases) {
    const result = await runTest(testCase);
    results.push(result);
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Calculate statistics
  const stats = {
    json: {
      correct: results.filter(r => r.jsonCorrect).length,
      avgTime: results.reduce((sum, r) => sum + r.jsonTime, 0) / results.length,
      avgConfidence: results.reduce((sum, r) => sum + r.jsonResult.confidence, 0) / results.length
    },
    database: {
      correct: results.filter(r => r.databaseCorrect).length,
      avgTime: results.reduce((sum, r) => sum + r.databaseTime, 0) / results.length,
      avgConfidence: results.reduce((sum, r) => sum + r.databaseResult.confidence, 0) / results.length
    },
    enhanced: {
      correct: results.filter(r => r.enhancedCorrect).length,
      avgTime: results.reduce((sum, r) => sum + r.enhancedTime, 0) / results.length,
      avgConfidence: results.reduce((sum, r) => sum + r.enhancedResult.confidence, 0) / results.length
    }
  };
  
  // Print summary
  console.log('\n' + '=' .repeat(60));
  console.log('📊 Test Summary');
  console.log('=' .repeat(60));
  
  console.log('\nAccuracy:');
  console.log(`  JSON RAG:     ${stats.json.correct}/${results.length} (${Math.round(stats.json.correct / results.length * 100)}%)`);
  console.log(`  Database RAG: ${stats.database.correct}/${results.length} (${Math.round(stats.database.correct / results.length * 100)}%)`);
  console.log(`  Enhanced RAG: ${stats.enhanced.correct}/${results.length} (${Math.round(stats.enhanced.correct / results.length * 100)}%)`);
  
  console.log('\nPerformance:');
  console.log(`  JSON RAG:     ${Math.round(stats.json.avgTime)}ms avg`);
  console.log(`  Database RAG: ${Math.round(stats.database.avgTime)}ms avg`);
  console.log(`  Enhanced RAG: ${Math.round(stats.enhanced.avgTime)}ms avg`);
  
  console.log('\nConfidence:');
  console.log(`  JSON RAG:     ${Math.round(stats.json.avgConfidence * 100)}% avg`);
  console.log(`  Database RAG: ${Math.round(stats.database.avgConfidence * 100)}% avg`);
  console.log(`  Enhanced RAG: ${Math.round(stats.enhanced.avgConfidence * 100)}% avg`);
  
  // Identify failed cases
  const failures = results.filter(r => !r.enhancedCorrect);
  if (failures.length > 0) {
    console.log('\n⚠️  Failed Classifications:');
    failures.forEach(f => {
      console.log(`  ${f.testCase.name}:`);
      console.log(`    Expected: ${f.testCase.expectedUN || 'Non-reg'} Class ${f.testCase.expectedClass || 'N/A'}`);
      console.log(`    Got:      ${f.enhancedResult.un_number || 'Non-reg'} Class ${f.enhancedResult.hazard_class || 'N/A'}`);
    });
  }
  
  // Recommendations
  console.log('\n💡 Recommendations:');
  if (stats.database.correct >= stats.json.correct && stats.database.avgTime < stats.json.avgTime * 2) {
    console.log('  ✅ Database RAG is ready for production use');
    console.log('  - Better or equal accuracy');
    console.log('  - Acceptable performance');
  } else if (stats.enhanced.correct > Math.max(stats.json.correct, stats.database.correct)) {
    console.log('  ✅ Enhanced RAG (hybrid) provides best accuracy');
    console.log('  - Use for critical classifications');
    console.log('  - Accept slightly higher latency for better results');
  } else {
    console.log('  ⚠️  Continue using JSON RAG for now');
    console.log('  - Database needs more training data');
    console.log('  - Consider adding more embeddings');
  }
  
  console.log('\n✨ Test complete!\n');
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}