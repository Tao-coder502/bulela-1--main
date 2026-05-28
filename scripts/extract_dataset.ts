import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateDataset() {
  const dataset: any[] = [];
  const curriculumDir = path.join(__dirname, '..', 'curriculum');
  const dictionaryPath = path.join(__dirname, '..', 'dictionary.json');

  // 1. Process Curriculum Files
  try {
    const files = await fs.readdir(curriculumDir);
    for (const file of files) {
      if (file.endsWith('.md')) {
        const content = await fs.readFile(path.join(curriculumDir, file), 'utf-8');
        const topicId = path.basename(file, '.md');
        
        // Simple extraction logic: find headers and their content
        const sections = content.split('##');
        for (const section of sections) {
          const lines = section.trim().split('\n');
          const title = lines[0].trim();
          const body = lines.slice(1).join('\n').trim();
          
          if (title && body) {
            dataset.push({
              instruction: `Explain ${title} in the context of Grade 8/9 Zambian Math topic: ${topicId}`,
              context: body,
              response: `As Ba Yama, I would say: ${body.substring(0, 200)}... (etc)`,
              tags: ['curriculum', topicId]
            });
          }
        }
      }
    }
  } catch (e) {
    console.error("Curriculum extraction failed", e);
  }

  // 2. Process Dictionary
  try {
    const dictData = await fs.readFile(dictionaryPath, 'utf-8');
    const dictionary = JSON.parse(dictData);
    for (const entry of dictionary) {
      dataset.push({
        instruction: `What is the definition of "${entry.term}" in Zambian Math?`,
        response: entry.definition,
        tags: ['dictionary', 'glossary']
      });
    }
  } catch (e) {
    console.error("Dictionary extraction failed", e);
  }

  const outputPath = path.join(__dirname, '..', 'bulela_fine_tuning_dataset.json');
  await fs.writeFile(outputPath, JSON.stringify(dataset, null, 2));
  console.log(`Generated ${dataset.length} training pairs in ${outputPath}`);
}

generateDataset();