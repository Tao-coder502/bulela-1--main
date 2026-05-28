import dictionaryData from '../../dictionary.json';
import cibembaGrammarData from '../../data/cibemba-grammar.json';
import mathGrade9Data from '../../data/math-grade9-textbook.json';

// Interfaces
interface DictionaryEntry {
  term: string;
  definition: string;
}

interface TextbookSection {
  id: string;
  title: string;
  content: string;
  type: 'grammar' | 'mathematics';
  pageNumber?: number;
}

// Processed data
export const data = {
  dictionary: dictionaryData as DictionaryEntry[],
  textbooks: {
    cibemba: processTextbook(cibembaGrammarData, 'grammar'),
    mathematics: processTextbook(mathGrade9Data, 'mathematics')
  }
};

// Process textbook JSON into searchable sections
function processTextbook(rawData: any, type: 'grammar' | 'mathematics'): TextbookSection[] {
  const sections: TextbookSection[] = [];
  
  function processNode(node: any, path: string = ''): void {
    // Extract text content
    if (node.text && node.text.trim() && node.text.length > 30) {
      const title = extractTitle(node.text);
      sections.push({
        id: node.id || `section-${sections.length}`,
        title,
        content: node.text,
        type,
        pageNumber: extractPageNumber(node.id)
      });
    }
    
    // Extract HTML content
    if (node.html) {
      const textContent = extractTextFromHtml(node.html);
      if (textContent.length > 50) {
        const title = extractTitle(textContent);
        sections.push({
          id: node.id || `section-${sections.length}`,
          title,
          content: textContent,
          type,
          pageNumber: extractPageNumber(node.id)
        });
      }
    }
    
    // Process children recursively
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach((child: any) => processNode(child, path));
    }
  }
  
  processNode(rawData);
  return sections;
}

function extractTextFromHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTitle(text: string): string {
  const firstSentence = text.split(/[.!?]/)[0];
  return firstSentence.length > 50 
    ? firstSentence.substring(0, 50) + '...'
    : firstSentence;
}

function extractPageNumber(id: string): number | undefined {
  if (!id) return undefined;
  const match = id.match(/\/page\/(\d+)/);
  return match ? parseInt(match[1]) : undefined;
}

// Search functions
export const searchDictionary = (query: string): DictionaryEntry[] => {
  const lowercaseQuery = query.toLowerCase();
  return data.dictionary.filter(item => 
    item.term.toLowerCase().includes(lowercaseQuery) ||
    item.definition.toLowerCase().includes(lowercaseQuery)
  );
};

export const searchTextbooks = (query: string, type?: 'grammar' | 'mathematics'): TextbookSection[] => {
  const lowercaseQuery = query.toLowerCase();
  let sections: TextbookSection[] = [];
  
  if (!type || type === 'grammar') {
    sections.push(...data.textbooks.cibemba);
  }
  
  if (!type || type === 'mathematics') {
    sections.push(...data.textbooks.mathematics);
  }
  
  return sections.filter(section => 
    section.title.toLowerCase().includes(lowercaseQuery) ||
    section.content.toLowerCase().includes(lowercaseQuery)
  ).slice(0, 20); // Limit results
};

// Enhanced offline response
export const getOfflineResponse = (query: string): string | null => {
  // Try dictionary first
  const dictResults = searchDictionary(query);
  if (dictResults.length > 0) {
    return dictResults[0].definition;
  }
  
  // Try textbooks
  const textbookResults = searchTextbooks(query);
  if (textbookResults.length > 0) {
    const section = textbookResults[0];
    const preview = section.content.length > 300 
      ? section.content.substring(0, 300) + '...'
      : section.content;
    return `From ${section.type === 'grammar' ? 'Cibemba Grammar' : 'Mathematics Grade 9'}:\n\n${preview}`;
  }
  
  // Common patterns
  const patterns = {
    'bemba': 'I can help you with Bemba language! I have access to a comprehensive Cibemba grammar textbook.',
    'cibemba': 'Cibemba is one of Zambia\'s major languages. I have grammar resources to help you.',
    'algebra': 'Algebra uses letters to represent unknown values. We solve equations to find these values.',
    'geometry': 'Geometry studies shapes, sizes, and positions of figures used in construction and design.',
    'derivative': 'A derivative measures how fast something changes, like speed showing position change over time.',
    'integral': 'An integral adds up small pieces to find a total, like calculating area under a curve.'
  };
  
  const lowercaseQuery = query.toLowerCase();
  for (const [pattern, response] of Object.entries(patterns)) {
    if (lowercaseQuery.includes(pattern)) {
      return response;
    }
  }
  
  return null;
};

// Cache management
export const cacheResponse = (query: string, response: string): void => {
  const cacheKey = `bulela_cache_${query.toLowerCase()}`;
  localStorage.setItem(cacheKey, response);
};

export const getCachedResponse = (query: string): string | null => {
  const cacheKey = `bulela_cache_${query.toLowerCase()}`;
  return localStorage.getItem(cacheKey);
};

// Get specific content
export const getGrammarSections = (): TextbookSection[] => data.textbooks.cibemba;
export const getMathSections = (): TextbookSection[] => data.textbooks.mathematics;
