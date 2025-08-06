#!/usr/bin/env tsx
/**
 * Dead Code Detection Script
 * 
 * Finds unused imports, exports, and functions in the codebase
 */

import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import * as ts from 'typescript';

interface UnusedItem {
  file: string;
  line: number;
  type: 'import' | 'export' | 'function' | 'variable';
  name: string;
  code: string;
}

class DeadCodeDetector {
  private sourceFiles: Map<string, ts.SourceFile> = new Map();
  private usedIdentifiers: Set<string> = new Set();
  private unusedItems: UnusedItem[] = [];

  constructor(private rootDir: string) {}

  async analyze(): Promise<void> {
    console.log('🔍 Analyzing codebase for dead code...\n');

    // Step 1: Parse all TypeScript files
    await this.parseSourceFiles();

    // Step 2: Find all used identifiers
    this.findUsedIdentifiers();

    // Step 3: Find unused imports
    this.findUnusedImports();

    // Step 4: Find unused exports
    this.findUnusedExports();

    // Step 5: Report findings
    this.reportFindings();
  }

  private async parseSourceFiles(): Promise<void> {
    const pattern = path.join(this.rootDir, '**/*.{ts,tsx}');
    const files = glob.sync(pattern, {
      ignore: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/migrations/**'
      ]
    });

    console.log(`Found ${files.length} TypeScript files to analyze\n`);

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const sourceFile = ts.createSourceFile(
        file,
        content,
        ts.ScriptTarget.Latest,
        true
      );
      this.sourceFiles.set(file, sourceFile);
    }
  }

  private findUsedIdentifiers(): void {
    for (const [filePath, sourceFile] of this.sourceFiles) {
      const visit = (node: ts.Node) => {
        // Track identifier usage
        if (ts.isIdentifier(node)) {
          this.usedIdentifiers.add(node.text);
        }

        // Track property access
        if (ts.isPropertyAccessExpression(node)) {
          this.usedIdentifiers.add(node.name.text);
        }

        // Track JSX element usage
        if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
          const tagName = node.tagName;
          if (ts.isIdentifier(tagName)) {
            this.usedIdentifiers.add(tagName.text);
          }
        }

        ts.forEachChild(node, visit);
      };

      visit(sourceFile);
    }
  }

  private findUnusedImports(): void {
    for (const [filePath, sourceFile] of this.sourceFiles) {
      const fileContent = sourceFile.getFullText();
      const lines = fileContent.split('\n');

      ts.forEachChild(sourceFile, node => {
        if (ts.isImportDeclaration(node)) {
          const importClause = node.importClause;
          if (!importClause) return;

          // Check named imports
          if (importClause.namedBindings && ts.isNamedImports(importClause.namedBindings)) {
            for (const element of importClause.namedBindings.elements) {
              const importName = element.name.text;
              const isUsedInFile = this.isIdentifierUsedInFile(
                sourceFile, 
                importName, 
                node.pos
              );

              if (!isUsedInFile) {
                const line = this.getLineNumber(sourceFile, element.pos);
                this.unusedItems.push({
                  file: filePath,
                  line,
                  type: 'import',
                  name: importName,
                  code: `import { ${importName} } from ...`
                });
              }
            }
          }

          // Check default imports
          if (importClause.name) {
            const importName = importClause.name.text;
            const isUsedInFile = this.isIdentifierUsedInFile(
              sourceFile, 
              importName, 
              node.pos
            );

            if (!isUsedInFile) {
              const line = this.getLineNumber(sourceFile, node.pos);
              this.unusedItems.push({
                file: filePath,
                line,
                type: 'import',
                name: importName,
                code: lines[line - 1].trim()
              });
            }
          }
        }
      });
    }
  }

  private findUnusedExports(): void {
    const exportedItems = new Map<string, { file: string; line: number; code: string }>();

    // First pass: collect all exports
    for (const [filePath, sourceFile] of this.sourceFiles) {
      const fileContent = sourceFile.getFullText();
      const lines = fileContent.split('\n');

      ts.forEachChild(sourceFile, node => {
        // Check export declarations
        if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
          for (const element of node.exportClause.elements) {
            const exportName = element.name.text;
            const line = this.getLineNumber(sourceFile, element.pos);
            exportedItems.set(exportName, {
              file: filePath,
              line,
              code: `export { ${exportName} }`
            });
          }
        }

        // Check exported functions
        if (ts.isFunctionDeclaration(node) && node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
          if (node.name) {
            const line = this.getLineNumber(sourceFile, node.pos);
            exportedItems.set(node.name.text, {
              file: filePath,
              line,
              code: lines[line - 1].trim()
            });
          }
        }

        // Check exported variables
        if (ts.isVariableStatement(node) && node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
          for (const decl of node.declarationList.declarations) {
            if (ts.isIdentifier(decl.name)) {
              const line = this.getLineNumber(sourceFile, node.pos);
              exportedItems.set(decl.name.text, {
                file: filePath,
                line,
                code: lines[line - 1].trim()
              });
            }
          }
        }
      });
    }

    // Second pass: check if exports are used
    for (const [exportName, exportInfo] of exportedItems) {
      // Skip if it's in an index file (likely re-export)
      if (exportInfo.file.includes('/index.')) continue;

      // Skip if it's the default export or main entry point
      if (exportName === 'default' || exportName === 'app' || exportName === 'router') continue;

      // Check if it's imported anywhere
      let isImported = false;
      for (const [filePath, sourceFile] of this.sourceFiles) {
        if (filePath === exportInfo.file) continue; // Skip same file

        const content = sourceFile.getFullText();
        if (content.includes(exportName)) {
          isImported = true;
          break;
        }
      }

      if (!isImported) {
        this.unusedItems.push({
          file: exportInfo.file,
          line: exportInfo.line,
          type: 'export',
          name: exportName,
          code: exportInfo.code
        });
      }
    }
  }

  private isIdentifierUsedInFile(
    sourceFile: ts.SourceFile, 
    identifier: string, 
    afterPosition: number
  ): boolean {
    let isUsed = false;

    const visit = (node: ts.Node) => {
      if (node.pos <= afterPosition) return;

      if (ts.isIdentifier(node) && node.text === identifier) {
        isUsed = true;
        return;
      }

      if (ts.isPropertyAccessExpression(node) && node.name.text === identifier) {
        isUsed = true;
        return;
      }

      if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
          ts.isIdentifier(node.tagName) && node.tagName.text === identifier) {
        isUsed = true;
        return;
      }

      if (!isUsed) {
        ts.forEachChild(node, visit);
      }
    };

    visit(sourceFile);
    return isUsed;
  }

  private getLineNumber(sourceFile: ts.SourceFile, position: number): number {
    const lineAndChar = sourceFile.getLineAndCharacterOfPosition(position);
    return lineAndChar.line + 1;
  }

  private reportFindings(): void {
    if (this.unusedItems.length === 0) {
      console.log('✅ No dead code found!\n');
      return;
    }

    console.log(`⚠️  Found ${this.unusedItems.length} potentially unused items:\n`);

    // Group by file
    const byFile = new Map<string, UnusedItem[]>();
    for (const item of this.unusedItems) {
      const relativePath = path.relative(this.rootDir, item.file);
      if (!byFile.has(relativePath)) {
        byFile.set(relativePath, []);
      }
      byFile.get(relativePath)!.push(item);
    }

    // Sort files by number of issues
    const sortedFiles = Array.from(byFile.entries())
      .sort((a, b) => b[1].length - a[1].length);

    for (const [file, items] of sortedFiles) {
      console.log(`\n📄 ${file} (${items.length} items):`);
      
      // Sort items by line number
      items.sort((a, b) => a.line - b.line);
      
      for (const item of items) {
        console.log(`   Line ${item.line}: ${item.type} '${item.name}'`);
        console.log(`   ${item.code}`);
      }
    }

    // Summary
    console.log('\n📊 Summary:');
    const typeCount = new Map<string, number>();
    for (const item of this.unusedItems) {
      typeCount.set(item.type, (typeCount.get(item.type) || 0) + 1);
    }
    
    for (const [type, count] of typeCount) {
      console.log(`   - ${count} unused ${type}s`);
    }

    console.log('\n💡 Tip: Review these items carefully before removing them.');
    console.log('   Some may be used in ways not detected by static analysis.\n');
  }
}

// Run the detector
const detector = new DeadCodeDetector(path.join(__dirname, '..', 'src'));
detector.analyze().catch(console.error);