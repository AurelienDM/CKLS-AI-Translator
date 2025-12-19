/**
 * Multi-File Handler
 * Handles processing, validation, and deduplication of multiple files
 */

import { parseFile, detectLanguages, readColumnD } from './FileHandler';
import { extractTextAndBuildPlaceholders } from '@/utils/textExtraction';
import type { FileData, DeduplicationStats, FileExtraction } from '@/types/multiFile';

/**
 * Process multiple files and validate compatibility
 * @param fileArray - Array of File objects
 * @param languageNames - Language code to name mapping
 * @param fileName - Optional override for file name extraction
 * @returns Array of file data objects
 * @throws Error if files have different source languages
 */
export async function processMultipleFiles(
  fileArray: File[],
  languageNames: Record<string, string>
): Promise<FileData[]> {
  if (!fileArray || fileArray.length === 0) {
    throw new Error('No files provided');
  }

  const filesData: FileData[] = [];

  // Process each file
  for (const file of fileArray) {
    try {
      const workbook = await parseFile(file);
      const langData = detectLanguages(workbook, languageNames, file.name);

      filesData.push({
        fileName: file.name,
        workbook,
        sourceISO: langData.sourceISO,
        sourceCKLS: langData.sourceCKLS,
        existingLanguages: langData.existingLanguages,
        fileTitleRaw: langData.fileTitleRaw,
        fileTitleSlug: langData.fileTitleSlug,
        normalizedTitle: langData.normalizedTitle,
        isHomePage: langData.isHomePage
      });
    } catch (error: any) {
      throw new Error(`Failed to process ${file.name}: ${error.message}`);
    }
  }

  // Validate all files have the same source language
  const firstSource = filesData[0].sourceISO;
  const conflictingFiles = filesData.filter(f => f.sourceISO !== firstSource);

  if (conflictingFiles.length > 0) {
    const fileNames = conflictingFiles.map(f => f.fileName).join(', ');
    throw new Error(
      `All files must have the same source language. ` +
      `Expected ${firstSource.toUpperCase()}, but found different source in: ${fileNames}`
    );
  }

  return filesData;
}

/**
 * Calculate deduplication statistics across multiple files
 * @param filesData - Array of file data objects
 * @param doNotTranslate - Terms to skip
 * @returns Deduplication statistics
 */
export function calculateDeduplicationStats(
  filesData: FileData[],
  doNotTranslate: string[] = []
): DeduplicationStats {
  const fileExtractions = extractFromMultipleFiles(filesData, doNotTranslate);
  const stringMap = buildUniqueStringMap(fileExtractions);

  // Calculate totals
  const totalFiles = filesData.length;
  let totalStrings = 0;
  let totalCharacters = 0;

  fileExtractions.forEach(extraction => {
    totalStrings += extraction.extracted.length;
    extraction.extracted.forEach(item => {
      totalCharacters += item.extracted.length;
    });
  });

  const uniqueStrings = stringMap.size;
  const duplicateStrings = totalStrings - uniqueStrings;
  const deduplicationPercentage = totalStrings > 0
    ? Math.round((duplicateStrings / totalStrings) * 100)
    : 0;
  const savedApiCalls = duplicateStrings;

  // Calculate character savings
  let uniqueCharacters = 0;
  stringMap.forEach((_locations, text) => {
    uniqueCharacters += text.length;
  });
  const characterSavings = totalCharacters - uniqueCharacters;

  return {
    totalFiles,
    totalStrings,
    uniqueStrings,
    duplicateStrings,
    deduplicationPercentage,
    savedApiCalls,
    characterSavings
  };
}

/**
 * Extract texts from multiple files
 * @param filesData - Array of file data objects
 * @param doNotTranslate - Terms to skip
 * @returns Array of extraction results
 */
export function extractFromMultipleFiles(
  filesData: FileData[],
  doNotTranslate: string[] = []
): FileExtraction[] {
  return filesData.map((fileData, fileIndex) => {
    const rows = readColumnD(fileData.workbook);
    const { extracted, rebuilt } = extractTextAndBuildPlaceholders(rows, doNotTranslate);

    return {
      fileIndex,
      extracted,
      rebuilt
    };
  });
}

/**
 * Build a map of unique strings to their locations across files
 * @param fileExtractions - Array of extraction results
 * @returns Map of text to locations
 */
export function buildUniqueStringMap(fileExtractions: FileExtraction[]): Map<string, Array<{
  fileIndex: number;
  rowIndex: number;
  id: string;
}>> {
  const stringMap = new Map<string, Array<{
    fileIndex: number;
    rowIndex: number;
    id: string;
  }>>();

  fileExtractions.forEach((extraction) => {
    extraction.extracted.forEach(item => {
      const text = item.extracted;
      
      if (!stringMap.has(text)) {
        stringMap.set(text, []);
      }

      stringMap.get(text)!.push({
        fileIndex: extraction.fileIndex,
        rowIndex: item.rowIndex,
        id: item.id
      });
    });
  });

  return stringMap;
}

