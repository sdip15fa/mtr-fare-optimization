import fs from 'fs';
import pdf from 'pdf-parse';

const pdfPath = '1_Metro_Fare_Matrix_FAM2024_Master_v3.pdf'; // Relative to project root

async function parsePdf() {
  try {
    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdf(dataBuffer);

    // Log the extracted text to the console
    console.log('--- PDF Text Start ---');
    console.log(data.text);
    console.log('--- PDF Text End ---');

    // You can add more processing here later to structure the data
    // For now, we just want to see the raw text output.

  } catch (error) {
    console.error('Error parsing PDF:', error);
  }
}

parsePdf();
