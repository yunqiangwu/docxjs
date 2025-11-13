const { ChartToSvgConverter } = require('./src/chart/chart-to-svg.ts');
const fs = require('fs');
const path = require('path');

// Read the test XML file
const xmlPath = path.join(__dirname, 'src/chart/test-data/chart-bar.xml');
const xmlText = fs.readFileSync(xmlPath, 'utf8');

// Create a mock browser environment
const JSDOM = require('jsdom').JSDOM;
const dom = new JSDOM('<!DOCTYPE html>');

// Set up global window and document objects
global.window = dom.window;
global.document = dom.window.document;

// Already imported before DOM setup

try {
    // Initialize the converter
    const converter = new ChartToSvgConverter();
    
    // Render the SVG
    const svg = converter.convertToSvg(xmlText, { width: 800, height: 600 });
    
    // Convert SVG to string
    const svgString = svg.outerHTML;
    
    // Write SVG to a file for inspection
    const outputPath = path.join(__dirname, 'test-bar-chart-output.svg');
    fs.writeFileSync(outputPath, svgString);
    
    // Analyze the SVG structure
    const bars = svg.querySelectorAll('rect');
    const textElements = svg.querySelectorAll('text');
    
    console.log('=== Bar Chart Rendering Test ===');
    console.log('Input XML file:', xmlPath);
    console.log('Output SVG file:', outputPath);
    console.log('Rendered SVG successfully!');
    console.log('Number of bars:', bars.length);
    console.log('Number of text elements:', textElements.length);
    console.log('SVG structure:');
    console.log(svgString.slice(0, 500) + '...');
    
} catch (error) {
    console.error('ERROR:', error.message);
    console.error(error.stack);
}
