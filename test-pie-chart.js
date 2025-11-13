const { ChartToSvgConverter } = require('./dist/chart/chart-to-svg');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

// Create a mock browser environment
const dom = new JSDOM('<!DOCTYPE html>');

// Set up global window and document objects
global.window = dom.window;
global.document = dom.window.document;

// Read the pie chart test XML file
const xmlPath = path.join(__dirname, 'test-data/chart-pie.xml');
const xmlText = fs.readFileSync(xmlPath, 'utf8');

console.log('=== Testing Pie Chart XML Structure ===');
console.log('XML loaded successfully');
console.log('Contains pieChart:', xmlText.includes('<c:pieChart'));

// Render the chart
console.log('\n=== Rendering Pie Chart ===');
try {
    const converter = new ChartToSvgConverter();
    const svg = converter.convertToSvg(xmlText, { width: 800, height: 600 });
    
    // Convert SVG to string for inspection
    const svgString = svg.outerHTML;
    
    // Write SVG to a file
    const outputPath = path.join(__dirname, 'test-pie-chart-output.svg');
    fs.writeFileSync(outputPath, svgString);
    
    console.log('✅ Chart rendered successfully');
    console.log('Output SVG:', outputPath);
    console.log('SVG width:', svg.getAttribute('width'));
    console.log('SVG height:', svg.getAttribute('height'));
    
    // Check SVG structure
    const pieSlices = svg.querySelectorAll('path');
    const axisLines = svg.querySelectorAll('line');
    const axisLabels = svg.querySelectorAll('text');
    
    console.log('\n📊 SVG Analysis:');
    console.log('Total elements:', svg.childElementCount);
    console.log('Pie slices:', pieSlices.length);
    console.log('Axis lines:', axisLines.length);
    console.log('Text labels:', axisLabels.length);
    
    // Count only axis-related labels (ignore title and other text)
    let axisRelatedLabels = 0;
    axisLabels.forEach(label => {
        const y = parseInt(label.getAttribute('y') || '0');
        // Axis labels are typically at the bottom or left
        if (y > 550 || y < 100) {
            axisRelatedLabels++;
        }
    });
    
    console.log('Axis-related labels:', axisRelatedLabels);
    
    // Check if there are any axis elements
    const hasAxisElements = axisLines.length > 0 || axisRelatedLabels > 0;
    
    console.log('\n🔍 Verification Results:');
    console.log('Has axis lines:', axisLines.length > 0);
    console.log('Has axis labels:', axisRelatedLabels > 0);
    console.log('Overall has any axis elements:', hasAxisElements);
    
    if (!hasAxisElements) {
        console.log('✅ PASSED: Pie chart does not contain any axis elements!');
    } else {
        console.log('❌ FAILED: Pie chart still contains axis elements!');
    }
    
    // Log the SVG content for manual inspection
    console.log('\n=== SVG Content (First 500 chars) ===');
    console.log(svgString.substring(0, 500));
    console.log('...');
    
} catch (error) {
    console.error('❌ Error rendering chart:', error);
    if (error.stack) {
        console.error('Error stack:', error.stack);
    }
}